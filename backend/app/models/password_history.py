from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.config.database import Base

class PasswordHistory(Base):
    __tablename__ = "password_histories"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
