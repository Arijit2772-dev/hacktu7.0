from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: Literal["Interior Wall", "Exterior Wall", "Wood & Metal", "Waterproofing"]
    sub_category: Literal["Luxury", "Premium", "Economy"] = "Premium"
    base_type: Literal["Water-based", "Oil-based"] = "Water-based"
    finish: Literal["Matt", "Soft Sheen", "Satin", "High Gloss"] = "Matt"
    sizes_available: list[Literal["1L", "4L", "10L", "20L"]] = Field(default_factory=lambda: ["1L", "4L", "10L", "20L"])
    price_per_litre: float = Field(gt=0)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    category: Optional[Literal["Interior Wall", "Exterior Wall", "Wood & Metal", "Waterproofing"]] = None
    sub_category: Optional[Literal["Luxury", "Premium", "Economy"]] = None
    base_type: Optional[Literal["Water-based", "Oil-based"]] = None
    finish: Optional[Literal["Matt", "Soft Sheen", "Satin", "High Gloss"]] = None
    sizes_available: Optional[list[Literal["1L", "4L", "10L", "20L"]]] = None
    price_per_litre: Optional[float] = Field(default=None, gt=0)

    @field_validator("sizes_available")
    @classmethod
    def _non_empty_sizes(cls, value):
        if value is not None and len(value) == 0:
            raise ValueError("sizes_available cannot be empty")
        return value


class ShadeCreate(BaseModel):
    product_id: int
    shade_name: str = Field(min_length=2, max_length=120)
    hex_color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    shade_family: Literal["Reds", "Blues", "Greens", "Yellows", "Neutrals", "Whites"]
    is_trending: bool = False


class ShadeUpdate(BaseModel):
    shade_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    hex_color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    shade_family: Optional[Literal["Reds", "Blues", "Greens", "Yellows", "Neutrals", "Whites"]] = None
    is_trending: Optional[bool] = None


class SKUCreate(BaseModel):
    shade_id: int
    size: Literal["1L", "4L", "10L", "20L"]
    unit_cost: float = Field(gt=0)
    mrp: float = Field(gt=0)


class WarehouseCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=3, max_length=32)
    region_id: int
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    latitude: float
    longitude: float
    capacity_litres: int = Field(default=500000, gt=0)


class InventoryAdjustment(BaseModel):
    warehouse_id: int
    sku_id: int
    adjustment: int  # positive or negative
    reason: str = Field(min_length=3, max_length=255)


class TransferCreate(BaseModel):
    from_warehouse_id: int
    to_warehouse_id: int
    sku_id: int
    quantity: int = Field(gt=0)
    reason: str = Field(default="", max_length=255)


class DealerUpdate(BaseModel):
    tier: Optional[Literal["Platinum", "Gold", "Silver"]] = None
    credit_limit: Optional[float] = Field(default=None, ge=0)
    performance_score: Optional[float] = Field(default=None, ge=0, le=100)
