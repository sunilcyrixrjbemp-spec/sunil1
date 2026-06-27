from pydantic import BaseModel
from typing import Optional, Generic, TypeVar

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

class ErrorResponse(BaseModel):
    status_code: int
    message: str
    detail: Optional[str] = None
