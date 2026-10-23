"""
Migration: Eski satışların sold_by_user_id/sold_by_name alanlarını,
mevcut sold_by (string) alanından çıkarsayarak doldurur.

Server her başladığında çalışır (idempotent — daha önce migrate edilmiş kayıtları atlar).
"""
import logging

logger = logging.getLogger(__name__)


async def backfill_sold_by_user_id(db):
    """sold_by_user_id boş VE sold_by string dolu olan satışları bul → users tablosundan
    name ile eşleşen kullanıcıyı bul → sold_by_user_id + sold_by_name yaz.
    """
    try:
        # Hedef: sold_by string var, user_id yok/boş, status=Satıldı
        cursor = db.cars.find({
            "status": "Satıldı",
            "$and": [
                {"$or": [{"sold_by_user_id": None}, {"sold_by_user_id": ""}, {"sold_by_user_id": {"$exists": False}}]},
                {"sold_by": {"$nin": [None, ""]}},
            ],
        }, {"_id": 0, "id": 1, "org_id": 1, "sold_by": 1, "plate": 1})

        candidates = await cursor.to_list(5000)
        if not candidates:
            return

        logger.info(f"[migrate_sold_by] {len(candidates)} aday satış kayıt — eşleştirme başlıyor")

        # Hızlı arama için org bazında user listesini cache'leyelim
        org_users_cache = {}

        matched = 0
        for car in candidates:
            org_id = car.get("org_id")
            sold_by = (car.get("sold_by") or "").strip()
            if not sold_by or not org_id:
                continue

            if org_id not in org_users_cache:
                users = await db.users.find(
                    {"org_id": org_id},
                    {"_id": 0, "id": 1, "name": 1, "company_name": 1, "email": 1},
                ).to_list(2000)
                org_users_cache[org_id] = users

            users = org_users_cache[org_id]
            sold_by_norm = sold_by.lower().strip()

            # Önce tam eşleşme
            match = None
            for u in users:
                for key in ("name", "company_name", "email"):
                    val = (u.get(key) or "").lower().strip()
                    if val and val == sold_by_norm:
                        match = u
                        break
                if match:
                    break

            # Tam eşleşme yoksa "starts with" / "contains"
            if not match:
                for u in users:
                    for key in ("name", "company_name"):
                        val = (u.get(key) or "").lower().strip()
                        if val and (val.startswith(sold_by_norm) or sold_by_norm.startswith(val) or sold_by_norm in val):
                            match = u
                            break
                    if match:
                        break

            if match:
                await db.cars.update_one(
                    {"id": car["id"], "org_id": org_id},
                    {"$set": {
                        "sold_by_user_id": match["id"],
                        "sold_by_name": match.get("name") or match.get("company_name") or sold_by,
                    }},
                )
                matched += 1

        if matched:
            logger.info(f"[migrate_sold_by] ✓ {matched}/{len(candidates)} satış kaydı eşleştirildi ve güncellendi")
        else:
            logger.info(f"[migrate_sold_by] {len(candidates)} aday var ama hiçbiri user'larla eşleşmedi (sold_by name'leri DB'deki user.name veya company_name ile uyuşmuyor)")
    except Exception as e:
        logger.exception(f"[migrate_sold_by] HATA: {e}")
