from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.config.database import Base

class Expense(Base):
    __tablename__ = "expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    expense_code = Column(String(100), unique=True, index=True, nullable=True) # RJ-MM/YY-XXXXXX format
    month = Column(String(50))
    year = Column(Integer)
    amount = Column(Float)
    status = Column(String(50), default="draft")  # draft, submitted, approved, rejected
    travel_mode = Column(String(100))  # travel category or major travel mode
    itinerary = Column(Text)  # stored as date string (or JSON summary)
    description = Column(Text)
    attachments = Column(Text)  # JSON array of files
    
    # New Itinerary-based master totals
    da_amount = Column(Float, default=0.0)
    hotel_amount = Column(Float, default=0.0)
    other_expense_amount = Column(Float, default=0.0)
    local_purchase_amount = Column(Float, default=0.0)
    calls_assigned = Column(Integer, default=0)
    calls_completed = Column(Integer, default=0)
    pms_count = Column(Integer, default=0)
    asset_tagging = Column(Integer, default=0)
    calibration_count = Column(Integer, default=0)
    mobilise_count = Column(Integer, default=0)
    
    # Preserve original submitted amounts
    original_amount = Column(Float, default=0.0)
    original_da_amount = Column(Float, default=0.0)
    original_hotel_amount = Column(Float, default=0.0)
    original_other_expense_amount = Column(Float, default=0.0)
    original_local_purchase_amount = Column(Float, default=0.0)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

