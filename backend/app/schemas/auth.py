from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = "customer"  # admin, dealer, customer
    dealer_id: Optional[int] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    dealer_id: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
