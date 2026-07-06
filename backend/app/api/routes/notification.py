from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.config.database import get_db, get_read_db
from app.api.routes.dependencies import get_current_user
from app.models.user import User
from app.models.notification import Notification
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class NotificationResponse(BaseModel):
    id: int
    user_id: str
    title: str
    description: str
    type: str
    read: bool
    link: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_read_db)
):
    """Retrieve notifications for the current authenticated user"""
    return db.query(Notification).filter(
        Notification.user_id == current_user.user_id
    ).order_by(Notification.created_at.desc()).all()

@router.post("/{id}/read")
def mark_notification_as_read(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a specific notification as read"""
    notif = db.query(Notification).filter(
        Notification.id == id,
        Notification.user_id == current_user.user_id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read = True
    db.commit()
    return {"status": "success", "message": "Notification marked as read"}

@router.post("/read-all")
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications of the current user as read"""
    db.query(Notification).filter(
        Notification.user_id == current_user.user_id,
        Notification.read == False
    ).update({Notification.read: True}, synchronize_session=False)
    db.commit()
    return {"status": "success", "message": "All notifications marked as read"}

@router.delete("/{id}")
def delete_notification(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notification"""
    notif = db.query(Notification).filter(
        Notification.id == id,
        Notification.user_id == current_user.user_id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return {"status": "success", "message": "Notification deleted"}
