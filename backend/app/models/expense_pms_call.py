from sqlalchemy import Column, Integer, String
from app.config.database import Base

class ExpensePmsCall(Base):
    __tablename__ = "expense_pms_calls"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itinerary_id = Column(String(100), nullable=False)
    barcode = Column(String(100), nullable=True)
    pms_frequency = Column(String(100), nullable=True)
    district_name = Column(String(100), nullable=True)
    hospital_name = Column(String(200), nullable=True)
    equipment_name = Column(String(200), nullable=True)
    model_name = Column(String(200), nullable=True)
    inventory_status = Column(String(100), nullable=True)
    photo_url = Column(String(500), nullable=True)
