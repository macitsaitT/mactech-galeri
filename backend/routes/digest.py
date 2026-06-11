"""Haftalık / Günlük özet e-maili — Resend entegrasyonu.

- Scheduler: APScheduler her hafta pazartesi (yada env'de ayarlanan gün/saat) özet gönderir.
- Manuel tetikleyici: POST /api/digest/send-now (admin-only) test için.
"""
import os
import asyncio
import logging
from datetime import datetime, timedelta, timezone

import resend
from fastapi import APIRouter, Depends, HTTPException
from pydantic import EmailStr, BaseModel, Field

from db import db
from auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "https://image-gallery-live.preview.emergentagent.com")
LOGO_URL = f"{PUBLIC_BASE_URL}/assets/images/oto-cari-vertical.png"

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _fmt_currency(val: float) -> str:
    try:
        return f"₺{int(val):,}".replace(",", ".")
    except Exception:
        return f"₺{val}"


async def _collect_digest_data(org_id: str, since_iso: str, until_iso: str) -> dict:
    """Haftalık özet için istatistikleri topla."""
    # Satılan araçlar (dönem içi)
    sold_cars = await db.cars.find({
        "org_id": org_id,
        "status": "Satıldı",
        "deleted": {"$ne": True},
        "sold_date": {"$gte": since_iso[:10], "$lte": until_iso[:10]},
    }, {"_id": 0}).to_list(5000)

    total_sales_revenue = sum(float(c.get("sale_price", 0) or 0) for c in sold_cars)

    # Activity logs (dönem içi)
    logs = await db.activity_logs.find({
        "org_id": org_id,
        "created_at": {"$gte": since_iso, "$lte": until_iso},
    }, {"_id": 0}).to_list(10000)

    price_changes = [lg for lg in logs if lg.get("action") == "price_change"]
    new_users = [lg for lg in logs if lg.get("action") == "create" and lg.get("entity_type") == "user"]
    new_cars = [lg for lg in logs if lg.get("action") == "create" and lg.get("entity_type") == "car"]
    deleted_cars = [lg for lg in logs if lg.get("action") in ("delete", "permanent_delete") and lg.get("entity_type") == "car"]

    # En iyi satıcı (dönem içi)
    seller_tally: dict = {}
    for car in sold_cars:
        key = car.get("sold_by_user_id") or "unassigned"
        name = car.get("sold_by_name") or "Atanmamış"
        if key not in seller_tally:
            seller_tally[key] = {"name": name, "count": 0, "revenue": 0.0}
        seller_tally[key]["count"] += 1
        seller_tally[key]["revenue"] += float(car.get("sale_price", 0) or 0)
    top_seller = None
    if seller_tally:
        top_seller = max(seller_tally.values(), key=lambda v: v["count"])

    # Aktif stok
    stock_count = await db.cars.count_documents({"org_id": org_id, "status": "Stokta", "deleted": {"$ne": True}})

    return {
        "sold_count": len(sold_cars),
        "total_revenue": total_sales_revenue,
        "price_change_count": len(price_changes),
        "new_user_count": len(new_users),
        "new_car_count": len(new_cars),
        "deleted_car_count": len(deleted_cars),
        "top_seller": top_seller,
        "stock_count": stock_count,
    }


