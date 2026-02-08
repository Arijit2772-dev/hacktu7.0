from fastapi.testclient import TestClient
import uuid

from app.main import app
from app.database import SessionLocal
from app.models.audit import AuditLog
from app.models.user import User
from app.services.auth_service import authenticate_user, create_access_token, ensure_bootstrap_admin


client = TestClient(app)


def _admin_headers():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == "admin", User.is_active == True).first()
        assert admin is not None
        token = create_access_token(admin.id, admin.role)
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def test_admin_api_requires_authentication():
    response = client.get("/api/admin/dashboard/summary")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_invalid_scenario_returns_404():
    response = client.get("/api/simulate/scenario/UNKNOWN_SCENARIO/data")
    assert response.status_code == 404
    assert response.json()["detail"] == "Scenario not found"


def test_legacy_order_request_endpoint_is_not_public():
    payload = {
        "customer_name": "Test User",
        "customer_phone": "9000000000",
        "shade_id": 1,
        "size_preference": "4L",
        "dealer_id": 1,
    }
    response = client.post("/api/customer/order-request", json=payload)
    assert response.status_code == 401


def test_auth_rate_limit_on_login_endpoint():
    payload = {"email": "missing@example.com", "password": "wrong-password"}
    final_status = None
    for _ in range(11):
        response = client.post("/api/auth/login", json=payload)
        final_status = response.status_code
    assert final_status == 429


def test_mutating_requests_are_audited():
    db = SessionLocal()
    before = db.query(AuditLog).count()
    db.close()

    client.post("/api/auth/login", json={"email": "audit@example.com", "password": "bad-password"})

    db = SessionLocal()
    after = db.query(AuditLog).count()
    latest = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    db.close()

    assert after >= before + 1
    assert latest is not None
    assert latest.path == "/api/auth/login"
    assert latest.method == "POST"


def test_ops_health_and_metrics_endpoints():
    live = client.get("/api/health/live")
    assert live.status_code == 200
    assert live.json()["status"] == "alive"

    ready = client.get("/api/health/ready")
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"
    assert ready.json()["checks"]["database"]["ok"] is True

    metrics = client.get("/api/metrics")
    assert metrics.status_code == 200
    payload = metrics.json()
    assert "requests" in payload
    assert "total" in payload["requests"]
    assert "latency_ms" in payload["requests"]

    prom = client.get("/api/metrics?format=prometheus")
    assert prom.status_code == 200
    assert "paintflow_http_requests_total" in prom.text


def test_request_id_and_timing_headers_present():
    response = client.get("/api/meta")
    assert response.status_code == 200
    assert response.headers.get("x-request-id")
    assert response.headers.get("x-response-time-ms")

    not_found = client.get("/api/simulate/scenario/UNKNOWN_SCENARIO/data")
    assert not_found.status_code == 404
    assert not_found.headers.get("x-request-id")


def test_refresh_token_rotation_invalidates_old_token():
    email = f"rotate-{uuid.uuid4().hex[:8]}@example.com"
    register_payload = {
        "email": email,
        "password": "securepass123",
        "full_name": "Rotation User",
        "phone": "9000000000",
    }
    register_response = client.post("/api/auth/register", json=register_payload)
    assert register_response.status_code == 200
    first_refresh = register_response.json()["refresh_token"]

    refresh_response = client.post("/api/auth/refresh", json={"refresh_token": first_refresh})
    assert refresh_response.status_code == 200
    second_refresh = refresh_response.json()["refresh_token"]
    assert second_refresh != first_refresh

    old_refresh_reuse = client.post("/api/auth/refresh", json={"refresh_token": first_refresh})
    assert old_refresh_reuse.status_code == 401


def test_logout_revokes_refresh_session():
    email = f"logout-{uuid.uuid4().hex[:8]}@example.com"
    register_payload = {
        "email": email,
        "password": "securepass123",
        "full_name": "Logout User",
        "phone": "9000000000",
    }
    register_response = client.post("/api/auth/register", json=register_payload)
    assert register_response.status_code == 200
    refresh_token = register_response.json()["refresh_token"]

    logout_response = client.post("/api/auth/logout", json={"refresh_token": refresh_token})
    assert logout_response.status_code == 200
    assert logout_response.json()["success"] is True

    refresh_response = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_response.status_code == 401


def test_bootstrap_admin_upgrades_existing_user_role():
    email = f"bootstrap-{uuid.uuid4().hex[:8]}@example.com"
    register_payload = {
        "email": email,
        "password": "securepass123",
        "full_name": "Bootstrap Candidate",
        "phone": "9000000000",
    }
    register_response = client.post("/api/auth/register", json=register_payload)
    assert register_response.status_code == 200

    db = SessionLocal()
    try:
        changed = ensure_bootstrap_admin(
            db,
            email=email,
            password="newadminpass123",
            full_name="Bootstrap Admin",
        )
        assert changed is True

        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.role == "admin"
        assert user.is_active is True
        assert user.full_name == "Bootstrap Admin"
    finally:
        db.close()

    db = SessionLocal()
    try:
        admin_user = authenticate_user(db, email, "newadminpass123")
        assert admin_user.role == "admin"
    finally:
        db.close()


def test_admin_can_create_product_with_frontend_minimal_payload():
    headers = _admin_headers()

    payload = {
        "name": f"Smoke Product {uuid.uuid4().hex[:6]}",
        "category": "Interior Wall",
        "finish": "Matt",
        "price_per_litre": 320,
    }
    create_response = client.post("/api/admin/products", headers=headers, json=payload)
    assert create_response.status_code == 200, create_response.text
    product_id = create_response.json()["product"]["id"]

    delete_response = client.delete(f"/api/admin/products/{product_id}", headers=headers)
    assert delete_response.status_code == 200, delete_response.text
