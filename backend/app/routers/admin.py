from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.analytics_service import get_dashboard_summary, get_dealer_performance, get_top_skus
from app.services.inventory_service import (
    get_warehouse_map_data, get_warehouse_inventory,
    get_recommended_transfers, approve_transfer, get_dead_stock,
)
from app.services.admin_crud_service import (
    create_product, update_product, delete_product, list_products,
    create_shade, update_shade, delete_shade,
    create_sku,
    create_warehouse, list_warehouses,
    update_dealer,
    adjust_inventory,
    create_transfer, complete_transfer, reject_transfer,
)
from app.schemas.admin import (
    ProductCreate, ProductUpdate, ShadeCreate, ShadeUpdate, SKUCreate,
    WarehouseCreate, DealerUpdate, InventoryAdjustment, TransferCreate,
)

router = APIRouter()


# ─── Dashboard ───

@router.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    return get_dashboard_summary(db)


# ─── Inventory Map ───

@router.get("/inventory/map")
def inventory_map(db: Session = Depends(get_db)):
    return get_warehouse_map_data(db)


@router.get("/inventory/warehouse/{warehouse_id}")
def warehouse_inventory(warehouse_id: int, db: Session = Depends(get_db)):
    return get_warehouse_inventory(db, warehouse_id)


# ─── Dead Stock ───

@router.get("/dead-stock")
def dead_stock(db: Session = Depends(get_db)):
    return get_dead_stock(db)


# ─── Transfers ───

@router.get("/transfers/recommended")
def recommended_transfers(db: Session = Depends(get_db)):
    return get_recommended_transfers(db)


@router.post("/transfers")
def create_transfer_endpoint(data: TransferCreate, db: Session = Depends(get_db)):
    return create_transfer(db, data.from_warehouse_id, data.to_warehouse_id,
                            data.sku_id, data.quantity, data.reason)


@router.post("/transfers/{transfer_id}/approve")
def approve_transfer_endpoint(transfer_id: int, db: Session = Depends(get_db)):
    return approve_transfer(db, transfer_id)


@router.post("/transfers/{transfer_id}/auto-balance")
def auto_balance(transfer_id: int, db: Session = Depends(get_db)):
    """Auto-balance: approve transfer with optimized quantity calculation."""
    result = approve_transfer(db, transfer_id)
    result["auto_balanced"] = True
    result["message"] = result.get("message", "Transfer approved") + " (auto-balanced)"
    return result


@router.post("/transfers/{transfer_id}/complete")
def complete_transfer_endpoint(transfer_id: int, db: Session = Depends(get_db)):
    return complete_transfer(db, transfer_id)


@router.post("/transfers/{transfer_id}/reject")
def reject_transfer_endpoint(transfer_id: int, db: Session = Depends(get_db)):
    return reject_transfer(db, transfer_id)


# ─── Dealers ───

@router.get("/dealers/performance")
def dealer_performance(region_id: int = None, db: Session = Depends(get_db)):
    return get_dealer_performance(db, region_id)


@router.put("/dealers/{dealer_id}")
def update_dealer_endpoint(dealer_id: int, data: DealerUpdate, db: Session = Depends(get_db)):
    return update_dealer(db, dealer_id, **data.model_dump(exclude_unset=True))


# ─── Products CRUD ───

@router.get("/products")
def get_products(db: Session = Depends(get_db)):
    return list_products(db)


@router.post("/products")
def create_product_endpoint(data: ProductCreate, db: Session = Depends(get_db)):
    p = create_product(db, data.name, data.category, data.finish, data.price_per_litre)
    return {"success": True, "product": {"id": p.id, "name": p.name}}


@router.put("/products/{product_id}")
def update_product_endpoint(product_id: int, data: ProductUpdate, db: Session = Depends(get_db)):
    p = update_product(db, product_id, **data.model_dump(exclude_unset=True))
    return {"success": True, "product": {"id": p.id, "name": p.name}}


@router.delete("/products/{product_id}")
def delete_product_endpoint(product_id: int, db: Session = Depends(get_db)):
    return delete_product(db, product_id)


# ─── Shades CRUD ───

@router.post("/shades")
def create_shade_endpoint(data: ShadeCreate, db: Session = Depends(get_db)):
    s = create_shade(db, data.product_id, data.shade_name, data.hex_color,
                      data.shade_family, data.is_trending)
    return {"success": True, "shade": {"id": s.id, "shade_name": s.shade_name}}


@router.put("/shades/{shade_id}")
def update_shade_endpoint(shade_id: int, data: ShadeUpdate, db: Session = Depends(get_db)):
    s = update_shade(db, shade_id, **data.model_dump(exclude_unset=True))
    return {"success": True, "shade": {"id": s.id, "shade_name": s.shade_name}}


@router.delete("/shades/{shade_id}")
def delete_shade_endpoint(shade_id: int, db: Session = Depends(get_db)):
    return delete_shade(db, shade_id)


# ─── SKUs ───

@router.post("/skus")
def create_sku_endpoint(data: SKUCreate, db: Session = Depends(get_db)):
    s = create_sku(db, data.shade_id, data.size, data.unit_cost, data.mrp)
    return {"success": True, "sku": {"id": s.id, "sku_code": s.sku_code}}


# ─── Warehouses ───

@router.get("/warehouses")
def get_warehouses(db: Session = Depends(get_db)):
    return list_warehouses(db)


@router.post("/warehouses")
def create_warehouse_endpoint(data: WarehouseCreate, db: Session = Depends(get_db)):
    w = create_warehouse(db, **data.model_dump())
    return {"success": True, "warehouse": {"id": w.id, "name": w.name}}


# ─── Inventory Adjustments ───

@router.post("/inventory/adjust")
def adjust_inventory_endpoint(data: InventoryAdjustment, db: Session = Depends(get_db)):
    return adjust_inventory(db, data.warehouse_id, data.sku_id, data.adjustment, data.reason)


# ─── Top SKUs ───

@router.get("/top-skus")
def top_skus(limit: int = 10, db: Session = Depends(get_db)):
    return get_top_skus(db, limit)
