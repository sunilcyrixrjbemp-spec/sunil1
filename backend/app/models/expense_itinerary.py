from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from app.config.database import Base

class ExpenseItinerary(Base):
    __tablename__ = "expense_itineraries"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itinerary_id = Column(String(100), unique=True, index=True, nullable=False)  # format: {exp_id}-{leg_number}
    exp_id = Column(String(100), nullable=False) # Store the text exp_id generated RJ-MM/YY-XXXXXX
    leg_number = Column(Integer, nullable=False)
    from_district = Column(String(100), nullable=True)
    to_district = Column(String(100), nullable=True)
    from_location = Column(String(200), nullable=True)
    to_location = Column(String(200), nullable=True)
    travel_mode = Column(String(50), nullable=True)
    distance_km = Column(Float, default=0.0)
    travel_amount = Column(Float, default=0.0)
    sub_mode = Column(String(50), nullable=True)
    sub_km = Column(Float, default=0.0)
    sub_amount = Column(Float, default=0.0)
    da_amount = Column(Float, default=0.0)
    hotel_amount = Column(Float, default=0.0)
    other_desc = Column(Text, nullable=True)
    other_amount = Column(Float, default=0.0)
    local_purchase = Column(Float, default=0.0)
    
    # Preserve original submitted leg amounts
    original_distance_km = Column(Float, default=0.0)
    original_travel_amount = Column(Float, default=0.0)
    original_sub_amount = Column(Float, default=0.0)
    original_da_amount = Column(Float, default=0.0)
    original_hotel_amount = Column(Float, default=0.0)
    original_other_amount = Column(Float, default=0.0)
    original_local_purchase = Column(Float, default=0.0)
    calls_assigned = Column(Integer, default=0)
    calls_completed = Column(Integer, default=0)
    pms_count = Column(Integer, default=0)
    asset_tagging = Column(Integer, default=0)
    calibration_count = Column(Integer, default=0)
    mobilise_count = Column(Integer, default=0)
    visit_purpose = Column(Text, nullable=True)
    activity_details = Column(Text, nullable=True)
