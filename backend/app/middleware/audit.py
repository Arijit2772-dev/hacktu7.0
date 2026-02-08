import uuid

from fastapi import Request

from app.database import SessionLocal
from app.services.audit_service import record_audit_log
from app.services.auth_service import decode_token


MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _extract_actor_from_request(request: Request) -> tuple[int | None, str | None]:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None, None
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub")) if payload.get("sub") else None
        role = payload.get("role")
        return user_id, role
    except Exception:
        return None, None


async def audit_middleware(request: Request, call_next):
    request_id = (
        getattr(request.state, "request_id", None)
        or request.headers.get("x-request-id")
        or str(uuid.uuid4())
    )
    request.state.request_id = request_id
    response = await call_next(request)

    if request.method not in MUTATING_METHODS:
        return response
    if not request.url.path.startswith("/api/"):
        return response
    if request.url.path.startswith("/api/notifications"):
        # Notification read state changes are high-volume; skip to keep logs signal-heavy.
        return response

    user_id, role = _extract_actor_from_request(request)
    db = SessionLocal()
    try:
        record_audit_log(
            db,
            user_id=user_id,
            role=role,
            method=request.method,
            path=request.url.path,
            action=f"{request.method}:{request.url.path}",
            status_code=response.status_code,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            request_id=request_id,
            details={"query": str(request.query_params)},
        )
    except Exception:
        # Never block request flow because of audit failures.
        pass
    finally:
        db.close()

    return response
