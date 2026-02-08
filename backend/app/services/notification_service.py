from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.notification import Notification


def _serialize_notification(n: Notification) -> dict:
    return {
        "id": n.id,
        "user_id": n.user_id,
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "category": n.category,
        "is_read": n.is_read,
        "link": n.link,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: str = "info",
    category: str = "system",
    link: str | None = None,
) -> dict:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        category=category,
        link=link,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return _serialize_notification(notification)


def create_notifications_for_users(
    db: Session,
    user_ids: list[int],
    title: str,
    message: str,
    type: str = "info",
    category: str = "system",
    link: str | None = None,
) -> list[dict]:
    deduped_ids = sorted(set([uid for uid in user_ids if uid]))
    if not deduped_ids:
        return []

    notifications = [
        Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            category=category,
            link=link,
            is_read=False,
        )
        for user_id in deduped_ids
    ]
    db.add_all(notifications)
    db.commit()
    for notification in notifications:
        db.refresh(notification)
    return [_serialize_notification(n) for n in notifications]


def get_notifications(
    db: Session,
    user_id: int,
    unread_only: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)

    total = query.count()
    rows = (
        query.order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [_serialize_notification(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def mark_as_read(db: Session, user_id: int, notification_id: int) -> dict:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.is_read:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return _serialize_notification(notification)


def mark_all_read(db: Session, user_id: int) -> dict:
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .update({"is_read": True})
    )
    db.commit()
    return {"updated": updated}


def get_unread_count(db: Session, user_id: int) -> int:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .count()
    )


def delete_notification(db: Session, user_id: int, notification_id: int) -> dict:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notification)
    db.commit()
    return {"success": True}
