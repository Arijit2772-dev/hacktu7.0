import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.config import (
    APP_ENV,
    AUTO_CREATE_TABLES,
    BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_NAME,
    BOOTSTRAP_ADMIN_PASSWORD,
    CORS_ALLOWED_ORIGINS,
    get_simulation_date_str,
)
from app.middleware.error_handler import register_error_handlers
from app.middleware.audit import audit_middleware
from app.middleware.request_observability import request_observability_middleware

logger = logging.getLogger("paintflow.api")


def configure_logging():
    level = logging.DEBUG if APP_ENV == "development" else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: preload Prophet models and scenario data
    import app.models  # Ensure SQLAlchemy metadata is fully registered
    from app.services.forecast_service import preload_models
    from app.simulations.scenarios import preload_scenarios
    from app.services.ingestion_scheduler import ingestion_loop
    from app.services.auth_service import ensure_bootstrap_admin
    stop_event = asyncio.Event()
    ingestion_task = None
    if AUTO_CREATE_TABLES:
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            logger.warning("Could not auto-create database tables: %s", e)
    else:
        logger.info("AUTO_CREATE_TABLES=false. Skipping automatic schema creation.")
    try:
        preload_models()
    except Exception as e:
        logger.warning("Could not preload Prophet models: %s", e)
    try:
        preload_scenarios()
    except Exception as e:
        logger.warning("Could not preload scenarios: %s", e)
    if BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD:
        db = SessionLocal()
        try:
            changed = ensure_bootstrap_admin(
                db,
                email=BOOTSTRAP_ADMIN_EMAIL,
                password=BOOTSTRAP_ADMIN_PASSWORD,
                full_name=BOOTSTRAP_ADMIN_NAME,
            )
            if changed:
                logger.info("Bootstrap admin ensured for email: %s", BOOTSTRAP_ADMIN_EMAIL)
        except Exception as e:
            logger.warning("Could not bootstrap admin user: %s", e)
        finally:
            db.close()
    try:
        ingestion_task = asyncio.create_task(ingestion_loop(stop_event))
    except Exception as e:
        logger.warning("Could not start ingestion scheduler: %s", e)
    yield
    # Shutdown
    try:
        stop_event.set()
        if ingestion_task:
            await asyncio.wait_for(ingestion_task, timeout=5)
    except Exception:
        pass


app = FastAPI(
    title="PaintFlow.ai API",
    description="AI-Powered Supply Chain Intelligence for Paint Manufacturing",
    version="1.0.0",
    lifespan=lifespan,
)

configure_logging()
register_error_handlers(app)
app.middleware("http")(request_observability_middleware)
app.middleware("http")(audit_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from app.routers import admin, dealer, customer, forecast, copilot, simulate, auth, notifications, ingestion, ops

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(dealer.router, prefix="/api/dealer", tags=["Dealer"])
app.include_router(customer.router, prefix="/api/customer", tags=["Customer"])
app.include_router(forecast.router, prefix="/api/forecast", tags=["Forecast"])
app.include_router(copilot.router, prefix="/api/copilot", tags=["Copilot"])
app.include_router(simulate.router, prefix="/api/simulate", tags=["Simulate"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(ingestion.router, prefix="/api/ingest", tags=["Ingestion"])
app.include_router(ops.router, prefix="/api", tags=["Ops"])


@app.get("/api/health")
def health_check():
    return {"status": "alive", "app": "PaintFlow.ai", "note": "Use /api/health/live and /api/health/ready."}


@app.get("/api/meta")
def get_meta():
    return {
        "app_simulation_date": get_simulation_date_str(),
        "scenarios": ["NORMAL", "TRUCK_STRIKE", "HEATWAVE", "EARLY_MONSOON"],
        "model_version": "prophet-1.1.5",
        "demo_mode": False,
    }
