"""Iter 48 — Inline expenses + transaction CRUD capital sync + cascade delete."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://image-gallery-live.preview.emergentagent.com").rstrip("/")
EMAIL = "test_branch_6b287ede@test.com"
PASSWORD = "Password123!"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    return body.get("token") or body.get("access_token")


@pytest.fixture(scope="session")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_capital(headers):
    r = requests.get(f"{BASE_URL}/api/capital", headers=headers, timeout=15)
    assert r.status_code == 200
    return float(r.json().get("amount", 0))


@pytest.fixture(scope="session")
def created_car(headers):
    payload = {
        "brand": "Test", "model": "Iter48", "year": 2022,
        "plate": f"TEST-IT48-{int(time.time())%100000}",
        "km": "0", "vehicle_type": "Sedan",
        "purchase_price": 100000, "sale_price": 200000,
        "status": "Stokta", "ownership": "stock",
    }
    r = requests.post(f"{BASE_URL}/api/cars", json=payload, headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    car = r.json()
    yield car
    # Teardown: permanent delete
    requests.delete(f"{BASE_URL}/api/cars/{car['id']}?permanent=true", headers=headers, timeout=15)


_state = {}


class TestInlineExpenseCreateCapitalDecrement:
    def test_create_two_expenses_capital_drops(self, headers, created_car):
        cap0 = get_capital(headers)
        # Expense 1
        e1 = {"type": "expense", "category": "Boya", "amount": 1500,
              "description": "Test boya", "date": "2026-01-15", "car_id": created_car["id"]}
        r1 = requests.post(f"{BASE_URL}/api/transactions", json=e1, headers=headers, timeout=15)
        assert r1.status_code == 200, r1.text
        tx1 = r1.json()
        _state["tx1_id"] = tx1["id"]
        assert tx1["amount"] == 1500
        assert tx1["car_id"] == created_car["id"]
        cap1 = get_capital(headers)
        assert abs(cap1 - (cap0 - 1500)) < 0.01, f"After expense1 cap0={cap0} cap1={cap1}"

        # Expense 2
        e2 = {"type": "expense", "category": "Ekspertiz", "amount": 800,
              "description": "Test ekspertiz", "date": "2026-01-15", "car_id": created_car["id"]}
        r2 = requests.post(f"{BASE_URL}/api/transactions", json=e2, headers=headers, timeout=15)
        assert r2.status_code == 200
        tx2 = r2.json()
        _state["tx2_id"] = tx2["id"]
        cap2 = get_capital(headers)
        assert abs(cap2 - (cap1 - 800)) < 0.01

    def test_put_transaction_amount_updates_capital(self, headers):
        # tx2 amount 800 → 1200, expense → kasa 400 daha düşmeli
        cap_before = get_capital(headers)
        r = requests.put(f"{BASE_URL}/api/transactions/{_state['tx2_id']}",
                         json={"amount": 1200}, headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["amount"] == 1200
        cap_after = get_capital(headers)
        assert abs(cap_after - (cap_before - 400)) < 0.01, \
            f"Update delta wrong: before={cap_before} after={cap_after}"

    def test_delete_transaction_reverts_capital(self, headers):
        # Soft delete tx1 (1500) → kasa +1500
        cap_before = get_capital(headers)
        r = requests.delete(f"{BASE_URL}/api/transactions/{_state['tx1_id']}",
                            headers=headers, timeout=15)
        assert r.status_code == 200
        cap_after = get_capital(headers)
        assert abs(cap_after - (cap_before + 1500)) < 0.01, \
            f"Delete revert wrong: before={cap_before} after={cap_after}"
        # GET transactions → tx1 should be deleted=True
        r2 = requests.get(f"{BASE_URL}/api/transactions", headers=headers, timeout=15)
        assert r2.status_code == 200
        for tx in r2.json():
            if tx["id"] == _state["tx1_id"]:
                assert tx.get("deleted") is True


class TestCascadeDeleteCar:
    """Yeni araç oluştur, 1 expense ekle, aracı sil → tx soft delete + kasa revert."""
    def test_cascade_delete_car_reverts_active_tx(self, headers):
        # 1) Yeni araç
        car_payload = {
            "brand": "Test", "model": "Cascade", "year": 2021,
            "plate": f"TEST-CSC-{int(time.time())%100000}",
            "km": "0", "vehicle_type": "Sedan",
            "purchase_price": 50000, "sale_price": 80000,
            "status": "Stokta", "ownership": "stock",
        }
        r = requests.post(f"{BASE_URL}/api/cars", json=car_payload, headers=headers, timeout=15)
        assert r.status_code == 200
        car = r.json()
        # 2) Expense
        cap0 = get_capital(headers)
        e = {"type": "expense", "category": "Lastik", "amount": 2000,
             "description": "Test lastik", "date": "2026-01-15", "car_id": car["id"]}
        rt = requests.post(f"{BASE_URL}/api/transactions", json=e, headers=headers, timeout=15)
        assert rt.status_code == 200
        tx_id = rt.json()["id"]
        cap1 = get_capital(headers)
        assert abs(cap1 - (cap0 - 2000)) < 0.01

        # 3) Soft-delete car (cascade)
        rd = requests.delete(f"{BASE_URL}/api/cars/{car['id']}", headers=headers, timeout=15)
        assert rd.status_code == 200, rd.text
        body = rd.json()
        assert body.get("success") is True
        assert body.get("removed_transactions", 0) >= 1
        # Kasa revert
        cap2 = get_capital(headers)
        assert abs(cap2 - cap1 - 2000) < 0.01, f"Cascade revert: cap1={cap1} cap2={cap2}"

        # 4) Tx soft-deleted check
        rg = requests.get(f"{BASE_URL}/api/transactions", headers=headers, timeout=15)
        for tx in rg.json():
            if tx["id"] == tx_id:
                assert tx.get("deleted") is True

        # cleanup permanent
        requests.delete(f"{BASE_URL}/api/cars/{car['id']}?permanent=true", headers=headers, timeout=15)
