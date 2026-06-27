from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.config.database import get_db

router = APIRouter()

@router.get("/monthly/{month}")
async def get_monthly_report(month: str, db: Session = Depends(get_db)):
    """Get monthly report"""
    return {"report": {}}

@router.post("/export-pdf")
async def export_pdf(db: Session = Depends(get_db)):
    """Export report as PDF"""
    return {"message": "PDF generated"}
