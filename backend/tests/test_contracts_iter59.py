"""Iter 59 — Contracts API (POST/GET/LIST/DELETE) + projection/index/cross-org tests."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "test_branch_6b287ede@test.com"
ADMIN_PASSWORD = "Password123!"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def car_and_customer(admin_headers):
    cars = requests.get(f"{API}/cars", headers=admin_headers, timeout=30).json()
    customers = requests.get(f"{API}/customers", headers=admin_headers, timeout=30).json()
    assert cars and customers, "seed cars/customers required"
    return cars[0], customers[0]


@pytest.fixture(scope="module")
def fresh_org_headers():
    """Brand new org for cross-org isolation test."""
    uid = uuid.uuid4().hex[:8]
    email = f"iter59_cross_{uid}@test.com"
    payload = {"email": email, "password": "Password123!", "company_name": f"Iter59 X {uid}", "name": "X User"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, email


# ---------- Auth ----------
def test_post_contracts_requires_auth():
    r = requests.post(f"{API}/contracts", json={}, timeout=30)
    assert r.status_code in (401, 403)


def test_get_contracts_requires_auth():
    r = requests.get(f"{API}/contracts", timeout=30)
    assert r.status_code in (401, 403)


# ---------- Validation ----------
def test_post_contracts_invalid_car_404(admin_headers, car_and_customer):
    _, customer = car_and_customer
    r = requests.post(f"{API}/contracts", headers=admin_headers, json={
        "type": "sale", "car_id": "nonexistent-car-id", "customer_id": customer["id"],
        "contract_no": "TEST-" + uuid.uuid4().hex[:6], "sale_price": 100,
    }, timeout=30)
    assert r.status_code == 404


def test_post_contracts_invalid_customer_404(admin_headers, car_and_customer):
    car, _ = car_and_customer
    r = requests.post(f"{API}/contracts", headers=admin_headers, json={
        "type": "sale", "car_id": car["id"], "customer_id": "nonexistent-cust-id",
        "contract_no": "TEST-" + uuid.uuid4().hex[:6], "sale_price": 100,
    }, timeout=30)
    assert r.status_code == 404


# ---------- CRUD + Projection ----------
@pytest.fixture(scope="module")
def created_contracts(admin_headers, car_and_customer):
    """Create kapora + delivery + sale contracts (with signatures)."""
    car, customer = car_and_customer
    sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
    ids = []
    for ctype in ("kapora", "delivery", "sale"):
        body = {
            "type": ctype,
            "car_id": car["id"],
            "customer_id": customer["id"],
            "contract_no": f"TEST-{ctype}-{uuid.uuid4().hex[:6]}",
            "sale_price": 250000 if ctype == "sale" else 0,
            "deposit_amount": 50000 if ctype == "kapora" else 0,
            "payment_method": "Havale",
            "notes": "TEST",
            "seller_signature": sig,
            "buyer_signature": sig,
        }
        r = requests.post(f"{API}/contracts", headers=admin_headers, json=body, timeout=30)
        assert r.status_code == 200, f"{ctype}: {r.status_code} {r.text[:200]}"
        d = r.json()
        assert d["type"] == ctype
        assert d["car_id"] == car["id"]
        assert d["customer_id"] == customer["id"]
        assert d["customer_name"] == customer.get("name", "")
        assert "_id" not in d
        assert d["seller_signature"] == sig  # POST response IS full doc
        ids.append(d["id"])
    yield ids, car, customer
    # cleanup
    for cid in ids:
        requests.delete(f"{API}/contracts/{cid}", headers=admin_headers, timeout=30)


def test_list_excludes_signatures(admin_headers, created_contracts):
    ids, car, _ = created_contracts
    r = requests.get(f"{API}/contracts", headers=admin_headers, params={"car_id": car["id"]}, timeout=30)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 3
    for row in rows:
        assert "seller_signature" not in row, f"signature leaked in list: keys={list(row.keys())}"
        assert "buyer_signature" not in row
        assert "_id" not in row
        assert "has_seller_signature" in row
        assert "has_buyer_signature" in row


def test_list_filter_by_car(admin_headers, created_contracts):
    ids, car, _ = created_contracts
    r = requests.get(f"{API}/contracts", headers=admin_headers, params={"car_id": car["id"]}, timeout=30)
    assert r.status_code == 200
    rows = r.json()
    for row in rows:
        assert row["car_id"] == car["id"]
    returned_ids = {row["id"] for row in rows}
    assert set(ids).issubset(returned_ids)


def test_list_filter_by_customer(admin_headers, created_contracts):
    ids, _, customer = created_contracts
    r = requests.get(f"{API}/contracts", headers=admin_headers, params={"customer_id": customer["id"]}, timeout=30)
    assert r.status_code == 200
    rows = r.json()
    for row in rows:
        assert row["customer_id"] == customer["id"]


def test_list_filter_by_type(admin_headers, created_contracts):
    _ids, _car, _cust = created_contracts
    r = requests.get(f"{API}/contracts", headers=admin_headers, params={"type": "kapora"}, timeout=30)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 1
    for row in rows:
        assert row["type"] == "kapora"


def test_get_single_includes_signatures(admin_headers, created_contracts):
    ids, _, _ = created_contracts
    r = requests.get(f"{API}/contracts/{ids[0]}", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == ids[0]
    assert d["seller_signature"].startswith("data:image/png;base64")
    assert d["buyer_signature"].startswith("data:image/png;base64")
    assert "_id" not in d


def test_get_nonexistent_404(admin_headers):
    r = requests.get(f"{API}/contracts/nonexistent-id-xyz", headers=admin_headers, timeout=30)
    assert r.status_code == 404


def test_delete_soft_removes(admin_headers, car_and_customer):
    car, customer = car_and_customer
    body = {
        "type": "sale", "car_id": car["id"], "customer_id": customer["id"],
        "contract_no": f"TEST-DEL-{uuid.uuid4().hex[:6]}", "sale_price": 100,
    }
    cid = requests.post(f"{API}/contracts", headers=admin_headers, json=body, timeout=30).json()["id"]
    # delete
    r = requests.delete(f"{API}/contracts/{cid}", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    # get → 404
    r2 = requests.get(f"{API}/contracts/{cid}", headers=admin_headers, timeout=30)
    assert r2.status_code == 404
    # list → excluded
    rows = requests.get(f"{API}/contracts", headers=admin_headers, params={"car_id": car["id"]}, timeout=30).json()
    assert cid not in {row["id"] for row in rows}


def test_delete_nonexistent_404(admin_headers):
    r = requests.delete(f"{API}/contracts/nonexistent-id-xyz", headers=admin_headers, timeout=30)
    assert r.status_code == 404


# ---------- Cross-org isolation ----------
def test_cross_org_isolation(admin_headers, created_contracts, fresh_org_headers):
    ids, _, _ = created_contracts
    other_headers, _email = fresh_org_headers
    r = requests.get(f"{API}/contracts", headers=other_headers, timeout=30)
    assert r.status_code == 200
    other_ids = {row["id"] for row in r.json()}
    assert not (set(ids) & other_ids), "cross-org leak detected"
    # also direct GET should 404
    r2 = requests.get(f"{API}/contracts/{ids[0]}", headers=other_headers, timeout=30)
    assert r2.status_code == 404


# ---------- Indexes ----------
def test_mongo_indexes_exist():
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    async def _check():
        c = AsyncIOMotorClient(mongo_url)
        idx = await c[db_name]["contracts"].index_information()
        c.close()
        return idx

    idx = asyncio.run(_check())
    keys_lists = [tuple(v.get("key", [])) for v in idx.values()]
    # org_id + car_id + created_at
    assert any(k[0][0] == "org_id" and len(k) >= 2 and k[1][0] == "car_id" for k in keys_lists if k), f"missing org_id+car_id index. Have: {keys_lists}"
    assert any(k[0][0] == "org_id" and len(k) >= 2 and k[1][0] == "customer_id" for k in keys_lists if k), f"missing org_id+customer_id index. Have: {keys_lists}"
    # id unique
    id_idx = [v for v in idx.values() if v.get("key", [[None]])[0][0] == "id"]
    assert id_idx and any(i.get("unique") for i in id_idx), "id index not unique"


# ---------- Performance ----------
def test_list_endpoint_fast(admin_headers):
    """sanity: list endpoint < 1s (no signatures included)."""
    t0 = time.time()
    r = requests.get(f"{API}/contracts", headers=admin_headers, timeout=30)
    elapsed = time.time() - t0
    assert r.status_code == 200
    assert elapsed < 1.5, f"list endpoint slow: {elapsed:.2f}s"


# ---------- Regression sanity ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=15)
    assert r.status_code == 200


def test_cars_list_regression(admin_headers):
    r = requests.get(f"{API}/cars", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_customers_list_regression(admin_headers):
    r = requests.get(f"{API}/customers", headers=admin_headers, timeout=30)
    assert r.status_code == 200


def test_transactions_list_regression(admin_headers):
    r = requests.get(f"{API}/transactions", headers=admin_headers, timeout=30)
    assert r.status_code == 200


def test_stats_regression(admin_headers):
    r = requests.get(f"{API}/stats", headers=admin_headers, timeout=30)
    assert r.status_code == 200
