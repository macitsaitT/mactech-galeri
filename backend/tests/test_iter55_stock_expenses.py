"""
Iter 55 — Stock-only "Araç Masraf" reactivity test.

Validates the data layer that backs the new clickable "Araç Masraf" tile +
StockExpensesDetailModal. The frontend computes the tile value from these APIs:
    activeTransactions
        .filter(t => type=='expense'
                 && car_id in (cars where status!='Satıldı' && !deleted)
                 && category NOT IN ('Araç Alımı','Araç Sahibine Ödeme'))
        .sum(amount)

End-to-end backend flow:
1. login admin
2. snapshot baseline (expenses by stock-car-id, category != excluded)
3. pick a stock car, POST expense tx (Bakım, 2500) → baseline += 2500
4. PATCH car status='Satıldı' (+ sold_by_user_id, sold_date) → baseline -= 2500
5. PATCH car status='Stokta' → baseline += 2500
6. DELETE tx ?permanent=true → baseline back to original
"""
import os
import uuid
import datetime as dt
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "test_branch_6b287ede@test.com"
ADMIN_PASS = "Password123!"

EXCLUDED_CATS = {"Araç Alımı", "Araç Sahibine Ödeme"}


def _stock_car_expense_total(cars, txs):
    stock_ids = {c["id"] for c in cars if (not c.get("deleted")) and c.get("status") != "Satıldı"}
    total = 0.0
    for t in txs:
        if t.get("deleted"):
            continue
        if t.get("type") != "expense":
            continue
        if t.get("category") in EXCLUDED_CATS:
            continue
        if t.get("car_id") in stock_ids:
            total += float(t.get("amount") or 0)
    return total, stock_ids


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json()["token"]
    user_id = r.json().get("user", {}).get("id") or r.json().get("user_id")
    return {
        "headers": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        "user_id": user_id,
    }


def _get(H, path):
    r = requests.get(f"{BASE}{path}", headers=H["headers"], timeout=15)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text}"
    return r.json()


def _refresh(H):
    cars = _get(H, "/api/cars")
    txs = _get(H, "/api/transactions")
    return cars, txs


# ---------- Reactivity end-to-end ----------
class TestStockExpensesReactivity:
    def test_full_flow(self, H):
        # 1. baseline
        cars, txs = _refresh(H)
        baseline, stock_ids = _stock_car_expense_total(cars, txs)
        assert len(stock_ids) > 0, "test org must have at least 1 non-sold car"

        # Pick a stock car that is NOT sold and ownership stock (use first available)
        target = next((c for c in cars
                       if (not c.get("deleted"))
                       and c.get("status") != "Satıldı"
                       and c.get("ownership") == "stock"), None)
        assert target is not None, "no stock-ownership car available"
        car_id = target["id"]
        original_status = target.get("status", "Stokta")

        AMT = 2500.0
        today = dt.date.today().isoformat()

        # 2. POST expense tx (Bakım, 2500) on stock car
        tx_payload = {
            "type": "expense",
            "category": "Bakım",
            "amount": AMT,
            "date": today,
            "description": f"iter55-test-{uuid.uuid4().hex[:6]}",
            "car_id": car_id,
        }
        r = requests.post(f"{BASE}/api/transactions",
                          headers=H["headers"], json=tx_payload, timeout=15)
        assert r.status_code in (200, 201), f"tx create failed: {r.status_code} {r.text}"
        tx_id = r.json().get("id")
        assert tx_id

        try:
            # 3. baseline += AMT (stock car expense)
            cars, txs = _refresh(H)
            after_tx, _ = _stock_car_expense_total(cars, txs)
            assert abs(after_tx - (baseline + AMT)) < 0.01, \
                f"after POST tx: expected baseline+{AMT}={baseline+AMT}, got {after_tx}"

            # 4. PATCH car to Satıldı  → tile should DROP by AMT (car leaves stock set)
            sold_payload = {
                "status": "Satıldı",
                "sold_date": today,
                "sale_price": 100000,
                "sold_by_user_id": H["user_id"],
            }
            r = requests.patch(f"{BASE}/api/cars/{car_id}",
                               headers=H["headers"], json=sold_payload, timeout=15)
            assert r.status_code == 200, f"PATCH sold failed: {r.status_code} {r.text}"

            cars, txs = _refresh(H)
            after_sold, stock_ids_after = _stock_car_expense_total(cars, txs)
            assert car_id not in stock_ids_after, "sold car must leave stock set"
            assert abs(after_sold - baseline) < 0.01, \
                f"after sold: expected baseline={baseline}, got {after_sold} (drop should be {AMT})"

            # 5. revert to Stokta → tile += AMT again
            # NOTE: sale_price must NOT be None (backend model is non-optional float).
            revert_payload = {"status": original_status, "sold_date": None,
                              "sale_price": 0, "sold_by_user_id": None, "sold_by_name": None}
            r = requests.patch(f"{BASE}/api/cars/{car_id}",
                               headers=H["headers"], json=revert_payload, timeout=15)
            assert r.status_code == 200, f"PATCH revert failed: {r.status_code} {r.text}"

            cars, txs = _refresh(H)
            after_revert, stock_ids_rev = _stock_car_expense_total(cars, txs)
            assert car_id in stock_ids_rev, "reverted car must re-enter stock set"
            assert abs(after_revert - (baseline + AMT)) < 0.01, \
                f"after revert: expected baseline+{AMT}={baseline+AMT}, got {after_revert}"

        finally:
            # 6. cleanup tx
            requests.delete(f"{BASE}/api/transactions/{tx_id}?permanent=true",
                            headers=H["headers"], timeout=15)
            # ensure car reverted
            requests.patch(f"{BASE}/api/cars/{car_id}",
                           headers=H["headers"],
                           json={"status": original_status, "sold_date": None,
                                 "sale_price": 0, "sold_by_user_id": None,
                                 "sold_by_name": None},
                           timeout=15)

        # 7. final state matches baseline
        cars, txs = _refresh(H)
        final, _ = _stock_car_expense_total(cars, txs)
        assert abs(final - baseline) < 0.01, \
            f"cleanup: expected baseline={baseline}, got {final}"

    def test_excluded_categories_do_not_count(self, H):
        """A 'Araç Alımı' expense on a stock car should NOT change the tile."""
        cars, txs = _refresh(H)
        baseline, _ = _stock_car_expense_total(cars, txs)

        target = next((c for c in cars
                       if (not c.get("deleted"))
                       and c.get("status") != "Satıldı"
                       and c.get("ownership") == "stock"), None)
        assert target is not None

        today = dt.date.today().isoformat()
        r = requests.post(f"{BASE}/api/transactions", headers=H["headers"], json={
            "type": "expense", "category": "Araç Alımı", "amount": 9999,
            "date": today, "description": f"iter55-excluded-{uuid.uuid4().hex[:6]}",
            "car_id": target["id"],
        }, timeout=15)
        assert r.status_code in (200, 201)
        tx_id = r.json().get("id")

        try:
            cars2, txs2 = _refresh(H)
            after, _ = _stock_car_expense_total(cars2, txs2)
            assert abs(after - baseline) < 0.01, \
                f"excluded category leaked into tile: baseline={baseline}, after={after}"
        finally:
            requests.delete(f"{BASE}/api/transactions/{tx_id}?permanent=true",
                            headers=H["headers"], timeout=15)
