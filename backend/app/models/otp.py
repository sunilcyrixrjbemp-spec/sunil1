from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.config.database import Base

class OTP(Base):
    __tablename__ = "otps"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(50), index=True, nullable=False)
    otp_code = Column(String(255), nullable=False)  # SHA256 hashed OTP code
    otp_type = Column(String(50), nullable=False)  # reset_password, unlock_account
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
