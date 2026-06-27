from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.config.database import Base

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(50), index=True, nullable=False)  # User receiving the notification (employee code)
    title = Column(String(200), nullable=False)
    description = Column(String(1000), nullable=False)
    type = Column(String(50), default="info")  # warning, success, error, info
    read = Column(Boolean, default=False)
    link = Column(String(200), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
