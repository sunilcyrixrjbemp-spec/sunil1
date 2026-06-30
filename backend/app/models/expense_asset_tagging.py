from sqlalchemy import Column, Integer, String, ForeignKey
from app.config.database import Base

class ExpenseAssetTagging(Base):
    __tablename__ = "expense_asset_taggings"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itinerary_id = Column(String(100), ForeignKey("expense_itineraries.itinerary_id", ondelete="CASCADE"), nullable=False)
    equipment_name = Column(String(200), nullable=True)
    quantity = Column(Integer, default=0)
