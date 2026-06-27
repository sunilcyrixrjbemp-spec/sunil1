from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from app.config.database import Base

class UserApprovalChain(Base):
    __tablename__ = "user_approval_chains"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False) # The employee submitting expenses
    level_number = Column(Integer, nullable=False) # e.g. 1, 2, 3
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False) # The designated approver
    
    # Ensure one approver per level per user
    __table_args__ = (
        UniqueConstraint("user_id", "level_number", name="uq_user_level"),
    )
