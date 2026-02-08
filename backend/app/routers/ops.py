from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import text

from app.config import APP_ENV
from app.database import SessionLocal
from app.services.observability_service import get_metrics_snapshot, render_prometheus_metrics


router = APIRouter()


@router.get("/health/live")
def health_live():
    return {
        "status": "alive",
        "service": "PaintFlow.ai",
        "environment": APP_ENV,
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/health/ready")
def health_ready():
    checks = {"database": {"ok": False}}
    ready = True

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        checks["database"]["ok"] = True
    except Exception as exc:
        ready = False
        checks["database"]["error"] = str(exc)
    finally:
        db.close()

    status_code = 200 if ready else 503
    payload = {
        "status": "ready" if ready else "degraded",
        "service": "PaintFlow.ai",
        "environment": APP_ENV,
        "timestamp": datetime.now(UTC).isoformat(),
        "checks": checks,
    }
    return JSONResponse(status_code=status_code, content=payload)


@router.get("/metrics")
def metrics(format: str = "json"):
    snapshot = get_metrics_snapshot()
    if format.lower() == "prometheus":
        return PlainTextResponse(
            render_prometheus_metrics(snapshot),
            media_type="text/plain; version=0.0.4; charset=utf-8",
        )
    return snapshot
