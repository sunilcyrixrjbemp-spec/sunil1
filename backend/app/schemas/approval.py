from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class ItineraryLegEdit(BaseModel):
    leg_number: int
    travel_amount: Optional[float] = None
    sub_amount: Optional[float] = None
    hotel_amount: Optional[float] = None
    other_amount: Optional[float] = None
    distance_km: Optional[float] = None
    da_amount: Optional[float] = None
    local_purchase: Optional[float] = None

class ApprovalActionRequest(BaseModel):
    comments: Optional[str] = ""
    itinerary_edits: Optional[List[ItineraryLegEdit]] = None
    client_timestamp: Optional[str] = None
    approved_value: Optional[float] = None

class ApprovalResponse(BaseModel):
    id: int
    expense_id: int
    approver_id: int
    level_number: int
    status: str  # pending, approved, rejected, waiting, cancelled
    comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Joined extra fields for optimized load
    expense_code: Optional[str] = None
    employeeName: Optional[str] = None
    eCode: Optional[str] = None
    purpose: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    itinerariesCount: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

