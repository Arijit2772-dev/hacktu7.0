from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import Shade, SKU, Product, Dealer, InventoryLevel
from app.models.user import User
from app.middleware.auth import require_customer
from app.schemas.customer import CartItemAdd, CartItemUpdate, CheckoutRequest
from app.services.customer_service import (
    get_cart, add_to_cart, update_cart_item, remove_from_cart,
    get_wishlist, add_to_wishlist, remove_from_wishlist,
    checkout, get_my_orders, get_order_detail,
)
import math

router = APIRouter()


class OrderRequestCreate(BaseModel):
    customer_name: str
    customer_phone: str
    shade_id: int
    size_preference: str = "4L"
    dealer_id: int


# ─── Public endpoints (no auth required) ──────────────────────────

@router.get("/shades")
def get_shades(
    family: str = None, category: str = None, trending: bool = None,
    db: Session = Depends(get_db),
):
    query = db.query(Shade)
    if family:
        query = query.filter(Shade.shade_family == family)
    if trending is not None:
        query = query.filter(Shade.is_trending == trending)

    shades = query.all()
    result = []
    for s in shades:
        product = db.query(Product).filter(Product.id == s.product_id).first()
        if category and product and product.category != category:
            continue
        result.append({
            "id": s.id,
            "shade_code": s.shade_code,
            "shade_name": s.shade_name,
            "hex_color": s.hex_color,
            "shade_family": s.shade_family,
            "is_trending": s.is_trending,
            "product_name": product.name if product else "",
            "product_category": product.category if product else "",
            "finish": product.finish if product else "",
        })
    return result


@router.get("/shades/{shade_id}")
def get_shade_detail(shade_id: int, db: Session = Depends(get_db)):
    shade = db.query(Shade).filter(Shade.id == shade_id).first()
    if not shade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shade not found")

    product = db.query(Product).filter(Product.id == shade.product_id).first()
    skus = db.query(SKU).filter(SKU.shade_id == shade.id).all()

    return {
        "id": shade.id,
        "shade_code": shade.shade_code,
        "shade_name": shade.shade_name,
        "hex_color": shade.hex_color,
        "rgb": {"r": shade.rgb_r, "g": shade.rgb_g, "b": shade.rgb_b},
        "shade_family": shade.shade_family,
        "is_trending": shade.is_trending,
        "product": {
            "name": product.name if product else "",
            "category": product.category if product else "",
            "finish": product.finish if product else "",
            "base_type": product.base_type if product else "",
        },
        "sizes": [
            {"size": sku.size, "sku_code": sku.sku_code, "mrp": sku.mrp, "sku_id": sku.id}
            for sku in sorted(skus, key=lambda x: float(x.size.replace("L", "")))
        ],
    }


@router.get("/shades/{shade_id}/availability")
def shade_availability(shade_id: int, lat: float, lng: float, db: Session = Depends(get_db)):
    """Find nearby dealers with stock for this shade."""
    shade = db.query(Shade).filter(Shade.id == shade_id).first()
    if not shade:
        return []

    sku = db.query(SKU).filter(SKU.shade_id == shade_id, SKU.size == "4L").first()
    if not sku:
        return []

    dealers = db.query(Dealer).all()
    results = []

    for dealer in dealers:
        dist = _haversine(lat, lng, dealer.latitude, dealer.longitude)
        if dist > 50:
            continue

        level = db.query(InventoryLevel).filter(
            InventoryLevel.warehouse_id == dealer.warehouse_id,
            InventoryLevel.sku_id == sku.id,
        ).first()

        stock = level.current_stock if level else 0
        if stock > 50:
            stock_status = "In Stock"
        elif stock > 0:
            stock_status = "Low Stock"
        else:
            stock_status = "Out of Stock"

        results.append({
            "dealer_id": dealer.id,
            "dealer_name": dealer.name,
            "city": dealer.city,
            "distance_km": round(dist, 1),
            "stock_status": stock_status,
            "stock_qty": stock,
            "latitude": dealer.latitude,
            "longitude": dealer.longitude,
        })

    return sorted(results, key=lambda x: x["distance_km"])[:10]


@router.get("/dealers/nearby")
def nearby_dealers(lat: float, lng: float, db: Session = Depends(get_db)):
    dealers = db.query(Dealer).all()
    results = []
    for d in dealers:
        dist = _haversine(lat, lng, d.latitude, d.longitude)
        if dist < 50:
            results.append({
                "id": d.id,
                "name": d.name,
                "city": d.city,
                "distance_km": round(dist, 1),
                "tier": d.tier,
                "latitude": d.latitude,
                "longitude": d.longitude,
            })
    return sorted(results, key=lambda x: x["distance_km"])[:10]


@router.post("/order-request")
def create_order_request(
    _req: OrderRequestCreate,
    _user: User = Depends(require_customer),
):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Legacy endpoint removed. Use authenticated cart + /api/customer/me/checkout.",
    )


@router.post("/snap-find")
async def snap_and_find(hex_color: str = "#FFD700", db: Session = Depends(get_db)):
    target_r, target_g, target_b = _hex_to_rgb(hex_color)
    shades = db.query(Shade).all()
    best_match = None
    best_distance = float("inf")

    for shade in shades:
        dist = math.sqrt(
            (shade.rgb_r - target_r) ** 2 +
            (shade.rgb_g - target_g) ** 2 +
            (shade.rgb_b - target_b) ** 2
        )
        if dist < best_distance:
            best_distance = dist
            best_match = shade

    if not best_match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No matching shade found")

    product = db.query(Product).filter(Product.id == best_match.product_id).first()

    return {
        "detected_color": {"hex": hex_color, "rgb": {"r": target_r, "g": target_g, "b": target_b}},
        "match": {
            "shade_name": best_match.shade_name,
            "shade_code": best_match.shade_code,
            "hex_color": best_match.hex_color,
            "shade_family": best_match.shade_family,
            "product_name": product.name if product else "",
            "confidence": round(max(0, 100 - best_distance / 4.41), 1),
        },
        "shade_id": best_match.id,
    }


# ─── Authenticated endpoints (cart, wishlist, orders) ──────────────

@router.get("/me/cart")
def get_my_cart(user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return get_cart(db, user.id)


@router.post("/me/cart")
def add_cart_item(data: CartItemAdd, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return add_to_cart(db, user.id, data.sku_id, data.quantity)


@router.put("/me/cart/{cart_id}")
def update_cart(cart_id: int, data: CartItemUpdate, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return update_cart_item(db, user.id, cart_id, data.quantity)


@router.delete("/me/cart/{cart_id}")
def delete_cart_item(cart_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return remove_from_cart(db, user.id, cart_id)


@router.get("/me/wishlist")
def get_my_wishlist(user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return get_wishlist(db, user.id)


@router.post("/me/wishlist/{shade_id}")
def add_wishlist_item(shade_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return add_to_wishlist(db, user.id, shade_id)


@router.delete("/me/wishlist/{wishlist_id}")
def delete_wishlist_item(wishlist_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return remove_from_wishlist(db, user.id, wishlist_id)


@router.post("/me/checkout")
def checkout_cart(data: CheckoutRequest, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return checkout(db, user.id, data.dealer_id)


@router.get("/me/orders")
def list_my_orders(user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return get_my_orders(db, user.id)


@router.get("/me/orders/{order_id}")
def my_order_detail(order_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)):
    return get_order_detail(db, user.id, order_id)


# ─── Helpers ──────────────────────────────────────────────────────

def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _hex_to_rgb(hex_color: str):
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
