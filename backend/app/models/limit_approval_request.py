from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.config.database import Base

class LimitApprovalRequest(Base):
    __tablename__ = "limit_approval_requests"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(50), nullable=False)
    manager_id = Column(String(50), nullable=False)
    request_type = Column(String(20), nullable=False)  # KM, AUTO
    requested_value = Column(Float, nullable=False)
    status = Column(String(20), default="Pending")  # Pending, Approved, Rejected
    for_month = Column(String(10), nullable=False)  # YYYY-MM
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
