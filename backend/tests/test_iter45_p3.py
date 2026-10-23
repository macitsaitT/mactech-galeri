"""Iter 45 P3 tests: Digest Settings UI, Wanted Cars, Receivables, Stock Aging."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "test_branch_6b287ede@test.com"
ADMIN_PASSWORD = "Password123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def satis_headers(admin_headers):
    """Create ephemeral satis sub-user for 403 checks."""
    email = f"TEST_satis_{uuid.uuid4().hex[:6]}@test.com"
    payload = {"email": email, "password": "Password123!", "company_name": "TEST satis", "role": "satis"}
    r = requests.post(f"{BASE_URL}/api/users", json=payload, headers=admin_headers)
    if r.status_code not in (200, 201):
        pytest.skip(f"Cannot create satis user: {r.status_code} {r.text}")
    user_id = r.json().get("id")
    # login
    lr = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Password123!"})
    assert lr.status_code == 200, lr.text
    tok = lr.json().get("token") or lr.json().get("access_token")
    yield {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    # teardown
    if user_id:
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers)


# ===== Digest Settings =====
class TestDigestSettings:
    def test_get_settings_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/digest/settings", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("enabled", "day", "hour", "recipient", "timezone"):
            assert k in data, f"missing key {k}"
        assert isinstance(data["hour"], int)

    def test_get_settings_satis_403(self, satis_headers):
        r = requests.get(f"{BASE_URL}/api/digest/settings", headers=satis_headers)
        assert r.status_code == 403

    def test_put_settings_persists(self, admin_headers):
        body = {"enabled": True, "day": "fri", "hour": 18}
        r = requests.put(f"{BASE_URL}/api/digest/settings", json=body, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["day"] == "fri" and data["hour"] == 18 and data["enabled"] is True

        # Verify persistence via GET
        g = requests.get(f"{BASE_URL}/api/digest/settings", headers=admin_headers)
        assert g.status_code == 200
        gd = g.json()
        assert gd["day"] == "fri" and gd["hour"] == 18 and gd["enabled"] is True

        # Reset to default
        requests.put(f"{BASE_URL}/api/digest/settings",
                     json={"enabled": True, "day": "mon", "hour": 9}, headers=admin_headers)


# ===== Wanted Cars =====
@pytest.fixture(scope="module")
def test_customer(admin_headers):
    payload = {"name": f"TEST_WantedCust_{uuid.uuid4().hex[:6]}", "phone": "5551234567"}
    r = requests.post(f"{BASE_URL}/api/customers", json=payload, headers=admin_headers)
    assert r.status_code in (200, 201), r.text
    cid = r.json().get("id")
    yield cid
    requests.delete(f"{BASE_URL}/api/customers/{cid}", headers=admin_headers)


class TestWantedCars:
    wid = None

    def test_create_wanted_invalid_customer(self, admin_headers):
        body = {"customer_id": "non-existent-id", "brand": "BMW"}
        r = requests.post(f"{BASE_URL}/api/wanted-cars", json=body, headers=admin_headers)
        assert r.status_code == 404

    def test_create_wanted(self, admin_headers, test_customer):
        body = {
            "customer_id": test_customer,
            "brand": "BMW",
            "model": "320",
            "year_min": 2015,
            "year_max": 2024,
            "budget_max": 2000000,
        }
        r = requests.post(f"{BASE_URL}/api/wanted-cars", json=body, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["customer_id"] == test_customer
        assert data["brand"] == "BMW"
        assert "match_count" in data
        assert isinstance(data["match_count"], int)
        TestWantedCars.wid = data["id"]

    def test_list_wanted(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/wanted-cars", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for it in items:
            assert "match_count" in it

    def test_matches_endpoint(self, admin_headers):
        wid = TestWantedCars.wid
        assert wid, "create test must run first"
        r = requests.get(f"{BASE_URL}/api/wanted-cars/{wid}/matches", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "wanted_car" in data and "matches" in data and "count" in data
        assert data["count"] == len(data["matches"])

    def test_matches_for_car(self, admin_headers):
        # Get any car
        cr = requests.get(f"{BASE_URL}/api/cars", headers=admin_headers)
        assert cr.status_code == 200
        cars = cr.json()
        if not cars:
            pytest.skip("No cars in stock to test matches-for-car")
        car_id = cars[0]["id"]
        r = requests.get(f"{BASE_URL}/api/wanted-cars/matches-for-car/{car_id}", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "matching_requests" in data and "count" in data

    def test_delete_wanted(self, admin_headers):
        wid = TestWantedCars.wid
        r = requests.delete(f"{BASE_URL}/api/wanted-cars/{wid}", headers=admin_headers)
        assert r.status_code == 200
        # Should not appear in list
        lr = requests.get(f"{BASE_URL}/api/wanted-cars", headers=admin_headers)
        ids = [it["id"] for it in lr.json()]
        assert wid not in ids


# ===== Installments Overdue =====
class TestInstallmentsOverdue:
    def test_overdue_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/installments/overdue/list", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rows" in data and "totals" in data
        assert isinstance(data["rows"], list)
        for k in ("overdue_count", "overdue_amount", "upcoming_count", "total_remaining"):
            assert k in data["totals"]
        for row in data["rows"]:
            for k in ("installment_id", "customer_name", "per_term_amount", "paid_amount",
                      "expected_paid", "overdue_amount", "remaining_amount", "days_overdue", "is_overdue"):
                assert k in row, f"missing key {k}"


# ===== Stock Aging =====
class TestStockAging:
    def test_stock_aging(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/stats/stock-aging", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rows" in data and "buckets" in data and "totals" in data
        for b in ("0-30", "31-60", "61-90", "91+"):
            assert b in data["buckets"]
        for k in ("total_cars", "stale_cars", "total_capital", "daily_cost"):
            assert k in data["totals"]
        for row in data["rows"]:
            for k in ("plate", "brand", "model", "days_in_stock", "daily_cost",
                      "accumulated_cost", "is_stale"):
                assert k in row
