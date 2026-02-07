from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.dealer_service import (
    get_dealer_dashboard, get_smart_orders, get_dealer_alerts,
)
from app.services.order_service import update_order_status, get_order_detail, search_orders
from app.schemas.dealer import ManualOrderCreate, OrderStatusUpdate
from app.models import Dealer, DealerOrder
from datetime import datetime
from typing import Optional

router = APIRouter()


@router.get("/{dealer_id}/dashboard")
def dealer_dashboard(dealer_id: int, db: Session = Depends(get_db)):
    return get_dealer_dashboard(db, dealer_id)


@router.get("/{dealer_id}/smart-orders")
def smart_orders(dealer_id: int, db: Session = Depends(get_db)):
    return get_smart_orders(db, dealer_id)


@router.post("/{dealer_id}/orders")
def place_order(dealer_id: int, order: ManualOrderCreate, db: Session = Depends(get_db)):
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
    return {"success": True, "order_id": new_order.id, "status": "placed"}


@router.post("/{dealer_id}/orders/bundle")
def accept_bundle(dealer_id: int, db: Session = Depends(get_db)):
    """Accept all AI-recommended orders at once."""
    recs = get_smart_orders(db, dealer_id)
    total_savings = 0
    orders_placed = 0

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
    return {
        "success": True,
        "orders_placed": orders_placed,
        "total_savings": round(total_savings, 0),
        "message": f"Bundle accepted! {orders_placed} orders placed. You saved \u20b9{total_savings:,.0f}!",
    }


@router.get("/{dealer_id}/orders/search")
def search_dealer_orders(
    dealer_id: int,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return search_orders(db, dealer_id, status=status, page=page, per_page=per_page)


@router.get("/{dealer_id}/orders/{order_id}")
def order_detail(dealer_id: int, order_id: int, db: Session = Depends(get_db)):
    return get_order_detail(db, order_id, dealer_id)


@router.put("/{dealer_id}/orders/{order_id}/status")
def change_order_status(
    dealer_id: int, order_id: int, data: OrderStatusUpdate,
    db: Session = Depends(get_db),
):
    return update_order_status(db, order_id, dealer_id, data.status)


@router.get("/{dealer_id}/orders")
def order_history(dealer_id: int, db: Session = Depends(get_db)):
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


@router.get("/{dealer_id}/alerts")
def dealer_alerts(dealer_id: int, db: Session = Depends(get_db)):
    return get_dealer_alerts(db, dealer_id)


@router.get("/{dealer_id}/profile")
def dealer_profile(dealer_id: int, db: Session = Depends(get_db)):
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        return {"error": "Dealer not found"}
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
