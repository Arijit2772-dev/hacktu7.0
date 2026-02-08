import json
import logging
import time
import uuid

from fastapi import Request

from app.services.observability_service import record_request_end, record_request_start


logger = logging.getLogger("paintflow.request")


async def request_observability_middleware(request: Request, call_next):
    request_id = (
        getattr(request.state, "request_id", None)
        or request.headers.get("x-request-id")
        or str(uuid.uuid4())
    )
    request.state.request_id = request_id
    record_request_start()

    start = time.perf_counter()
    response = None
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        record_request_end(request.url.path, status_code, duration_ms)
        if response is not None:
            response.headers["x-request-id"] = request_id
            response.headers["x-response-time-ms"] = f"{duration_ms:.2f}"

        logger.info(
            json.dumps(
                {
                    "event": "http_request",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "client_ip": request.client.host if request.client else None,
                },
                ensure_ascii=True,
            )
        )
