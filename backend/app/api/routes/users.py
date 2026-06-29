import os
import re
import logging
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional

from app.config.database import get_db
from app.api.routes.dependencies import get_current_user
from app.models.user import User
from app.models.password_history import PasswordHistory
from app.schemas.user import UserResponse, ProfileUpdateRequest, ChangePasswordRequest
from app.services.auth_service import auth_service
from app.utils.security import (
    verify_password,
    get_password_hash,
    validate_password_strength,
    check_password_history
)

logger = logging.getLogger(__name__)
router = APIRouter()

class FCMTokenRequest(BaseModel):
    fcm_token: str

@router.post("/fcm-token")
async def save_fcm_token(
    request: FCMTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save or update the user's FCM push notification token"""
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db_user.fcm_token = request.fcm_token
    db.commit()
    logger.info(f"FCM token saved for user {current_user.user_id}")
    return {"status": "success", "message": "FCM token saved"}


@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get authenticated user profile"""
    return auth_service.resolve_user_hierarchy_names(current_user, db)

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile (mobile number, email ID)"""
    # Fetch from database to ensure it is session-attached for updates
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if request.mobile_number is not None:
        mobile = request.mobile_number.strip()
        # Allow empty or valid format
        if mobile and not re.match(r"^\+?[0-9\- \(\)]{7,20}$", mobile):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid mobile number format"
            )
        db_user.mobile_number = mobile if mobile else None
        
    if request.mail_id is not None:
        email = request.mail_id.strip()
        if email and not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email address format"
            )
        db_user.mail_id = email if email else None
        
    db.commit()
    from app.utils import cache
    cache.delete(f"auth_user:{db_user.user_id}")
    db.refresh(db_user)
    logger.info(f"User {db_user.user_id} updated profile details.")
    return auth_service.resolve_user_hierarchy_names(db_user, db)

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change password for authenticated user with security history validation"""
    # Fetch fresh from database for updates
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Verify old password
    if not verify_password(request.old_password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
        
    # 2. Check if new password matches old password
    if request.new_password == request.old_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password"
        )
        
    # 3. Verify confirmation matches
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation password do not match"
        )
        
    # 4. Validate password strength
    strength = validate_password_strength(request.new_password)
    if not strength["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(strength["errors"])
        )
        
    # 5. Check password history (last 5 passwords)
    history_entries = db.query(PasswordHistory)\
        .filter(PasswordHistory.user_id == db_user.id)\
        .order_by(desc(PasswordHistory.created_at))\
        .limit(5)\
        .all()
    history_hashes = [h.hashed_password for h in history_entries]
    
    if check_password_history(request.new_password, history_hashes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot reuse any of your last 5 passwords."
        )
        
    # 6. Hash new password and update database
    new_hash = get_password_hash(request.new_password)
    db_user.hashed_password = new_hash
    
    # 7. Write to password history
    new_history = PasswordHistory(
        user_id=db_user.id,
        hashed_password=new_hash
    )
    db.add(new_history)
    db.commit()
    from app.utils import cache
    cache.delete(f"auth_user:{db_user.user_id}")
    
    logger.info(f"User {db_user.user_id} successfully changed password.")
    return {"status": "success", "message": "Password has been updated successfully."}

@router.post("/profile/photo", response_model=UserResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload user profile photo to Google Drive and update profile_pic_url"""
    # 1. Validate file format (strictly JPG, JPEG, PNG - no PDFs for profile picture)
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, JPEG, and PNG files are allowed for profile pictures."
        )
        
    # 2. Validate file size (max 2MB)
    from app.config.settings import settings
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the limit of {settings.MAX_UPLOAD_SIZE / (1024 * 1024):.0f}MB."
        )
        
    # 3. Read bytes and upload to Google Drive
    try:
        file_bytes = file.file.read()
        
        # Safe filename
        safe_name = os.path.basename(file.filename).replace(" ", "_")
        drive_filename = f"profile_{current_user.user_id}_{safe_name}"
        
        from app.utils.gdrive import upload_profile_pic_to_drive
        file_id = upload_profile_pic_to_drive(
            file_content=file_bytes,
            filename=drive_filename,
            mime_type=file.content_type or "image/jpeg"
        )
        
        profile_url = f"/api/upload/file/gdrive/{file_id}"
        
        # 4. Update in Database
        db_user = db.query(User).filter(User.id == current_user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        db_user.profile_pic_url = profile_url
        db.commit()
        
        # Clear auth cache so the updated user details reflect instantly everywhere
        from app.utils import cache
        cache.delete(f"auth_user:{db_user.user_id}")
        db.refresh(db_user)
        
        logger.info(f"User {db_user.user_id} updated profile picture: {profile_url}")
        return auth_service.resolve_user_hierarchy_names(db_user, db)
    except Exception as err:
        logger.error(f"Failed to upload profile photo: {str(err)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile photo to Google Drive: {str(err)}"
        )
