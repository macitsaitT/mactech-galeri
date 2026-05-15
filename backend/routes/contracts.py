"""Contracts router — Dijital sözleşme kayıtları (Kapora / Teslim / Satış).
Sözleşmeler MongoDB'ye kaydedilir, indeksli sorgulama, imzalar base64 olarak document içinde tutulur.
Performans için: liste endpoint'inde imzalar dahil EDİLMEZ (proj.exclude); tek-kayıt endpoint'inde dahil.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Literal, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from auth import get_current_user

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
contracts_coll = db["contracts"]

router = APIRouter()

ContractType = Literal["kapora", "delivery", "sale"]


class ContractCreate(BaseModel):
    type: ContractType
    car_id: str
    customer_id: str
    contract_no: str
    sale_price: float = 0
    deposit_amount: float = 0
    payment_method: Optional[str] = ""
    notes: Optional[str] = ""
    due_date: Optional[str] = ""
    delivery_date: Optional[str] = ""
    # imzalar opsiyonel — fiziksel imza durumunda boş gönderilebilir
    seller_signature: Optional[str] = ""  # data:image/png;base64,...
    buyer_signature: Optional[str] = ""


class ContractListItem(BaseModel):
    id: str
    type: ContractType
    contract_no: str
    car_id: str
    customer_id: str
    customer_name: Optional[str] = ""
    car_plate: Optional[str] = ""
    car_label: Optional[str] = ""
    sale_price: float = 0
    deposit_amount: float = 0
    payment_method: Optional[str] = ""
    has_seller_signature: bool = False
    has_buyer_signature: bool = False
    created_at: str
    created_by: Optional[str] = ""
    created_by_name: Optional[str] = ""


class ContractFull(ContractListItem):
    notes: Optional[str] = ""
    due_date: Optional[str] = ""
    delivery_date: Optional[str] = ""
    seller_signature: Optional[str] = ""
    buyer_signature: Optional[str] = ""


_LIST_PROJ = {
    "_id": 0,
    "id": 1, "type": 1, "contract_no": 1, "car_id": 1, "customer_id": 1,
    "customer_name": 1, "car_plate": 1, "car_label": 1,
    "sale_price": 1, "deposit_amount": 1, "payment_method": 1,
    "has_seller_signature": 1, "has_buyer_signature": 1,
    "created_at": 1, "created_by": 1, "created_by_name": 1,
}


@router.post("/contracts", response_model=ContractFull)
async def create_contract(body: ContractCreate, current_user: dict = Depends(get_current_user)):
    """Sözleşmeyi kaydet (imzalar base64 olarak doc içinde tutulur)."""
    org_id = current_user.get("org_id", current_user["user_id"])

    # Araç ve müşteri verisi snapshot — ilerleyen güncellemelerde kayıt korunsun
    car = await db.cars.find_one({"id": body.car_id, "org_id": org_id}, {"_id": 0, "brand": 1, "model": 1, "year": 1, "plate": 1})
    if not car:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    customer = await db.customers.find_one({"id": body.customer_id, "org_id": org_id}, {"_id": 0, "name": 1})
    if not customer:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")

    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "type": body.type,
        "contract_no": body.contract_no,
        "car_id": body.car_id,
        "customer_id": body.customer_id,
        "customer_name": customer.get("name", ""),
        "car_plate": (car.get("plate") or "").upper(),
        "car_label": f"{car.get('brand', '')} {car.get('model', '')}".strip(),
        "sale_price": float(body.sale_price or 0),
        "deposit_amount": float(body.deposit_amount or 0),
        "payment_method": body.payment_method or "",
        "notes": body.notes or "",
        "due_date": body.due_date or "",
        "delivery_date": body.delivery_date or "",
        "seller_signature": body.seller_signature or "",
        "buyer_signature": body.buyer_signature or "",
        "has_seller_signature": bool(body.seller_signature),
        "has_buyer_signature": bool(body.buyer_signature),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["user_id"],
        "created_by_name": current_user.get("name") or current_user.get("email", ""),
        "deleted": False,
    }
    await contracts_coll.insert_one(doc)
    # MongoDB insert_one mutates the dict adding _id → strip it
    doc.pop("_id", None)
    return ContractFull(**{k: doc.get(k) for k in ContractFull.model_fields if k in doc})


@router.get("/contracts", response_model=List[ContractListItem])
async def list_contracts(
    car_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    type: Optional[ContractType] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("org_id", current_user["user_id"])
    q = {"org_id": org_id, "deleted": {"$ne": True}}
    if car_id:
        q["car_id"] = car_id
    if customer_id:
        q["customer_id"] = customer_id
    if type:
        q["type"] = type
    cursor = contracts_coll.find(q, _LIST_PROJ).sort("created_at", -1).limit(limit)
    return [ContractListItem(**d) async for d in cursor]


@router.get("/contracts/{contract_id}", response_model=ContractFull)
async def get_contract(contract_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    doc = await contracts_coll.find_one(
        {"id": contract_id, "org_id": org_id, "deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Sözleşme bulunamadı")
    return ContractFull(**{k: doc.get(k) for k in ContractFull.model_fields if k in doc})


@router.delete("/contracts/{contract_id}")
async def delete_contract(contract_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    result = await contracts_coll.update_one(
        {"id": contract_id, "org_id": org_id},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sözleşme bulunamadı")
    return {"ok": True}


# ✅ Indexler — startup'ta idempotent yaratılır (server.py'den çağrılır)
async def ensure_indexes():
    await contracts_coll.create_index([("org_id", 1), ("car_id", 1), ("created_at", -1)])
    await contracts_coll.create_index([("org_id", 1), ("customer_id", 1), ("created_at", -1)])
    await contracts_coll.create_index("id", unique=True)
