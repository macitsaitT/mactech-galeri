"""Kasa / Sermaye endpoint'leri."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional

from auth import get_current_user
from db import db
from capital_service import get_capital, apply_delta

router = APIRouter()


class CapitalAdjust(BaseModel):
    amount: float = Field(..., gt=0, description="Pozitif tutar")
    type: Literal["deposit", "withdrawal"]  # deposit=giriş, withdrawal=çıkış
    description: Optional[str] = ""


class CapitalSet(BaseModel):
    amount: float = Field(..., ge=0, description="Yeni bakiye (sıfır veya pozitif)")
    description: Optional[str] = ""


@router.get("/capital")
async def read_capital(current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    return await get_capital(org_id)


@router.post("/capital/adjust")
async def adjust_capital(body: CapitalAdjust, current_user: dict = Depends(get_current_user)):
    """Manuel kasa girişi (deposit) veya çıkışı (withdrawal)."""
    org_id = current_user.get("org_id", current_user["user_id"])
    delta = body.amount if body.type == "deposit" else -body.amount
    reason = "manual_deposit" if body.type == "deposit" else "manual_withdrawal"
    updated = await apply_delta(
        org_id,
        delta,
        reason=reason,
        ref_type="manual",
        description=body.description,
        user_id=current_user.get("user_id"),
    )
    return updated


@router.post("/capital/set")
async def set_capital(body: CapitalSet, current_user: dict = Depends(get_current_user)):
    """Kasa bakiyesini doğrudan ayarla (başlangıç sermayesi için)."""
    org_id = current_user.get("org_id", current_user["user_id"])
    current = await get_capital(org_id)
    current_amt = float(current.get("amount", 0) or 0)
    delta = body.amount - current_amt
    updated = await apply_delta(
        org_id,
        delta,
        reason="manual_set",
        ref_type="manual",
        description=body.description or f"Kasa sıfırlama/ayarlama: ₺{body.amount:,.2f}",
        allow_negative=True,
        user_id=current_user.get("user_id"),
    )
    return updated


@router.get("/capital/movements")
async def list_movements(limit: int = 100, current_user: dict = Depends(get_current_user)):
    """Son kasa hareketleri (denetim)."""
    org_id = current_user.get("org_id", current_user["user_id"])
    movements = (
        await db.capital_movements.find({"org_id": org_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(max(1, min(limit, 500)))
    )
    return {"movements": movements}
