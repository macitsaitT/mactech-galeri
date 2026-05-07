"""
Iter 50 — Satıcı (seller_customer_id) multi-car senaryo test.

Test akışı:
1. Yeni "Potansiyel" müşteri oluştur (Ahmet)
2. Bu satıcıdan 1. araç al → Ahmet 'Satıcı' olur
3. Aynı satıcıdan 2. araç al → Ahmet hâlâ 'Satıcı'
4. Customer detail endpoint: sold_to_us_cars=2, total amount = 1+2 alış toplamı
5. 1. aracı sil → Ahmet hâlâ 'Satıcı' olmalı (2. araç var)
6. 2. aracı da sil → Ahmet 'Potansiyel'e revert olmalı
7. Restore + edge case: PUT ile seller değiştirme — eski seller orphan ise revert, yeni seller mark.

Çalıştırma: cd /app/backend && pytest tests/test_iter50_seller_multi_car.py -v
"""
import os
import uuid
import pytest
import requests

API_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://image-gallery-live.preview.emergentagent.com")
TEST_EMAIL = "test_branch_6b287ede@test.com"
TEST_PASS = "Password123!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{API_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASS},
        timeout=10,
    )
    assert r.status_code == 200, f"Login fail: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _create_customer(headers, name, phone="05551112233"):
    r = requests.post(
        f"{API_URL}/api/customers",
        headers=headers,
        json={"name": name, "phone": phone, "type": "Potansiyel"},
        timeout=10,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()


def _get_customer(headers, customer_id):
    r = requests.get(f"{API_URL}/api/customers", headers=headers, timeout=10)
    assert r.status_code == 200
    for c in r.json():
        if c["id"] == customer_id:
            return c
    return None


def _create_car(headers, plate, seller_customer_id=None, purchase_price=400000):
    payload = {
        "brand": "TEST",
        "model": "Iter50",
        "year": 2020,
        "plate": plate,
        "sale_price": 600000,
        "purchase_price": purchase_price,
        "ownership": "stock",
        "fuel_type": "Dizel",
        "gear": "Otomatik",
        "status": "Stokta",
    }
    if seller_customer_id:
        payload["seller_customer_id"] = seller_customer_id
    r = requests.post(f"{API_URL}/api/cars", headers=headers, json=payload, timeout=10)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _delete_car(headers, car_id, permanent=True):
    r = requests.delete(
        f"{API_URL}/api/cars/{car_id}?permanent={'true' if permanent else 'false'}",
        headers=headers,
        timeout=10,
    )
    assert r.status_code == 200, r.text


def _delete_customer(headers, customer_id):
    requests.delete(
        f"{API_URL}/api/customers/{customer_id}?permanent=true",
        headers=headers,
        timeout=10,
    )


def test_seller_multi_car_lifecycle(headers):
    """1 satıcıdan 2 araç al → tip Satıcı, 1 sil → hâlâ Satıcı, 2.yi sil → Potansiyel."""
    suffix = uuid.uuid4().hex[:6].upper()
    seller = _create_customer(headers, f"Iter50 Satici {suffix}")
    seller_id = seller["id"]
    plate1 = f"34S{suffix}1"
    plate2 = f"34S{suffix}2"

    car_ids = []
    try:
        # 1. araç
        car1 = _create_car(headers, plate1, seller_customer_id=seller_id, purchase_price=400000)
        car_ids.append(car1["id"])
        c = _get_customer(headers, seller_id)
        assert c["type"] == "Satıcı", f"1. araçtan sonra tip Satıcı olmalı, geldi: {c['type']}"

        # 2. araç (aynı satıcıdan)
        car2 = _create_car(headers, plate2, seller_customer_id=seller_id, purchase_price=300000)
        car_ids.append(car2["id"])
        c = _get_customer(headers, seller_id)
        assert c["type"] == "Satıcı", "2. araçtan sonra hâlâ Satıcı olmalı"

        # detail endpoint — 2 araç + toplam 700K
        r = requests.get(
            f"{API_URL}/api/customers/{seller_id}/detail",
            headers={"Authorization": headers["Authorization"]},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d.get("sold_to_us_cars", [])) == 2, f"detail: 2 araç beklenir, geldi {len(d.get('sold_to_us_cars', []))}"
        assert d["totals"]["total_sold_to_us_amount"] == 700000.0, d["totals"]

        # 1. aracı sil → tip hâlâ Satıcı (2. araç var)
        _delete_car(headers, car1["id"])
        car_ids.remove(car1["id"])
        c = _get_customer(headers, seller_id)
        assert c["type"] == "Satıcı", f"1. araç silindikten sonra hâlâ Satıcı olmalı (2. araç var), geldi: {c['type']}"

        # 2. aracı sil → tip Potansiyel'e revert
        _delete_car(headers, car2["id"])
        car_ids.remove(car2["id"])
        c = _get_customer(headers, seller_id)
        assert c["type"] == "Potansiyel", f"Tüm araçlar silindi → Potansiyel olmalı, geldi: {c['type']}"
    finally:
        for cid in car_ids:
            try:
                _delete_car(headers, cid)
            except Exception:
                pass
        _delete_customer(headers, seller_id)


def test_seller_change_via_put(headers):
    """PUT ile seller değişirse eski Potansiyel'e revert, yeni Satıcı olur."""
    suffix = uuid.uuid4().hex[:6].upper()
    seller_a = _create_customer(headers, f"Iter50 SellerA {suffix}", phone="05559990001")
    seller_b = _create_customer(headers, f"Iter50 SellerB {suffix}", phone="05559990002")
    car = None
    try:
        car = _create_car(headers, f"34P{suffix}", seller_customer_id=seller_a["id"])
        # A → Satıcı
        assert _get_customer(headers, seller_a["id"])["type"] == "Satıcı"
        assert _get_customer(headers, seller_b["id"])["type"] == "Potansiyel"

        # PUT ile satıcıyı B'ye değiştir
        update_payload = {
            "brand": car["brand"],
            "model": car["model"],
            "year": car["year"],
            "plate": car["plate"],
            "sale_price": car["sale_price"],
            "purchase_price": car["purchase_price"],
            "ownership": "stock",
            "fuel_type": "Dizel",
            "gear": "Otomatik",
            "status": "Stokta",
            "seller_customer_id": seller_b["id"],
        }
        r = requests.put(
            f"{API_URL}/api/cars/{car['id']}",
            headers=headers,
            json=update_payload,
            timeout=10,
        )
        assert r.status_code == 200, r.text

        # A → Potansiyel (orphan), B → Satıcı
        assert _get_customer(headers, seller_a["id"])["type"] == "Potansiyel", "Eski seller orphan, Potansiyel olmalı"
        assert _get_customer(headers, seller_b["id"])["type"] == "Satıcı", "Yeni seller Satıcı olmalı"

        # PATCH ile seller'ı kaldır
        r = requests.patch(
            f"{API_URL}/api/cars/{car['id']}",
            headers=headers,
            json={"seller_customer_id": ""},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert _get_customer(headers, seller_b["id"])["type"] == "Potansiyel", "PATCH ile kaldırınca eski seller revert"
    finally:
        if car:
            try:
                _delete_car(headers, car["id"])
            except Exception:
                pass
        _delete_customer(headers, seller_a["id"])
        _delete_customer(headers, seller_b["id"])
