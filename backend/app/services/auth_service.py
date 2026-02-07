import hashlib
import hmac
import os
import jwt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.user import User
from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS


def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt."""
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"{salt}${h.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against stored hash."""
    try:
        salt, stored_hash = password_hash.split("$")
        h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
        return hmac.compare_digest(h.hex(), stored_hash)
    except (ValueError, AttributeError):
        return False


def create_access_token(user_id: int, role: str) -> str:
    """Create JWT access token."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate JWT token."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def register_user(db: Session, email: str, password: str, full_name: str,
                   phone: str = None, role: str = "customer", dealer_id: int = None) -> User:
    """Register a new user."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        phone=phone,
        role=role,
        dealer_id=dealer_id,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    """Authenticate user by email and password."""
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("Invalid email or password")
    if not user.is_active:
        raise ValueError("Account is disabled")

    user.last_login = datetime.utcnow()
    db.commit()
    return user
