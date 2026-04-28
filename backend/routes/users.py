from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from db import db
from auth import get_current_user, hash_password
from models import UserCreate
from security import validate_email, validate_password

PERMISSION_KEYS = [
    "vehicles_view", "vehicles_add", "vehicles_edit", "vehicles_delete", "vehicles_sell", "vehicles_price_view",
    "customers_view", "customers_add", "customers_edit", "customers_delete",
    "transactions_view", "transactions_add", "transactions_edit", "transactions_delete",
    "reports_view",
    "appointments_view", "appointments_add", "appointments_edit", "appointments_delete",
    "dashboard_view", "trash_view",
]

DEFAULT_PERMISSIONS = {
    "muhasebe": {
        "vehicles_view": True, "vehicles_add": False, "vehicles_edit": False, "vehicles_delete": False,
        "vehicles_sell": False, "vehicles_price_view": True,
        "customers_view": True, "customers_add": False, "customers_edit": False, "customers_delete": False,
        "transactions_view": True, "transactions_add": True, "transactions_edit": True, "transactions_delete": False,
        "reports_view": True,
        "appointments_view": True, "appointments_add": False, "appointments_edit": False, "appointments_delete": False,
        "dashboard_view": True, "trash_view": False,
    },
    "satis": {
        "vehicles_view": True, "vehicles_add": True, "vehicles_edit": True, "vehicles_delete": False,
        "vehicles_sell": True, "vehicles_price_view": False,
        "customers_view": True, "customers_add": True, "customers_edit": True, "customers_delete": False,
        "transactions_view": False, "transactions_add": True, "transactions_edit": False, "transactions_delete": False,
        "reports_view": False,
        "appointments_view": True, "appointments_add": True, "appointments_edit": True, "appointments_delete": True,
        "dashboard_view": True, "trash_view": False,
    }
}

router = APIRouter()


@router.get("/permissions")
async def get_permissions(current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    doc = await db.permissions.find_one({"org_id": org_id}, {"_id": 0})
    if not doc:
        return {"org_id": org_id, "role_defaults": DEFAULT_PERMISSIONS, "user_overrides": {}}
    return {
        "org_id": org_id,
        "role_defaults": doc.get("role_defaults", doc.get("permissions", DEFAULT_PERMISSIONS)),
        "user_overrides": doc.get("user_overrides", {})
    }


@router.put("/permissions")
async def update_permissions(body: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update permissions")
    org_id = current_user.get("org_id", current_user["user_id"])
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if "role_defaults" in body:
        update_data["role_defaults"] = body["role_defaults"]
    if "user_overrides" in body:
        update_data["user_overrides"] = body["user_overrides"]
    if "permissions" in body and "role_defaults" not in body:
        update_data["role_defaults"] = body["permissions"]
    await db.permissions.update_one({"org_id": org_id}, {"$set": update_data}, upsert=True)
    return {"success": True}


@router.get("/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    role = current_user.get("role", "admin")
    if role != "admin":
        me = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0, "verification_code": 0})
        return [me] if me else []
    return await db.users.find({"org_id": org_id}, {"_id": 0, "password_hash": 0, "verification_code": 0}).to_list(100)


@router.post("/users")
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin kullanici ekleyebilir")
    clean_email = validate_email(user.email)
    validate_password(user.password)
    org_id = current_user.get("org_id", current_user["user_id"])

    # ✅ Email kontrolü org_id'ye scope'lu — multi-tenant pattern.
    # Aynı email başka bir organizasyonda olabilir; bu org içinde unique olmalı.
    existing = await db.users.find_one({"email": clean_email, "org_id": org_id})
    if existing:
        raise HTTPException(status_code=400, detail="Bu email bu organizasyonda zaten kayitli")

    user_id = str(uuid.uuid4())
    
    # Admin kullanıcısının abonelik bilgilerini al
    admin = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    
    user_doc = {
        "id": user_id, "email": clean_email, "password_hash": hash_password(user.password),
        "company_name": user.company_name, "phone": user.phone,
        "address": "", "logo_url": "", "theme": "dark",
        "role": user.role, "org_id": org_id, "email_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        # Admin'in abonelik bilgilerini kopyala (aynı organizasyonda)
        "subscription": admin.get("subscription", "free"),
        "payment_status": admin.get("payment_status", "none"),
        "trial_active": admin.get("trial_active", False),
        "trial_start": admin.get("trial_start"),
        "trial_end": admin.get("trial_end"),
        "subscription_end_date": admin.get("subscription_end_date"),
        "access_blocked": False,
        "auth_provider": "local"
    }
    await db.users.insert_one(user_doc)
    return {"id": user_id, "email": clean_email, "company_name": user.company_name, "phone": user.phone, "role": user.role, "org_id": org_id}


@router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin kullanici duzenleyebilir")
    org_id = current_user.get("org_id", current_user["user_id"])
    target = await db.users.find_one({"id": user_id, "org_id": org_id})
    if not target:
        raise HTTPException(status_code=404, detail="Kullanici bulunamadi")
    allowed = {"role", "company_name", "phone", "email"}
    safe_updates = {k: v for k, v in updates.items() if k in allowed and v is not None}
    if "email" in safe_updates:
        safe_updates["email"] = validate_email(safe_updates["email"])
    if "password" in updates and updates["password"]:
        validate_password(updates["password"])
        safe_updates["password_hash"] = hash_password(updates["password"])
    if safe_updates:
        safe_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": user_id}, {"$set": safe_updates})
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin kullanici silebilir")
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz")
    org_id = current_user.get("org_id", current_user["user_id"])
    # ✅ Önce org_id ile dene (normal akış); bulamazsa sadece id ile dene (legacy/migrated kayıtlar)
    target = await db.users.find_one({"id": user_id, "org_id": org_id})
    if not target:
        # Legacy: belki org_id alanı eski şemada yok
        target = await db.users.find_one({"id": user_id})
        if not target:
            # Zaten yok — idempotent başarılı dön ki frontend listede görünmesin
            return {"success": True, "already_deleted": True}
    res = await db.users.delete_one({"id": user_id})
    return {"success": True, "deleted_count": res.deleted_count}


@router.get("/employees")
async def get_employees(current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    users = await db.users.find({"org_id": org_id}, {"_id": 0, "password_hash": 0, "verification_code": 0}).to_list(100)
    return [{"id": u["id"], "email": u["email"], "name": u.get("company_name", u["email"]), "phone": u.get("phone", ""), "role": u.get("role", "satis")} for u in users]


@router.get("/org-users")
async def get_org_users(current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    users = await db.users.find({"org_id": org_id}, {"_id": 0, "password_hash": 0, "verification_code": 0}).to_list(100)
    return [{"id": u["id"], "name": u.get("company_name", u["email"]), "role": u.get("role", "satis")} for u in users]
