from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.config.database import Base

class Approval(Base):
    __tablename__ = "approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"))
    approver_id = Column(Integer, ForeignKey("users.id"))
    level_number = Column(Integer, default=1)
    status = Column(String)  # pending, approved, rejected, waiting, cancelled
    comments = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
