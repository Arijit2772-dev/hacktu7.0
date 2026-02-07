"""Order lifecycle management for dealers."""

from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from app.models import DealerOrder, Dealer, SKU, Shade

VALID_TRANSITIONS = {
    "placed": ["confirmed", "cancelled"],
    "confirmed": ["shipped", "cancelled"],
    "shipped": ["delivered"],
    "delivered": [],
    "cancelled": [],
}


def update_order_status(db: Session, order_id: int, dealer_id: int, new_status: str):
    order = db.query(DealerOrder).filter(
        DealerOrder.id == order_id,
        DealerOrder.dealer_id == dealer_id,
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current = order.status
    allowed = VALID_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{current}' to '{new_status}'. Allowed: {allowed}"
        )

    order.status = new_status
    db.commit()

    return {
        "success": True,
        "order_id": order.id,
        "old_status": current,
        "new_status": new_status,
        "message": f"Order #{order.id} updated to {new_status}",
    }


def get_order_detail(db: Session, order_id: int, dealer_id: int):
    order = db.query(DealerOrder).filter(
        DealerOrder.id == order_id,
        DealerOrder.dealer_id == dealer_id,
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    sku = db.query(SKU).filter(SKU.id == order.sku_id).first()
    shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None

    return {
        "id": order.id,
        "dealer_id": order.dealer_id,
        "sku_id": order.sku_id,
        "sku_code": sku.sku_code if sku else None,
        "size": sku.size if sku else None,
        "shade_name": shade.shade_name if shade else None,
        "shade_hex": shade.hex_color if shade else None,
        "quantity": order.quantity,
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "status": order.status,
        "is_ai_suggested": order.is_ai_suggested,
        "order_source": order.order_source,
        "savings_amount": order.savings_amount,
        "mrp": sku.mrp if sku else 0,
        "total_value": round(order.quantity * (sku.mrp if sku else 0), 2),
        "allowed_transitions": VALID_TRANSITIONS.get(order.status, []),
    }


def search_orders(db: Session, dealer_id: int, status: str = None, page: int = 1, per_page: int = 20):
    query = db.query(DealerOrder).filter(DealerOrder.dealer_id == dealer_id)

    if status:
        query = query.filter(DealerOrder.status == status)

    total = query.count()
    orders = query.order_by(DealerOrder.order_date.desc()).offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for o in orders:
        sku = db.query(SKU).filter(SKU.id == o.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None
        results.append({
            "id": o.id,
            "sku_id": o.sku_id,
            "sku_code": sku.sku_code if sku else None,
            "shade_name": shade.shade_name if shade else None,
            "shade_hex": shade.hex_color if shade else None,
            "size": sku.size if sku else None,
            "quantity": o.quantity,
            "order_date": o.order_date.isoformat() if o.order_date else None,
            "status": o.status,
            "is_ai_suggested": o.is_ai_suggested,
            "savings_amount": o.savings_amount,
        })

    return {"orders": results, "total": total, "page": page, "per_page": per_page}
