"""Iter 56 — OCR endpoint test (POST /api/ocr).

Covers:
- 401 without auth
- 400 invalid MIME type (text/plain)
- 413 oversize (>10MB)
- 400 too small payload
- Ruhsat type with synthetic JPG containing visible Turkish text fields → >=5 non-empty fields
- Kimlik type with synthetic JPG → >=4 non-empty fields
"""
import io
import os
import time
import pytest
import requests
from PIL import Image, ImageDraw, ImageFont

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://image-gallery-live.preview.emergentagent.com").rstrip("/")
LOGIN_EMAIL = "test_branch_6b287ede@test.com"
LOGIN_PASSWORD = "Password123!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _load_font(size=28):
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _make_ruhsat_jpg() -> bytes:
    """Synthetic Turkish ruhsat-like image with clear text & visual features."""
    W, H = 1100, 700
    img = Image.new("RGB", (W, H), (245, 248, 252))
    d = ImageDraw.Draw(img)
    # Header banner
    d.rectangle([0, 0, W, 80], fill=(15, 60, 130))
    title_font = _load_font(34)
    d.text((30, 22), "T.C. ARAÇ TESCİL BELGESİ (RUHSAT)", fill=(255, 255, 255), font=title_font)

    # Inner card
    d.rectangle([20, 100, W - 20, H - 20], outline=(60, 90, 140), width=3)
    # decorative lines
    for y in range(120, H - 30, 50):
        d.line([(40, y), (W - 40, y)], fill=(230, 235, 245), width=1)

    fields = [
        ("Plaka", "34 ABC 1234"),
        ("Marka", "BMW"),
        ("Model", "320i"),
        ("Model Yili", "2020"),
        ("Motor No", "B48A20A12345"),
        ("Sasi No (VIN)", "WBA8E9C50KA123456"),
        ("Tescil Tarihi", "2020-06-15"),
        ("Renk", "Siyah"),
        ("Yakit", "Benzin"),
        ("Vites", "Otomatik"),
    ]
    f_label = _load_font(22)
    f_val = _load_font(26)
    y0 = 130
    for i, (label, val) in enumerate(fields):
        col = i % 2
        row = i // 2
        x = 50 + col * 520
        y = y0 + row * 100
        d.text((x, y), f"{label}:", fill=(60, 70, 100), font=f_label)
        d.text((x, y + 28), val, fill=(10, 20, 40), font=f_val)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def _make_kimlik_jpg() -> bytes:
    W, H = 1000, 620
    img = Image.new("RGB", (W, H), (250, 245, 230))
    d = ImageDraw.Draw(img)
    # Top stripe
    d.rectangle([0, 0, W, 70], fill=(180, 30, 40))
    title_font = _load_font(30)
    d.text((30, 18), "T.C. KİMLİK KARTI / NÜFUS CÜZDANI", fill=(255, 255, 255), font=title_font)
    # photo placeholder
    d.rectangle([40, 110, 240, 380], fill=(210, 210, 210), outline=(120, 120, 120), width=2)
    d.text((90, 230), "FOTO", fill=(80, 80, 80), font=_load_font(28))
    # text fields
    fields = [
        ("Adi", "AHMET"),
        ("Soyadi", "YILMAZ"),
        ("T.C. Kimlik No", "12345678901"),
        ("Dogum Tarihi", "1985-03-22"),
        ("Dogum Yeri", "İSTANBUL"),
    ]
    f_label = _load_font(22)
    f_val = _load_font(28)
    y0 = 110
    for i, (label, val) in enumerate(fields):
        y = y0 + i * 70
        d.text((280, y), f"{label}:", fill=(80, 60, 50), font=f_label)
        d.text((280, y + 28), val, fill=(20, 10, 10), font=f_val)
    # decorative diagonal
    for x in range(-200, W, 30):
        d.line([(x, 0), (x + 200, H)], fill=(245, 240, 225), width=1)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


# ==================== Validation tests ====================
class TestOCRValidation:
    def test_requires_auth(self):
        files = {"file": ("a.jpg", b"x" * 2048, "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/ocr",
                          files=files, data={"type": "ruhsat"}, timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_rejects_non_image_mime(self, auth_headers):
        files = {"file": ("doc.txt", b"hello world" * 200, "text/plain")}
        r = requests.post(f"{BASE_URL}/api/ocr",
                          headers=auth_headers, files=files,
                          data={"type": "ruhsat"}, timeout=15)
        assert r.status_code == 400, f"Expected 400, got {r.status_code} {r.text}"
        assert "tür" in r.text.lower() or "jpg" in r.text.lower() or "geçersiz" in r.text.lower()

    def test_rejects_oversize(self, auth_headers):
        # 10.5 MB JPEG
        big = b"\xff\xd8\xff\xe0" + b"A" * (10 * 1024 * 1024 + 500)
        files = {"file": ("big.jpg", big, "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/ocr",
                          headers=auth_headers, files=files,
                          data={"type": "ruhsat"}, timeout=30)
        assert r.status_code == 413, f"Expected 413, got {r.status_code} {r.text}"

    def test_rejects_too_small(self, auth_headers):
        files = {"file": ("tiny.jpg", b"\xff\xd8\xff\xe0tiny", "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/ocr",
                          headers=auth_headers, files=files,
                          data={"type": "ruhsat"}, timeout=15)
        assert r.status_code == 400, f"Expected 400 small, got {r.status_code}"


# ==================== OCR extraction tests (LLM call) ====================
class TestOCRExtraction:
    def test_ruhsat_extraction(self, auth_headers):
        img = _make_ruhsat_jpg()
        assert len(img) > 5000
        files = {"file": ("ruhsat.jpg", img, "image/jpeg")}
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/ocr",
                          headers=auth_headers, files=files,
                          data={"type": "ruhsat"}, timeout=90)
        elapsed = time.time() - t0
        print(f"\n[OCR ruhsat] {elapsed:.1f}s status={r.status_code}")
        assert r.status_code == 200, f"OCR failed: {r.status_code} {r.text[:500]}"
        body = r.json()
        assert body.get("type") == "ruhsat"
        data = body.get("data", {})
        print(f"[OCR ruhsat] data={data}")
        expected_keys = {"plaka", "marka", "model", "yil", "motor_no",
                         "sasi_no", "renk", "yakit", "vites"}
        non_empty = [k for k in expected_keys if data.get(k) and str(data[k]).strip()]
        print(f"[OCR ruhsat] non_empty={non_empty}")
        assert len(non_empty) >= 5, f"Expected >=5 non-empty fields, got {len(non_empty)}: {non_empty}"

    def test_kimlik_extraction(self, auth_headers):
        img = _make_kimlik_jpg()
        assert len(img) > 5000
        files = {"file": ("kimlik.jpg", img, "image/jpeg")}
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/ocr",
                          headers=auth_headers, files=files,
                          data={"type": "kimlik"}, timeout=90)
        elapsed = time.time() - t0
        print(f"\n[OCR kimlik] {elapsed:.1f}s status={r.status_code}")
        assert r.status_code == 200, f"OCR failed: {r.status_code} {r.text[:500]}"
        body = r.json()
        assert body.get("type") == "kimlik"
        data = body.get("data", {})
        print(f"[OCR kimlik] data={data}")
        expected_keys = {"ad", "soyad", "tc_kimlik_no", "dogum_tarihi", "dogum_yeri"}
        non_empty = [k for k in expected_keys if data.get(k) and str(data[k]).strip()]
        print(f"[OCR kimlik] non_empty={non_empty}")
        assert len(non_empty) >= 4, f"Expected >=4 non-empty fields, got {len(non_empty)}: {non_empty}"
