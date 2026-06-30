from sqlalchemy import Column, Integer, String
from app.config.database import Base

class ExpenseAssetMobilise(Base):
    __tablename__ = "expense_asset_mobilises"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itinerary_id = Column(String(100), nullable=False)
    quantity = Column(Integer, default=0)
