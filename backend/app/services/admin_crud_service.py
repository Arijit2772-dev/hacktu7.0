"""Admin CRUD operations for products, shades, SKUs, warehouses, dealers, inventory."""

import json
import uuid
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi import HTTPException, status
from datetime import datetime

from app.models import (
    Product, Shade, SKU, Warehouse, Dealer, Region,
    InventoryLevel, InventoryTransfer,
)


# ─── Products ───

def _serialize_sizes(sizes: list[str] | str | None) -> str:
    if sizes is None:
        return '["1L","4L","10L","20L"]'
    if isinstance(sizes, str):
        return sizes
    if not sizes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sizes_available cannot be empty")
    return json.dumps(sizes)


def create_product(
    db: Session,
    name: str,
    category: str,
    sub_category: str,
    base_type: str,
    finish: str,
    sizes_available: list[str] | str | None,
    price_per_litre: float,
):
    product = Product(
        name=name,
        category=category,
        sub_category=sub_category,
        base_type=base_type,
        finish=finish,
        sizes_available=_serialize_sizes(sizes_available),
        price_per_litre=price_per_litre,
    )
    db.add(product)
    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or duplicate product data")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create product")
    return product


def update_product(db: Session, product_id: int, **kwargs):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if "sizes_available" in kwargs and kwargs["sizes_available"] is not None:
        kwargs["sizes_available"] = _serialize_sizes(kwargs["sizes_available"])
    for key, val in kwargs.items():
        if val is not None:
            setattr(product, key, val)
    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product update data")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update product")
    return product


def delete_product(db: Session, product_id: int):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete product")
    return {"success": True, "message": f"Product '{product.name}' deleted"}


def list_products(db: Session):
    products = db.query(Product).order_by(Product.id).all()
    return [
        {
            "id": p.id, "name": p.name, "category": p.category,
            "sub_category": p.sub_category,
            "base_type": p.base_type,
            "sizes_available": p.sizes_available,
            "finish": p.finish, "price_per_litre": p.price_per_litre,
            "shade_count": db.query(Shade).filter(Shade.product_id == p.id).count(),
        }
        for p in products
    ]


# ─── Shades ───

def create_shade(db: Session, product_id: int, shade_name: str, hex_color: str,
                  shade_family: str, is_trending: bool = False):
    r, g, b = int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)
    shade_code = f"CUS-{shade_family[:3].upper()}-{uuid.uuid4().hex[:6].upper()}"
    shade = Shade(
        product_id=product_id, shade_code=shade_code, shade_name=shade_name,
        hex_color=hex_color, rgb_r=r, rgb_g=g, rgb_b=b,
        shade_family=shade_family, is_trending=is_trending,
    )
    db.add(shade)
    try:
        db.commit()
        db.refresh(shade)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or duplicate shade data")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create shade")
    return shade


def update_shade(db: Session, shade_id: int, **kwargs):
    shade = db.query(Shade).filter(Shade.id == shade_id).first()
    if not shade:
        raise HTTPException(status_code=404, detail="Shade not found")
    for key, val in kwargs.items():
        if val is not None:
            setattr(shade, key, val)
    if "hex_color" in kwargs and kwargs["hex_color"]:
        hex_color = kwargs["hex_color"]
        shade.rgb_r = int(hex_color[1:3], 16)
        shade.rgb_g = int(hex_color[3:5], 16)
        shade.rgb_b = int(hex_color[5:7], 16)
    try:
        db.commit()
        db.refresh(shade)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid shade update data")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update shade")
    return shade


def delete_shade(db: Session, shade_id: int):
    shade = db.query(Shade).filter(Shade.id == shade_id).first()
    if not shade:
        raise HTTPException(status_code=404, detail="Shade not found")
    db.delete(shade)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete shade")
    return {"success": True, "message": f"Shade '{shade.shade_name}' deleted"}


# ─── SKUs ───

