from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.config.database import Base

class UserRole(Base):
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)  # Admin, Engineer, Manager, etc.
    assigned_at = Column(DateTime, server_default=func.now())
    
    # Relationship to user
    user = relationship("User", back_populates="roles")
