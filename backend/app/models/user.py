from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.config.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(50), unique=True, index=True, nullable=False)
    e_code = Column(String(50), nullable=True)
    name = Column(String(200), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    user_status = Column(String(20), default="active")  # active, locked, disabled
    date_of_joining = Column(Date, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    e_upkaran_id = Column(String(100), nullable=True)
    grade = Column(String(50), nullable=True)
    district = Column(String(100), nullable=True)
    zone = Column(String(100), nullable=True)
    manager = Column(String(200), nullable=True)
    zonal_manager = Column(String(200), nullable=True)
    coordinator = Column(String(200), nullable=True)
    failed_attempt = Column(Integer, default=0)
    mobile_number = Column(String(20), nullable=True)
    mail_id = Column(String(200), nullable=True)
    designation = Column(String(200), nullable=True)
    role = Column(String(50), default="Engineer")
    type = Column(String(100), nullable=True)
    allowed_windows = Column(String(500), default="home,approval,expense,analysis,report,help,profile")
    active_session_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
