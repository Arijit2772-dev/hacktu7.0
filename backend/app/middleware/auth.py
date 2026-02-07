from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.services.auth_service import decode_token

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT and return the current user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User | None:
    """Return user if token provided, else None."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload["sub"])
        return db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except Exception:
        return None


def require_role(required_role: str):
    """Dependency factory that checks user role."""
    async def role_checker(user: User = Depends(get_current_user)):
        if user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires '{required_role}' role.",
            )
        return user
    return role_checker


# Convenience dependencies
require_admin = require_role("admin")
require_dealer = require_role("dealer")
require_customer = require_role("customer")
