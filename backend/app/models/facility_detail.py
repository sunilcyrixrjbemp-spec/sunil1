from sqlalchemy import Column, String
from app.config.database import Base

class FacilityDetail(Base):
    __tablename__ = "facility_details"
    
    facility_name = Column(String(200), primary_key=True)
    district_name = Column(String(100), nullable=False)
    facility_incharge = Column(String(100), nullable=True)
    dm_name = Column(String(100), nullable=True)
    coordinator_name = Column(String(100), nullable=True)
    facility_type = Column(String(50), nullable=True)
    zone_name = Column(String(50), nullable=True)
