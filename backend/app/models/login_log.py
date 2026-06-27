from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.config.database import Base

class LoginLog(Base):
    __tablename__ = "login_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(50), index=True, nullable=False)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    login_status = Column(String(20), nullable=False)  # success, failed, locked
    created_at = Column(DateTime, server_default=func.now())
