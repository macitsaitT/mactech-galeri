"""Backend tests for iteration 30 (Türkçe MACTech CRM):
- /api/branches CRUD (GET, POST, PUT, DELETE)
- /api/branches DELETE 400 when active cars assigned
- /api/installments listing (regression)
- /api/capital and /api/transactions health (regression)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://image-gallery-live.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def auth_token():
    """Register a brand new user and return token."""
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "email": f"test_branch_{suffix}@test.com",
        "password": "Password123!",
        "company_name": f"Branch Test {suffix}",
        "phone": "0532 111 22 33",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    if r.status_code not in (200, 201):
        pytest.skip(f"Registration failed: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if not token and "user" in data:
        # try login
        lr = requests.post(f"{API}/auth/login", json={"email": payload["email"], "password": payload["password"]}, timeout=20)
        if lr.status_code == 200:
            token = lr.json().get("token") or lr.json().get("access_token")
    if not token:
        pytest.skip(f"No token returned: {data}")
    # Persist creds for future agents
    try:
        with open("/app/memory/test_credentials.md", "w") as f:
            f.write(f"# Test Credentials (iteration 30)\n\n- email: {payload['email']}\n- password: {payload['password']}\n- company: {payload['company_name']}\n")
    except Exception:
        pass
    return token


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ---- Branches ----
class TestBranches:
    def test_list_requires_auth(self):
        r = requests.get(f"{API}/branches", timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_list_initial_empty(self, auth_headers):
        r = requests.get(f"{API}/branches", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_create_branch_requires_name(self, auth_headers):
        r = requests.post(f"{API}/branches", headers=auth_headers, json={}, timeout=15)
        assert r.status_code in (400, 422)

    def test_create_branch_main(self, auth_headers):
        r = requests.post(
            f"{API}/branches",
            headers=auth_headers,
            json={"name": "Merkez Şube", "city": "İstanbul", "is_main": True},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Merkez Şube"
        assert data["is_main"] is True
        assert "id" in data
        # GET to verify persistence
        lr = requests.get(f"{API}/branches", headers=auth_headers, timeout=15)
        assert lr.status_code == 200
        assert any(b["id"] == data["id"] for b in lr.json())

    def test_is_main_exclusivity(self, auth_headers):
        # create branch1 main
        r1 = requests.post(f"{API}/branches", headers=auth_headers, json={"name": "ŞubeA", "is_main": True}, timeout=15).json()
        # create branch2 main → r1 should become non-main
        r2 = requests.post(f"{API}/branches", headers=auth_headers, json={"name": "ŞubeB", "is_main": True}, timeout=15).json()
        lr = requests.get(f"{API}/branches", headers=auth_headers, timeout=15).json()
        mains = [b for b in lr if b["is_main"]]
        assert len(mains) == 1, f"Expected 1 main, got {len(mains)}: {mains}"
        assert mains[0]["id"] == r2["id"]

    def test_update_branch(self, auth_headers):
        r = requests.post(f"{API}/branches", headers=auth_headers, json={"name": "Eski Ad"}, timeout=15).json()
        bid = r["id"]
        ur = requests.put(f"{API}/branches/{bid}", headers=auth_headers, json={"name": "Yeni Ad", "city": "Ankara"}, timeout=15)
        assert ur.status_code == 200, ur.text
        updated = ur.json()
        assert updated["name"] == "Yeni Ad"
        assert updated["city"] == "Ankara"
        # GET verify
        lr = requests.get(f"{API}/branches", headers=auth_headers, timeout=15).json()
        found = next((b for b in lr if b["id"] == bid), None)
        assert found and found["name"] == "Yeni Ad"

    def test_update_is_main_unique(self, auth_headers):
        b1 = requests.post(f"{API}/branches", headers=auth_headers, json={"name": "X1", "is_main": True}, timeout=15).json()
        b2 = requests.post(f"{API}/branches", headers=auth_headers, json={"name": "X2"}, timeout=15).json()
        ur = requests.put(f"{API}/branches/{b2['id']}", headers=auth_headers, json={"is_main": True}, timeout=15)
        assert ur.status_code == 200
        lr = requests.get(f"{API}/branches", headers=auth_headers, timeout=15).json()
        mains = [b for b in lr if b["is_main"]]
        assert len(mains) == 1
        assert mains[0]["id"] == b2["id"]

    def test_delete_branch_soft(self, auth_headers):
        r = requests.post(f"{API}/branches", headers=auth_headers, json={"name": "Silinecek"}, timeout=15).json()
        bid = r["id"]
        dr = requests.delete(f"{API}/branches/{bid}", headers=auth_headers, timeout=15)
        assert dr.status_code == 200, dr.text
        # GET should not contain it
        lr = requests.get(f"{API}/branches", headers=auth_headers, timeout=15).json()
        assert all(b["id"] != bid for b in lr)

    def test_delete_branch_with_active_car_blocked(self, auth_headers):
        # create branch
        b = requests.post(f"{API}/branches", headers=auth_headers, json={"name": "AraçlıŞube"}, timeout=15).json()
        bid = b["id"]
        # create a car assigned to this branch
        car_payload = {
            "brand": "BMW",
            "model": "320i",
            "year": 2020,
            "plate": f"34 TST {uuid.uuid4().hex[:3].upper()}",
            "purchase_price": 500000,
            "asking_price": 600000,
            "branch_id": bid,
        }
        cr = requests.post(f"{API}/cars", headers=auth_headers, json=car_payload, timeout=15)
        if cr.status_code not in (200, 201):
            pytest.skip(f"Car create failed: {cr.status_code} {cr.text}")
        # Attempt delete
        dr = requests.delete(f"{API}/branches/{bid}", headers=auth_headers, timeout=15)
        assert dr.status_code == 400, f"Expected 400 (active car blocks), got {dr.status_code} {dr.text}"

    def test_update_nonexistent_branch_404(self, auth_headers):
        r = requests.put(f"{API}/branches/non-existent-id", headers=auth_headers, json={"name": "X"}, timeout=15)
        assert r.status_code == 404

    def test_delete_nonexistent_branch_404(self, auth_headers):
        r = requests.delete(f"{API}/branches/non-existent-id", headers=auth_headers, timeout=15)
        assert r.status_code == 404


# ---- Installments regression ----
class TestInstallments:
    def test_list_installments(self, auth_headers):
        r = requests.get(f"{API}/installments", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# ---- Capital + Transactions regression ----
class TestCapitalTransactions:
    def test_get_capital(self, auth_headers):
        r = requests.get(f"{API}/capital", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "amount" in d

    def test_list_transactions(self, auth_headers):
        r = requests.get(f"{API}/transactions", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        # should be list or {transactions: []}
        d = r.json()
        assert isinstance(d, (list, dict))
