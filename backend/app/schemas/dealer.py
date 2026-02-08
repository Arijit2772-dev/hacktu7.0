from pydantic import BaseModel, Field
from typing import Optional, Literal


class ManualOrderCreate(BaseModel):
    sku_id: int
    quantity: int = Field(gt=0, le=100000)
    notes: Optional[str] = Field(default=None, max_length=500)


class OrderStatusUpdate(BaseModel):
    status: Literal["confirmed", "shipped", "delivered", "cancelled"]


class DealerProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, min_length=8, max_length=20)


class CustomerRequestStatusUpdate(BaseModel):
    status: Literal["contacted", "fulfilled", "cancelled"]
