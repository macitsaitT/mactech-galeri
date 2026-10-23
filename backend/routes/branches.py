"""
Şube (Branch) Yönetimi
- Bir kullanıcı/org birden fazla galeri (şube) açabilir.
- Cars, Transactions, Customers koleksiyonlarına `branch_id` field'ı opsiyonel eklenir.
- Filtre uygulamak için frontend `?branch_id=` query'si geçirebilir.
"""
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from db import db
from helpers import build_data_filter

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BranchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    city: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    is_main: bool = False


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    is_main: Optional[bool] = None


@router.get("/branches")
async def list_branches(current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    items = await db.branches.find(
        {"org_id": org_id, "deleted": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return items


@router.post("/branches")
async def create_branch(body: BranchCreate, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "user_id": current_user["user_id"],
        "name": body.name,
        "city": body.city or "",
        "address": body.address or "",
        "phone": body.phone or "",
        "is_main": bool(body.is_main),
        "deleted": False,
        "created_at": _now(),
        "updated_at": _now(),
    }
    # Eğer is_main=True ise diğerlerini False yap
    if doc["is_main"]:
        await db.branches.update_many(
            {"org_id": org_id, "is_main": True}, {"$set": {"is_main": False}}
        )
    await db.branches.insert_one(doc.copy())
    return await db.branches.find_one({"id": doc["id"]}, {"_id": 0})


@router.put("/branches/{branch_id}")
async def update_branch(branch_id: str, body: BranchUpdate, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.branches.find_one({"id": branch_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Şube bulunamadı")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = _now()
    if updates.get("is_main") is True:
        await db.branches.update_many(
            {"org_id": org_id, "is_main": True, "id": {"$ne": branch_id}},
            {"$set": {"is_main": False}},
        )
    await db.branches.update_one({"id": branch_id}, {"$set": updates})
    return await db.branches.find_one({"id": branch_id}, {"_id": 0})


@router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.branches.find_one({"id": branch_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Şube bulunamadı")

    # Bu şubeye atanmış aktif araç var mı?
    car_count = await db.cars.count_documents({
        "org_id": org_id,
        "branch_id": branch_id,
        "deleted": {"$ne": True},
    })
    if car_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Bu şubeye atanmış {car_count} aktif araç var. Önce başka şubeye taşıyın veya silin.",
        )
    await db.branches.update_one(
        {"id": branch_id}, {"$set": {"deleted": True, "deleted_at": _now()}}
    )
    return {"success": True}
