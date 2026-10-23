"""mactech.tr alt kullanıcı sync servisi.

Bu modül, CRM'de bir çalışan (alt kullanıcı) oluşturulduğunda / silindiğinde
mactech.tr'nin `/api/platform/sub-users` endpoint'ine bildirim gönderir.

Best-effort: sync başarısız olursa CRM işlemi bloklamaz, sadece log'a yazılır.
"""
import os
import logging
import asyncio
from typing import Optional

import httpx

from db import db

logger = logging.getLogger(__name__)

MACTECH_BASE_URL = os.environ.get("MACTECH_BASE_URL", "https://www.mactech.tr")
SUBUSER_ENDPOINT = f"{MACTECH_BASE_URL}/api/platform/sub-users"


async def _get_parent_jwt(org_id: str) -> Optional[str]:
    """Ana admin'in mactech.tr platform JWT'sini getir."""
    admin = await db.users.find_one(
        {"id": org_id, "role": "admin"},
        {"_id": 0, "mactech_jwt": 1, "auth_provider": 1}
    )
    if not admin:
        return None
    return admin.get("mactech_jwt")


async def _log_sync_attempt(
    action: str,
    email: str,
    org_id: str,
    success: bool,
    status_code: Optional[int] = None,
    error: Optional[str] = None,
):
    """Sync denemelerini DB'de logla — debug ve retry için."""
    try:
        from datetime import datetime, timezone
        await db.subuser_sync_logs.insert_one({
            "action": action,
            "email": email,
            "org_id": org_id,
            "success": success,
            "status_code": status_code,
            "error": error,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


async def sync_sub_user_created(org_id: str, email: str, name: str, password: str, phone: str = ""):
    """Çalışan oluşturulduğunda mactech.tr'ye bildir."""
    jwt = await _get_parent_jwt(org_id)
    if not jwt:
        await _log_sync_attempt("create", email, org_id, False, error="parent_jwt_missing")
        logger.warning(f"[subuser-sync] Parent JWT yok — skip create: {email}")
        return {"synced": False, "reason": "no_parent_jwt"}

    payload = {
        "email": email,
        "name": name or email.split("@")[0],
        "password": password,
        "phone": phone or "",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                SUBUSER_ENDPOINT,
                json=payload,
                headers={"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
            )
        ok = 200 <= resp.status_code < 300
        await _log_sync_attempt("create", email, org_id, ok, resp.status_code, None if ok else resp.text[:200])
        if ok:
            logger.info(f"[subuser-sync] Çalışan oluşturuldu mactech.tr'de: {email}")
        else:
            logger.warning(f"[subuser-sync] Create failed {resp.status_code}: {email} → {resp.text[:120]}")
        return {"synced": ok, "status_code": resp.status_code}
    except Exception as e:
        await _log_sync_attempt("create", email, org_id, False, error=str(e))
        logger.error(f"[subuser-sync] Create exception: {email} → {e}")
        return {"synced": False, "error": str(e)}


async def sync_sub_user_deleted(org_id: str, email: str):
    """Çalışan silindiğinde mactech.tr'ye bildir."""
    jwt = await _get_parent_jwt(org_id)
    if not jwt:
        await _log_sync_attempt("delete", email, org_id, False, error="parent_jwt_missing")
        logger.warning(f"[subuser-sync] Parent JWT yok — skip delete: {email}")
        return {"synced": False, "reason": "no_parent_jwt"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                SUBUSER_ENDPOINT,
                params={"email": email},
                headers={"Authorization": f"Bearer {jwt}"},
            )
        ok = 200 <= resp.status_code < 300 or resp.status_code == 404  # 404 = zaten yok
        await _log_sync_attempt("delete", email, org_id, ok, resp.status_code, None if ok else resp.text[:200])
        if ok:
            logger.info(f"[subuser-sync] Çalışan silindi mactech.tr'de: {email} (status {resp.status_code})")
        else:
            logger.warning(f"[subuser-sync] Delete failed {resp.status_code}: {email} → {resp.text[:120]}")
        return {"synced": ok, "status_code": resp.status_code}
    except Exception as e:
        await _log_sync_attempt("delete", email, org_id, False, error=str(e))
        logger.error(f"[subuser-sync] Delete exception: {email} → {e}")
        return {"synced": False, "error": str(e)}


def fire_and_forget(coro):
    """Await olmadan asenkron task başlat — endpoint yanıtını geciktirmemek için."""
    try:
        asyncio.create_task(coro)
    except RuntimeError:
        # Event loop yoksa (sync context) — senkron çalıştır
        asyncio.get_event_loop().run_until_complete(coro)
