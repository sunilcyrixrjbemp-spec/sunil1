from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class ExpenseCreateRequest(BaseModel):
    purpose: str
    category: str
    amount: float
    date: str  # YYYY-MM-DD format
    description: Optional[str] = ""
    attachments: Optional[List[str]] = []

class ExpenseResponse(BaseModel):
    id: int
    user_id: int
    month: str
    year: int
    amount: float
    status: str  # draft, submitted, approved, rejected
    travel_mode: Optional[str] = None
    itinerary: Optional[str] = None
    description: Optional[str] = None
    attachments: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
