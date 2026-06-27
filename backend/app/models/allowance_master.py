from sqlalchemy import Column, Integer, String, Float
from app.config.database import Base

class AllowanceMaster(Base):
    __tablename__ = "allowance_master"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    level = Column(String(50), nullable=True)
    grade = Column(String(50), nullable=True, index=True)
    category = Column(String(100), nullable=True)
    hotel_in_state_s = Column(Integer, default=1500)
    hotel_in_state_d = Column(Integer, default=0)
    hotel_out_state_s = Column(Integer, default=0)
    hotel_out_state_d = Column(Integer, default=0)
    daily_in_district = Column(Integer, default=250)
    daily_out_district = Column(Integer, default=400)
    daily_hotel = Column(Integer, default=350)
    daily_out_state = Column(Integer, default=600)
    vehicle_type = Column(String(50), default="Bike")
    rate_per_km = Column(Float, default=4.5)
    max_km_per_month = Column(Integer, default=2000)
