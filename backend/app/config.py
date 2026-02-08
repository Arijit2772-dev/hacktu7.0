import os
from pathlib import Path
from datetime import date


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "paintflow.db"
MODEL_DIR = BASE_DIR / "app" / "ml" / "models"
SCENARIO_DIR = BASE_DIR / "app" / "simulations" / "data"

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"

INGEST_INBOX_DIR = Path(os.getenv("INGEST_INBOX_DIR", str(BASE_DIR / "app" / "ingestion" / "inbox")))
INGEST_ARCHIVE_DIR = Path(os.getenv("INGEST_ARCHIVE_DIR", str(BASE_DIR / "app" / "ingestion" / "archive")))
INGEST_ERROR_DIR = Path(os.getenv("INGEST_ERROR_DIR", str(BASE_DIR / "app" / "ingestion" / "error")))
INGEST_ENABLED = _as_bool(os.getenv("INGEST_ENABLED"), True)
INGEST_POLL_SECONDS = int(os.getenv("INGEST_POLL_SECONDS", "3600"))

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")
AUTO_CREATE_TABLES = _as_bool(os.getenv("AUTO_CREATE_TABLES"), not IS_PRODUCTION)

_cors_env = _as_csv(os.getenv("CORS_ALLOWED_ORIGINS"))
if _cors_env:
    CORS_ALLOWED_ORIGINS = _cors_env
elif IS_PRODUCTION:
    raise RuntimeError("CORS_ALLOWED_ORIGINS must be explicitly set in production.")
else:
    CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

# Optional simulation date pin for demos. If unset/invalid, use real current date.
APP_SIMULATION_DATE = os.getenv("APP_SIMULATION_DATE", "").strip()


def get_simulation_date() -> date:
    if APP_SIMULATION_DATE:
        try:
            return date.fromisoformat(APP_SIMULATION_DATE)
        except ValueError:
            return date.today()
    return date.today()


def get_simulation_date_str() -> str:
    return get_simulation_date().isoformat()

# Gemini API key (set via environment variable)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Copilot timeout in seconds
COPILOT_TIMEOUT = 3.0

# JWT config
JWT_SECRET = os.getenv("JWT_SECRET", "paintflow-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
JWT_REFRESH_SECRET = os.getenv("JWT_REFRESH_SECRET", JWT_SECRET)
JWT_REFRESH_EXPIRY_DAYS = int(os.getenv("JWT_REFRESH_EXPIRY_DAYS", "14"))

# Optional bootstrap admin (useful for first deploy on empty DB)
BOOTSTRAP_ADMIN_EMAIL = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
BOOTSTRAP_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
BOOTSTRAP_ADMIN_NAME = os.getenv("BOOTSTRAP_ADMIN_NAME", "Platform Admin").strip() or "Platform Admin"

if IS_PRODUCTION and JWT_SECRET == "paintflow-secret-key-change-in-production":
    raise RuntimeError("JWT_SECRET must be set in production.")
if IS_PRODUCTION and len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET must be at least 32 characters in production.")
if IS_PRODUCTION and len(JWT_REFRESH_SECRET) < 32:
    raise RuntimeError("JWT_REFRESH_SECRET must be at least 32 characters in production.")
if IS_PRODUCTION and AUTO_CREATE_TABLES:
    raise RuntimeError("AUTO_CREATE_TABLES must be false in production. Use Alembic migrations.")
if IS_PRODUCTION and any("localhost" in origin or "127.0.0.1" in origin for origin in CORS_ALLOWED_ORIGINS):
    raise RuntimeError("Localhost origins are not allowed in production CORS_ALLOWED_ORIGINS.")
if IS_PRODUCTION and bool(BOOTSTRAP_ADMIN_EMAIL) != bool(BOOTSTRAP_ADMIN_PASSWORD):
    raise RuntimeError("Set both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD together, or leave both empty.")
if BOOTSTRAP_ADMIN_PASSWORD and len(BOOTSTRAP_ADMIN_PASSWORD) < 8:
    raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.")
