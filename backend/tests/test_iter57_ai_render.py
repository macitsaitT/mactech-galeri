"""Iter 57 — AI Render endpoint test (POST /api/ai/render-car).

Covers:
- 401 without auth
- 400 invalid MIME type
- 413 oversize (>10MB)
- 422 invalid style (Pydantic Literal validation)
- 200 with valid JPG + style='studio_dark' returns non-empty image_base64
- 200 with valid JPG + style='dramatic_lighting' returns non-empty image_base64

Note: each LLM call ~30-60s. Only 2 LLM-touching tests to keep iteration time low.
"""
import io
import os
import time
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://image-gallery-live.preview.emergentagent.com",
).rstrip("/")
LOGIN_EMAIL = "test_branch_6b287ede@test.com"
LOGIN_PASSWORD = "Password123!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _make_car_jpg() -> bytes:
    """Synthetic car-silhouette JPG with real visual features (~800x500)."""
    W, H = 800, 500
    img = Image.new("RGB", (W, H), (200, 215, 230))  # sky background
    d = ImageDraw.Draw(img)
    # ground
    d.rectangle([0, 360, W, H], fill=(80, 80, 85))
    # road stripes
    for x in range(20, W, 60):
        d.rectangle([x, 425, x + 30, 432], fill=(240, 230, 100))
    # car body (sedan shape) - hood/cabin/trunk
    # main body
    d.rectangle([140, 270, 660, 380], fill=(180, 30, 35))  # red car body
    # cabin/roof (trapezoid via polygon)
    d.polygon([(240, 270), (340, 200), (520, 200), (620, 270)], fill=(150, 25, 30))
    # windows
    d.polygon([(255, 265), (350, 215), (430, 215), (430, 265)], fill=(60, 80, 110))
    d.polygon([(440, 265), (440, 215), (515, 215), (605, 265)], fill=(60, 80, 110))
    # door line
    d.line([(430, 270), (430, 380)], fill=(110, 15, 20), width=2)
    # wheels
    d.ellipse([200, 350, 290, 430], fill=(20, 20, 25))
    d.ellipse([515, 350, 605, 430], fill=(20, 20, 25))
    d.ellipse([220, 370, 270, 410], fill=(150, 150, 155))
    d.ellipse([535, 370, 585, 410], fill=(150, 150, 155))
    # headlights/taillights
    d.ellipse([635, 295, 665, 325], fill=(255, 230, 150))
    d.ellipse([135, 295, 165, 325], fill=(255, 80, 80))
    # bumper
    d.rectangle([140, 365, 660, 385], fill=(120, 20, 25))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


# ==================== Validation tests (no LLM calls) ====================
class TestAIRenderValidation:
    def test_requires_auth(self):
        files = {"file": ("car.jpg", b"\xff\xd8\xff\xe0" + b"x" * 2048, "image/jpeg")}
        r = requests.post(
            f"{BASE_URL}/api/ai/render-car",
            files=files,
            data={"style": "studio_dark"},
            timeout=15,
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code} {r.text[:200]}"

    def test_rejects_non_image_mime(self, auth_headers):
        files = {"file": ("doc.txt", b"hello world" * 200, "text/plain")}
        r = requests.post(
            f"{BASE_URL}/api/ai/render-car",
            headers=auth_headers,
            files=files,
            data={"style": "studio_dark"},
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code} {r.text[:300]}"
        body = r.text.lower()
        assert "tür" in body or "jpg" in body or "geçersiz" in body or "png" in body

    def test_rejects_oversize(self, auth_headers):
        big = b"\xff\xd8\xff\xe0" + b"A" * (10 * 1024 * 1024 + 500)
        files = {"file": ("big.jpg", big, "image/jpeg")}
        r = requests.post(
            f"{BASE_URL}/api/ai/render-car",
            headers=auth_headers,
            files=files,
            data={"style": "studio_dark"},
            timeout=30,
        )
        assert r.status_code == 413, f"Expected 413, got {r.status_code} {r.text[:200]}"

    def test_rejects_unknown_style(self, auth_headers):
        files = {"file": ("car.jpg", _make_car_jpg(), "image/jpeg")}
        r = requests.post(
            f"{BASE_URL}/api/ai/render-car",
            headers=auth_headers,
            files=files,
            data={"style": "neon_cyberpunk"},
            timeout=15,
        )
        # Pydantic Literal validation should give 422; some FastAPI versions may produce 400
        assert r.status_code in (400, 422), f"Expected 400/422, got {r.status_code} {r.text[:300]}"


# ==================== LLM-backed render tests ====================
class TestAIRenderGeneration:
    def test_render_studio_dark(self, auth_headers):
        img = _make_car_jpg()
        assert len(img) > 5000
        files = {"file": ("car.jpg", img, "image/jpeg")}
        t0 = time.time()
        r = requests.post(
            f"{BASE_URL}/api/ai/render-car",
            headers=auth_headers,
            files=files,
            data={"style": "studio_dark"},
            timeout=120,
        )
        elapsed = time.time() - t0
        print(f"\n[AI Render studio_dark] {elapsed:.1f}s status={r.status_code}")
        assert r.status_code == 200, f"Render failed: {r.status_code} {r.text[:500]}"
        body = r.json()
        b64 = body.get("image_base64", "")
        mime = body.get("mime_type", "")
        # Do NOT print full base64 - only head
        print(f"[AI Render studio_dark] mime={mime} b64_len={len(b64)} head={b64[:20]}")
        assert mime in ("image/png", "image/jpeg", "image/jpg", "image/webp"), f"Unexpected mime: {mime}"
        assert len(b64) > 50000, f"Expected b64 > 50k chars, got {len(b64)}"

    def test_render_dramatic_lighting(self, auth_headers):
        img = _make_car_jpg()
        files = {"file": ("car.jpg", img, "image/jpeg")}
        t0 = time.time()
        r = requests.post(
            f"{BASE_URL}/api/ai/render-car",
            headers=auth_headers,
            files=files,
            data={"style": "dramatic_lighting"},
            timeout=120,
        )
        elapsed = time.time() - t0
        print(f"\n[AI Render dramatic_lighting] {elapsed:.1f}s status={r.status_code}")
        assert r.status_code == 200, f"Render failed: {r.status_code} {r.text[:500]}"
        body = r.json()
        b64 = body.get("image_base64", "")
        mime = body.get("mime_type", "")
        print(f"[AI Render dramatic_lighting] mime={mime} b64_len={len(b64)} head={b64[:20]}")
        assert mime in ("image/png", "image/jpeg", "image/jpg", "image/webp")
        assert len(b64) > 50000, f"Expected b64 > 50k chars, got {len(b64)}"
