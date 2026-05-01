"""Backend test for GET /api/export/expertise/{car_id} White Label logo header."""
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://image-gallery-live.preview.emergentagent.com').rstrip('/')
EMAIL = "test_branch_6b287ede@test.com"
PASSWORD = "Password123!"

# 1x1 transparent PNG base64
TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
LOGO_DATA_URL = f"data:image/png;base64,{TINY_PNG_B64}"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def car_id(headers):
    # Create a test car (TEST_ prefix in plate)
    payload = {
        "brand": "Ford",
        "model": "Focus",
        "year": 2020,
        "plate": "TEST EXP 01",
        "km": "50000",
        "fuel_type": "Benzin",
        "gear": "Manuel",
        "engine_type": "1.6",
        "purchase_price": 500000,
        "sale_price": 600000,
        "status": "Stokta",
        "ownership": "stock",
        "province": "Istanbul",
        "district": "Kadikoy",
        "expertise": {
            "parts": {"on_tampon": "boyali", "kaput": "orijinal"},
            "mechanical": {"motor": "Orijinal", "sanziman": "Orijinal", "yuruyen": "Orijinal"}
        },
        "expertise_score": 88,
        "tramer_amount": 0,
    }
    r = requests.post(f"{BASE_URL}/api/cars", json=payload, headers=headers, timeout=15)
    assert r.status_code in (200, 201), f"Car create failed: {r.status_code} {r.text[:300]}"
    cid = r.json().get("id")
    assert cid
    yield cid
    # cleanup
    try:
        requests.delete(f"{BASE_URL}/api/cars/{cid}", headers=headers, timeout=10)
    except Exception:
        pass


def _set_logo(headers, logo_value):
    # Try PUT /api/auth/profile
    r = requests.put(f"{BASE_URL}/api/auth/profile", json={"logo_url": logo_value, "company_name": "TEST Co AS"}, headers=headers, timeout=15)
    return r


def test_set_logo_via_profile(headers):
    r = _set_logo(headers, LOGO_DATA_URL)
    assert r.status_code in (200, 201, 204), f"Profile update failed: {r.status_code} {r.text[:300]}"


def test_expertise_pdf_returns_pdf_with_logo(headers, car_id):
    r = requests.get(f"{BASE_URL}/api/export/expertise/{car_id}", headers=headers, timeout=30)
    assert r.status_code == 200, f"Status {r.status_code}: {r.text[:300]}"
    ct = r.headers.get("content-type", "")
    assert "application/pdf" in ct, f"Wrong content-type: {ct}"
    content = r.content
    assert content[:4] == b"%PDF", f"Not a PDF: first bytes {content[:8]!r}"
    assert len(content) > 2000, f"PDF too small ({len(content)} bytes)"


def test_expertise_pdf_without_logo_still_works(headers, car_id):
    # Clear logo
    _set_logo(headers, "")
    r = requests.get(f"{BASE_URL}/api/export/expertise/{car_id}", headers=headers, timeout=30)
    assert r.status_code == 200
    assert r.content[:4] == b"%PDF"
    # Restore logo
    _set_logo(headers, LOGO_DATA_URL)


def test_expertise_pdf_404_for_unknown_car(headers):
    r = requests.get(f"{BASE_URL}/api/export/expertise/nonexistent-car-id-xyz", headers=headers, timeout=15)
    assert r.status_code == 404


def test_expertise_pdf_requires_auth():
    r = requests.get(f"{BASE_URL}/api/export/expertise/any", timeout=10)
    assert r.status_code in (401, 403)
