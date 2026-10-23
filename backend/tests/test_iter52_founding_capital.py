"""
Iter 52 — founding_capital field + PUT /api/capital/founding endpoint.

Coverage:
1. GET /api/capital returns 'founding_capital' field (defaults to 0)
2. PUT /api/capital/founding {amount: X} persists value
3. After PUT, GET /api/capital reflects updated founding_capital
4. PUT validates amount >= 0 (negative rejected with 422)
5. role='satis' is blocked (403) on both GET /api/capital and PUT /api/capital/founding
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
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}",
            "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def original_founding(admin_headers):
    """Save original founding_capital so we can restore at module end."""
    r = requests.get(f"{BASE}/api/capital", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    original = float(r.json().get("founding_capital", 0) or 0)
    yield original
    # Restore
    requests.put(f"{BASE}/api/capital/founding", headers=admin_headers,
                 json={"amount": original}, timeout=10)


# ---------- 1. GET /api/capital exposes founding_capital ----------
class TestFoundingCapitalFieldExposure:
    def test_get_capital_contains_founding_capital_key(self, admin_headers):
        r = requests.get(f"{BASE}/api/capital", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "founding_capital" in body, f"founding_capital missing: keys={list(body.keys())}"
        assert isinstance(body["founding_capital"], (int, float))


# ---------- 2 & 3. PUT persists + GET reflects ----------
class TestFoundingCapitalPersistence:
    def test_put_founding_persists_and_get_reflects(self, admin_headers, original_founding):
        new_value = 5_000_000.0
        r = requests.put(f"{BASE}/api/capital/founding", headers=admin_headers,
                         json={"amount": new_value}, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert float(body.get("founding_capital", 0)) == new_value

        # Verify via GET
        r = requests.get(f"{BASE}/api/capital", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert float(r.json().get("founding_capital", 0)) == new_value

    def test_put_founding_zero_accepted(self, admin_headers, original_founding):
        r = requests.put(f"{BASE}/api/capital/founding", headers=admin_headers,
                         json={"amount": 0}, timeout=10)
        assert r.status_code == 200, r.text
        r = requests.get(f"{BASE}/api/capital", headers=admin_headers, timeout=10)
        assert float(r.json().get("founding_capital", 0)) == 0.0

    def test_put_founding_negative_rejected(self, admin_headers, original_founding):
        r = requests.put(f"{BASE}/api/capital/founding", headers=admin_headers,
                         json={"amount": -100}, timeout=10)
        assert r.status_code == 422, f"Expected 422 for negative, got {r.status_code}: {r.text}"


# ---------- 4. satis role blocked ----------
class TestSatisRoleBlockedFromFounding:
    @pytest.fixture(scope="class")
    def satis_creds(self, admin_headers):
        suffix = uuid.uuid4().hex[:8]
        email = f"satis_iter52_{suffix}@test.com"
        password = "Password123!"
        phone = ("0555" + uuid.uuid4().int.__str__())[:11]
        payload = {
            "email": email, "password": password,
            "company_name": f"Satis52 {suffix}", "phone": phone,
            "role": "satis", "name": f"Satis52 {suffix[:4]}",
        }
        r = requests.post(f"{BASE}/api/users", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        uid = r.json()["id"]
        yield {"email": email, "password": password, "id": uid}
        requests.delete(f"{BASE}/api/users/{uid}", headers=admin_headers, timeout=10)

    @pytest.fixture(scope="class")
    def satis_headers(self, satis_creds):
        r = requests.post(f"{BASE}/api/auth/login",
                          json={"email": satis_creds["email"], "password": satis_creds["password"]},
                          timeout=15)
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['token']}",
                "Content-Type": "application/json"}

    def test_satis_get_capital_403(self, satis_headers):
        r = requests.get(f"{BASE}/api/capital", headers=satis_headers, timeout=10)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_satis_put_founding_403(self, satis_headers):
        r = requests.put(f"{BASE}/api/capital/founding", headers=satis_headers,
                         json={"amount": 1000}, timeout=10)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
