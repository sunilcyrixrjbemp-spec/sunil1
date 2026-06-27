from sqlalchemy import Column, Integer, String, Text
from app.config.database import Base

class ExpenseAttachment(Base):
    __tablename__ = "expense_attachments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    exp_id = Column(String(100), nullable=False)
    itinerary_id = Column(String(100), nullable=True)
    bill_type = Column(String(50), nullable=False)
    file_url = Column(Text, nullable=False)
