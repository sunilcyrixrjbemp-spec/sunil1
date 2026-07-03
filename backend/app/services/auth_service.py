import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from fastapi import HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.user import User
from app.models.password_history import PasswordHistory
from app.models.login_log import LoginLog
from app.models.otp import OTP
from app.config.settings import settings
from app.utils.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    generate_otp,
    hash_otp,
    verify_otp,
    validate_password_strength,
    check_password_history
)
from app.utils.constants import DESIGNATIONS, ZONE_DISTRICTS, ROLES
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

class AuthService:
    def authenticate_user(self, user_id: str, password: str, db: Session, ip_address: str, user_agent: str, force: bool = False, background_tasks = None) -> Dict[str, Any]:
        # 1. Find user
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            # We log failed attempt for non-existent users without incrementing a specific counter
            self._log_login(db, user_id, ip_address, user_agent, "failed", background_tasks=background_tasks)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid User ID or Password"
            )

        # 2. Check user status
        if user.user_status == "disabled":
            self._log_login(db, user_id, ip_address, user_agent, "failed", background_tasks=background_tasks)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is disabled. Please contact the administrator."
            )
            
        if user.user_status == "locked":
            self._log_login(db, user_id, ip_address, user_agent, "locked", background_tasks=background_tasks)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is locked due to multiple failed login attempts. Please use the Unlock Account option."
            )

        # 3. Verify password
        password_correct = verify_password(password, user.hashed_password)
        
        if not password_correct:
            # Increment failed attempts
            user.failed_attempt += 1
            db.commit()
            
            # Check lock threshold
            if user.failed_attempt >= settings.MAX_FAILED_ATTEMPTS:
                user.user_status = "locked"
                db.commit()
                self._log_login(db, user_id, ip_address, user_agent, "locked", background_tasks=background_tasks)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account has been locked due to 5 failed login attempts. Please unlock it using your registered details."
                )
            
            self._log_login(db, user_id, ip_address, user_agent, "failed", background_tasks=background_tasks)
            attempts_left = settings.MAX_FAILED_ATTEMPTS - user.failed_attempt
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid User ID or Password. {attempts_left} attempts remaining before account lock."
            )

        # 4. Single session validation
        if user.active_session_id and not force:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ALREADY_LOGGED_IN"
            )

        # 5. Successful login - generate new active session ID
        import uuid
        session_id = str(uuid.uuid4())
        user.active_session_id = session_id
        user.failed_attempt = 0
        db.commit()
        
        self._log_login(db, user_id, ip_address, user_agent, "success", background_tasks=background_tasks)
        
        # Create tokens with sid (session ID) payload
        access_token = create_access_token(data={"sub": user.user_id, "sid": session_id})
        refresh_token = create_refresh_token(data={"sub": user.user_id, "sid": session_id})
        
        # Resolve manager/zonal_manager/coordinator names if they contain e_codes
        self.resolve_user_hierarchy_names(user, db)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user
        }

    def forgot_password(self, user_id: str, dob_str: str, db: Session, background_tasks: BackgroundTasks = None) -> Dict[str, str]:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User ID not registered"
            )
            
        try:
            input_dob = datetime.strptime(dob_str, "%d-%m-%Y").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Date of Birth format. Use DD-MM-YYYY format."
            )

        if user.date_of_birth != input_dob:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification failed. Provided Date of Birth does not match our records."
            )
            
        if user.user_status == "disabled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account is disabled. Password reset is not permitted."
            )

        if not user.mail_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No registered email address found for this user. Please contact Admin."
            )

        # Generate and save OTP
        otp_code = generate_otp()
        hashed_otp = hash_otp(otp_code)
        expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        
        # Save to DB
        otp_entry = OTP(
            user_id=user.user_id,
            otp_code=hashed_otp,
            otp_type="reset_password",
            expires_at=expires_at,
            is_used=False
        )
        db.add(otp_entry)
        db.commit()

        # Send via email (asynchronous if background_tasks is available)
        if background_tasks:
            background_tasks.add_task(
                email_service.send_otp_email,
                to_email=user.mail_id,
                user_name=user.name,
                otp=otp_code,
                purpose="password_reset"
            )
        else:
            email_sent = email_service.send_otp_email(
                to_email=user.mail_id,
                user_name=user.name,
                otp=otp_code,
                purpose="password_reset"
            )
            if not email_sent and settings.GAS_WEB_APP_URL:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to send OTP email. Please try again later."
                )

        return {
            "message": "OTP sent successfully to your registered email address.",
            "masked_email": self._mask_email(user.mail_id)
        }

    def verify_otp(self, user_id: str, otp: str, otp_type: str, db: Session, delete_after_verify: bool = True) -> bool:
        # Delete expired OTPs for this user first
        db.query(OTP).filter(
            OTP.user_id == user_id,
            datetime.utcnow() > OTP.expires_at
        ).delete(synchronize_session=False)
        db.commit()

        # Find latest unused OTP for user + type
        otp_entry = db.query(OTP).filter(
            OTP.user_id == user_id,
            OTP.otp_type == otp_type
        ).order_by(desc(OTP.created_at)).first()

        if not otp_entry:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No pending OTP found for this user."
            )

        if not verify_otp(otp, otp_entry.otp_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OTP code. Please enter the correct code."
            )

        # Delete the OTP entry from database completely upon verification if requested
        if delete_after_verify:
            db.delete(otp_entry)
            db.commit()
        return True

    def reset_password(self, user_id: str, otp: str, new_password: str, confirm_password: str, db: Session) -> Dict[str, str]:
        # Validate OTP first to secure password reset endpoint against bypass attempts
        self.verify_otp(user_id, otp, "reset_password", db)

        if new_password != confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Passwords do not match."
            )

        # Validate password strength
        strength = validate_password_strength(new_password)
        if not strength["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="; ".join(strength["errors"])
            )

        # Find user
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Check password history (last 5)
        history_records = db.query(PasswordHistory).filter(
            PasswordHistory.user_id == user.id
        ).order_by(desc(PasswordHistory.created_at)).limit(settings.PASSWORD_HISTORY_COUNT).all()
        
        history_hashes = [h.hashed_password for h in history_records]
        
        # Include current password in checking
        history_hashes.append(user.hashed_password)
        
        if check_password_history(new_password, history_hashes):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password cannot be same as any of the last 5 passwords."
            )

        # Update password
        hashed_new_password = get_password_hash(new_password)
        
        # Add to history
        history_entry = PasswordHistory(
            user_id=user.id,
            hashed_password=user.hashed_password  # Store old password in history
        )
        db.add(history_entry)
        
        user.hashed_password = hashed_new_password
        user.failed_attempt = 0
        if user.user_status == "locked":
            user.user_status = "active"
            
        db.commit()

        return {"message": "Password reset successfully. You can now login with your new password."}

    def unlock_account(self, user_id: str, doj_str: str, dob_str: str, db: Session, background_tasks: BackgroundTasks = None) -> Dict[str, str]:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User ID not registered"
            )

        # Check status
        if user.user_status == "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your account is already active and unlocked. Please sign in directly."
            )

        if user.user_status == "disabled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account is disabled. Please contact the administrator."
            )

        # Parse and verify DOJ & DOB
        try:
            input_doj = datetime.strptime(doj_str, "%d-%m-%Y").date()
            input_dob = datetime.strptime(dob_str, "%d-%m-%Y").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use DD-MM-YYYY format."
            )

        if user.date_of_joining != input_doj or user.date_of_birth != input_dob:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification failed. Provided Date of Joining or Date of Birth does not match our records."
            )

        if not user.mail_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No registered email address found. Please contact Admin."
            )

        # Generate OTP
        otp_code = generate_otp()
        hashed_otp = hash_otp(otp_code)
        expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

        otp_entry = OTP(
            user_id=user.user_id,
            otp_code=hashed_otp,
            otp_type="unlock_account",
            expires_at=expires_at,
            is_used=False
        )
        db.add(otp_entry)
        db.commit()

        # Send via email (asynchronous if background_tasks is available)
        if background_tasks:
            background_tasks.add_task(
                email_service.send_otp_email,
                to_email=user.mail_id,
                user_name=user.name,
                otp=otp_code,
                purpose="account_unlock"
            )
        else:
            email_sent = email_service.send_otp_email(
                to_email=user.mail_id,
                user_name=user.name,
                otp=otp_code,
                purpose="account_unlock"
            )
            if not email_sent and settings.GAS_WEB_APP_URL:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to send OTP email. Please try again later."
                )

        return {
            "message": "Verification successful. OTP sent to your registered email address.",
            "masked_email": self._mask_email(user.mail_id)
        }

    def unlock_verify_otp(self, user_id: str, otp: str, db: Session) -> Dict[str, str]:
        # Verify OTP
        self.verify_otp(user_id, otp, "unlock_account", db)
        
        # Unlock account
        user = db.query(User).filter(User.user_id == user_id).first()
        if user:
            user.user_status = "active"
            user.failed_attempt = 0
            db.commit()
            return {"message": "Account unlocked successfully. You can now login."}
            
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    def get_dropdowns(self, db: Session) -> Dict[str, Any]:
        from app.utils import cache
        cached = cache.get("global_dropdowns")
        if cached:
            return cached

        from app.models.allowance_master import AllowanceMaster
        grades_query = db.query(AllowanceMaster.grade).distinct().all()
        grades = [g[0] for g in grades_query if g[0]]
        grades = sorted(list(set(grades)))
        if not grades:
            grades = ["A", "B", "C", "D"]
        res = {
            "designations": DESIGNATIONS,
            "zones": ZONE_DISTRICTS,
            "roles": ROLES,
            "grades": grades
        }
        cache.set("global_dropdowns", res)
        return res

    def resolve_user_hierarchy_names(self, user: User, db: Session) -> User:
        """Resolves manager, zonal_manager, and coordinator e_codes/user_ids to their actual User Names.
        Uses case-insensitive matching on user_id, e_code, and name fields.
        Detaches the user from the session to safely mutate fields without triggering ORM flush."""
        try:
            from sqlalchemy.orm import make_transient
            from sqlalchemy import func as sa_func
            from app.utils import cache
            db.expunge(user)
            make_transient(user)
            
            for field in ['manager', 'zonal_manager', 'coordinator']:
                val = getattr(user, field, None)
                if not val or not val.strip():
                    continue
                val_lower = val.strip().lower()
                
                cache_key = f"resolved_name:{val_lower}"
                cached_name = cache.get(cache_key)
                if cached_name is not None:
                    setattr(user, field, cached_name)
                    continue
                
                # Try to find user by user_id, e_code, or name (case-insensitive)
                resolved = db.query(User.name).filter(
                    (sa_func.lower(User.user_id) == val_lower) |
                    (sa_func.lower(User.e_code) == val_lower) |
                    (sa_func.lower(User.name) == val_lower)
                ).first()
                if resolved and resolved.name:
                    setattr(user, field, resolved.name)
                    cache.set(cache_key, resolved.name)
                else:
                    cache.set(cache_key, val)
        except Exception as e:
            logger.error(f"Error resolving user hierarchy names: {str(e)}")
        return user

    def _log_login(self, db: Session, user_id: str, ip_address: str, user_agent: str, status: str, background_tasks = None):
        if background_tasks:
            background_tasks.add_task(self._log_login_bg_worker, user_id, ip_address, user_agent, status)
            return

        try:
            log = LoginLog(
                user_id=user_id,
                ip_address=ip_address,
                user_agent=user_agent,
                login_status=status
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Error logging login: {str(e)}")
            db.rollback()

    def _log_login_bg_worker(self, user_id: str, ip_address: str, user_agent: str, status: str):
        from app.config.database import SessionLocal
        db = SessionLocal()
        try:
            log = LoginLog(
                user_id=user_id,
                ip_address=ip_address,
                user_agent=user_agent,
                login_status=status
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Error in background login logging: {str(e)}")
            db.rollback()
        finally:
            db.close()

    def _mask_email(self, email: str) -> str:
        try:
            parts = email.split("@")
            name, domain = parts[0], parts[1]
            if len(name) <= 2:
                masked_name = name[0] + "*" * (len(name) - 1)
            else:
                masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
            return f"{masked_name}@{domain}"
        except Exception:
            return email

auth_service = AuthService()
