import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

# In-memory sliding window limiter for single-process deployments.
_hits: dict[str, deque[float]] = defaultdict(deque)


def _allow_request(key: str, max_requests: int, window_seconds: int) -> bool:
    now = time.time()
    window_start = now - window_seconds
    bucket = _hits[key]

    while bucket and bucket[0] < window_start:
        bucket.popleft()

    if len(bucket) >= max_requests:
        return False

    bucket.append(now)
    return True


def rate_limit_auth(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path

    # Separate limits for login and register.
    if path.endswith("/login"):
        max_requests, window = 10, 60
    elif path.endswith("/register"):
        max_requests, window = 5, 60
    else:
        max_requests, window = 30, 60

    key = f"{client_ip}:{path}"
    if _allow_request(key, max_requests=max_requests, window_seconds=window):
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many requests. Please try again shortly.",
    )
