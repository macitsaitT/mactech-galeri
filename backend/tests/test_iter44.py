"""Iter 44 — Transaction activity logs, activity-logs date filter,
sales-breakdown endpoint, digest preview/send-now endpoints.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN = {"email": "test_branch_6b287ede@test.com", "password": "Password123!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def satis_client(admin_headers):
    """Create a satis (non-admin) user for 403 testing."""
    email = f"TEST_satis_iter44_{uuid.uuid4().hex[:8]}@test.com"
    pw = "Password123!"
    # Admin creates satis user
    r = requests.post(
        f"{BASE_URL}/api/users",
        headers=admin_headers,
        json={"email": email, "password": pw, "company_name": "TEST Satis 44", "role": "satis", "phone": "5550000044"},
        timeout=15,
    )
    assert r.status_code in (200, 201), f"User create failed {r.status_code} {r.text}"
    uid = r.json().get("id")
    # Login as satis
    lr = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert lr.status_code == 200, lr.text
    token = lr.json().get("access_token") or lr.json().get("token")
    yield {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        requests.delete(f"{BASE_URL}/api/users/{uid}?permanent=true", headers=admin_headers, timeout=10)
    except Exception:
        pass


# ---------- Transaction Activity Logs ----------
class TestTransactionActivityLogs:
    def test_create_transaction_logs_activity(self, admin_headers):
        payload = {
            "type": "expense",
            "category": "Test İter44",
            "amount": 1234.5,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "description": "TEST_iter44 create log",
        }
        r = requests.post(f"{BASE_URL}/api/transactions", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        tx_id = r.json()["id"]

        # GET logs filtered
        lr = requests.get(
            f"{BASE_URL}/api/activity-logs?entity_type=transaction&action=create",
            headers=admin_headers, timeout=15,
        )
        assert lr.status_code == 200
        logs = lr.json()["logs"]
        match = [lg for lg in logs if lg.get("entity_id") == tx_id]
        assert match, "create log for transaction not found"
        d = match[0].get("details") or {}
        assert d.get("type") == "expense"
        assert float(d.get("amount") or 0) == 1234.5

        # Update amount
        ur = requests.put(
            f"{BASE_URL}/api/transactions/{tx_id}",
            headers=admin_headers, json={"amount": 2222.0}, timeout=15,
        )
        assert ur.status_code == 200
        lr2 = requests.get(
            f"{BASE_URL}/api/activity-logs?entity_type=transaction&action=update",
            headers=admin_headers, timeout=15,
        )
        up_logs = [lg for lg in lr2.json()["logs"] if lg.get("entity_id") == tx_id]
        assert up_logs, "update log missing"
        changes = (up_logs[0].get("details") or {}).get("changes") or {}
        assert "amount" in changes and float(changes["amount"]["old"]) == 1234.5
        assert float(changes["amount"]["new"]) == 2222.0

        # Soft delete
        dr = requests.delete(f"{BASE_URL}/api/transactions/{tx_id}", headers=admin_headers, timeout=15)
        assert dr.status_code == 200
        lr3 = requests.get(
            f"{BASE_URL}/api/activity-logs?entity_type=transaction&action=delete",
            headers=admin_headers, timeout=15,
        )
        del_logs = [lg for lg in lr3.json()["logs"] if lg.get("entity_id") == tx_id]
        assert del_logs, "soft delete log missing"

        # Permanent delete
        pr = requests.delete(
            f"{BASE_URL}/api/transactions/{tx_id}?permanent=true",
            headers=admin_headers, timeout=15,
        )
        assert pr.status_code == 200
        lr4 = requests.get(
            f"{BASE_URL}/api/activity-logs?entity_type=transaction&action=permanent_delete",
            headers=admin_headers, timeout=15,
        )
        pd_logs = [lg for lg in lr4.json()["logs"] if lg.get("entity_id") == tx_id]
        assert pd_logs, "permanent_delete log missing"


# ---------- Activity Logs Date Filter ----------
class TestActivityLogsDateFilter:
    def test_date_range_filter(self, admin_headers):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        r = requests.get(
            f"{BASE_URL}/api/activity-logs?start_date={today}&end_date={tomorrow}",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200
        logs = r.json()["logs"]
        # All returned log created_at should fall within range
        for lg in logs:
            ca = lg.get("created_at", "")
            assert ca >= f"{today}T00:00:00", f"log created_at {ca} before start_date {today}"
            assert ca <= f"{tomorrow}T23:59:59+99:99", "should be within range"

    def test_old_end_date_returns_empty(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/activity-logs?start_date=2000-01-01&end_date=2000-01-02",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["count"] == 0


# ---------- Sales Breakdown ----------
class TestSalesBreakdown:
    def test_monthly_breakdown_shape(self, admin_headers):
        year = datetime.utcnow().year
        r = requests.get(
            f"{BASE_URL}/api/stats/sales-breakdown?period=monthly&year={year}",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["period"] == "monthly"
        assert j["year"] == year
        assert isinstance(j["data"], list) and len(j["data"]) == 12
        for bucket in j["data"]:
            for k in ("label", "sold_count", "revenue", "profit"):
                assert k in bucket, f"missing {k} in bucket"

    def test_yearly_breakdown_shape(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/stats/sales-breakdown?period=yearly",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200
        j = r.json()
        assert j["period"] == "yearly"
        assert isinstance(j["data"], list)
        assert 1 <= len(j["data"]) <= 5
        for bucket in j["data"]:
            for k in ("label", "sold_count", "revenue", "profit"):
                assert k in bucket


# ---------- Digest endpoints ----------
class TestDigest:
    def test_preview_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/digest/preview", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "stats" in j and "html" in j
        for k in ("sold_count", "new_car_count", "price_change_count", "stock_count"):
            assert k in j["stats"], f"stats.{k} missing"
        assert isinstance(j["html"], str) and len(j["html"]) > 2000, f"html too short: {len(j['html'])}"

    def test_preview_forbidden_for_satis(self, satis_client):
        r = requests.get(f"{BASE_URL}/api/digest/preview", headers=satis_client, timeout=20)
        assert r.status_code == 403

    def test_send_now_admin(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/digest/send-now", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("sent") is True, f"sent != True: {j}"
        assert j.get("email_id")
        assert j.get("recipient")
        assert "stats" in j

    def test_send_now_forbidden_for_satis(self, satis_client):
        r = requests.post(f"{BASE_URL}/api/digest/send-now", headers=satis_client, timeout=20)
        assert r.status_code == 403
