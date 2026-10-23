"""
Iter 51 — Verify Car Pydantic model now exposes sold_by_user_id and sold_by_name in GET /api/cars.
This was the P3 action item from iter50 (CarBase extended at models.py:80-82).
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "test_branch_6b287ede@test.com"
ADMIN_PASS = "Password123!"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_user(admin_headers):
    r = requests.get(f"{BASE}/api/auth/me", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    return r.json()


class TestSoldByFieldsInCarResponse:
    """P3 from iter50 — Car Pydantic model must expose sold_by_user_id and sold_by_name."""

    def test_get_cars_list_contains_sold_by_fields(self, admin_headers):
        r = requests.get(f"{BASE}/api/cars", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        cars = r.json()
        assert isinstance(cars, list)
        if not cars:
            pytest.skip("No cars in org — cannot verify field surface")
        sample = cars[0]
        # Even if value is empty string, the fields must EXIST on the response model
        assert "sold_by_user_id" in sample, f"sold_by_user_id missing from GET /api/cars: keys={list(sample.keys())}"
        assert "sold_by_name" in sample, f"sold_by_name missing from GET /api/cars: keys={list(sample.keys())}"

    def test_patch_satildi_then_get_returns_sold_by(self, admin_headers, admin_user):
        suffix = uuid.uuid4().hex[:6].upper()
        plate = f"34IT{suffix}"
        r = requests.post(f"{BASE}/api/cars", headers=admin_headers, json={
            "brand": "TEST", "model": "Iter51SoldBy", "year": 2022, "plate": plate,
            "sale_price": 600000, "purchase_price": 400000, "ownership": "stock",
            "fuel_type": "Dizel", "gear": "Otomatik", "status": "Stokta",
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
        car_id = r.json()["id"]
        try:
            seller_name = admin_user.get("name") or admin_user.get("company_name") or "Admin"
            r = requests.patch(f"{BASE}/api/cars/{car_id}", headers=admin_headers, json={
                "status": "Satıldı",
                "sold_by_user_id": admin_user["id"],
                "sold_by_name": seller_name,
            }, timeout=15)
            assert r.status_code == 200, r.text

            # GET single & list must show the persisted fields
            r = requests.get(f"{BASE}/api/cars", headers=admin_headers, timeout=15)
            assert r.status_code == 200
            cars = r.json()
            target = next((c for c in cars if c.get("id") == car_id), None)
            assert target is not None, "Sold car not in /api/cars list"
            assert target.get("sold_by_user_id") == admin_user["id"], target
            assert target.get("sold_by_name") == seller_name, target
        finally:
            requests.delete(f"{BASE}/api/cars/{car_id}?permanent=true", headers=admin_headers, timeout=10)
