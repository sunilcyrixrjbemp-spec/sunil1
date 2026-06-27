from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.config.database import Base

class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    asset_type = Column(String)
    zone = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
