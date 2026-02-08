import re
from collections import defaultdict, deque
from datetime import UTC, datetime
from threading import Lock


_lock = Lock()
_started_at = datetime.now(UTC)
_in_flight = 0
_requests_total = 0
_status_counts: dict[str, int] = defaultdict(int)
_path_counts: dict[str, int] = defaultdict(int)
_durations_ms: deque[float] = deque(maxlen=2000)

_num_segment_re = re.compile(r"/\d+(?=/|$)")
_uuid_segment_re = re.compile(
    r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=/|$)"
)


def normalize_path(path: str) -> str:
    normalized = _num_segment_re.sub("/:id", path)
    normalized = _uuid_segment_re.sub("/:uuid", normalized)
    return normalized


def record_request_start() -> None:
    global _in_flight
    with _lock:
        _in_flight += 1


def record_request_end(path: str, status_code: int, duration_ms: float) -> None:
    global _in_flight, _requests_total
    normalized = normalize_path(path)
    status_bucket = f"{status_code // 100}xx"
    with _lock:
        _in_flight = max(0, _in_flight - 1)
        _requests_total += 1
        _status_counts[status_bucket] += 1
        _path_counts[normalized] += 1
        _durations_ms.append(duration_ms)


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values_sorted = sorted(values)
    rank = int((len(values_sorted) - 1) * p)
    return round(values_sorted[rank], 2)


def get_metrics_snapshot() -> dict:
    with _lock:
        durations = list(_durations_ms)
        status_counts = dict(_status_counts)
        path_counts = dict(_path_counts)
        requests_total = _requests_total
        in_flight = _in_flight

    avg_latency_ms = round(sum(durations) / len(durations), 2) if durations else 0.0
    top_paths = sorted(path_counts.items(), key=lambda item: item[1], reverse=True)[:15]

    return {
        "service": "PaintFlow.ai",
        "started_at": _started_at.isoformat(),
        "uptime_seconds": int((datetime.now(UTC) - _started_at).total_seconds()),
        "requests": {
            "total": requests_total,
            "in_flight": in_flight,
            "by_status": status_counts,
            "latency_ms": {
                "avg": avg_latency_ms,
                "p50": _percentile(durations, 0.5),
                "p95": _percentile(durations, 0.95),
            },
        },
        "top_paths": [{"path": path, "count": count} for path, count in top_paths],
    }


def render_prometheus_metrics(snapshot: dict) -> str:
    lines: list[str] = []
    requests = snapshot.get("requests", {})
    lines.append("# HELP paintflow_http_requests_total Total HTTP requests processed.")
    lines.append("# TYPE paintflow_http_requests_total counter")
    lines.append(f"paintflow_http_requests_total {requests.get('total', 0)}")
    lines.append("# HELP paintflow_http_requests_in_flight Current in-flight HTTP requests.")
    lines.append("# TYPE paintflow_http_requests_in_flight gauge")
    lines.append(f"paintflow_http_requests_in_flight {requests.get('in_flight', 0)}")

    for status_bucket, value in requests.get("by_status", {}).items():
        lines.append(
            f'paintflow_http_requests_by_status_total{{status_bucket="{status_bucket}"}} {value}'
        )

    latency = requests.get("latency_ms", {})
    lines.append("# HELP paintflow_http_latency_ms_avg Average HTTP latency in milliseconds.")
    lines.append("# TYPE paintflow_http_latency_ms_avg gauge")
    lines.append(f"paintflow_http_latency_ms_avg {latency.get('avg', 0.0)}")
    lines.append(f"paintflow_http_latency_ms_p50 {latency.get('p50', 0.0)}")
    lines.append(f"paintflow_http_latency_ms_p95 {latency.get('p95', 0.0)}")

    lines.append("# HELP paintflow_process_uptime_seconds Service uptime in seconds.")
    lines.append("# TYPE paintflow_process_uptime_seconds gauge")
    lines.append(f"paintflow_process_uptime_seconds {snapshot.get('uptime_seconds', 0)}")
    return "\n".join(lines) + "\n"
