"""Iteration 31 backend tests - Sales/Capital/Customer flows."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://image-gallery-live.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Try the existing test account first
    creds = {"email": "test_branch_6b287ede@test.com", "password": "Password123!"}
    r = s.post(f"{API}/auth/login", json=creds)
    if r.status_code != 200:
        # Register fresh account
        suffix = uuid.uuid4().hex[:8]
        creds = {
            "email": f"iter31_{suffix}@test.com",
            "password": "Password123!",
            "company_name": f"Iter31 {suffix}",
            "phone": "5550000000",
        }
        rr = s.post(f"{API}/auth/register", json=creds)
        assert rr.status_code in (200, 201), f"register failed: {rr.status_code} {rr.text}"
        r = s.post(f"{API}/auth/login", json={"email": creds["email"], "password": creds["password"]})
    assert r.status_code == 200, f"login failed: {r.text}"
    token = r.json().get("token") or r.json().get("access_token")
    assert token, f"no token in {r.json()}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---- Capital baseline ----
def test_get_capital(auth_session):
    r = auth_session.get(f"{API}/capital")
    assert r.status_code == 200
    body = r.json()
    assert "amount" in body


def test_get_capital_movements(auth_session):
    r = auth_session.get(f"{API}/capital/movements")
    assert r.status_code == 200
    assert "movements" in r.json()


# ---- Branches regression ----
def test_branches_list(auth_session):
    r = auth_session.get(f"{API}/branches")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_branches_crud(auth_session):
    name = f"TEST_iter31_{uuid.uuid4().hex[:6]}"
    r = auth_session.post(f"{API}/branches", json={"name": name})
    assert r.status_code == 200, r.text
    bid = r.json().get("id")
    assert bid
    # update
    r2 = auth_session.put(f"{API}/branches/{bid}", json={"name": name + "_upd"})
    assert r2.status_code == 200
    # delete
    r3 = auth_session.delete(f"{API}/branches/{bid}")
    assert r3.status_code == 200


# ---- Customer DELETE (used by bulk delete) ----
def test_customer_delete(auth_session):
    name = f"TEST_iter31_cust_{uuid.uuid4().hex[:6]}"
    rc = auth_session.post(f"{API}/customers", json={"name": name, "phone": "5551111111", "type": "Potansiyel"})
    assert rc.status_code == 200, rc.text
    cid = rc.json()["id"]
    rd = auth_session.delete(f"{API}/customers/{cid}")
    assert rd.status_code in (200, 204), rd.text


# ---- Negative-capital allowed expense ----
def test_expense_allows_negative_capital(auth_session):
    # Create a car
    car_payload = {
        "brand": "TEST", "model": f"X{uuid.uuid4().hex[:4]}", "year": 2020,
        "plate": f"34T{uuid.uuid4().hex[:4].upper()}", "purchase_price": 0,
        "status": "Stokta",
    }
    rc = auth_session.post(f"{API}/cars", json=car_payload)
    assert rc.status_code == 200, rc.text
    car_id = rc.json()["id"]

    # Get current capital
    cap = auth_session.get(f"{API}/capital").json().get("amount", 0)

    # Set capital to 0 to ensure expense will push negative
    rs = auth_session.post(f"{API}/capital/set", json={"amount": 0, "description": "test reset"})
    assert rs.status_code == 200, rs.text

    # Now post an expense — should NOT raise insufficient_capital (allow_negative=True)
    exp = {
        "type": "expense",
        "category": "Araç Masrafı",
        "description": "Boya",
        "amount": 5000,
        "date": "2026-01-15",
        "car_id": car_id,
    }
    re = auth_session.post(f"{API}/transactions", json=exp)
    assert re.status_code == 200, f"Expected 200 even with empty capital, got {re.status_code}: {re.text}"
    tx_id = re.json()["id"]

    # Capital should now be -5000
    cap2 = auth_session.get(f"{API}/capital").json().get("amount", 0)
    assert cap2 == pytest.approx(-5000), f"Expected -5000, got {cap2}"

    # Cleanup: delete tx and reset capital
    auth_session.delete(f"{API}/transactions/{tx_id}?permanent=true")
    auth_session.post(f"{API}/capital/set", json={"amount": cap, "description": "restore"})


# ---- Full sale flow end-to-end ----
def test_full_sale_flow(auth_session):
    # 1. Create car
    car_payload = {
        "brand": "TEST", "model": f"S{uuid.uuid4().hex[:4]}", "year": 2021,
        "plate": f"34S{uuid.uuid4().hex[:4].upper()}", "purchase_price": 100000,
        "status": "Stokta", "ownership": "stock",
    }
    rc = auth_session.post(f"{API}/cars", json=car_payload)
    assert rc.status_code == 200, rc.text
    car_id = rc.json()["id"]

    # 2. PATCH car to Satıldı with employee_share
    upd = {
        "status": "Satıldı",
        "sale_price": 130000,
        "employee_share": 5000,
        "sold_by": "Test Çalışan",
        "sold_date": "2026-01-15",
    }
    ru = auth_session.patch(f"{API}/cars/{car_id}", json=upd)
    assert ru.status_code == 200, ru.text

    # 3. Income: Araç Satışı
    inc = {
        "type": "income", "category": "Araç Satışı",
        "description": f"TEST Sale {car_id}", "amount": 130000,
        "date": "2026-01-15", "car_id": car_id,
    }
    ri = auth_session.post(f"{API}/transactions", json=inc)
    assert ri.status_code == 200, ri.text
    inc_id = ri.json()["id"]

    # 4. Expense: Çalışan Payı
    exp = {
        "type": "expense", "category": "Çalışan Payı",
        "description": f"TEST emp share {car_id}", "amount": 5000,
        "date": "2026-01-15", "car_id": car_id,
        "employee_name": "Test Çalışan",
    }
    re = auth_session.post(f"{API}/transactions", json=exp)
    assert re.status_code == 200, re.text
    exp_id = re.json()["id"]

    # Cleanup
    auth_session.delete(f"{API}/transactions/{inc_id}?permanent=true")
    auth_session.delete(f"{API}/transactions/{exp_id}?permanent=true")
    auth_session.delete(f"{API}/cars/{car_id}?permanent=true")


# ---- DELETE manual capital movement: revert balance ----
def test_delete_manual_movement(auth_session):
    # Snapshot capital
    before = float(auth_session.get(f"{API}/capital").json().get("amount", 0))

    # Create a manual deposit
    rd = auth_session.post(f"{API}/capital/adjust", json={"amount": 1234, "type": "deposit", "description": "TEST_iter31"})
    assert rd.status_code == 200, rd.text
    after_deposit = float(auth_session.get(f"{API}/capital").json().get("amount", 0))
    assert after_deposit == pytest.approx(before + 1234)

    # List movements; find the latest manual_deposit with our description
    mvs = auth_session.get(f"{API}/capital/movements?limit=20").json().get("movements", [])
    target = next((m for m in mvs if m.get("reason") == "manual_deposit" and "TEST_iter31" in (m.get("description") or "")), None)
    assert target, f"manual movement not found in {mvs[:3]}"
    mv_id = target["id"]

    # Delete it
    rd2 = auth_session.delete(f"{API}/capital/movements/{mv_id}")
    assert rd2.status_code == 200, rd2.text

    # Balance reverted
    after_delete = float(auth_session.get(f"{API}/capital").json().get("amount", 0))
    assert after_delete == pytest.approx(before), f"Expected {before}, got {after_delete}"


# ---- DELETE transaction-bound movement should 400 ----
def test_delete_transaction_movement_blocked(auth_session):
    # Create a transaction → produces a transaction-bound capital_movement
    inc = {
        "type": "income", "category": "Diğer",
        "description": "TEST_iter31_bound", "amount": 100,
        "date": "2026-01-15",
    }
    ri = auth_session.post(f"{API}/transactions", json=inc)
    assert ri.status_code == 200
    tx_id = ri.json()["id"]

    mvs = auth_session.get(f"{API}/capital/movements?limit=20").json().get("movements", [])
    bound = next((m for m in mvs if m.get("ref_type") == "transaction" and m.get("ref_id") == tx_id), None)
    assert bound, "transaction-bound movement missing"

    rd = auth_session.delete(f"{API}/capital/movements/{bound['id']}")
    assert rd.status_code == 400, f"Expected 400, got {rd.status_code}: {rd.text}"

    # Cleanup
    auth_session.delete(f"{API}/transactions/{tx_id}?permanent=true")
