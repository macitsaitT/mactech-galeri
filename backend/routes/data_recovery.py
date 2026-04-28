"""
Acil veri kurtarma endpoint'leri.
Kullanıcı verilerini "kayıp" olarak gördüğünde:
1. Soft-delete (deleted=true) edilmiş araçları/işlemleri görüntüle
2. Tek tıkla restore et
3. Farklı org_id altındaki verileri tespit et (SSO mactech_id değişikliği vb.)
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from auth import get_current_user
from db import db

router = APIRouter(prefix="/recovery", tags=["recovery"])


@router.get("/status")
async def recovery_status(current_user: dict = Depends(get_current_user)):
    """Bu hesabın görünür ve gizli verilerinin özetini ver."""
    org_id = current_user.get("org_id", current_user["user_id"])
    email = current_user.get("email", "")

    # Bu hesaba (org_id) ait
    visible_cars = await db.cars.count_documents({"org_id": org_id, "deleted": {"$ne": True}})
    deleted_cars = await db.cars.count_documents({"org_id": org_id, "deleted": True})
    visible_tx = await db.transactions.count_documents({"org_id": org_id, "deleted": {"$ne": True}})
    deleted_tx = await db.transactions.count_documents({"org_id": org_id, "deleted": True})
    visible_customers = await db.customers.count_documents({"org_id": org_id, "deleted": {"$ne": True}})

    # Aynı email'e ait FARKLI hesaplar (eski/güncel)
    same_email_users = await db.users.find(
        {"email": email}, {"_id": 0, "id": 1, "org_id": 1, "created_at": 1, "mactech_id": 1, "auth_provider": 1}
    ).to_list(50)

    # Bu email'e ait diğer hesapların altındaki araç sayıları
    foreign_data = []
    for u in same_email_users:
        other_org = u.get("org_id")
        if other_org and other_org != org_id:
            cars_n = await db.cars.count_documents({"org_id": other_org})
            tx_n = await db.transactions.count_documents({"org_id": other_org})
            cust_n = await db.customers.count_documents({"org_id": other_org})
            if cars_n + tx_n + cust_n > 0:
                foreign_data.append({
                    "user_id": u.get("id"),
                    "org_id": other_org,
                    "created_at": u.get("created_at"),
                    "mactech_id": u.get("mactech_id"),
                    "cars": cars_n,
                    "transactions": tx_n,
                    "customers": cust_n,
                })

    return {
        "current_user": {
            "id": current_user.get("user_id"),
            "email": email,
            "org_id": org_id,
        },
        "visible": {
            "cars": visible_cars,
            "transactions": visible_tx,
            "customers": visible_customers,
        },
        "soft_deleted": {
            "cars": deleted_cars,
            "transactions": deleted_tx,
        },
        "same_email_orphan_data": foreign_data,
        "duplicate_users_count": len(same_email_users),
    }


@router.post("/restore-all-deleted")
async def restore_all_deleted(current_user: dict = Depends(get_current_user)):
    """Bu hesaba (org_id) ait TÜM soft-deleted veriyi geri yükler."""
    org_id = current_user.get("org_id", current_user["user_id"])
    cars_res = await db.cars.update_many(
        {"org_id": org_id, "deleted": True},
        {"$set": {"deleted": False, "deleted_at": None}},
    )
    tx_res = await db.transactions.update_many(
        {"org_id": org_id, "deleted": True},
        {"$set": {"deleted": False, "deleted_at": None}},
    )
    cust_res = await db.customers.update_many(
        {"org_id": org_id, "deleted": True},
        {"$set": {"deleted": False, "deleted_at": None}},
    )
    return {
        "success": True,
        "cars_restored": cars_res.modified_count,
        "transactions_restored": tx_res.modified_count,
        "customers_restored": cust_res.modified_count,
    }


@router.post("/migrate-orphan-data")
async def migrate_orphan_data(source_org_id: str, current_user: dict = Depends(get_current_user)):
    """
    Aynı e-posta ile ait olan eski bir hesabın (source_org_id) tüm verilerini
    bu hesaba (current org_id) taşır. Güvenlik: sadece aynı email'in başka hesaplarından alabilir.
    """
    target_org_id = current_user.get("org_id", current_user["user_id"])
    email = current_user.get("email", "")

    # Güvenlik kontrolü — source_org_id aynı email'e ait bir kullanıcı mı?
    source_user = await db.users.find_one({"org_id": source_org_id, "email": email})
    if not source_user:
        raise HTTPException(status_code=403, detail="Bu org'a erişim yetkiniz yok")

    cars_res = await db.cars.update_many(
        {"org_id": source_org_id},
        {"$set": {"org_id": target_org_id}},
    )
    tx_res = await db.transactions.update_many(
        {"org_id": source_org_id},
        {"$set": {"org_id": target_org_id}},
    )
    cust_res = await db.customers.update_many(
        {"org_id": source_org_id},
        {"$set": {"org_id": target_org_id}},
    )
    cap_res = await db.capital_movements.update_many(
        {"org_id": source_org_id},
        {"$set": {"org_id": target_org_id}},
    )
    return {
        "success": True,
        "cars_migrated": cars_res.modified_count,
        "transactions_migrated": tx_res.modified_count,
        "customers_migrated": cust_res.modified_count,
        "capital_movements_migrated": cap_res.modified_count,
        "from": source_org_id,
        "to": target_org_id,
    }
