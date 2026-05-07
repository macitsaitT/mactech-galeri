"""Iter 47 — 8 maddelik backlog backend testleri.

Coverage:
1. Phone validation 11-hane (customers create/update + users create)
2. Capital endpoint vehicles_capital + breakdown
3. Customer detail endpoint (purchased_cars + transactions + installments + totals)
4. Sale revert flow — Satıldı→Stokta, customer type 'Satış Yapıldı'→'Potansiyel'
5. Branch_id query filter (cars/customers/transactions/stats)
6. User branch_id field create/update
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://image-gallery-live.preview.emergentagent.com").rstrip("/")
EMAIL = "test_branch_6b287ede@test.com"
PASSWORD = "Password123!"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    body = r.json()
    return body.get("token") or body.get("access_token")


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def branch_id(auth):
    """Ensure at least one branch exists for branch_id tests."""
    r = requests.get(f"{BASE_URL}/api/branches", headers=auth, timeout=10)
    branches = r.json() if r.status_code == 200 else []
    if branches:
        return branches[0]["id"]
    # create one
    r = requests.post(
        f"{BASE_URL}/api/branches",
        headers=auth,
        json={"name": f"TEST_Branch_{uuid.uuid4().hex[:6]}", "address": "Test"},
        timeout=10,
    )
    if r.status_code in (200, 201):
        return r.json().get("id")
    pytest.skip(f"Could not create branch: {r.status_code} {r.text}")


# ==================== 1. PHONE VALIDATION ====================

class TestPhoneValidation:
    def test_customer_create_phone_10_digits_rejected(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/customers",
            headers=auth,
            json={"name": "TEST_Phone10", "phone": "5551234567", "type": "Potansiyel"},
            timeout=10,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        assert "11" in r.text or "telefon" in r.text.lower()

    def test_customer_create_phone_11_digits_accepted(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/customers",
            headers=auth,
            json={"name": f"TEST_Phone11_{uuid.uuid4().hex[:6]}", "phone": "05551234567", "type": "Potansiyel"},
            timeout=10,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        cid = r.json()["id"]
        # cleanup
        requests.delete(f"{BASE_URL}/api/customers/{cid}?permanent=true", headers=auth)

    def test_customer_update_phone_validation(self, auth):
        # create with valid phone first
        r = requests.post(
            f"{BASE_URL}/api/customers",
            headers=auth,
            json={"name": f"TEST_PhoneUpd_{uuid.uuid4().hex[:6]}", "phone": "05551234567", "type": "Potansiyel"},
            timeout=10,
        )
        assert r.status_code == 200
        cid = r.json()["id"]
        try:
            # try invalid 10-digit update
            r2 = requests.put(f"{BASE_URL}/api/customers/{cid}", headers=auth, json={"phone": "5551234"}, timeout=10)
            assert r2.status_code == 400, f"Expected 400, got {r2.status_code}: {r2.text}"
            # valid update
            r3 = requests.put(f"{BASE_URL}/api/customers/{cid}", headers=auth, json={"phone": "05559876543"}, timeout=10)
            assert r3.status_code == 200, f"{r3.status_code}: {r3.text}"
            assert r3.json()["phone"] == "05559876543"
        finally:
            requests.delete(f"{BASE_URL}/api/customers/{cid}?permanent=true", headers=auth)


# ==================== 2. CAPITAL VEHICLES ====================

class TestCapitalVehicles:
    def test_capital_has_vehicles_fields(self, auth):
        r = requests.get(f"{BASE_URL}/api/capital", headers=auth, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("vehicles_capital", "vehicles_count", "total_equity", "vehicles_breakdown"):
            assert k in data, f"missing field {k} in capital response: {list(data.keys())}"
        assert isinstance(data["vehicles_breakdown"], list)
        assert isinstance(data["vehicles_capital"], (int, float))
        # vehicles_capital should equal sum of breakdown purchase_price
        s = sum(float(c.get("purchase_price", 0) or 0) for c in data["vehicles_breakdown"])
        assert abs(s - data["vehicles_capital"]) < 0.01
        # total_equity == amount + vehicles_capital
        assert abs(data["total_equity"] - (float(data.get("amount", 0)) + data["vehicles_capital"])) < 0.01


# ==================== 3. CUSTOMER DETAIL ====================

class TestCustomerDetail:
    def test_customer_detail_invalid_id(self, auth):
        r = requests.get(f"{BASE_URL}/api/customers/nonexistent-id-xxx/detail", headers=auth, timeout=10)
        assert r.status_code == 404

    def test_customer_detail_shape(self, auth):
        # create a customer
        r = requests.post(
            f"{BASE_URL}/api/customers",
            headers=auth,
            json={"name": f"TEST_Detail_{uuid.uuid4().hex[:6]}", "phone": "05551112233", "type": "Potansiyel"},
            timeout=10,
        )
        assert r.status_code == 200
        cid = r.json()["id"]
        try:
            r2 = requests.get(f"{BASE_URL}/api/customers/{cid}/detail", headers=auth, timeout=10)
            assert r2.status_code == 200, r2.text
            data = r2.json()
            for k in ("customer", "purchased_cars", "transactions", "installments", "totals"):
                assert k in data, f"missing {k}"
            for k in ("total_purchases", "total_spent", "total_paid", "total_remaining"):
                assert k in data["totals"], f"missing totals.{k}"
            assert data["customer"]["id"] == cid
            assert isinstance(data["purchased_cars"], list)
        finally:
            requests.delete(f"{BASE_URL}/api/customers/{cid}?permanent=true", headers=auth)


# ==================== 4. SALE REVERT FLOW ====================

class TestSaleRevert:
    def test_sale_cancel_reverts_customer_type(self, auth):
        # create customer
        r = requests.post(
            f"{BASE_URL}/api/customers",
            headers=auth,
            json={"name": f"TEST_Revert_{uuid.uuid4().hex[:6]}", "phone": "05551239988", "type": "Potansiyel"},
            timeout=10,
        )
        assert r.status_code == 200
        cid = r.json()["id"]

        # create a car
        r = requests.post(
            f"{BASE_URL}/api/cars",
            headers=auth,
            json={
                "plate": f"34TEST{uuid.uuid4().hex[:4].upper()}",
                "brand": "Test",
                "model": "Revert",
                "year": 2020,
                "purchase_price": 100000,
                "sale_price": 120000,
                "status": "Stokta",
                "ownership": "stock",
            },
            timeout=10,
        )
        assert r.status_code in (200, 201), r.text
        car_id = r.json()["id"]

        try:
            # Mark customer as Satış Yapıldı
            r2 = requests.put(
                f"{BASE_URL}/api/customers/{cid}",
                headers=auth,
                json={"type": "Satış Yapıldı"},
                timeout=10,
            )
            assert r2.status_code == 200

            # Patch car: status=Satıldı + customer_id (this is normally done via sales endpoint
            # but PATCH with status change triggers revert logic; we set customer_id directly)
            r3 = requests.patch(
                f"{BASE_URL}/api/cars/{car_id}",
                headers=auth,
                json={"status": "Satıldı", "customer_id": cid, "sold_date": "2026-01-15", "sale_price": 120000},
                timeout=10,
            )
            assert r3.status_code == 200, r3.text

            # Now cancel sale: status -> Stokta
            r4 = requests.patch(
                f"{BASE_URL}/api/cars/{car_id}",
                headers=auth,
                json={"status": "Stokta"},
                timeout=10,
            )
            assert r4.status_code == 200, r4.text

            # customer type should be reverted to Potansiyel
            r5 = requests.get(f"{BASE_URL}/api/customers/{cid}/detail", headers=auth, timeout=10)
            assert r5.status_code == 200
            assert r5.json()["customer"]["type"] == "Potansiyel", \
                f"Customer type not reverted: {r5.json()['customer']['type']}"
        finally:
            requests.delete(f"{BASE_URL}/api/cars/{car_id}?permanent=true", headers=auth)
            requests.delete(f"{BASE_URL}/api/customers/{cid}?permanent=true", headers=auth)


# ==================== 5. BRANCH_ID FILTER ====================

class TestBranchFilter:
    def test_cars_branch_filter(self, auth, branch_id):
        # No filter
        r1 = requests.get(f"{BASE_URL}/api/cars", headers=auth, timeout=10)
        assert r1.status_code == 200
        all_cars = r1.json()
        # With branch
        r2 = requests.get(f"{BASE_URL}/api/cars?branch_id={branch_id}", headers=auth, timeout=10)
        assert r2.status_code == 200
        filt = r2.json()
        assert len(filt) <= len(all_cars)
        for c in filt:
            assert c.get("branch_id") == branch_id

    def test_customers_branch_filter(self, auth, branch_id):
        r1 = requests.get(f"{BASE_URL}/api/customers", headers=auth, timeout=10)
        assert r1.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/customers?branch_id={branch_id}", headers=auth, timeout=10)
        assert r2.status_code == 200
        for c in r2.json():
            assert c.get("branch_id") == branch_id

    def test_transactions_branch_filter(self, auth, branch_id):
        r2 = requests.get(f"{BASE_URL}/api/transactions?branch_id={branch_id}", headers=auth, timeout=10)
        assert r2.status_code == 200, r2.text
        for t in r2.json():
            assert t.get("branch_id") == branch_id

    def test_stats_branch_filter(self, auth, branch_id):
        r1 = requests.get(f"{BASE_URL}/api/stats", headers=auth, timeout=10)
        assert r1.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/stats?branch_id={branch_id}", headers=auth, timeout=10)
        assert r2.status_code == 200, r2.text


# ==================== 6. USER BRANCH_ID ====================

class TestUserBranch:
    def test_user_create_with_branch(self, auth, branch_id):
        email = f"test_subuser_{uuid.uuid4().hex[:6]}@test.com"
        r = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth,
            json={
                "email": email,
                "password": "Password123!",
                "company_name": "TEST Sub",
                "phone": "05551234567",
                "role": "satis",
                "branch_id": branch_id,
            },
            timeout=10,
        )
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"
        uid = r.json().get("id") or r.json().get("user_id")
        try:
            # Verify by listing users
            r2 = requests.get(f"{BASE_URL}/api/users", headers=auth, timeout=10)
            assert r2.status_code == 200
            users = r2.json()
            found = next((u for u in users if u.get("email") == email), None)
            assert found is not None, f"Created user not found in list"
            assert found.get("branch_id") == branch_id, f"branch_id missing: {found}"

            # Update branch_id to None
            if uid:
                r3 = requests.put(
                    f"{BASE_URL}/api/users/{uid}",
                    headers=auth,
                    json={"branch_id": None},
                    timeout=10,
                )
                assert r3.status_code == 200, r3.text
        finally:
            if uid:
                requests.delete(f"{BASE_URL}/api/users/{uid}", headers=auth)

    def test_user_create_invalid_phone(self, auth):
        email = f"test_badphone_{uuid.uuid4().hex[:6]}@test.com"
        r = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth,
            json={
                "email": email,
                "password": "Password123!",
                "company_name": "X",
                "phone": "5551234",
                "role": "satis",
            },
            timeout=10,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
