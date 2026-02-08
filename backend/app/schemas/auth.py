from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, Literal


class UserRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2)
    phone: Optional[str] = None


class UserLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: Literal["admin", "dealer", "customer"]
    dealer_id: Optional[int] = None
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2)
    phone: Optional[str] = Field(default=None, min_length=8, max_length=20)


class TokenRefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: str = Field(min_length=32)


class LogoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: Optional[str] = Field(default=None, min_length=32)
