"""
Kasa / Sermaye Servisi
- Her org için tek bir `capital` dokümanı tutulur: {org_id, amount, updated_at}
- Atomik `apply_delta`: negatifse mevcut yeterliyse uygular, yoksa HTTPException(400) fırlatır.
- Tüm transaction create/update/delete'lerden ve manuel kasa hareketlerinden çağrılır.
- Hareketler `capital_movements` koleksiyonuna log'lanır (denetim için).
"""
from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import HTTPException
from pymongo import ReturnDocument

from db import db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_capital(org_id: str) -> dict:
    """Mevcut kasa dokümanını getir. Yoksa 0'dan oluştur."""
    doc = await db.capital.find_one({"org_id": org_id}, {"_id": 0})
    if not doc:
        doc = {"org_id": org_id, "amount": 0.0, "updated_at": _now(), "created_at": _now()}
        await db.capital.insert_one(doc.copy())
        doc.pop("_id", None)
    return doc


async def apply_delta(
    org_id: str,
    delta: float,
    *,
    reason: str,
    ref_type: Optional[str] = None,
    ref_id: Optional[str] = None,
    description: Optional[str] = None,
    allow_negative: bool = False,
    user_id: Optional[str] = None,
) -> dict:
    """
    Kasa bakiyesine delta ekle. delta<0 ve !allow_negative ise yeterlilik kontrol edilir.
    Atomik `$inc` kullanır — paralel iki istekte bile race condition oluşmaz.
    Dönüş: güncel kasa dokümanı.
    """
    # Upsert ile 0'dan başlat
    await db.capital.update_one(
        {"org_id": org_id},
        {
            "$setOnInsert": {"org_id": org_id, "amount": 0.0, "created_at": _now()},
            "$set": {"updated_at": _now()},
        },
        upsert=True,
    )

    if delta < 0 and not allow_negative:
        # Yalnızca yeterli bakiye varsa düş
        result = await db.capital.find_one_and_update(
            {"org_id": org_id, "amount": {"$gte": abs(delta)}},
            {"$inc": {"amount": delta}, "$set": {"updated_at": _now()}},
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            current = await db.capital.find_one({"org_id": org_id}, {"_id": 0}) or {"amount": 0}
            avail = float(current.get("amount", 0) or 0)
            need = abs(delta)
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "insufficient_capital",
                    "message": (
                        f"Yetersiz sermaye! Mevcut bakiye: ₺{avail:,.2f} — "
                        f"Gerekli: ₺{need:,.2f}. Lütfen önce Kasa Girişi yapın."
                    ),
                    "available": avail,
                    "required": need,
                },
            )
    else:
        # Pozitif veya allow_negative → koşulsuz
        result = await db.capital.find_one_and_update(
            {"org_id": org_id},
            {"$inc": {"amount": delta}, "$set": {"updated_at": _now()}},
            return_document=ReturnDocument.AFTER,
        )

    # Hareket logla
    movement = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "delta": float(delta),
        "balance_after": float(result.get("amount", 0) if result else 0),
        "reason": reason,
        "ref_type": ref_type,
        "ref_id": ref_id,
        "description": description or "",
        "user_id": user_id,
        "created_at": _now(),
    }
    await db.capital_movements.insert_one(movement.copy())

    if result:
        result.pop("_id", None)
    return result or {"org_id": org_id, "amount": 0.0}
