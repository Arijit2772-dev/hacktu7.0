import hashlib
import hmac
import logging
import os
import uuid
from datetime import datetime, timedelta
from datetime import UTC

import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import (
    JWT_ALGORITHM,
    JWT_EXPIRY_HOURS,
    JWT_REFRESH_EXPIRY_DAYS,
    JWT_REFRESH_SECRET,
    JWT_SECRET,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger("paintflow.auth")


def _utcnow() -> datetime:
    # Store as naive UTC to stay compatible with existing SQLAlchemy DateTime columns.
    return datetime.now(UTC).replace(tzinfo=None)


def _hash_password_legacy(password: str) -> str:
    """Legacy PBKDF2 hash format kept for backward compatibility."""
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"{salt}${h.hex()}"


def _verify_password_legacy(password: str, password_hash: str) -> bool:
    """Verify legacy PBKDF2 hashes."""
    try:
        salt, stored_hash = password_hash.split("$")
        h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
        return hmac.compare_digest(h.hex(), stored_hash)
    except (ValueError, AttributeError):
        return False


def _hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def hash_password(password: str) -> str:
    """Hash password using bcrypt (passlib)."""
    try:
        return pwd_context.hash(password)
    except Exception as exc:
        logger.warning("bcrypt hashing unavailable, falling back to PBKDF2: %s", exc)
        return _hash_password_legacy(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify both modern bcrypt and legacy PBKDF2 password hashes."""
    if not password_hash:
        return False
    if pwd_context.identify(password_hash):
        try:
            return pwd_context.verify(password, password_hash)
        except Exception:
            return False
    return _verify_password_legacy(password, password_hash)


def should_upgrade_password_hash(password_hash: str) -> bool:
    """Whether a stored hash should be upgraded to the current scheme."""
    try:
        if not password_hash:
            return True
        if not pwd_context.identify(password_hash):
            return True
        return pwd_context.needs_update(password_hash)
    except Exception:
        return False


def create_access_token(user_id: int, role: str) -> str:
    """Create JWT access token."""
    now = _utcnow()
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": now + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": now,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _create_refresh_token(user_id: int, token_id: str, now: datetime) -> str:
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": token_id,
        "exp": now + timedelta(days=JWT_REFRESH_EXPIRY_DAYS),
        "iat": now,
    }
    return jwt.encode(payload, JWT_REFRESH_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str, expected_type: str | None = "access") -> dict:
    """Decode and validate JWT token."""
    secret = JWT_REFRESH_SECRET if expected_type == "refresh" else JWT_SECRET
    payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    token_type = payload.get("type")

    if expected_type == "access":
        # Backward compatibility for previously minted access tokens without type.
        if token_type not in (None, "access"):
            raise jwt.InvalidTokenError("Invalid token type")
    elif expected_type and token_type != expected_type:
        raise jwt.InvalidTokenError("Invalid token type")
    return payload


def register_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    phone: str = None,
) -> User:
    """Register a new customer user."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        phone=phone,
        role="customer",
        dealer_id=None,
        is_active=True,
        created_at=_utcnow(),
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

    if should_upgrade_password_hash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login = _utcnow()
    db.commit()
    return user


def issue_token_pair(db: Session, user: User) -> dict:
    now = _utcnow()
    refresh_token_id = str(uuid.uuid4())
    refresh_token = _create_refresh_token(user.id, refresh_token_id, now)

    token_row = RefreshToken(
        user_id=user.id,
        token_id=refresh_token_id,
        token_hash=_hash_refresh_token(refresh_token),
        created_at=now,
        expires_at=now + timedelta(days=JWT_REFRESH_EXPIRY_DAYS),
    )
    db.add(token_row)
    db.commit()

    return {
        "access_token": create_access_token(user.id, user.role),
        "refresh_token": refresh_token,
        "user": user,
    }


def refresh_user_session(db: Session, refresh_token: str) -> dict:
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
        user_id = int(payload.get("sub"))
        token_id = payload.get("jti")
    except Exception:
        raise ValueError("Invalid or expired refresh token")

    if not token_id:
        raise ValueError("Invalid or expired refresh token")

    token_hash = _hash_refresh_token(refresh_token)
    token_row = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user_id,
            RefreshToken.token_id == token_id,
            RefreshToken.token_hash == token_hash,
        )
        .first()
    )
    now = _utcnow()
    if not token_row or token_row.revoked_at is not None or token_row.expires_at < now:
        raise ValueError("Invalid or expired refresh token")

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise ValueError("User not found or inactive")

    next_token_id = str(uuid.uuid4())
    next_refresh_token = _create_refresh_token(user.id, next_token_id, now)
    token_row.revoked_at = now
    token_row.replaced_by_token_id = next_token_id

    db.add(
        RefreshToken(
            user_id=user.id,
            token_id=next_token_id,
            token_hash=_hash_refresh_token(next_refresh_token),
            created_at=now,
            expires_at=now + timedelta(days=JWT_REFRESH_EXPIRY_DAYS),
        )
    )
    user.last_login = now
    db.commit()
    db.refresh(user)

    return {
        "access_token": create_access_token(user.id, user.role),
        "refresh_token": next_refresh_token,
        "user": user,
    }


def revoke_refresh_session(db: Session, refresh_token: str) -> bool:
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
        user_id = int(payload.get("sub"))
        token_id = payload.get("jti")
    except Exception:
        return False

    if not token_id:
        return False

    token_hash = _hash_refresh_token(refresh_token)
    token_row = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user_id,
            RefreshToken.token_id == token_id,
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
        .first()
    )
    if not token_row:
        return False

    token_row.revoked_at = _utcnow()
    db.commit()
    return True


def ensure_bootstrap_admin(
    db: Session,
    email: str,
    password: str,
    full_name: str = "Platform Admin",
) -> bool:
    """
    Ensure an initial admin account exists for first deploy.
    Returns True when an admin account was created or updated.
    """
    normalized_email = (email or "").strip().lower()
    if not normalized_email or not password:
        return False

    if len(password) < 8:
        raise ValueError("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters")

    user = db.query(User).filter(User.email == normalized_email).first()
    if user:
        changed = False
        should_set_password = False
        if user.role != "admin":
            user.role = "admin"
            changed = True
            should_set_password = True
        if not user.is_active:
            user.is_active = True
            changed = True
            should_set_password = True
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            changed = True
        # Only rotate password when account needed elevation/reactivation.
        if should_set_password:
            user.password_hash = hash_password(password)
            changed = True
        if changed:
            db.commit()
        return changed

    admin_exists = db.query(User.id).filter(User.role == "admin", User.is_active == True).first()
    if admin_exists:
        return False

    new_admin = User(
        email=normalized_email,
        password_hash=hash_password(password),
        full_name=full_name or "Platform Admin",
        phone=None,
        role="admin",
        dealer_id=None,
        is_active=True,
        created_at=_utcnow(),
    )
    db.add(new_admin)
    db.commit()
    return True
