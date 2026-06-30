from sqlalchemy import Column, Integer, String, ForeignKey
from app.config.database import Base

class ExpenseAssetMobilise(Base):
    __tablename__ = "expense_asset_mobilises"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itinerary_id = Column(String(100), ForeignKey("expense_itineraries.itinerary_id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=0)
