from fastapi import APIRouter, Depends, Request, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.config.database import get_db
from app.config.settings import settings
from app.schemas.user import (
    UserLogin,
    TokenResponse,
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest,
    UnlockAccountRequest,
    OTPResponse,
    DropdownResponse,
    RefreshTokenRequest
)
from app.services.auth_service import auth_service
from app.models.user import User

router = APIRouter()

def get_client_ip(request: Request) -> str:
    """Helper to extract client IP address including reverse proxy headers"""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # Get the first IP in the list (the actual client IP)
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return "127.0.0.1"

@router.post("/login", response_model=TokenResponse)
async def login(request: Request, credentials: UserLogin, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    ip_address = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "Unknown")
    auth_data = auth_service.authenticate_user(
        user_id=credentials.user_id,
        password=credentials.password,
        db=db,
        ip_address=ip_address,
        user_agent=user_agent,
        force=credentials.force,
        background_tasks=background_tasks
    )
    
    # Pre-fetch bootstrap data so that the frontend gets ALL data instantly upon login click!
    user = db.query(User).filter(User.user_id == credentials.user_id).first()
    if user:
        try:
            auth_data["bootstrap_data"] = await get_bootstrap_data_helper(user, db)
        except Exception as e:
            bootstrap_logger.error(f"Failed to pre-fetch bootstrap data during login: {e}")
            auth_data["bootstrap_data"] = None

        # Trigger full KV prefill as background task when any privileged user logs in.
        # This mirrors all DB tables to Cloudflare KV so future requests have 0 DB reads.
        PREFILL_ROLES = {"Admin", "Super Admin", "admin", "super_admin", "Zonal Manager"}
        user_role = (user.role or "").strip()
        if user_role in PREFILL_ROLES:
            try:
                from app.utils.kv_prefill import prefill_all_kv
                background_tasks.add_task(prefill_all_kv, db)
                bootstrap_logger.info(f"KV Prefill: background task scheduled for user {user.user_id} (role={user_role})")
            except Exception as e:
                bootstrap_logger.warning(f"KV Prefill: failed to schedule background task: {e}")

    return auth_data


@router.post("/forgot-password", response_model=OTPResponse)
async def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    return auth_service.forgot_password(
        user_id=request.user_id,
        dob_str=request.date_of_birth,
        db=db,
        background_tasks=background_tasks
    )

@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    success = auth_service.verify_otp(
        user_id=request.user_id,
        otp=request.otp,
        otp_type=request.otp_type,
        db=db,
        delete_after_verify=False
    )
    return {"success": success, "message": "OTP verified successfully."}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    return auth_service.reset_password(
        user_id=request.user_id,
        otp=request.otp,
        new_password=request.new_password,
        confirm_password=request.confirm_password,
        db=db
    )

@router.post("/unlock-account", response_model=OTPResponse)
async def unlock_account(request: UnlockAccountRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    return auth_service.unlock_account(
        user_id=request.user_id,
        doj_str=request.date_of_joining,
        dob_str=request.date_of_birth,
        db=db,
        background_tasks=background_tasks
    )

@router.post("/unlock-verify-otp")
async def unlock_verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    return auth_service.unlock_verify_otp(
        user_id=request.user_id,
        otp=request.otp,
        db=db
    )

@router.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                user = db.query(User).filter(User.user_id == user_id).first()
                if user:
                    user.active_session_id = None
                    db.commit()
        except Exception:
            pass
    return {"success": True, "message": "Logged out successfully"}



@router.post("/refresh")
async def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(
            request.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        token_type = payload.get("type")
        token_sid = payload.get("sid")
        
        if not user_id or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
            
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user or user.user_status != "active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive or not found"
            )

        # Validate that the refresh token matches the user's current active session.
        # If the user has been force logged out, active_session_id is set to None (or another session's ID).
        if not user.active_session_id or user.active_session_id != token_sid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been terminated by administrator."
            )

        from app.utils.security import create_access_token, create_refresh_token
        new_access = create_access_token(data={"sub": user.user_id, "sid": user.active_session_id})
        new_refresh = create_refresh_token(data={"sub": user.user_id, "sid": user.active_session_id})
        
        from app.schemas.user import UserResponse
        return {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "user": UserResponse.model_validate(user)
        }
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@router.get("/dropdowns", response_model=DropdownResponse)
async def get_dropdowns(db: Session = Depends(get_db)):
    return auth_service.get_dropdowns(db)

from app.api.routes.dependencies import get_current_user
from datetime import datetime
import asyncio
import logging

bootstrap_logger = logging.getLogger(__name__)

