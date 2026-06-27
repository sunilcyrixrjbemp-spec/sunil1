from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.utils.push_notifications import send_push_to_user_by_code
import logging

logger = logging.getLogger(__name__)

def create_notification(
    db: Session,
    user_id: str,
    title: str,
    description: str,
    notification_type: str = "info",
    link: str = None
):
    """
    Creates a persistent notification in the database for a user
    and triggers a native Firebase push notification if enrolled.
    """
    try:
        # 1. Save to SQLite database
        db_notif = Notification(
            user_id=user_id,
            title=title,
            description=description,
            type=notification_type,
            link=link
        )
        db.add(db_notif)
        db.commit()
        db.refresh(db_notif)
        logger.info(f"Database notification created for user {user_id}: {title}")
        
        # 2. Trigger FCM push notification
        send_push_to_user_by_code(
            user_code=user_id,
            title=title,
            body=description,
            data={"type": notification_type, "link": link or "/home"}
        )
        
        return db_notif
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create notification for user {user_id}: {e}")
        return None
