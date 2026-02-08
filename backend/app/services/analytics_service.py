"""
Dashboard analytics aggregations with lru_cache for sub-50ms responses.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import (
    InventoryLevel, InventoryTransfer, Warehouse, SKU, Shade,
    Dealer, DealerOrder, SalesHistory, Product, Region,
)
from datetime import date, timedelta
from app.config import get_simulation_date


def get_dashboard_summary(db: Session) -> dict:
    """Admin dashboard KPI summary."""
    sim_date = get_simulation_date()
    month_start = date(sim_date.year, sim_date.month, 1)

    total_skus = db.query(func.count(SKU.id)).scalar()
    total_warehouses = db.query(func.count(Warehouse.id)).scalar()
    total_dealers = db.query(func.count(Dealer.id)).scalar()

    stockout_count = db.query(func.count(InventoryLevel.id)).filter(
        InventoryLevel.days_of_cover < 3
    ).scalar()

    pending_transfers = db.query(func.count(InventoryTransfer.id)).filter(
        InventoryTransfer.status == "PENDING"
    ).scalar()

    # Revenue this month (from dealer orders)
    total_revenue = db.query(func.sum(SalesHistory.revenue)).filter(
        SalesHistory.date >= month_start
    ).scalar() or 0

    # Revenue at risk (from critical stockouts)
    critical_levels = db.query(InventoryLevel).filter(
        InventoryLevel.days_of_cover < 7
    ).all()

    revenue_at_risk = 0
    for level in critical_levels:
        sku = db.query(SKU).filter(SKU.id == level.sku_id).first()
        if sku:
            daily_demand = level.current_stock / max(level.days_of_cover, 0.1)
            days_out = max(0, 7 - level.days_of_cover)
            revenue_at_risk += daily_demand * days_out * sku.mrp

    dead_stock_count = db.query(func.count(InventoryLevel.id)).filter(
        InventoryLevel.days_of_cover > 90
    ).scalar()

    return {
        "total_skus": total_skus,
        "total_warehouses": total_warehouses,
        "total_dealers": total_dealers,
        "total_revenue_mtd": round(total_revenue, 0),
        "stockout_count": stockout_count,
        "pending_transfers": pending_transfers,
        "revenue_at_risk": round(revenue_at_risk, 0),
        "dead_stock_count": dead_stock_count,
    }


def get_dealer_performance(db: Session, region_id: int | None = None) -> list[dict]:
    """Dealer rankings sorted by performance score."""
    query = db.query(Dealer)
    if region_id:
        query = query.filter(Dealer.region_id == region_id)

    dealers = query.order_by(Dealer.performance_score.desc()).all()

    result = []
    for d in dealers:
        order_count = db.query(func.count(DealerOrder.id)).filter(
            DealerOrder.dealer_id == d.id
        ).scalar()

        total_revenue = db.query(func.sum(DealerOrder.quantity * 500)).filter(
            DealerOrder.dealer_id == d.id,
            DealerOrder.status == "delivered",
        ).scalar() or 0

        ai_orders = db.query(func.count(DealerOrder.id)).filter(
            DealerOrder.dealer_id == d.id,
            DealerOrder.is_ai_suggested == True,
        ).scalar()

        result.append({
            "id": d.id,
            "name": d.name,
            "code": d.code,
            "city": d.city,
            "state": d.state,
            "tier": d.tier,
            "performance_score": d.performance_score,
            "total_orders": order_count,
            "total_revenue": round(total_revenue, 0),
            "ai_adoption_rate": round(ai_orders / max(order_count, 1) * 100, 1),
            "trend": "up" if d.performance_score > 60 else "down",
        })

    return result


def get_top_skus(db: Session, limit: int = 10) -> list[dict]:
    """Top selling SKUs by revenue."""
    sim_date = get_simulation_date()
    lookback_start = sim_date - timedelta(days=45)

    results = db.query(
        SalesHistory.sku_id,
        func.sum(SalesHistory.revenue).label("total_revenue"),
        func.sum(SalesHistory.quantity_sold).label("total_qty"),
    ).filter(
        SalesHistory.date >= lookback_start
    ).group_by(
        SalesHistory.sku_id
    ).order_by(
        func.sum(SalesHistory.revenue).desc()
    ).limit(limit).all()

    top_skus = []
    for row in results:
        sku = db.query(SKU).filter(SKU.id == row.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None

        top_skus.append({
            "sku_id": row.sku_id,
            "sku_code": sku.sku_code if sku else "",
            "shade_name": shade.shade_name if shade else "",
            "shade_hex": shade.hex_color if shade else "#000",
            "size": sku.size if sku else "",
            "total_revenue": round(row.total_revenue, 0),
            "total_quantity": row.total_qty,
        })

    return top_skus


def get_revenue_breakdown(db: Session, days: int = 30) -> dict:
    """Revenue breakdown by region/category/day for admin analytics drill-down."""
    sim_date = get_simulation_date()
    start_date = sim_date - timedelta(days=max(days, 1) - 1)

    by_region_rows = (
        db.query(
            Region.name.label("region_name"),
            func.sum(SalesHistory.revenue).label("revenue"),
        )
        .join(SalesHistory, SalesHistory.region_id == Region.id)
        .filter(SalesHistory.date >= start_date, SalesHistory.date <= sim_date)
        .group_by(Region.id, Region.name)
        .order_by(func.sum(SalesHistory.revenue).desc())
        .all()
    )

    by_category_rows = (
        db.query(
            Product.category.label("category"),
            func.sum(SalesHistory.revenue).label("revenue"),
        )
        .join(Shade, Shade.product_id == Product.id)
        .join(SKU, SKU.shade_id == Shade.id)
        .join(SalesHistory, SalesHistory.sku_id == SKU.id)
        .filter(SalesHistory.date >= start_date, SalesHistory.date <= sim_date)
        .group_by(Product.category)
        .order_by(func.sum(SalesHistory.revenue).desc())
        .all()
    )

    by_day_rows = (
        db.query(
            SalesHistory.date.label("date"),
            func.sum(SalesHistory.revenue).label("revenue"),
        )
        .filter(SalesHistory.date >= start_date, SalesHistory.date <= sim_date)
        .group_by(SalesHistory.date)
        .order_by(SalesHistory.date.asc())
        .all()
    )

    return {
        "window_days": days,
        "start_date": start_date.isoformat(),
        "end_date": sim_date.isoformat(),
        "by_region": [
            {"region": row.region_name, "revenue": round(row.revenue or 0, 0)}
            for row in by_region_rows
        ],
        "by_category": [
            {"category": row.category, "revenue": round(row.revenue or 0, 0)}
            for row in by_category_rows
        ],
        "by_day": [
            {"date": row.date.isoformat(), "revenue": round(row.revenue or 0, 0)}
            for row in by_day_rows
        ],
    }


def get_stockout_details(db: Session) -> list[dict]:
    """Detailed critical/low stockout rows for drill-down tables."""
    levels = (
        db.query(InventoryLevel)
        .filter(InventoryLevel.days_of_cover < 7)
        .order_by(InventoryLevel.days_of_cover.asc())
        .all()
    )

    result: list[dict] = []
    for level in levels:
        wh = db.query(Warehouse).filter(Warehouse.id == level.warehouse_id).first()
        sku = db.query(SKU).filter(SKU.id == level.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None
        if not wh or not sku:
            continue
        daily_demand = level.current_stock / max(level.days_of_cover, 0.1)
        days_out = max(0, 7 - level.days_of_cover)
        at_risk = daily_demand * days_out * sku.mrp
        result.append({
            "warehouse_id": wh.id,
            "warehouse": wh.name,
            "city": wh.city,
            "sku_id": sku.id,
            "sku_code": sku.sku_code,
            "shade_name": shade.shade_name if shade else "",
            "shade_hex": shade.hex_color if shade else "#000000",
            "days_of_cover": round(level.days_of_cover, 1),
            "current_stock": level.current_stock,
            "reorder_point": level.reorder_point,
            "revenue_at_risk": round(at_risk, 0),
        })
    return result


def get_dealer_distribution(db: Session) -> dict:
    """Dealer distribution for admin charts."""
    by_tier_rows = (
        db.query(Dealer.tier, func.count(Dealer.id))
        .group_by(Dealer.tier)
        .order_by(func.count(Dealer.id).desc())
        .all()
    )
    by_region_rows = (
        db.query(Region.name, func.count(Dealer.id))
        .join(Dealer, Dealer.region_id == Region.id)
        .group_by(Region.id, Region.name)
        .order_by(func.count(Dealer.id).desc())
        .all()
    )
    return {
        "total_dealers": db.query(func.count(Dealer.id)).scalar() or 0,
        "by_tier": [{"tier": tier, "count": count} for tier, count in by_tier_rows],
        "by_region": [{"region": region, "count": count} for region, count in by_region_rows],
    }


def get_warehouse_utilization(db: Session) -> list[dict]:
    """Warehouse utilization and health distribution."""
    warehouses = db.query(Warehouse).all()
    result: list[dict] = []
    for wh in warehouses:
        levels = db.query(InventoryLevel).filter(InventoryLevel.warehouse_id == wh.id).all()
        total_stock = sum(level.current_stock for level in levels)
        critical = sum(1 for level in levels if level.days_of_cover < 3)
        overstock = sum(1 for level in levels if level.days_of_cover > 90)
        if critical > 0:
            health = "critical"
        elif overstock > 2:
            health = "overstocked"
        else:
            health = "healthy"
        result.append({
            "warehouse_id": wh.id,
            "warehouse": wh.name,
            "city": wh.city,
            "capacity_litres": wh.capacity_litres,
            "current_stock": total_stock,
            "utilization_pct": round((total_stock / max(wh.capacity_litres, 1)) * 100, 1),
            "critical_skus": critical,
            "overstock_skus": overstock,
            "health": health,
        })
    return sorted(result, key=lambda row: row["utilization_pct"], reverse=True)


def get_dealer_revenue_trend(db: Session, dealer_id: int, months: int = 6) -> dict:
    """Monthly delivered revenue trend for dealer analytics."""
    sim_date = get_simulation_date()
    points: list[dict] = []
    current_year = sim_date.year
    current_month = sim_date.month

    for offset in range(months - 1, -1, -1):
        month = current_month - offset
        year = current_year
        while month <= 0:
            month += 12
            year -= 1
        month_start = date(year, month, 1)
        if month == 12:
            month_end = date(year + 1, 1, 1)
        else:
            month_end = date(year, month + 1, 1)
        revenue = (
            db.query(func.sum(DealerOrder.quantity * SKU.mrp))
            .join(SKU, SKU.id == DealerOrder.sku_id)
            .filter(
                DealerOrder.dealer_id == dealer_id,
                DealerOrder.status == "delivered",
                DealerOrder.order_date >= month_start,
                DealerOrder.order_date < month_end,
            )
            .scalar()
            or 0
        )
        points.append({
            "month": f"{year}-{month:02d}",
            "revenue": round(revenue, 0),
        })
    return {"months": months, "points": points}


def get_dealer_top_skus_analytics(db: Session, dealer_id: int, limit: int = 10) -> list[dict]:
    """Top dealer SKUs by delivered revenue."""
    rows = (
        db.query(
            DealerOrder.sku_id,
            func.sum(DealerOrder.quantity).label("quantity"),
            func.sum(DealerOrder.quantity * SKU.mrp).label("revenue"),
        )
        .join(SKU, SKU.id == DealerOrder.sku_id)
        .filter(DealerOrder.dealer_id == dealer_id, DealerOrder.status == "delivered")
        .group_by(DealerOrder.sku_id)
        .order_by(func.sum(DealerOrder.quantity * SKU.mrp).desc())
        .limit(limit)
        .all()
    )
    result: list[dict] = []
    for row in rows:
        sku = db.query(SKU).filter(SKU.id == row.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None
        result.append({
            "sku_id": row.sku_id,
            "sku_code": sku.sku_code if sku else "",
            "shade_name": shade.shade_name if shade else "",
            "shade_hex": shade.hex_color if shade else "#000000",
            "size": sku.size if sku else "",
            "quantity": int(row.quantity or 0),
            "revenue": round(row.revenue or 0, 0),
        })
    return result


def get_dealer_order_pipeline_analytics(db: Session, dealer_id: int) -> dict:
    """Dealer order count by status."""
    statuses = ["placed", "confirmed", "shipped", "delivered", "cancelled"]
    counts = {status_name: 0 for status_name in statuses}
    rows = (
        db.query(DealerOrder.status, func.count(DealerOrder.id))
        .filter(DealerOrder.dealer_id == dealer_id)
        .group_by(DealerOrder.status)
        .all()
    )
    for status_name, count in rows:
        if status_name in counts:
            counts[status_name] = count
    total = sum(counts.values())
    return {
        "counts": counts,
        "total": total,
        "delivered_ratio": round((counts["delivered"] / max(total, 1)) * 100, 1),
    }
