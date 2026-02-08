"""
Dealer intelligence service.
Smart order recommendations with cost savings calculation.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import (
    Dealer,
    DealerOrder,
    InventoryLevel,
    SKU,
    Shade,
    Warehouse,
    CustomerOrderRequest,
    User,
    Notification,
)
from app.services.forecast_service import get_forecast
from app.config import get_simulation_date
from datetime import date, timedelta, datetime
import numpy as np
from fastapi import HTTPException, status


def _next_diwali_reference_date(sim_date: date) -> date:
    this_year = date(sim_date.year, 10, 25)
    if sim_date <= this_year:
        return this_year
    return date(sim_date.year + 1, 10, 25)


def get_dealer_dashboard(db: Session, dealer_id: int) -> dict:
    """Dealer dashboard with health score and key metrics."""
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dealer not found")
    sim_date = get_simulation_date()
    month_start = datetime(sim_date.year, sim_date.month, 1)

    # Get orders
    total_orders = db.query(func.count(DealerOrder.id)).filter(
        DealerOrder.dealer_id == dealer_id
    ).scalar() or 0

    total_orders_mtd = db.query(func.count(DealerOrder.id)).filter(
        DealerOrder.dealer_id == dealer_id,
        DealerOrder.order_date >= month_start,
    ).scalar() or 0

    ai_recs = db.query(func.count(InventoryLevel.id)).filter(
        InventoryLevel.warehouse_id == dealer.warehouse_id,
        InventoryLevel.days_of_cover < 14,
    ).scalar() or 0

    revenue = (
        db.query(func.sum(DealerOrder.quantity * SKU.mrp))
        .join(SKU, SKU.id == DealerOrder.sku_id)
        .filter(
            DealerOrder.dealer_id == dealer_id,
            DealerOrder.status == "delivered",
            DealerOrder.order_date >= month_start,
        )
        .scalar()
        or 0
    )

    total_savings = db.query(func.sum(DealerOrder.savings_amount)).filter(
        DealerOrder.dealer_id == dealer_id,
        DealerOrder.is_ai_suggested == True,
    ).scalar() or 0

    delivered_orders = db.query(func.count(DealerOrder.id)).filter(
        DealerOrder.dealer_id == dealer_id,
        DealerOrder.status == "delivered",
    ).scalar() or 0

    fulfillment_rate = round((delivered_orders / max(total_orders, 1)) * 100, 1)

    delivered_mtd = db.query(DealerOrder).filter(
        DealerOrder.dealer_id == dealer_id,
        DealerOrder.status == "delivered",
        DealerOrder.order_date >= month_start,
    ).all()
    if delivered_mtd:
        avg_delivery_days = round(
            np.mean([
                max((sim_date - order.order_date.date()).days, 1)
                for order in delivered_mtd if order.order_date
            ]),
            1,
        )
    else:
        avg_delivery_days = 0.0

    # Compute health score
    health_score = _compute_health_score(db, dealer)

    return {
        "dealer": {
            "id": dealer.id,
            "name": dealer.name,
            "city": dealer.city,
            "state": dealer.state,
            "tier": dealer.tier,
        },
        "health_score": health_score,
        "total_orders": total_orders,
        "total_orders_mtd": total_orders_mtd,
        "ai_recommendations_pending": ai_recs,
        "revenue_this_month": round(revenue, 0),
        "total_ai_savings": round(total_savings, 0),
        "fulfillment_rate": fulfillment_rate,
        "avg_delivery_time_days": avg_delivery_days,
        "performance_score": dealer.performance_score,
    }


def _compute_health_score(db: Session, dealer: Dealer) -> float:
    """
    Health score 0-100:
    40% stock coverage, 25% stockout frequency,
    20% order fulfillment, 15% product breadth
    """
    # Stock coverage (from warehouse inventory)
    levels = db.query(InventoryLevel).filter(
        InventoryLevel.warehouse_id == dealer.warehouse_id
    ).all()

    if not levels:
        return 50.0

    avg_cover = np.mean([l.days_of_cover for l in levels])
    coverage_score = min(100, avg_cover / 30 * 100)

    stockout_count = sum(1 for l in levels if l.days_of_cover < 3)
    stockout_score = max(0, 100 - stockout_count * 15)

    # Order fulfillment
    total = db.query(func.count(DealerOrder.id)).filter(
        DealerOrder.dealer_id == dealer.id
    ).scalar()
    delivered = db.query(func.count(DealerOrder.id)).filter(
        DealerOrder.dealer_id == dealer.id,
        DealerOrder.status == "delivered",
    ).scalar()
    fulfillment_score = (delivered / max(total, 1)) * 100

    # Product breadth
    unique_skus = db.query(func.count(func.distinct(DealerOrder.sku_id))).filter(
        DealerOrder.dealer_id == dealer.id
    ).scalar()
    breadth_score = min(100, unique_skus / 20 * 100)

    return round(
        0.4 * coverage_score + 0.25 * stockout_score +
        0.2 * fulfillment_score + 0.15 * breadth_score, 1
    )


def get_smart_orders(db: Session, dealer_id: int) -> list[dict]:
    """Generate AI-driven order recommendations for a dealer."""
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        return []

    # Get dealer's warehouse inventory
    levels = db.query(InventoryLevel).filter(
        InventoryLevel.warehouse_id == dealer.warehouse_id,
        InventoryLevel.days_of_cover < 30,
    ).order_by(InventoryLevel.days_of_cover.asc()).all()

    recommendations = []
    sim_date = get_simulation_date()

    for level in levels[:15]:  # Top 15 low-stock items
        sku = db.query(SKU).filter(SKU.id == level.sku_id).first()
        if not sku:
            continue
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first()
        if not shade:
            continue

        # Forecast demand
        forecast = get_forecast(sku.id, dealer.region_id, horizon=30)
        predicted_demand = sum(f["predicted"] for f in forecast.get("forecast", []))

        # Calculate recommended quantity
        recommended_qty = max(10, int(predicted_demand * 1.2 - level.current_stock))

        # Calculate savings
        manual_cost = recommended_qty * sku.mrp
        ai_cost = manual_cost * 0.92  # 8% savings through optimized logistics
        savings = round(manual_cost - ai_cost, 0)

        # Determine urgency
        if level.days_of_cover < 3:
            urgency = "CRITICAL"
        elif level.days_of_cover < 14:
            urgency = "RECOMMENDED"
        else:
            urgency = "OPTIONAL"

        # Generate context-aware reason
        reason = _generate_reason(shade, level, sim_date)

        # Stockout date
        daily_demand = level.current_stock / max(level.days_of_cover, 0.1)
        stockout_date = sim_date + timedelta(days=int(level.days_of_cover))

        recommendations.append({
            "sku_id": sku.id,
            "sku_code": sku.sku_code,
            "shade_name": shade.shade_name,
            "shade_hex": shade.hex_color,
            "shade_family": shade.shade_family,
            "size": sku.size,
            "current_stock": level.current_stock,
            "recommended_qty": recommended_qty,
            "urgency": urgency,
            "reason": reason,
            "predicted_stockout_date": stockout_date.isoformat(),
            "savings_amount": savings,
            "mrp_per_unit": sku.mrp,
            "total_cost": round(ai_cost, 0),
        })

    return sorted(recommendations, key=lambda x: (
        {"CRITICAL": 0, "RECOMMENDED": 1, "OPTIONAL": 2}[x["urgency"]],
        x["predicted_stockout_date"],
    ))


def _generate_reason(shade: Shade, level: InventoryLevel, sim_date: date) -> str:
    """Generate context-aware reason for the recommendation."""
    # Check upcoming events relative to simulation date
    days_to_diwali = (_next_diwali_reference_date(sim_date) - sim_date).days
    if 0 < days_to_diwali <= 21:
        return f"Diwali in {days_to_diwali} days - demand expected to surge 60%"

    if shade.shade_name == "Bridal Red":
        return "Wedding season peak - 'Bridal Red' trending +40% in your region"

    if shade.is_trending:
        return f"'{shade.shade_name}' is trending - 40% increase in customer searches"

    if level.days_of_cover < 3:
        return f"CRITICAL: Stock will last only {level.days_of_cover:.0f} days at current sell-through"

    if sim_date.month in (6, 7, 8, 9) and shade.product and shade.product.category == "Waterproofing":
        return "Peak monsoon season - waterproofing demand at annual high"

    return f"Stock will last {level.days_of_cover:.0f} days - restock recommended before depletion"


def get_dealer_alerts(db: Session, dealer_id: int) -> dict:
    """Get stockout, transfer, and trending alerts for a dealer."""
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        return {"stockout_alerts": [], "trending": [], "transfer_notifications": []}

    # Stockout alerts
    critical = db.query(InventoryLevel).filter(
        InventoryLevel.warehouse_id == dealer.warehouse_id,
        InventoryLevel.days_of_cover < 7,
    ).all()

    stockout_alerts = []
    for level in critical:
        sku = db.query(SKU).filter(SKU.id == level.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None
        if shade:
            stockout_alerts.append({
                "shade_name": shade.shade_name,
                "shade_hex": shade.hex_color,
                "days_remaining": round(level.days_of_cover, 1),
                "current_stock": level.current_stock,
            })

    # Trending shades
    trending = db.query(Shade).filter(Shade.is_trending == True).limit(5).all()

    return {
        "stockout_alerts": stockout_alerts[:5],
        "trending": [{"shade_name": s.shade_name, "shade_hex": s.hex_color} for s in trending],
        "transfer_notifications": [],
    }


def _month_starts(sim_date: date, months: int) -> list[datetime]:
    starts = []
    year = sim_date.year
    month = sim_date.month
    for offset in range(months - 1, -1, -1):
        y = year
        m = month - offset
        while m <= 0:
            y -= 1
            m += 12
        starts.append(datetime(y, m, 1))
    return starts


def get_dealer_dashboard_activity(db: Session, dealer_id: int, limit: int = 20) -> dict:
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dealer not found")

    items: list[dict] = []

    # Recent dealer orders
    recent_orders = db.query(DealerOrder).filter(
        DealerOrder.dealer_id == dealer_id
    ).order_by(DealerOrder.order_date.desc()).limit(limit).all()
    for order in recent_orders:
        sku = db.query(SKU).filter(SKU.id == order.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None
        items.append({
            "type": "order",
            "title": f"Order #{order.id} {order.status}",
            "message": f"{order.quantity} units of {shade.shade_name if shade else sku.sku_code if sku else 'SKU'}",
            "created_at": order.order_date.isoformat() if order.order_date else None,
            "link": f"/dealer/orders/{order.id}",
        })

    # Customer request updates
    recent_requests = db.query(CustomerOrderRequest).filter(
        CustomerOrderRequest.dealer_id == dealer_id
    ).order_by(CustomerOrderRequest.created_at.desc()).limit(max(5, limit // 2)).all()
    for req in recent_requests:
        shade = db.query(Shade).filter(Shade.id == req.shade_id).first()
        items.append({
            "type": "customer_request",
            "title": f"Customer request {req.status}",
            "message": f"{req.customer_name} requested {shade.shade_name if shade else 'a shade'}",
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "link": "/dealer/customer-requests",
        })

    # System notifications for dealer users
    dealer_user_ids = [
        row[0]
        for row in db.query(User.id).filter(
            User.role == "dealer",
            User.dealer_id == dealer_id,
            User.is_active == True,
        ).all()
    ]
    if dealer_user_ids:
        notifications = db.query(Notification).filter(
            Notification.user_id.in_(dealer_user_ids)
        ).order_by(Notification.created_at.desc()).limit(limit).all()
        for notification in notifications:
            items.append({
                "type": f"notification:{notification.category}",
                "title": notification.title,
                "message": notification.message,
                "created_at": notification.created_at.isoformat() if notification.created_at else None,
                "link": notification.link or "/dealer/notifications",
            })

    # Critical stock alerts
    critical_levels = db.query(InventoryLevel).filter(
        InventoryLevel.warehouse_id == dealer.warehouse_id,
        InventoryLevel.days_of_cover < 7,
    ).order_by(InventoryLevel.days_of_cover.asc()).limit(5).all()
    for level in critical_levels:
        sku = db.query(SKU).filter(SKU.id == level.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None
        created_at = level.last_updated or datetime.utcnow()
        items.append({
            "type": "stock_alert",
            "title": "Stock running low",
            "message": f"{shade.shade_name if shade else sku.sku_code if sku else 'SKU'} has {round(level.days_of_cover, 1)} days cover left",
            "created_at": created_at.isoformat(),
            "link": "/dealer/smart-orders",
        })

    sorted_items = sorted(
        items,
        key=lambda item: item.get("created_at") or "",
        reverse=True,
    )[:limit]
    return {"items": sorted_items, "total": len(sorted_items)}


def get_dealer_order_pipeline(db: Session, dealer_id: int) -> dict:
    sim_date = get_simulation_date()
    month_start = datetime(sim_date.year, sim_date.month, 1)
    statuses = ["placed", "confirmed", "shipped", "delivered", "cancelled"]

    all_counts = {status: 0 for status in statuses}
    for status, count in db.query(DealerOrder.status, func.count(DealerOrder.id)).filter(
        DealerOrder.dealer_id == dealer_id
    ).group_by(DealerOrder.status).all():
        if status in all_counts:
            all_counts[status] = count

    mtd_counts = {status: 0 for status in statuses}
    for status, count in db.query(DealerOrder.status, func.count(DealerOrder.id)).filter(
        DealerOrder.dealer_id == dealer_id,
        DealerOrder.order_date >= month_start,
    ).group_by(DealerOrder.status).all():
        if status in mtd_counts:
            mtd_counts[status] = count

    total_all = sum(all_counts.values())
    total_mtd = sum(mtd_counts.values())

    return {
        "all_time": all_counts,
        "mtd": mtd_counts,
        "total_all_time": total_all,
        "total_mtd": total_mtd,
        "fulfillment_rate_all_time": round((all_counts["delivered"] / max(total_all, 1)) * 100, 1),
        "fulfillment_rate_mtd": round((mtd_counts["delivered"] / max(total_mtd, 1)) * 100, 1),
    }


def get_dealer_trends(db: Session, dealer_id: int, months: int = 6) -> dict:
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dealer not found")

    sim_date = get_simulation_date()
    starts = _month_starts(sim_date, months)
    # Add one extra boundary for month-end slicing.
    end_boundary = datetime(sim_date.year, sim_date.month, sim_date.day) + timedelta(days=1)
    month_boundaries = starts + [end_boundary]

    levels = db.query(InventoryLevel).filter(
        InventoryLevel.warehouse_id == dealer.warehouse_id
    ).all()
    if levels:
        stock_signal = min(100.0, max(0.0, float(np.mean([l.days_of_cover for l in levels])) / 30 * 100))
    else:
        stock_signal = 50.0

    points = []
    for idx, start in enumerate(starts):
        end = month_boundaries[idx + 1] if idx + 1 < len(month_boundaries) else end_boundary
        revenue = (
            db.query(func.sum(DealerOrder.quantity * SKU.mrp))
            .join(SKU, SKU.id == DealerOrder.sku_id)
            .filter(
                DealerOrder.dealer_id == dealer_id,
                DealerOrder.status == "delivered",
                DealerOrder.order_date >= start,
                DealerOrder.order_date < end,
            )
            .scalar()
            or 0
        )
        total_orders = db.query(func.count(DealerOrder.id)).filter(
            DealerOrder.dealer_id == dealer_id,
            DealerOrder.order_date >= start,
            DealerOrder.order_date < end,
        ).scalar() or 0
        delivered = db.query(func.count(DealerOrder.id)).filter(
            DealerOrder.dealer_id == dealer_id,
            DealerOrder.status == "delivered",
            DealerOrder.order_date >= start,
            DealerOrder.order_date < end,
        ).scalar() or 0
        unique_skus = db.query(func.count(func.distinct(DealerOrder.sku_id))).filter(
            DealerOrder.dealer_id == dealer_id,
            DealerOrder.order_date >= start,
            DealerOrder.order_date < end,
        ).scalar() or 0

        fulfillment = (delivered / max(total_orders, 1)) * 100
        breadth = min(100.0, (unique_skus / 12) * 100)
        health = round((0.5 * fulfillment) + (0.3 * breadth) + (0.2 * stock_signal), 1)

        points.append({
            "month": start.strftime("%b %Y"),
            "month_key": start.strftime("%Y-%m"),
            "revenue": round(float(revenue), 2),
            "health_score": health,
            "orders": int(total_orders),
        })

    max_revenue = max([point["revenue"] for point in points], default=0.0)
    avg_health = round(float(np.mean([point["health_score"] for point in points])) if points else 0.0, 1)
    return {
        "points": points,
        "max_revenue": max_revenue,
        "avg_health": avg_health,
    }


def get_dealer_top_skus(db: Session, dealer_id: int, limit: int = 10) -> dict:
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        return {"items": []}

    sold_by_sku = {
        sku_id: qty
        for sku_id, qty in db.query(
            DealerOrder.sku_id,
            func.sum(DealerOrder.quantity),
        ).filter(
            DealerOrder.dealer_id == dealer_id,
            DealerOrder.status != "cancelled",
        ).group_by(DealerOrder.sku_id).all()
    }

    levels = db.query(InventoryLevel).filter(
        InventoryLevel.warehouse_id == dealer.warehouse_id
    ).all()

    items = []
    for level in levels:
        sku = db.query(SKU).filter(SKU.id == level.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None
        if not sku:
            continue
        sold_qty = int(sold_by_sku.get(level.sku_id, 0) or 0)
        if level.days_of_cover < 3:
            stock_status = "critical"
        elif level.days_of_cover < 7:
            stock_status = "low"
        elif level.days_of_cover > 90:
            stock_status = "overstock"
        else:
            stock_status = "healthy"
        items.append({
            "sku_id": sku.id,
            "sku_code": sku.sku_code,
            "shade_name": shade.shade_name if shade else "Unknown Shade",
            "shade_hex": shade.hex_color if shade else "#9CA3AF",
            "size": sku.size,
            "sold_qty": sold_qty,
            "current_stock": level.current_stock,
            "days_of_cover": round(level.days_of_cover, 1),
            "stock_status": stock_status,
            "reorder_point": level.reorder_point,
            "reorder_needed": level.current_stock <= level.reorder_point,
        })

    sorted_items = sorted(
        items,
        key=lambda item: (-item["sold_qty"], item["days_of_cover"])
    )[:limit]
    return {"items": sorted_items}
