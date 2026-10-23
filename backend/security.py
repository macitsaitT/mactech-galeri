import re
import logging
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)

# ==================== INPUT VALIDATION ====================

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
MIN_PASSWORD_LENGTH = 8


def validate_email(email: str) -> str:
    email = email.strip().lower()
    if not email or len(email) > 254:
        raise HTTPException(status_code=400, detail="Geçersiz email adresi")
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Geçersiz email formatı")
    return email


def validate_password(password: str):
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Şifre en az {MIN_PASSWORD_LENGTH} karakter olmalıdır")


def validate_phone(phone: str, required: bool = False) -> str:
    """Türkiye formatı: tam 11 hane rakam (0XXXXXXXXXX).

    - required=True ise boş kabul edilmez, 400 fırlatır.
    - required=False ve boş ise boş string döner.
    - Format dışı (11 haneden az/çok, rakam dışı) her zaman 400 fırlatır.
    """
    if phone is None:
        phone = ""
    raw = str(phone).strip()
    if not raw:
        if required:
            raise HTTPException(status_code=400, detail="Telefon numarası zorunludur")
        return ""
    # Yalnızca rakamları al
    digits = re.sub(r"\D", "", raw)
    if len(digits) != 11:
        raise HTTPException(
            status_code=400,
            detail="Telefon numarası tam 11 haneli olmalıdır (örn: 05551234567)"
        )
    if not digits.startswith("0"):
        raise HTTPException(
            status_code=400,
            detail="Telefon numarası 0 ile başlamalıdır (örn: 05551234567)"
        )
    return digits


# ==================== MONGODB INJECTION PREVENTION ====================

def sanitize_string(value: str) -> str:
    if not isinstance(value, str):
        return value
    # Strip MongoDB operators from string values
    if value.startswith("$"):
        raise HTTPException(status_code=400, detail="Geçersiz giriş")
    return value


def sanitize_dict(data: dict) -> dict:
    cleaned = {}
    for key, value in data.items():
        if isinstance(key, str) and key.startswith("$"):
            continue  # Strip MongoDB operator keys
        if isinstance(value, str):
            cleaned[key] = sanitize_string(value)
        elif isinstance(value, dict):
            cleaned[key] = sanitize_dict(value)
        else:
            cleaned[key] = value
    return cleaned


# ==================== FILE UPLOAD MAGIC BYTES ====================

MAGIC_BYTES = {
    "jpg": [b'\xff\xd8\xff'],
    "jpeg": [b'\xff\xd8\xff'],
    "png": [b'\x89PNG\r\n\x1a\n'],
    "gif": [b'GIF87a', b'GIF89a'],
    "webp": [b'RIFF'],
}


def validate_file_magic(data: bytes, ext: str) -> bool:
    signatures = MAGIC_BYTES.get(ext, [])
    if not signatures:
        return False
    return any(data[:len(sig)] == sig for sig in signatures)


# ==================== SECURITY HEADERS MIDDLEWARE ====================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response
