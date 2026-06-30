from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from app.config.database import Base

class EngineerAdvance(Base):
    __tablename__ = "engineer_advances"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(50), index=True, nullable=False)
    month = Column(String(20), nullable=False)
    year = Column(Integer, nullable=False)
    advance_amount = Column(Float, default=0.0)
    created_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'month', 'year', name='uq_user_month_year_advance'),
    )