def _build_html(company_name: str, period_label: str, stats: dict) -> str:
    top = stats.get("top_seller")
    top_line = (
        f'<strong>{top["name"]}</strong> — {top["count"]} araç, {_fmt_currency(top["revenue"])} ciro'
        if top else "—"
    )
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Haftalık Özet — {company_name}</title></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f6;padding:24px 0;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0a0a0a;padding:28px 24px;text-align:center;border-bottom:2px solid #C5A267;">
          <img src="{LOGO_URL}" alt="Oto-Cari Otomotiv • Powered by MacTech" width="120" height="120" style="display:block;margin:0 auto 12px;width:120px;height:auto;border:0;outline:none;text-decoration:none;" />
          <div style="color:#C5A267;font-size:11px;letter-spacing:4px;font-weight:bold;text-transform:uppercase;">Oto-Cari Otomotiv</div>
          <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:6px;font-family:Arial,sans-serif;">Haftalık Özet</div>
          <div style="color:#aaaaaa;font-size:12px;margin-top:4px;">{period_label}</div>
        </td></tr>

        <tr><td style="padding:28px 32px 12px;">
          <p style="margin:0 0 12px;font-size:15px;color:#333;">Merhaba <strong>{company_name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:13px;color:#555;line-height:1.6;">
            Geçen haftaki operasyonel özetiniz aşağıdadır. Detaylar için CRM'deki <em>İşlem Geçmişi</em> ve <em>Personel Performansı</em> sayfalarına bakabilirsiniz.
          </p>

          <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
            <tr>
              <td width="50%" style="padding:8px;">
                <div style="border:1px solid #e4e4e4;border-radius:8px;padding:16px;text-align:center;">
                  <div style="font-size:11px;text-transform:uppercase;color:#888;letter-spacing:1px;">Satılan Araç</div>
                  <div style="font-size:28px;font-weight:700;color:#16a34a;margin-top:4px;">{stats['sold_count']}</div>
                </div>
              </td>
              <td width="50%" style="padding:8px;">
                <div style="border:1px solid #e4e4e4;border-radius:8px;padding:16px;text-align:center;">
                  <div style="font-size:11px;text-transform:uppercase;color:#888;letter-spacing:1px;">Toplam Ciro</div>
                  <div style="font-size:22px;font-weight:700;color:#222;margin-top:4px;">{_fmt_currency(stats['total_revenue'])}</div>
                </div>
              </td>
            </tr>
          </table>

          <h3 style="margin:0 0 10px;font-size:14px;color:#0a0a0a;border-bottom:2px solid #C5A267;padding-bottom:6px;">Hareket Özeti</h3>
          <table cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;color:#333;margin-bottom:20px;">
            <tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">🚗 Yeni eklenen araç</td><td align="right" style="border-bottom:1px solid #f0f0f0;"><strong>{stats['new_car_count']}</strong></td></tr>
            <tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">💰 Fiyat değişikliği</td><td align="right" style="border-bottom:1px solid #f0f0f0;"><strong>{stats['price_change_count']}</strong></td></tr>
            <tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">👤 Eklenen personel</td><td align="right" style="border-bottom:1px solid #f0f0f0;"><strong>{stats['new_user_count']}</strong></td></tr>
            <tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">🗑️ Silinen araç</td><td align="right" style="border-bottom:1px solid #f0f0f0;"><strong>{stats['deleted_car_count']}</strong></td></tr>
            <tr><td style="padding:6px 0;">📦 Aktif stok sayısı</td><td align="right"><strong>{stats['stock_count']}</strong></td></tr>
          </table>

          <h3 style="margin:0 0 10px;font-size:14px;color:#0a0a0a;border-bottom:2px solid #C5A267;padding-bottom:6px;">🏆 Haftanın En İyi Satıcısı</h3>
          <p style="margin:0 0 24px;font-size:14px;color:#333;">{top_line}</p>

          <div style="background:#fafaf2;border:1px solid #e8e0c3;border-radius:8px;padding:14px 16px;margin-top:8px;">
            <p style="margin:0;font-size:12px;color:#6b5d1c;line-height:1.6;">
              Bu özet otomatik olarak <strong>Oto-Cari Otomotiv CRM</strong> tarafından oluşturuldu. Aboneliği durdurmak için e-posta ile bize ulaşabilirsiniz.
            </p>
          </div>
        </td></tr>

        <tr><td style="background:#0a0a0a;padding:18px;text-align:center;font-size:11px;color:#888;border-top:1px solid #C5A267;">
          © {datetime.now(timezone.utc).year} <span style="color:#C5A267;font-weight:600;">Oto-Cari Otomotiv</span> — Powered by <span style="color:#C5A267;">MacTech</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def _send_digest_to_org(org_id: str, since: datetime, until: datetime) -> dict:
    """Bir organizasyonun admin kullanıcılarına özet gönder."""
    owner = await db.users.find_one(
        {"$or": [{"id": org_id}, {"org_id": org_id, "role": "admin"}]},
        {"_id": 0}
    )
    if not owner:
        return {"org_id": org_id, "sent": False, "error": "no owner"}

    admin_email = owner.get("email")
    company_name = owner.get("company_name") or "MACTech Galeri"
    if not admin_email:
        return {"org_id": org_id, "sent": False, "error": "no email"}

    stats = await _collect_digest_data(org_id, since.isoformat(), until.isoformat())
    period_label = f'{since.strftime("%d.%m.%Y")} — {until.strftime("%d.%m.%Y")}'
    html = _build_html(company_name, period_label, stats)
    subject = f"Oto-Cari Otomotiv Haftalık Özet — {since.strftime('%d.%m')}–{until.strftime('%d.%m.%Y')}"

    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY missing — skipping send for %s", admin_email)
        return {"org_id": org_id, "sent": False, "error": "no api key"}

    params = {
        "from": SENDER_EMAIL,
        "to": [admin_email],
        "subject": subject,
        "html": html,
    }
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        eid = email.get("id") if isinstance(email, dict) else None
        logger.info("Digest sent to %s — id=%s", admin_email, eid)
        return {"org_id": org_id, "sent": True, "email_id": eid, "recipient": admin_email, "stats": stats}
    except Exception as e:
        logger.error("Digest send failed for %s: %s", admin_email, e)
        return {"org_id": org_id, "sent": False, "error": str(e)}


async def run_weekly_digest_for_all() -> list:
    """Scheduler'ın her saat başı çağırdığı ana fonksiyon.

    Her admin için kayıtlı digest_settings (day/hour) mevcut zamanla eşleşiyorsa mail gönder.
    Default: pazartesi 09:00 (Europe/Istanbul).
    """
    import zoneinfo
    tz_name = os.environ.get("DIGEST_TIMEZONE", "Europe/Istanbul")
    try:
        tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc

    local_now = datetime.now(tz)
    cur_hour = local_now.hour
    # Python weekday: Mon=0..Sun=6
    cur_day_idx = local_now.weekday()
    day_map = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}
    cur_day = day_map[cur_day_idx]

    until = datetime.now(timezone.utc)
    since = until - timedelta(days=7)
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1, "org_id": 1, "email": 1, "digest_enabled": 1, "digest_day": 1, "digest_hour": 1}).to_list(1000)
    seen_orgs = set()
    results = []
    for u in admins:
        oid = u.get("org_id") or u.get("id")
        if not oid or oid in seen_orgs:
            continue
        seen_orgs.add(oid)
        # User digest settings — default: enabled, mon, 9
        enabled = u.get("digest_enabled", True)
        pref_day = (u.get("digest_day") or "mon").lower()[:3]
        try:
            pref_hour = int(u.get("digest_hour", 9))
        except Exception:
            pref_hour = 9
        if not enabled:
            continue
        if pref_day != cur_day or pref_hour != cur_hour:
            continue
        res = await _send_digest_to_org(oid, since, until)
        results.append(res)
    return results


