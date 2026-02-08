from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from app.models.customer import Cart, Wishlist, CustomerOrder, CustomerOrderItem
from app.models.product import SKU, Shade
from app.models.dealer import Dealer
from app.models.user import User


DEALER_REQUEST_TRANSITIONS = {
    "requested": {"contacted", "cancelled"},
    "placed": {"contacted", "cancelled"},  # backward compatibility for older rows
    "contacted": {"fulfilled", "cancelled"},
    "fulfilled": set(),
    "cancelled": set(),
}


def _normalize_request_status(raw_status: str | None) -> str:
    """Map legacy statuses into the customer-request workflow vocabulary."""
    if raw_status in ("placed", None):
        return "requested"
    if raw_status in ("confirmed", "shipped", "delivered"):
        return "fulfilled"
    return raw_status


def _notify_user_ids(
    db: Session,
    user_ids: list[int],
    title: str,
    message: str,
    type: str = "info",
    category: str = "system",
    link: str | None = None,
):
    if not user_ids:
        return
    try:
        from app.services.notification_service import create_notifications_for_users
        create_notifications_for_users(
            db,
            user_ids,
            title=title,
            message=message,
            type=type,
            category=category,
            link=link,
        )
    except Exception as e:
        print(f"Warning: Failed to create notifications: {e}")


# ─── Cart ────────────────────────────────────────────────────────────────────

def get_cart(db: Session, user_id: int):
    """Return cart items with full SKU and shade details."""
    items = (
        db.query(Cart, SKU, Shade)
        .join(SKU, Cart.sku_id == SKU.id)
        .join(Shade, SKU.shade_id == Shade.id)
        .filter(Cart.user_id == user_id)
        .all()
    )
    result = []
    for cart_item, sku, shade in items:
        result.append({
            "cart_id": cart_item.id,
            "sku_id": sku.id,
            "sku_code": sku.sku_code,
            "shade_name": shade.shade_name,
            "hex_color": shade.hex_color,
            "shade_id": shade.id,
            "size": sku.size,
            "mrp": sku.mrp,
            "quantity": cart_item.quantity,
            "subtotal": round(sku.mrp * cart_item.quantity, 2),
            "added_at": cart_item.added_at.isoformat() if cart_item.added_at else None,
        })
    total = round(sum(item["subtotal"] for item in result), 2)
    return {"items": result, "total": total, "count": len(result)}


def add_to_cart(db: Session, user_id: int, sku_id: int, quantity: int):
    """Add item to cart, or increment quantity if already present."""
    # Validate SKU exists
    sku = db.query(SKU).filter(SKU.id == sku_id).first()
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")

    existing = (
        db.query(Cart)
        .filter(Cart.user_id == user_id, Cart.sku_id == sku_id)
        .first()
    )
    if existing:
        existing.quantity += quantity
        db.commit()
        db.refresh(existing)
        return {"message": "Cart updated", "cart_id": existing.id, "quantity": existing.quantity}

    cart_item = Cart(
        user_id=user_id,
        sku_id=sku_id,
        quantity=quantity,
        added_at=datetime.utcnow(),
    )
    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    return {"message": "Added to cart", "cart_id": cart_item.id, "quantity": cart_item.quantity}


