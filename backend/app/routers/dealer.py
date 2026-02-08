from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.dealer_service import (
    get_dealer_dashboard,
    get_smart_orders,
    get_dealer_alerts,
    get_dealer_dashboard_activity,
    get_dealer_order_pipeline,
    get_dealer_trends,
    get_dealer_top_skus,
)
from app.services.analytics_service import (
    get_dealer_revenue_trend,
    get_dealer_top_skus_analytics,
    get_dealer_order_pipeline_analytics,
)
from app.services.order_service import update_order_status, get_order_detail, search_orders
from app.services.customer_service import (
    get_dealer_customer_requests,
    update_dealer_customer_request_status,
)
from app.schemas.dealer import ManualOrderCreate, OrderStatusUpdate, CustomerRequestStatusUpdate
from app.models import Dealer, DealerOrder, SKU
from app.models.user import User
from app.middleware.auth import require_dealer
from datetime import datetime
from typing import Optional

router = APIRouter()


def _get_dealer_id(user: User) -> int:
    """Extract dealer_id from authenticated user."""
    if not user.dealer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No dealer associated with this account",
        )
    return user.dealer_id


def _notify_admins(db: Session, title: str, message: str, category: str = "order", link: str = "/admin"):
    try:
        from app.services.notification_service import create_notifications_for_users
        admin_ids = [row[0] for row in db.query(User.id).filter(User.role == "admin", User.is_active == True).all()]
        if admin_ids:
            create_notifications_for_users(
                db,
                admin_ids,
                title=title,
                message=message,
                type="info",
                category=category,
                link=link,
            )
    except Exception as e:
        print(f"Warning: Failed to create admin notification: {e}")


# ─── /me/ endpoints (JWT-based, dealer_id from token) ───

