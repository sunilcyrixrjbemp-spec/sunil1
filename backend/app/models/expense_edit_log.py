from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.config.database import Base

class ExpenseEditLog(Base):
    __tablename__ = "expense_edit_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    expense_id = Column(Integer, nullable=False) # Store expense id
    editor_id = Column(Integer, nullable=False)  # User ID of editor
    editor_name = Column(String(100), nullable=True)
    editor_role = Column(String(50), nullable=True)
    leg_number = Column(Integer, nullable=True)  # Which leg (1-based), or null for master
    field_name = Column(String(100), nullable=False)  # e.g. "travel_amount", "da_amount", "distance_km", "comments"
    old_value = Column(String(200), nullable=True)
    new_value = Column(String(200), nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
