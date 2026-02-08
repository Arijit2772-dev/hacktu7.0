from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.notification_service import (
    get_notifications,
    get_unread_count,
    mark_as_read,
    mark_all_read,
    delete_notification,
)

router = APIRouter()


@router.get("")
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_notifications(db, user.id, unread_only=unread_only, limit=limit, offset=offset)


@router.get("/unread-count")
def unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"count": get_unread_count(db, user.id)}


@router.put("/read-all")
def read_all(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return mark_all_read(db, user.id)


@router.put("/{notification_id}/read")
def read_notification(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return mark_as_read(db, user.id, notification_id)


@router.delete("/{notification_id}")
def remove_notification(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return delete_notification(db, user.id, notification_id)