@router.get("/me/dashboard")
def dealer_dashboard(user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    return get_dealer_dashboard(db, _get_dealer_id(user))


@router.get("/me/dashboard/activity")
def dealer_dashboard_activity(
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return get_dealer_dashboard_activity(db, _get_dealer_id(user), limit=limit)


@router.get("/me/dashboard/pipeline")
def dealer_dashboard_pipeline(
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return get_dealer_order_pipeline(db, _get_dealer_id(user))


@router.get("/me/dashboard/trends")
def dealer_dashboard_trends(
    months: int = Query(6, ge=3, le=12),
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return get_dealer_trends(db, _get_dealer_id(user), months=months)


@router.get("/me/inventory/top-skus")
def dealer_top_skus(
    limit: int = Query(10, ge=1, le=30),
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return get_dealer_top_skus(db, _get_dealer_id(user), limit=limit)


@router.get("/me/analytics/revenue-trend")
def dealer_analytics_revenue_trend(
    months: int = Query(6, ge=3, le=12),
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return get_dealer_revenue_trend(db, _get_dealer_id(user), months=months)


@router.get("/me/analytics/top-skus")
def dealer_analytics_top_skus(
    limit: int = Query(10, ge=1, le=30),
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return get_dealer_top_skus_analytics(db, _get_dealer_id(user), limit=limit)


@router.get("/me/analytics/order-pipeline")
def dealer_analytics_order_pipeline(
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return get_dealer_order_pipeline_analytics(db, _get_dealer_id(user))


@router.get("/me/smart-orders")
def smart_orders(user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    return get_smart_orders(db, _get_dealer_id(user))


@router.post("/me/orders")
def place_order(order: ManualOrderCreate, user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    dealer_id = _get_dealer_id(user)
    if order.quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be greater than zero")
    sku_exists = db.query(SKU.id).filter(SKU.id == order.sku_id).first()
    if not sku_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU not found")

    try:
        new_order = DealerOrder(
            dealer_id=dealer_id,
            sku_id=order.sku_id,
            quantity=order.quantity,
            order_date=datetime.utcnow(),
            status="placed",
            is_ai_suggested=False,
            order_source="manual",
            savings_amount=0.0,
        )
        db.add(new_order)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to place order") from exc

    _notify_admins(
        db,
        title="Dealer Order Placed",
        message=f"Dealer #{dealer_id} placed order #{new_order.id} ({new_order.quantity} units).",
        category="order",
        link="/admin",
    )
    return {"success": True, "order_id": new_order.id, "status": "placed"}


@router.post("/me/orders/bundle")
def accept_bundle(user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    """Accept all AI-recommended orders at once."""
    dealer_id = _get_dealer_id(user)
    recs = get_smart_orders(db, dealer_id)
    total_savings = 0
    orders_placed = 0

    try:
        for rec in recs:
            if rec["urgency"] in ("CRITICAL", "RECOMMENDED"):
                order = DealerOrder(
                    dealer_id=dealer_id,
                    sku_id=rec["sku_id"],
                    quantity=rec["recommended_qty"],
                    order_date=datetime.utcnow(),
                    status="placed",
                    is_ai_suggested=True,
                    order_source="ai_recommendation",
                    savings_amount=rec["savings_amount"],
                )
                db.add(order)
                total_savings += rec["savings_amount"]
                orders_placed += 1

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to accept smart-order bundle") from exc

    if orders_placed > 0:
        _notify_admins(
            db,
            title="Dealer Accepted AI Bundle",
            message=f"Dealer #{dealer_id} accepted {orders_placed} AI recommendations.",
            category="order",
            link="/admin",
        )
    return {
        "success": True,
        "orders_placed": orders_placed,
        "total_savings": round(total_savings, 0),
        "message": f"Bundle accepted! {orders_placed} orders placed. You saved \u20b9{total_savings:,.0f}!",
    }


@router.get("/me/orders/search")
def search_dealer_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return search_orders(db, _get_dealer_id(user), status=status_filter, page=page, per_page=per_page)


@router.get("/me/orders/{order_id}")
def order_detail(order_id: int, user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    return get_order_detail(db, order_id, _get_dealer_id(user))


@router.put("/me/orders/{order_id}/status")
def change_order_status(
    order_id: int, data: OrderStatusUpdate,
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return update_order_status(db, order_id, _get_dealer_id(user), data.status)


@router.get("/me/orders")
def order_history(user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    dealer_id = _get_dealer_id(user)
    orders = db.query(DealerOrder).filter(
        DealerOrder.dealer_id == dealer_id
    ).order_by(DealerOrder.order_date.desc()).limit(50).all()

    return [
        {
            "id": o.id,
            "sku_id": o.sku_id,
            "quantity": o.quantity,
            "order_date": o.order_date.isoformat() if o.order_date else None,
            "status": o.status,
            "is_ai_suggested": o.is_ai_suggested,
            "savings_amount": o.savings_amount,
        }
        for o in orders
    ]


@router.get("/me/customer-requests")
def dealer_customer_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return get_dealer_customer_requests(
        db,
        _get_dealer_id(user),
        status=status_filter,
        page=page,
        per_page=per_page,
    )


@router.put("/me/customer-requests/{order_id}/status")
def update_customer_request_status(
    order_id: int,
    data: CustomerRequestStatusUpdate,
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return update_dealer_customer_request_status(
        db,
        _get_dealer_id(user),
        order_id,
        data.status,
    )


@router.post("/me/customer-requests/{order_id}/reject")
def reject_customer_request(
    order_id: int,
    user: User = Depends(require_dealer),
    db: Session = Depends(get_db),
):
    return update_dealer_customer_request_status(
        db,
        _get_dealer_id(user),
        order_id,
        "cancelled",
    )


@router.get("/me/alerts")
def dealer_alerts(user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    return get_dealer_alerts(db, _get_dealer_id(user))


@router.get("/me/profile")
def dealer_profile(user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    dealer_id = _get_dealer_id(user)
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dealer not found")
    return {
        "id": dealer.id,
        "name": dealer.name,
        "code": dealer.code,
        "city": dealer.city,
        "state": dealer.state,
        "tier": dealer.tier,
        "credit_limit": dealer.credit_limit,
        "performance_score": dealer.performance_score,
        "region_id": dealer.region_id,
        "warehouse_id": dealer.warehouse_id,
    }
