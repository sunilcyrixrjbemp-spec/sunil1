from sqlalchemy import Column, Integer, String, Text
from app.config.database import Base

class ExpenseOtherActivity(Base):
    __tablename__ = "expense_other_activities"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itinerary_id = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