async def get_bootstrap_data_helper(user, db: Session) -> dict:
    """Fetch all bootstrap data concurrently using asyncio.gather for maximum speed."""
    from app.api.routes.expense import init_expense, get_expenses, get_team_expenses
    from app.api.routes.approval import get_pending_approvals
    from app.models.approval_hierarchy import HierarchyApprover
    from app.config.database import SessionLocal
    from fastapi.encoders import jsonable_encoder
    from sqlalchemy import func
    
    month_str = datetime.now().isoformat()[:7]
    
    # Pre-calculate is_team_lead using main db session (2 fast indexed queries)
    allowed_windows = user.allowed_windows.split(",") if user.allowed_windows else []
    allowed_windows = [w.strip().lower() for w in allowed_windows]
    name_clean = user.name.strip()
    uid_clean = user.user_id.strip()
    
    has_direct_reports = db.query(User).filter(
        (User.manager.ilike(name_clean)) | (User.manager.ilike(uid_clean)) |
        (User.coordinator.ilike(name_clean)) | (User.coordinator.ilike(uid_clean)) |
        (User.zonal_manager.ilike(name_clean)) | (User.zonal_manager.ilike(uid_clean))
    ).first() is not None
    
    is_hierarchy_approver = db.query(HierarchyApprover).filter(
        HierarchyApprover.approver_id == user.id
    ).first() is not None
    
    is_team_lead = (
        user.role == "Admin" or
        "approval" in allowed_windows or
        has_direct_reports or
        is_hierarchy_approver
    )

    # Define concurrent fetch helpers — each creates its own DB session
    async def fetch_dropdowns():
        sess = SessionLocal()
        try:
            return auth_service.get_dropdowns(sess)
        except Exception as e:
            bootstrap_logger.error(f"Bootstrap get_dropdowns error: {e}")
            return {}
        finally:
            sess.close()

    async def fetch_init():
        sess = SessionLocal()
        try:
            return await init_expense(user_id=user.user_id, month=month_str, db=sess, current_user=user)
        except Exception as e:
            bootstrap_logger.error(f"Bootstrap init_expense error: {e}")
            return {}
        finally:
            sess.close()

    async def fetch_my_expenses():
        sess = SessionLocal()
        try:
            return await get_expenses(db=sess, current_user=user)
        except Exception as e:
            bootstrap_logger.error(f"Bootstrap get_expenses error: {e}")
            return []
        finally:
            sess.close()

    async def fetch_team_expenses():
        if not is_team_lead:
            return []
        sess = SessionLocal()
        try:
            return await get_team_expenses(db=sess, current_user=user)
        except Exception as e:
            bootstrap_logger.error(f"Bootstrap get_team_expenses error: {e}")
            return []
        finally:
            sess.close()

    async def fetch_pending_approvals():
        if not is_team_lead:
            return []
        sess = SessionLocal()
        try:
            raw = await get_pending_approvals(db=sess, current_user=user)
            return jsonable_encoder(raw)
        except Exception as e:
            bootstrap_logger.error(f"Bootstrap get_pending_approvals error: {e}")
            return []
        finally:
            sess.close()

    # Fire all 5 fetches concurrently
    dropdowns, expense_init, my_expenses, team_expenses, pending_approvals = await asyncio.gather(
        fetch_dropdowns(),
        fetch_init(),
        fetch_my_expenses(),
        fetch_team_expenses(),
        fetch_pending_approvals()
    )

    # Compute allowance stats from expense_init result
    allowance_stats = None
    if expense_init and expense_init.get("allowance"):
        allowance = expense_init["allowance"]
        allowance_stats = {
            "currentKm": allowance.get("current_month_km") or 0.0,
            "maxKm": (allowance.get("max_km_per_month") or 2000.0) + (expense_init.get("approved_km") or 0.0),
            "currentAuto": allowance.get("current_month_auto") or 0.0,
            "maxAuto": (allowance.get("max_auto_per_month") or 1000.0) + (expense_init.get("approved_auto") or 0.0),
            "vehicleType": allowance.get("vehicle_type") or "Bike",
            "rateBike": allowance.get("rate_bike") or 4.5,
            "rateCar": allowance.get("rate_car") or 9.0
        }

    return {
        "dropdowns": dropdowns,
        "expense_init": expense_init,
        "my_expenses": my_expenses,
        "allowance_stats": allowance_stats,
        "team_expenses": team_expenses,
        "pending_approvals": pending_approvals,
        "pending_approvals_count": len(pending_approvals)
    }

@router.get("/bootstrap")
async def bootstrap(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await get_bootstrap_data_helper(current_user, db)


@router.post("/prefill-kv")
async def trigger_kv_prefill(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger a full KV prefill from the database.
    Only accessible by Admin/Super Admin roles.
    The prefill runs in the background — response returns immediately.
    """
    PREFILL_ROLES = {"Admin", "Super Admin", "admin", "super_admin"}
    user_role = (current_user.role or "").strip()
    if user_role not in PREFILL_ROLES:
        raise HTTPException(status_code=403, detail="Access denied. Admin role required.")

    from app.utils.kv_prefill import prefill_all_kv
    background_tasks.add_task(prefill_all_kv, db)
    return {
        "success": True,
        "message": "KV prefill started in background. All table data will be mirrored to Cloudflare KV shortly."
    }
