from pydantic import BaseModel
from typing import Optional


class ProductCreate(BaseModel):
    name: str
    category: str  # Interior Wall, Exterior Wall, Wood & Metal, Waterproofing
    finish: str = "Matt"
    price_per_litre: float


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    finish: Optional[str] = None
    price_per_litre: Optional[float] = None


class ShadeCreate(BaseModel):
    product_id: int
    shade_name: str
    hex_color: str
    shade_family: str  # Reds, Blues, Greens, Yellows, Neutrals, Whites
    is_trending: bool = False


class ShadeUpdate(BaseModel):
    shade_name: Optional[str] = None
    hex_color: Optional[str] = None
    shade_family: Optional[str] = None
    is_trending: Optional[bool] = None


class SKUCreate(BaseModel):
    shade_id: int
    size: str  # 1L, 4L, 10L, 20L
    unit_cost: float
    mrp: float


class WarehouseCreate(BaseModel):
    name: str
    code: str
    region_id: int
    city: str
    state: str
    latitude: float
    longitude: float
    capacity_litres: int = 500000


class InventoryAdjustment(BaseModel):
    warehouse_id: int
    sku_id: int
    adjustment: int  # positive or negative
    reason: str


class TransferCreate(BaseModel):
    from_warehouse_id: int
    to_warehouse_id: int
    sku_id: int
    quantity: int
    reason: str = ""


class DealerUpdate(BaseModel):
    tier: Optional[str] = None
    credit_limit: Optional[float] = None
    performance_score: Optional[float] = None
