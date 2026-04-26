"""
Iter 35 — Tests for:
  1) PUT /api/customers/{id} partial update (must accept just {type: 'Satış Yapıldı'})
  2) Full sale-flow simulation (PATCH cars + POST income tx + POST employee_share tx + PUT customer)
  3) DELETE /api/capital/movements/{id} for manual + tx_linked + auto-generated
  4) After tx_linked delete, related transaction must be soft-deleted
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "test_branch_6b287ede@test.com"
PASSWORD = "Password123!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in response: {data}"
    return tok


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- 1) Partial update of customer ----------
class TestCustomerPartialUpdate:
    def test_create_customer_then_partial_update_type_only(self, auth_headers):
        # Create
        payload = {
            "name": f"TEST_Customer_{uuid.uuid4().hex[:6]}",
            "phone": "5551112233",
            "type": "Potansiyel",
            "notes": "iter35",
        }
        r = requests.post(f"{API}/customers", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        cust = r.json()
        cid = cust["id"]
        assert cust["name"] == payload["name"]
        assert cust["type"] == "Potansiyel"

        # Partial update — only `type`
        r2 = requests.put(f"{API}/customers/{cid}", json={"type": "Satış Yapıldı"}, headers=auth_headers, timeout=20)
        assert r2.status_code == 200, f"Partial update failed: {r2.status_code} {r2.text}"
        updated = r2.json()
        assert updated["type"] == "Satış Yapıldı"
        # Other fields preserved
        assert updated["name"] == payload["name"]
        assert updated["phone"] == "5551112233"

        # GET to verify persistence
        r3 = requests.get(f"{API}/customers", headers=auth_headers, timeout=20)
        assert r3.status_code == 200
        found = next((c for c in r3.json() if c["id"] == cid), None)
        assert found is not None
        assert found["type"] == "Satış Yapıldı"
        assert found["name"] == payload["name"]

        # Cleanup
        requests.delete(f"{API}/customers/{cid}?permanent=true", headers=auth_headers, timeout=20)

    def test_partial_update_empty_body_no_error(self, auth_headers):
        payload = {"name": f"TEST_Empty_{uuid.uuid4().hex[:6]}", "phone": "555"}
        r = requests.post(f"{API}/customers", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code == 200
        cid = r.json()["id"]

        r2 = requests.put(f"{API}/customers/{cid}", json={}, headers=auth_headers, timeout=20)
        # Empty body must NOT 422 (was the prod bug)
        assert r2.status_code == 200, f"Empty body PUT should work: {r2.status_code} {r2.text}"

        # Unknown fields ignored, no 422
        r3 = requests.put(f"{API}/customers/{cid}", json={"foo": "bar"}, headers=auth_headers, timeout=20)
        assert r3.status_code == 200

        requests.delete(f"{API}/customers/{cid}?permanent=true", headers=auth_headers, timeout=20)

    def test_partial_update_non_existent_returns_404(self, auth_headers):
        r = requests.put(
            f"{API}/customers/nonexistent-id-xxx",
            json={"type": "Satış Yapıldı"},
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 404


# ---------- 2) Full sale flow simulation ----------
class TestSaleFlowEndToEnd:
    def test_full_sale_flow_no_422(self, auth_headers):
        # Create a car first
        car_payload = {
            "brand": "TEST_Brand",
            "model": "Model X",
            "year": 2020,
            "plate": f"TEST{uuid.uuid4().hex[:4].upper()}",
            "purchase_price": 100000,
            "status": "stokta",
        }
        rc = requests.post(f"{API}/cars", json=car_payload, headers=auth_headers, timeout=20)
        assert rc.status_code in (200, 201), rc.text
        car = rc.json()
        car_id = car["id"]

        # Create customer
        cust_payload = {"name": f"TEST_SaleCust_{uuid.uuid4().hex[:6]}", "phone": "555", "type": "Potansiyel"}
        rcu = requests.post(f"{API}/customers", json=cust_payload, headers=auth_headers, timeout=20)
        assert rcu.status_code == 200
        cust_id = rcu.json()["id"]

        try:
            # Step A: PATCH car → status=satıldı, sale_price
            r1 = requests.patch(
                f"{API}/cars/{car_id}",
                json={"status": "satıldı", "sale_price": 150000, "sold_date": "2026-01-15"},
                headers=auth_headers,
                timeout=20,
            )
            assert r1.status_code in (200, 201), f"PATCH car failed: {r1.status_code} {r1.text}"

            # Step B: income transaction (Araç Satışı)
            tx_payload = {
                "type": "income",
                "category": "Araç Satışı",
                "description": "TEST sale",
                "amount": 150000,
                "date": "2026-01-15",
                "car_id": car_id,
                "customer_id": cust_id,
            }
            r2 = requests.post(f"{API}/transactions", json=tx_payload, headers=auth_headers, timeout=20)
            assert r2.status_code == 200, f"Income tx failed: {r2.status_code} {r2.text}"

            # Step C: employee share expense
            es_payload = {
                "type": "expense",
                "category": "Çalışan Payı",
                "description": "TEST share",
                "amount": 5000,
                "date": "2026-01-15",
                "car_id": car_id,
                "employee_name": "TEST_Emp",
            }
            r3 = requests.post(f"{API}/transactions", json=es_payload, headers=auth_headers, timeout=20)
            assert r3.status_code == 200, f"Employee share tx failed: {r3.status_code} {r3.text}"

            # Step D: PUT customer with ONLY {type: 'Satış Yapıldı'} — the prod-422 bug
            r4 = requests.put(
                f"{API}/customers/{cust_id}",
                json={"type": "Satış Yapıldı"},
                headers=auth_headers,
                timeout=20,
            )
            assert r4.status_code == 200, f"Customer partial PUT regressed: {r4.status_code} {r4.text}"
            assert r4.json()["type"] == "Satış Yapıldı"
        finally:
            # Cleanup
            requests.delete(f"{API}/cars/{car_id}?permanent=true", headers=auth_headers, timeout=20)
            requests.delete(f"{API}/customers/{cust_id}?permanent=true", headers=auth_headers, timeout=20)


# ---------- 3) DELETE /api/capital/movements/{id} ----------
class TestCapitalMovementDelete:
    def _get_movements(self, headers, limit=100):
        r = requests.get(f"{API}/capital/movements?limit={limit}", headers=headers, timeout=20)
        assert r.status_code == 200
        return r.json().get("movements", [])

    def test_delete_manual_deposit_movement(self, auth_headers):
        # Create a manual deposit
        r = requests.post(
            f"{API}/capital/adjust",
            json={"amount": 1234.0, "type": "deposit", "description": "TEST_iter35_manual_dep"},
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text

        # Capture current balance
        bal_before_delete = float(r.json().get("amount", 0))

        # Find that movement
        movs = self._get_movements(auth_headers)
        target = next(
            (m for m in movs if m.get("reason") == "manual_deposit" and m.get("description") == "TEST_iter35_manual_dep"),
            None,
        )
        assert target is not None, "Manual deposit movement not found"

        # Delete it
        rd = requests.delete(f"{API}/capital/movements/{target['id']}", headers=auth_headers, timeout=20)
        assert rd.status_code == 200, f"Delete manual movement failed: {rd.status_code} {rd.text}"
        body = rd.json()
        assert body.get("type") == "manual"
        assert body.get("success") is True

        # Verify balance reverted (deposit was +1234, after delete should be -1234 from the post-deposit balance)
        rcap = requests.get(f"{API}/capital", headers=auth_headers, timeout=20)
        assert rcap.status_code == 200
        bal_after = float(rcap.json().get("amount", 0))
        # Reverse delta of +1234 = -1234, so balance went from bal_before_delete to bal_before_delete - 1234
        assert abs(bal_after - (bal_before_delete - 1234.0)) < 0.01, (
            f"Balance not reverted correctly: before_delete={bal_before_delete} after={bal_after}"
        )

    def test_delete_tx_linked_movement_softdeletes_transaction(self, auth_headers):
        # Create an income transaction (will create transaction_create movement)
        tx_payload = {
            "type": "income",
            "category": "TEST_Linked",
            "description": "TEST_iter35_tx_linked",
            "amount": 999.0,
            "date": "2026-01-15",
        }
        rt = requests.post(f"{API}/transactions", json=tx_payload, headers=auth_headers, timeout=20)
        assert rt.status_code == 200, rt.text
        tx_id = rt.json()["id"]

        # Find the transaction_create movement for this tx
        movs = self._get_movements(auth_headers, limit=200)
        target = next(
            (m for m in movs if m.get("reason") == "transaction_create" and m.get("ref_id") == tx_id),
            None,
        )
        assert target is not None, "transaction_create movement not found"

        # Delete it
        rd = requests.delete(f"{API}/capital/movements/{target['id']}", headers=auth_headers, timeout=20)
        assert rd.status_code == 200, f"Delete tx_linked failed: {rd.status_code} {rd.text}"
        assert rd.json().get("type") == "tx_linked"

        # Verify the transaction is soft-deleted (deleted=true) in GET /transactions
        rg = requests.get(f"{API}/transactions", headers=auth_headers, timeout=20)
        assert rg.status_code == 200
        tx_doc = next((t for t in rg.json() if t["id"] == tx_id), None)
        assert tx_doc is not None, "Transaction should still exist (soft-deleted)"
        assert tx_doc.get("deleted") is True, f"Transaction should be soft-deleted, got: {tx_doc}"

    def test_delete_auto_movement_returns_400(self, auth_headers):
        """Auto-generated transaction_delete or employee_share_sync movements cannot be deleted."""
        # Create + delete a tx to spawn a transaction_delete movement
        tx_payload = {
            "type": "expense",
            "category": "TEST_Auto",
            "description": "TEST_iter35_auto",
            "amount": 50.0,
            "date": "2026-01-15",
        }
        rt = requests.post(f"{API}/transactions", json=tx_payload, headers=auth_headers, timeout=20)
        assert rt.status_code == 200
        tx_id = rt.json()["id"]

        rd = requests.delete(f"{API}/transactions/{tx_id}", headers=auth_headers, timeout=20)
        assert rd.status_code == 200

        # Find the transaction_delete movement
        movs = self._get_movements(auth_headers, limit=300)
        auto_mv = next(
            (m for m in movs if m.get("reason") == "transaction_delete" and m.get("ref_id") == tx_id),
            None,
        )
        assert auto_mv is not None, "Auto transaction_delete movement not found"

        # Try to delete — must be 400
        rdel = requests.delete(f"{API}/capital/movements/{auto_mv['id']}", headers=auth_headers, timeout=20)
        assert rdel.status_code == 400, f"Auto movement should not be deletable: {rdel.status_code} {rdel.text}"

    def test_delete_nonexistent_movement_returns_404(self, auth_headers):
        rdel = requests.delete(f"{API}/capital/movements/does-not-exist-xxx", headers=auth_headers, timeout=20)
        assert rdel.status_code == 404
