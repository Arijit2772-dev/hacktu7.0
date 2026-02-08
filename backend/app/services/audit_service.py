import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def record_audit_log(
    db: Session,
    *,
    user_id: int | None,
    role: str | None,
    method: str,
    path: str,
    action: str,
    status_code: int,
    ip_address: str | None = None,
    user_agent: str | None = None,
    request_id: str | None = None,
    details: dict | None = None,
) -> AuditLog:
    row = AuditLog(
        user_id=user_id,
        role=role,
        method=method,
        path=path,
        action=action,
        status_code=status_code,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
        details_json=json.dumps(details, ensure_ascii=True) if details else None,
        created_at=datetime.now(UTC),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_audit_logs(
    db: Session,
    *,
    limit: int = 100,
    offset: int = 0,
    user_id: int | None = None,
    action: str | None = None,
    status_code: int | None = None,
    method: str | None = None,
    role: str | None = None,
    path: str | None = None,
    request_id: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> dict:
    limit = max(1, min(limit, 500))
    offset = max(0, offset)

    query = db.query(AuditLog)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if status_code is not None:
        query = query.filter(AuditLog.status_code == status_code)
    if method:
        query = query.filter(AuditLog.method == method.upper())
    if role:
        query = query.filter(AuditLog.role == role.lower())
    if path:
        query = query.filter(AuditLog.path.ilike(f"%{path}%"))
    if request_id:
        query = query.filter(AuditLog.request_id.ilike(f"%{request_id}%"))
    if created_from is not None:
        query = query.filter(AuditLog.created_at >= created_from)
    if created_to is not None:
        query = query.filter(AuditLog.created_at <= created_to)

    total = query.count()
    rows = (
        query.order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": row.id,
                "user_id": row.user_id,
                "role": row.role,
                "method": row.method,
                "path": row.path,
                "action": row.action,
                "status_code": row.status_code,
                "ip_address": row.ip_address,
                "user_agent": row.user_agent,
                "request_id": row.request_id,
                "details_json": row.details_json,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + len(rows) < total,
    }