def update_cart_item(db: Session, user_id: int, cart_id: int, quantity: int):
    """Update cart item quantity. Remove if quantity is 0."""
    item = (
        db.query(Cart)
        .filter(Cart.id == cart_id, Cart.user_id == user_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    if quantity <= 0:
        db.delete(item)
        db.commit()
        return {"message": "Item removed from cart"}

    item.quantity = quantity
    db.commit()
    db.refresh(item)
    return {"message": "Cart updated", "cart_id": item.id, "quantity": item.quantity}


def remove_from_cart(db: Session, user_id: int, cart_id: int):
    """Delete a cart item."""
    item = (
        db.query(Cart)
        .filter(Cart.id == cart_id, Cart.user_id == user_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    db.delete(item)
    db.commit()
    return {"message": "Item removed from cart"}


def clear_cart(db: Session, user_id: int):
    """Delete all cart items for a user."""
    db.query(Cart).filter(Cart.user_id == user_id).delete()
    db.commit()


# ─── Wishlist ────────────────────────────────────────────────────────────────

def get_wishlist(db: Session, user_id: int):
    """Return wishlist items with shade details."""
    items = (
        db.query(Wishlist, Shade)
        .join(Shade, Wishlist.shade_id == Shade.id)
        .filter(Wishlist.user_id == user_id)
        .all()
    )
    result = []
    for wish_item, shade in items:
        result.append({
            "wishlist_id": wish_item.id,
            "shade_id": shade.id,
            "shade_name": shade.shade_name,
            "shade_code": shade.shade_code,
            "hex_color": shade.hex_color,
            "shade_family": shade.shade_family,
            "is_trending": shade.is_trending,
            "added_at": wish_item.added_at.isoformat() if wish_item.added_at else None,
        })
    return result


def add_to_wishlist(db: Session, user_id: int, shade_id: int):
    """Add shade to wishlist if not already present."""
    shade = db.query(Shade).filter(Shade.id == shade_id).first()
    if not shade:
        raise HTTPException(status_code=404, detail="Shade not found")

    existing = (
        db.query(Wishlist)
        .filter(Wishlist.user_id == user_id, Wishlist.shade_id == shade_id)
        .first()
    )
    if existing:
        return {"message": "Already in wishlist", "wishlist_id": existing.id}

    wish_item = Wishlist(
        user_id=user_id,
        shade_id=shade_id,
        added_at=datetime.utcnow(),
    )
    db.add(wish_item)
    db.commit()
    db.refresh(wish_item)
    return {"message": "Added to wishlist", "wishlist_id": wish_item.id}


def remove_from_wishlist(db: Session, user_id: int, wishlist_id: int):
    """Delete a wishlist item."""
    item = (
        db.query(Wishlist)
        .filter(Wishlist.id == wishlist_id, Wishlist.user_id == user_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    db.delete(item)
    db.commit()
    return {"message": "Removed from wishlist"}


# ─── Checkout & Orders ──────────────────────────────────────────────────────

def checkout(db: Session, user_id: int, dealer_id: int):
    """Create a CustomerOrder from the user's cart items."""
    # Validate dealer
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")

    # Get cart items
    cart_rows = (
        db.query(Cart, SKU)
        .join(SKU, Cart.sku_id == SKU.id)
        .filter(Cart.user_id == user_id)
        .all()
    )
    if not cart_rows:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Calculate total and build order items
    total_amount = 0.0
    order_items_data = []
    for cart_item, sku in cart_rows:
        line_total = sku.mrp * cart_item.quantity
        total_amount += line_total
        order_items_data.append({
            "sku_id": sku.id,
            "quantity": cart_item.quantity,
            "unit_price": sku.mrp,
        })

    total_amount = round(total_amount, 2)

    try:
        # Create order
        order = CustomerOrder(
            user_id=user_id,
            dealer_id=dealer_id,
            status="requested",
            total_amount=total_amount,
            created_at=datetime.utcnow(),
        )
        db.add(order)
        db.flush()  # get order.id before creating items

        # Create order items
        for item_data in order_items_data:
            order_item = CustomerOrderItem(
                order_id=order.id,
                sku_id=item_data["sku_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
            )
            db.add(order_item)

        # Clear cart
        db.query(Cart).filter(Cart.user_id == user_id).delete()

        db.commit()
        db.refresh(order)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create order") from exc

    dealer_user_ids = [
        row[0]
        for row in db.query(User.id).filter(
            User.role == "dealer",
            User.dealer_id == dealer_id,
            User.is_active == True,
        ).all()
    ]
    _notify_user_ids(
        db,
        dealer_user_ids,
        title="New Customer Request",
        message=f"Order request #{order.id} received. Total value: ₹{order.total_amount:,.0f}.",
        type="alert",
        category="order",
        link="/dealer/customer-requests",
    )
    _notify_user_ids(
        db,
        [user_id],
        title="Order Request Submitted",
        message=f"Your order request #{order.id} was submitted to a dealer.",
        type="success",
        category="order",
        link="/customer/orders",
    )

    return {
        "order_id": order.id,
        "status": _normalize_request_status(order.status),
        "total_amount": order.total_amount,
        "dealer_id": order.dealer_id,
        "items_count": len(order_items_data),
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


def get_my_orders(db: Session, user_id: int):
    """Return all orders for a user with item details."""
    orders = (
        db.query(CustomerOrder)
        .filter(CustomerOrder.user_id == user_id)
        .order_by(CustomerOrder.created_at.desc())
        .all()
    )
    result = []
    for order in orders:
        items = (
            db.query(CustomerOrderItem, SKU, Shade)
            .join(SKU, CustomerOrderItem.sku_id == SKU.id)
            .join(Shade, SKU.shade_id == Shade.id)
            .filter(CustomerOrderItem.order_id == order.id)
            .all()
        )
        order_items = []
        for oi, sku, shade in items:
            order_items.append({
                "item_id": oi.id,
                "sku_id": sku.id,
                "sku_code": sku.sku_code,
                "shade_name": shade.shade_name,
                "hex_color": shade.hex_color,
                "size": sku.size,
                "quantity": oi.quantity,
                "unit_price": oi.unit_price,
                "subtotal": round(oi.unit_price * oi.quantity, 2),
            })
        result.append({
            "order_id": order.id,
            "status": _normalize_request_status(order.status),
            "total_amount": order.total_amount,
            "dealer_id": order.dealer_id,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "items": order_items,
        })
    return result


def get_order_detail(db: Session, user_id: int, order_id: int):
    """Return a single order with its items."""
    order = (
        db.query(CustomerOrder)
        .filter(CustomerOrder.id == order_id, CustomerOrder.user_id == user_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items = (
        db.query(CustomerOrderItem, SKU, Shade)
        .join(SKU, CustomerOrderItem.sku_id == SKU.id)
        .join(Shade, SKU.shade_id == Shade.id)
        .filter(CustomerOrderItem.order_id == order.id)
        .all()
    )
    order_items = []
    for oi, sku, shade in items:
        order_items.append({
            "item_id": oi.id,
            "sku_id": sku.id,
            "sku_code": sku.sku_code,
            "shade_name": shade.shade_name,
            "hex_color": shade.hex_color,
            "size": sku.size,
            "quantity": oi.quantity,
            "unit_price": oi.unit_price,
            "subtotal": round(oi.unit_price * oi.quantity, 2),
        })
    return {
        "order_id": order.id,
        "status": _normalize_request_status(order.status),
        "total_amount": order.total_amount,
        "dealer_id": order.dealer_id,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": order_items,
    }


def get_dealer_customer_requests(
    db: Session,
    dealer_id: int,
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
):
    """List customer order requests assigned to a dealer."""
    query = db.query(CustomerOrder).filter(CustomerOrder.dealer_id == dealer_id)
    if status:
        requested_status = status.lower()
        if requested_status == "requested":
            query = query.filter(CustomerOrder.status.in_(["requested", "placed"]))
        elif requested_status == "fulfilled":
            query = query.filter(CustomerOrder.status.in_(["fulfilled", "confirmed", "shipped", "delivered"]))
        else:
            query = query.filter(CustomerOrder.status == requested_status)

    total = query.count()
    orders = (
        query.order_by(CustomerOrder.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    requests = []
    for order in orders:
        customer = db.query(User).filter(User.id == order.user_id).first()
        items = (
            db.query(CustomerOrderItem, SKU, Shade)
            .join(SKU, CustomerOrderItem.sku_id == SKU.id)
            .join(Shade, SKU.shade_id == Shade.id)
            .filter(CustomerOrderItem.order_id == order.id)
            .all()
        )

        request_items = []
        for item, sku, shade in items:
            request_items.append({
                "item_id": item.id,
                "sku_id": sku.id,
                "sku_code": sku.sku_code,
                "shade_name": shade.shade_name,
                "hex_color": shade.hex_color,
                "size": sku.size,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": round(item.unit_price * item.quantity, 2),
            })

        normalized_status = _normalize_request_status(order.status)
        allowed_transitions = sorted(list(DEALER_REQUEST_TRANSITIONS.get(normalized_status, set())))

        requests.append({
            "order_id": order.id,
            "status": normalized_status,
            "allowed_transitions": allowed_transitions,
            "total_amount": order.total_amount,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "customer": {
                "id": customer.id if customer else order.user_id,
                "name": customer.full_name if customer else "Unknown Customer",
                "phone": customer.phone if customer else None,
                "email": customer.email if customer else None,
            },
            "items": request_items,
        })

    return {
        "requests": requests,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


def update_dealer_customer_request_status(
    db: Session,
    dealer_id: int,
    order_id: int,
    new_status: str,
):
    """Update a dealer-assigned customer request status with transition checks."""
    order = (
        db.query(CustomerOrder)
        .filter(CustomerOrder.id == order_id, CustomerOrder.dealer_id == dealer_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Customer request not found")

    normalized_current = _normalize_request_status(order.status)
    target = new_status.lower()

    allowed = DEALER_REQUEST_TRANSITIONS.get(normalized_current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{normalized_current}' to '{target}'. Allowed: {sorted(list(allowed))}",
        )

    try:
        order.status = target
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update order request status") from exc

    status_messages = {
        "contacted": "Dealer has contacted you for your order request.",
        "fulfilled": "Your order request has been fulfilled.",
        "cancelled": "Your order request was cancelled by the dealer.",
    }
    _notify_user_ids(
        db,
        [order.user_id],
        title="Order Request Update",
        message=status_messages.get(target, f"Order request status changed to {target}."),
        type="info" if target != "fulfilled" else "success",
        category="order",
        link="/customer/orders",
    )

    return {
        "success": True,
        "order_id": order.id,
        "old_status": normalized_current,
        "new_status": target,
        "message": f"Customer request #{order.id} updated to {target}",
    }
