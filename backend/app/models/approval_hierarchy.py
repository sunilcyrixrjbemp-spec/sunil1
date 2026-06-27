from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.config.database import Base

class ApprovalHierarchy(Base):
    __tablename__ = "approval_hierarchies"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    
    # Relationships
    requesters = relationship("HierarchyRequester", back_populates="hierarchy", cascade="all, delete-orphan")
    approvers = relationship("HierarchyApprover", back_populates="hierarchy", cascade="all, delete-orphan")

class HierarchyRequester(Base):
    __tablename__ = "hierarchy_requesters"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    hierarchy_id = Column(Integer, ForeignKey("approval_hierarchies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False) # Each requester belongs to 1 hierarchy
    
    # Relationships
    hierarchy = relationship("ApprovalHierarchy", back_populates="requesters")
    user = relationship("User", foreign_keys=[user_id])

class HierarchyApprover(Base):
    __tablename__ = "hierarchy_approvers"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    hierarchy_id = Column(Integer, ForeignKey("approval_hierarchies.id", ondelete="CASCADE"), nullable=False)
    level_number = Column(Integer, nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Relationships
    hierarchy = relationship("ApprovalHierarchy", back_populates="approvers")
    approver = relationship("User", foreign_keys=[approver_id])
    
    __table_args__ = (
        UniqueConstraint("hierarchy_id", "level_number", name="uq_hierarchy_level"),
    )
