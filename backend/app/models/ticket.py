from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.config.database import Base

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticket_code = Column(String(50), unique=True, index=True, nullable=False)
    created_by_id = Column(Integer, nullable=False)
    created_by_name = Column(String(100), nullable=False)
    created_by_code = Column(String(50), nullable=False, index=True)
    concern_type = Column(String(50), nullable=False)  # Expense, Profile, TA/DA
    expense_id = Column(Integer, nullable=True)
    expense_code = Column(String(50), nullable=True)
    priority = Column(String(20), nullable=False)  # Low, Medium, High, Critical
    description = Column(Text, nullable=False)
    assigned_to_role = Column(String(50), nullable=False, index=True)  # Admin, Manager, Coordinator
    assigned_to_name = Column(String(100), nullable=False, index=True)
    status = Column(String(20), default="Open", nullable=False, index=True)  # Open, Closed, Final Closed
    comments = Column(Text, nullable=True)  # Discussion timeline text log
    needs_followup = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    closed_at = Column(DateTime, nullable=True)
