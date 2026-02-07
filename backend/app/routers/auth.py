from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse, UserUpdate
from app.services.auth_service import register_user, authenticate_user, create_access_token
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(data: UserRegister, db: Session = Depends(get_db)):
    try:
        user = register_user(
            db,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            phone=data.phone,
            role=data.role,
            dealer_id=data.dealer_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    token = create_access_token(user.id, user.role)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    try:
        user = authenticate_user(db, data.email, data.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    token = create_access_token(user.id, user.role)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


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
