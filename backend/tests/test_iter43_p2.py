"""Iter 43 P2 tests — Activity Logs + Employee Performance"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "test_branch_6b287ede@test.com"
ADMIN_PASS = "Password123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# --- Activity Logs basic GET + filters ---

def test_get_activity_logs_default(H):
    r = requests.get(f"{BASE_URL}/api/activity-logs", headers=H, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "logs" in data and isinstance(data["logs"], list)
    assert "count" in data


def test_get_activity_logs_filter_entity(H):
    r = requests.get(f"{BASE_URL}/api/activity-logs?entity_type=car", headers=H, timeout=20)
    assert r.status_code == 200
    for log in r.json()["logs"]:
        assert log["entity_type"] == "car"


def test_get_activity_logs_filter_action(H):
    r = requests.get(f"{BASE_URL}/api/activity-logs?action=price_change", headers=H, timeout=20)
    assert r.status_code == 200
    for log in r.json()["logs"]:
        assert log["action"] == "price_change"


# --- Car create / patch / delete logs ---

@pytest.fixture
def created_car_id(H):
    payload = {
        "plate": f"TST{uuid.uuid4().hex[:5].upper()}",
        "brand": "TestBrand", "model": "LogModel", "year": 2020,
        "purchase_price": 100000, "sale_price": 150000,
        "status": "Stokta", "ownership": "stock",
    }
    r = requests.post(f"{BASE_URL}/api/cars", headers=H, json=payload, timeout=20)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    yield cid, payload["plate"]
    # cleanup permanent
    requests.delete(f"{BASE_URL}/api/cars/{cid}?permanent=true", headers=H, timeout=20)


def test_post_car_creates_create_log(H, created_car_id):
    cid, plate = created_car_id
    time.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/activity-logs?entity_type=car&action=create",
                     headers=H, timeout=20)
    assert r.status_code == 200
    logs = r.json()["logs"]
    assert any(l.get("entity_id") == cid for l in logs), \
        f"create log not found for {cid}"


def test_patch_price_change_log(H, created_car_id):
    cid, plate = created_car_id
    r = requests.patch(f"{BASE_URL}/api/cars/{cid}", headers=H,
                       json={"sale_price": 175000}, timeout=20)
    assert r.status_code == 200
    time.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/activity-logs?entity_type=car&action=price_change",
                     headers=H, timeout=20)
    assert r.status_code == 200
    logs = [l for l in r.json()["logs"] if l.get("entity_id") == cid]
    assert logs, "price_change log missing"
    found = next((l for l in logs if l.get("details", {}).get("field") == "sale_price"), None)
    assert found is not None, f"sale_price log missing in {logs}"
    assert float(found["details"]["new"]) == 175000
    assert float(found["details"]["old"]) == 150000


def test_patch_status_change_log(H, created_car_id):
    cid, _ = created_car_id
    r = requests.patch(f"{BASE_URL}/api/cars/{cid}", headers=H,
                       json={"status": "Satıldı", "sold_date": "2026-01-15"}, timeout=20)
    assert r.status_code == 200
    time.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/activity-logs?entity_type=car&action=status_change",
                     headers=H, timeout=20)
    assert r.status_code == 200
    logs = [l for l in r.json()["logs"] if l.get("entity_id") == cid]
    assert logs, "status_change log missing"


def test_delete_car_creates_delete_log(H):
    # create a fresh car for delete
    payload = {
        "plate": f"DEL{uuid.uuid4().hex[:5].upper()}",
        "brand": "Del", "model": "X", "year": 2020,
        "purchase_price": 50000, "sale_price": 60000,
        "status": "Stokta", "ownership": "stock",
    }
    r = requests.post(f"{BASE_URL}/api/cars", headers=H, json=payload, timeout=20)
    assert r.status_code == 200
    cid = r.json()["id"]
    # soft delete
    r = requests.delete(f"{BASE_URL}/api/cars/{cid}", headers=H, timeout=20)
    assert r.status_code == 200
    time.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/activity-logs?entity_type=car&action=delete",
                     headers=H, timeout=20)
    assert any(l.get("entity_id") == cid for l in r.json()["logs"]), "soft delete log missing"
    # permanent delete
    r = requests.delete(f"{BASE_URL}/api/cars/{cid}?permanent=true", headers=H, timeout=20)
    assert r.status_code == 200
    time.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/activity-logs?entity_type=car&action=permanent_delete",
                     headers=H, timeout=20)
    assert any(l.get("entity_id") == cid for l in r.json()["logs"]), "permanent delete log missing"


# --- User CRUD logs ---

def test_user_crud_logs(H):
    email = f"test_iter43_{uuid.uuid4().hex[:6]}@test.com"
    payload = {"email": email, "password": "Password123!", "company_name": "TEST_iter43_user",
               "phone": "5551112233", "role": "satis"}
    r = requests.post(f"{BASE_URL}/api/users", headers=H, json=payload, timeout=20)
    assert r.status_code == 200, r.text
    uid = r.json()["id"]

    time.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/activity-logs?entity_type=user&action=create",
                     headers=H, timeout=20)
    assert any(l.get("entity_id") == uid for l in r.json()["logs"]), "user create log missing"

    # update
    r = requests.put(f"{BASE_URL}/api/users/{uid}", headers=H,
                     json={"company_name": "TEST_iter43_user_UPD"}, timeout=20)
    assert r.status_code == 200
    time.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/activity-logs?entity_type=user&action=update",
                     headers=H, timeout=20)
    assert any(l.get("entity_id") == uid for l in r.json()["logs"]), "user update log missing"

    # delete
    r = requests.delete(f"{BASE_URL}/api/users/{uid}", headers=H, timeout=20)
    assert r.status_code == 200
    time.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/activity-logs?entity_type=user&action=delete",
                     headers=H, timeout=20)
    assert any(l.get("entity_id") == uid for l in r.json()["logs"]), "user delete log missing"


# --- Clear logs auth ---

def test_clear_logs_non_admin_forbidden():
    # Create temp non-admin user, login as it, then attempt clear
    admin_login = requests.post(f"{BASE_URL}/api/auth/login",
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
                                timeout=20).json()
    admin_h = {"Authorization": f"Bearer {admin_login['token']}",
               "Content-Type": "application/json"}
    email = f"satis_iter43_{uuid.uuid4().hex[:6]}@test.com"
    pwd = "Password123!"
    r = requests.post(f"{BASE_URL}/api/users", headers=admin_h,
                      json={"email": email, "password": pwd,
                            "company_name": "TEST_satis_iter43",
                            "phone": "5551112244", "role": "satis"}, timeout=20)
    assert r.status_code == 200, r.text
    new_uid = r.json()["id"]
    try:
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": email, "password": pwd}, timeout=20)
        assert login.status_code == 200
        sat_h = {"Authorization": f"Bearer {login.json()['token']}",
                 "Content-Type": "application/json"}
        r = requests.delete(f"{BASE_URL}/api/activity-logs/clear",
                            headers=sat_h, timeout=20)
        # endpoint returns 200 with success=False (or 403)
        if r.status_code == 200:
            assert r.json().get("success") is False
        else:
            assert r.status_code in (401, 403)
    finally:
        requests.delete(f"{BASE_URL}/api/users/{new_uid}", headers=admin_h, timeout=20)


# --- Employee performance ---

def test_employee_performance_admin(H):
    r = requests.get(f"{BASE_URL}/api/stats/employee-performance", headers=H, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "performance" in data and isinstance(data["performance"], list)
    assert "totals" in data
    totals = data["totals"]
    for k in ("sold_count", "total_revenue", "total_cost", "total_profit", "total_employee_share"):
        assert k in totals
    # At least the admin user should appear (sold_count may be 0)
    assert len(data["performance"]) >= 1
    for row in data["performance"]:
        for k in ("user_id", "user_name", "sold_count", "total_revenue",
                  "total_cost", "total_profit", "total_employee_share"):
            assert k in row, f"missing {k} in {row}"


def test_employee_performance_satis_role_self_only():
    # create satis user, login, check only self
    admin_login = requests.post(f"{BASE_URL}/api/auth/login",
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
                                timeout=20).json()
    admin_h = {"Authorization": f"Bearer {admin_login['token']}",
               "Content-Type": "application/json"}
    email = f"perf_satis_{uuid.uuid4().hex[:6]}@test.com"
    pwd = "Password123!"
    r = requests.post(f"{BASE_URL}/api/users", headers=admin_h,
                      json={"email": email, "password": pwd,
                            "company_name": "TEST_perf_satis",
                            "phone": "5551112255", "role": "satis"}, timeout=20)
    assert r.status_code == 200
    new_uid = r.json()["id"]
    try:
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": email, "password": pwd}, timeout=20)
        sat_h = {"Authorization": f"Bearer {login.json()['token']}",
                 "Content-Type": "application/json"}
        r = requests.get(f"{BASE_URL}/api/stats/employee-performance",
                         headers=sat_h, timeout=20)
        assert r.status_code == 200
        rows = r.json()["performance"]
        # Should only contain entries for the satis user (or empty + unassigned)
        non_unassigned = [x for x in rows if x.get("user_id")]
        assert all(x["user_id"] == new_uid for x in non_unassigned), \
            f"satis sees other users: {[x['user_id'] for x in non_unassigned]}"
    finally:
        requests.delete(f"{BASE_URL}/api/users/{new_uid}", headers=admin_h, timeout=20)