class DigestSettingsBody(BaseModel):
    enabled: bool = True
    day: str = Field("mon", pattern="^(mon|tue|wed|thu|fri|sat|sun)$")
    hour: int = Field(9, ge=0, le=23)


@router.get("/digest/settings")
async def get_digest_settings(current_user: dict = Depends(get_current_user)):
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Yalnızca admin")
    org_id = current_user.get("org_id", current_user["user_id"])
    owner = await db.users.find_one({"id": org_id}, {"_id": 0}) or {}
    return {
        "enabled": owner.get("digest_enabled", True),
        "day": owner.get("digest_day", "mon"),
        "hour": int(owner.get("digest_hour", 9)),
        "recipient": owner.get("email", current_user.get("email", "")),
        "timezone": os.environ.get("DIGEST_TIMEZONE", "Europe/Istanbul"),
    }


@router.put("/digest/settings")
async def update_digest_settings(body: DigestSettingsBody, current_user: dict = Depends(get_current_user)):
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Yalnızca admin")
    org_id = current_user.get("org_id", current_user["user_id"])
    await db.users.update_one(
        {"id": org_id},
        {"$set": {"digest_enabled": body.enabled, "digest_day": body.day, "digest_hour": body.hour}},
    )
    return {"enabled": body.enabled, "day": body.day, "hour": body.hour}


@router.post("/digest/send-now")
async def send_now(current_user: dict = Depends(get_current_user)):
    """Test endpoint: mevcut admin'e hemen haftalık özet gönder."""
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin test gönderimi yapabilir")
    org_id = current_user.get("org_id", current_user["user_id"])
    until = datetime.now(timezone.utc)
    since = until - timedelta(days=7)
    result = await _send_digest_to_org(org_id, since, until)
    return result


@router.get("/digest/preview")
async def preview(current_user: dict = Depends(get_current_user)):
    """Admin: gönderilecek HTML içeriği preview olarak getir (gerçek mail göndermeden)."""
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Yalnızca admin")
    org_id = current_user.get("org_id", current_user["user_id"])
    until = datetime.now(timezone.utc)
    since = until - timedelta(days=7)
    stats = await _collect_digest_data(org_id, since.isoformat(), until.isoformat())
    company_name = current_user.get("company_name") or "MACTech Galeri"
    html = _build_html(company_name, f'{since.strftime("%d.%m.%Y")} — {until.strftime("%d.%m.%Y")}', stats)
    return {"stats": stats, "html": html}


class _SendEmailBody:  # type: ignore
    recipient_email: EmailStr
    subject: str
    html_content: str
