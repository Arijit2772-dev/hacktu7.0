from pydantic import BaseModel
from typing import Optional


class ManualOrderCreate(BaseModel):
    sku_id: int
    quantity: int
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str  # confirmed, shipped, delivered, cancelled


class DealerProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
