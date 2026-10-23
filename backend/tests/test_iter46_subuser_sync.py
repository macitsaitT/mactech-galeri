"""Iter 46 — mactech.tr sub-user sync entegrasyonu testleri."""
import os
import pytest
import requests
import uuid

API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
ADMIN_EMAIL = "test_branch_6b287ede@test.com"
ADMIN_PASSWORD = "Password123!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{API_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200
    return r.json()["token"]


def _hdr(tk):
    return {"Authorization": f"Bearer {tk}", "Content-Type": "application/json"}


def test_subuser_sync_log_endpoint_admin_only(token):
    r = requests.get(f"{API_URL}/api/users/subuser-sync-logs", headers=_hdr(token))
    assert r.status_code == 200
    data = r.json()
    assert "logs" in data
    assert "count" in data
    assert "success" in data and "failed" in data


def test_subuser_sync_triggered_on_create(token):
    email = f"pytest_iter46_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(
        f"{API_URL}/api/users",
        headers=_hdr(token),
        json={
            "email": email, "password": "Test12345!",
            "company_name": "Pytest Sync", "phone": "5559876543", "role": "satis",
        },
    )
    assert r.status_code == 200
    new_id = r.json()["id"]

    # Sync log kaydı oluşmuş olmalı (async, ~1 saniye)
    import time
    time.sleep(2)

    logs = requests.get(f"{API_URL}/api/users/subuser-sync-logs", headers=_hdr(token)).json()
    create_logs = [lg for lg in logs["logs"] if lg["action"] == "create" and lg["email"] == email]
    assert len(create_logs) >= 1, f"Create sync log bulunamadı: {create_logs}"

    # Temizle
    requests.delete(f"{API_URL}/api/users/{new_id}", headers=_hdr(token))


def test_subuser_sync_triggered_on_delete(token):
    email = f"pytest_del_{uuid.uuid4().hex[:8]}@test.com"
    # Ekle
    r = requests.post(
        f"{API_URL}/api/users", headers=_hdr(token),
        json={"email": email, "password": "Test12345!", "company_name": "Del Test", "role": "satis"},
    )
    new_id = r.json()["id"]

    # Sil
    requests.delete(f"{API_URL}/api/users/{new_id}", headers=_hdr(token))

    import time
    time.sleep(2)
    logs = requests.get(f"{API_URL}/api/users/subuser-sync-logs", headers=_hdr(token)).json()
    delete_logs = [lg for lg in logs["logs"] if lg["action"] == "delete" and lg["email"] == email]
    assert len(delete_logs) >= 1
