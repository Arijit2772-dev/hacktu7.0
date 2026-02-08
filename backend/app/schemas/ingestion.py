from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class SalesHistoryIn(BaseModel):
    sku_code: str = Field(min_length=1)
    region_name: str = Field(min_length=1)
    date: date
    quantity_sold: int = Field(ge=0)
    revenue: float = Field(ge=0)
    channel: Literal["dealer", "online", "institutional"] = "dealer"


class InventoryLevelIn(BaseModel):
    warehouse_code: str = Field(min_length=1)
    sku_code: str = Field(min_length=1)
    current_stock: int = Field(ge=0)
    reorder_point: int | None = Field(default=None, ge=0)
    max_capacity: int | None = Field(default=None, ge=1)
    days_of_cover: float | None = Field(default=None, ge=0)
    last_updated: datetime | None = None


class DealerOrderIn(BaseModel):
    dealer_code: str = Field(min_length=1)
    sku_code: str = Field(min_length=1)
    quantity: int = Field(gt=0)
    order_date: datetime | None = None
    status: Literal["recommended", "placed", "confirmed", "shipped", "delivered", "cancelled"] = "placed"
    is_ai_suggested: bool = False
    order_source: str = "ingested"
    savings_amount: float = Field(default=0.0, ge=0)


class IngestionError(BaseModel):
    row: int
    message: str


class IngestionResult(BaseModel):
    entity: str
    dry_run: bool
    processed: int
    inserted: int
    updated: int
    skipped: int
    errors: list[IngestionError]


class IngestionRunOut(BaseModel):
    id: int
    entity: str
    source: str
    filename: str | None = None
    dry_run: bool
    status: str
    processed: int
    inserted: int
    updated: int
    skipped: int
    error_count: int
    triggered_by_user_id: int | None = None
    started_at: datetime
    completed_at: datetime
