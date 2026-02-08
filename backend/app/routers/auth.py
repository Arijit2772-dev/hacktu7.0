from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import (
    LogoutRequest,
    TokenRefreshRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)
from app.services.auth_service import (
    authenticate_user,
    issue_token_pair,
    refresh_user_session,
    register_user,
    revoke_refresh_session,
)
from app.middleware.auth import get_current_user
from app.middleware.rate_limit import rate_limit_auth
from app.models.user import User

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(data: UserRegister, _rate_limited: None = Depends(rate_limit_auth), db: Session = Depends(get_db)):
    try:
        user = register_user(
            db,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            phone=data.phone,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    token_data = issue_token_pair(db, user)
    return TokenResponse(
        access_token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        user=UserResponse.model_validate(token_data["user"]),
    )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, _rate_limited: None = Depends(rate_limit_auth), db: Session = Depends(get_db)):
    try:
        user = authenticate_user(db, data.email, data.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    token_data = issue_token_pair(db, user)
    return TokenResponse(
        access_token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        user=UserResponse.model_validate(token_data["user"]),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: TokenRefreshRequest, _rate_limited: None = Depends(rate_limit_auth), db: Session = Depends(get_db)):
    try:
        token_data = refresh_user_session(db, data.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return TokenResponse(
        access_token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        user=UserResponse.model_validate(token_data["user"]),
    )


@router.post("/logout")
def logout(data: LogoutRequest, db: Session = Depends(get_db)):
    if data.refresh_token:
        revoke_refresh_session(db, data.refresh_token)
    return {"success": True}


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.put("/me", response_model=UserResponse)
def update_me(data: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.phone is not None:
        user.phone = data.phone
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("/dealers-list")
def dealers_list(db: Session = Depends(get_db)):
    """Return list of dealers for registration dropdown."""
    from app.models import Dealer
    dealers = db.query(Dealer).order_by(Dealer.name).all()
    return [
        {"id": d.id, "name": d.name, "code": d.code, "city": d.city}
        for d in dealers
    ]
