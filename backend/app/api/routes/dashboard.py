from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.config.database import get_db

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    return {
        "total_expenses": 0,
        "pending_approvals": 0,
        "this_month": 0,
        "total_users": 0
    }

@router.get("/summary")
async def get_summary(db: Session = Depends(get_db)):
    """Get summary data"""
    return {"summary": {}}
