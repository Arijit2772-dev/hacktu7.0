from pydantic import BaseModel, Field


class CartItemAdd(BaseModel):
    sku_id: int
    quantity: int = Field(default=1, gt=0, le=100000)


class CartItemUpdate(BaseModel):
    quantity: int = Field(gt=0, le=100000)


class WishlistAdd(BaseModel):
    shade_id: int


class CheckoutRequest(BaseModel):
    dealer_id: int