def create_sku(db: Session, shade_id: int, size: str, unit_cost: float, mrp: float):
    shade = db.query(Shade).filter(Shade.id == shade_id).first()
    if not shade:
        raise HTTPException(status_code=404, detail="Shade not found")
    product = db.query(Product).filter(Product.id == shade.product_id).first()
    sku_code = f"{product.name[:3].upper()}-{shade.shade_code}-{size}"
    sku = SKU(shade_id=shade_id, size=size, sku_code=sku_code, unit_cost=unit_cost, mrp=mrp)
    db.add(sku)
    try:
        db.commit()
        db.refresh(sku)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or duplicate SKU data")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create SKU")
    return sku


# ─── Warehouses ───

def create_warehouse(db: Session, **kwargs):
    warehouse = Warehouse(**kwargs)
    db.add(warehouse)
    try:
        db.commit()
        db.refresh(warehouse)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or duplicate warehouse data")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create warehouse")
    return warehouse


def list_warehouses(db: Session):
    warehouses = db.query(Warehouse).order_by(Warehouse.id).all()
    return [
        {
            "id": w.id, "name": w.name, "code": w.code,
            "city": w.city, "state": w.state,
            "region_id": w.region_id,
            "capacity_litres": w.capacity_litres,
            "latitude": w.latitude, "longitude": w.longitude,
            "sku_count": db.query(InventoryLevel).filter(InventoryLevel.warehouse_id == w.id).count(),
        }
        for w in warehouses
    ]


# ─── Dealers ───

def update_dealer(db: Session, dealer_id: int, **kwargs):
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    for key, val in kwargs.items():
        if val is not None:
            setattr(dealer, key, val)
    try:
        db.commit()
        db.refresh(dealer)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update dealer")
    return dealer


# ─── Inventory ───

def adjust_inventory(db: Session, warehouse_id: int, sku_id: int, adjustment: int, reason: str):
    level = db.query(InventoryLevel).filter(
        InventoryLevel.warehouse_id == warehouse_id,
        InventoryLevel.sku_id == sku_id,
    ).first()

    if not level:
        if adjustment < 0:
            raise HTTPException(status_code=400, detail="No inventory record to decrease")
        level = InventoryLevel(
            warehouse_id=warehouse_id, sku_id=sku_id,
            current_stock=adjustment, reorder_point=50, max_capacity=5000,
            days_of_cover=0, last_updated=datetime.utcnow(),
        )
        db.add(level)
    else:
        new_stock = level.current_stock + adjustment
        if new_stock < 0:
            raise HTTPException(status_code=400, detail="Insufficient stock for adjustment")
        level.current_stock = new_stock
        level.last_updated = datetime.utcnow()

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to adjust inventory")
    return {
        "success": True,
        "message": f"Inventory adjusted by {adjustment:+d} units. Reason: {reason}",
        "new_stock": level.current_stock,
    }


# ─── Transfers ───

def create_transfer(db: Session, from_warehouse_id: int, to_warehouse_id: int,
                     sku_id: int, quantity: int, reason: str):
    transfer = InventoryTransfer(
        from_warehouse_id=from_warehouse_id,
        to_warehouse_id=to_warehouse_id,
        sku_id=sku_id,
        quantity=quantity,
        status="PENDING",
        reason=reason,
        recommended_at=datetime.utcnow(),
    )
    db.add(transfer)
    try:
        db.commit()
        db.refresh(transfer)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create transfer")
    return {"success": True, "transfer_id": transfer.id, "message": "Transfer created"}


def complete_transfer(db: Session, transfer_id: int):
    transfer = db.query(InventoryTransfer).filter(InventoryTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status not in ("APPROVED", "IN_TRANSIT"):
        raise HTTPException(status_code=400, detail=f"Cannot complete transfer in {transfer.status} status")
    transfer.status = "COMPLETED"
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to complete transfer")
    return {"success": True, "message": "Transfer completed"}


def reject_transfer(db: Session, transfer_id: int):
    transfer = db.query(InventoryTransfer).filter(InventoryTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != "PENDING":
        raise HTTPException(status_code=400, detail="Only pending transfers can be rejected")
    transfer.status = "REJECTED"
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reject transfer")
    return {"success": True, "message": "Transfer rejected"}
