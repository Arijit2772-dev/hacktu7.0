"""
Inventory orchestration service.
Transfer recommendations, auto-balance, inventory health.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from app.models import InventoryLevel, InventoryTransfer, Warehouse, SKU, Shade, Dealer
from app.models.user import User
from datetime import datetime
import logging


logger = logging.getLogger("paintflow.inventory")


def get_warehouse_map_data(db: Session) -> list[dict]:
    """Get all warehouses with inventory status for the map."""
    warehouses = db.query(Warehouse).all()
    result = []

    for wh in warehouses:
        levels = db.query(InventoryLevel).filter(
            InventoryLevel.warehouse_id == wh.id
        ).all()

        total_stock = sum(l.current_stock for l in levels)
        critical_count = sum(1 for l in levels if l.days_of_cover < 3)
        low_count = sum(1 for l in levels if 3 <= l.days_of_cover < 14)
        overstock_count = sum(1 for l in levels if l.days_of_cover > 90)

        if critical_count > 0:
            status = "critical"
        elif low_count > 2:
            status = "low"
        elif overstock_count > 2:
            status = "overstocked"
        else:
            status = "healthy"

        # Revenue at risk calculation
        revenue_at_risk = 0
        for l in levels:
            if l.days_of_cover < 7:
                sku = db.query(SKU).filter(SKU.id == l.sku_id).first()
                if sku:
                    daily_demand = l.current_stock / max(l.days_of_cover, 0.1)
                    days_out = max(0, 7 - l.days_of_cover)
                    revenue_at_risk += daily_demand * days_out * sku.mrp

        result.append({
            "id": wh.id,
            "name": wh.name,
            "code": wh.code,
            "city": wh.city,
            "state": wh.state,
            "latitude": wh.latitude,
            "longitude": wh.longitude,
            "capacity": wh.capacity_litres,
            "total_stock": total_stock,
            "capacity_pct": round(total_stock / max(wh.capacity_litres, 1) * 100, 1),
            "critical_skus": critical_count,
            "low_skus": low_count,
            "overstock_skus": overstock_count,
            "status": status,
            "revenue_at_risk": round(revenue_at_risk, 0),
        })

    return result


def get_warehouse_inventory(db: Session, warehouse_id: int) -> list[dict]:
    """Get detailed inventory for a specific warehouse."""
    levels = db.query(InventoryLevel).filter(
        InventoryLevel.warehouse_id == warehouse_id
    ).all()

    result = []
    for level in levels:
        sku = db.query(SKU).filter(SKU.id == level.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None

        if level.days_of_cover < 3:
            status = "critical"
        elif level.days_of_cover < 14:
            status = "low"
        elif level.days_of_cover > 90:
            status = "overstocked"
        else:
            status = "healthy"

        result.append({
            "id": level.id,
            "sku_id": sku.id if sku else None,
            "sku_code": sku.sku_code if sku else "",
            "shade_name": shade.shade_name if shade else "",
            "shade_hex": shade.hex_color if shade else "#000",
            "size": sku.size if sku else "",
            "current_stock": level.current_stock,
            "reorder_point": level.reorder_point,
            "days_of_cover": level.days_of_cover,
            "status": status,
        })

    return sorted(result, key=lambda x: x["days_of_cover"])


def get_recommended_transfers(db: Session) -> list[dict]:
    """Get all pending transfer recommendations."""
    transfers = db.query(InventoryTransfer).filter(
        InventoryTransfer.status.in_(["PENDING", "APPROVED", "IN_TRANSIT"])
    ).all()

    result = []
    for t in transfers:
        from_wh = db.query(Warehouse).filter(Warehouse.id == t.from_warehouse_id).first()
        to_wh = db.query(Warehouse).filter(Warehouse.id == t.to_warehouse_id).first()
        sku = db.query(SKU).filter(SKU.id == t.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None

        result.append({
            "id": t.id,
            "from_warehouse": {"id": from_wh.id, "name": from_wh.name, "city": from_wh.city, "state": from_wh.state,
                               "lat": from_wh.latitude, "lng": from_wh.longitude} if from_wh else None,
            "to_warehouse": {"id": to_wh.id, "name": to_wh.name, "city": to_wh.city, "state": to_wh.state,
                             "lat": to_wh.latitude, "lng": to_wh.longitude} if to_wh else None,
            "sku_code": sku.sku_code if sku else "",
            "shade_name": shade.shade_name if shade else "",
            "shade_hex": shade.hex_color if shade else "#000",
            "quantity": t.quantity,
            "status": t.status,
            "reason": t.reason,
            "recommended_at": t.recommended_at.isoformat() if t.recommended_at else None,
        })

    return result


def approve_transfer(db: Session, transfer_id: int) -> dict:
    """Approve a transfer and optimistically update inventory."""
    transfer = db.query(InventoryTransfer).filter(InventoryTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")
    if transfer.status not in {"PENDING", "APPROVED"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transfer cannot be approved from status '{transfer.status}'",
        )
    if transfer.quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer quantity must be positive")

    from_level = (
        db.query(InventoryLevel)
        .filter(
            InventoryLevel.warehouse_id == transfer.from_warehouse_id,
            InventoryLevel.sku_id == transfer.sku_id,
        )
        .first()
    )
    if not from_level:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source warehouse inventory record not found",
        )
    if from_level.current_stock < transfer.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock in source warehouse ({from_level.current_stock} available)",
        )

    to_level = (
        db.query(InventoryLevel)
        .filter(
            InventoryLevel.warehouse_id == transfer.to_warehouse_id,
            InventoryLevel.sku_id == transfer.sku_id,
        )
        .first()
    )

    try:
        transfer.status = "IN_TRANSIT"

        from_level.current_stock -= transfer.quantity
        from_level.days_of_cover = round(from_level.current_stock / max(transfer.quantity / 30, 1), 1)

        if not to_level:
            to_level = InventoryLevel(
                warehouse_id=transfer.to_warehouse_id,
                sku_id=transfer.sku_id,
                current_stock=0,
                reorder_point=max(from_level.reorder_point, 1),
                max_capacity=max(from_level.max_capacity, transfer.quantity * 2),
                days_of_cover=0,
                last_updated=datetime.utcnow(),
            )
            db.add(to_level)

        to_level.current_stock += transfer.quantity
        to_level.days_of_cover = round(to_level.current_stock / max(transfer.quantity / 30, 1), 1)
        to_level.last_updated = datetime.utcnow()
        from_level.last_updated = datetime.utcnow()
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to approve transfer %s", transfer_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to approve transfer") from exc

    to_wh = db.query(Warehouse).filter(Warehouse.id == transfer.to_warehouse_id).first()
    from_wh = db.query(Warehouse).filter(Warehouse.id == transfer.from_warehouse_id).first()
    sku = db.query(SKU).filter(SKU.id == transfer.sku_id).first()
    shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None
    shade_name = shade.shade_name if shade else "product"
    from_city = from_wh.city if from_wh else "source warehouse"
    to_city = to_wh.city if to_wh else "destination warehouse"

    try:
        from app.services.notification_service import create_notifications_for_users
        admin_ids = [row[0] for row in db.query(User.id).filter(User.role == "admin", User.is_active == True).all()]
        dealer_ids = [
            row[0]
            for row in db.query(Dealer.id).filter(
                Dealer.warehouse_id.in_([transfer.from_warehouse_id, transfer.to_warehouse_id])
            ).all()
        ]
        dealer_user_ids = []
        if dealer_ids:
            dealer_user_ids = [
                row[0]
                for row in db.query(User.id).filter(
                    User.role == "dealer",
                    User.dealer_id.in_(dealer_ids),
                    User.is_active == True,
                ).all()
            ]
        create_notifications_for_users(
            db,
            admin_ids + dealer_user_ids,
            title="Transfer Approved",
            message=f"{transfer.quantity} units of {shade_name} moving from {from_city} to {to_city}.",
            type="success",
            category="transfer",
            link="/admin/transfers",
        )
    except Exception as e:
        logger.warning("Failed to create transfer notifications: %s", e)

    return {
        "success": True,
        "message": f"Transfer approved. {transfer.quantity} units of {shade_name} "
                   f"moving from {from_city} to {to_city}. ETA: 2 days.",
        "transfer_id": transfer.id,
    }


def get_dead_stock(db: Session) -> list[dict]:
    """Get SKUs with > 90 days of cover (dead stock)."""
    levels = db.query(InventoryLevel).filter(
        InventoryLevel.days_of_cover > 90
    ).all()

    result = []
    for level in levels:
        wh = db.query(Warehouse).filter(Warehouse.id == level.warehouse_id).first()
        sku = db.query(SKU).filter(SKU.id == level.sku_id).first()
        shade = db.query(Shade).filter(Shade.id == sku.shade_id).first() if sku else None

        result.append({
            "warehouse": wh.name if wh else "",
            "warehouse_city": wh.city if wh else "",
            "sku_code": sku.sku_code if sku else "",
            "shade_name": shade.shade_name if shade else "",
            "shade_hex": shade.hex_color if shade else "#000",
            "size": sku.size if sku else "",
            "current_stock": level.current_stock,
            "days_of_cover": level.days_of_cover,
            "capital_locked": round(level.current_stock * (sku.unit_cost if sku else 0), 0),
            "recommendation": "Transfer to high-demand warehouse" if level.days_of_cover > 120 else "Run promotion",
        })

    return sorted(result, key=lambda x: -x["days_of_cover"])
