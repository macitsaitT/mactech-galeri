from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
from db import get_database
from auth import get_current_user

router = APIRouter(prefix="/api/features", tags=["features"])


class FeatureCreate(BaseModel):
    title: str
    description: str
    image_url: Optional[str] = ""
    order: int = 0
    is_active: bool = True


class FeatureUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/")
async def get_features(current_user: dict = Depends(get_current_user)):
    """Organizasyonun özelliklerini getir"""
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    features = await db.features.find(
        {"org_id": org_id, "is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return {"features": features}


@router.post("/")
async def create_feature(
    feature: FeatureCreate,
    current_user: dict = Depends(get_current_user)
):
    """Yeni özellik oluştur"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin özellik ekleyebilir")
    
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    feature_id = f"feat_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    
    feature_doc = {
        "id": feature_id,
        "org_id": org_id,
        "title": feature.title,
        "description": feature.description,
        "image_url": feature.image_url,
        "order": feature.order,
        "is_active": feature.is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.features.insert_one(feature_doc)
    
    return {"id": feature_id, "message": "Özellik oluşturuldu"}


@router.put("/{feature_id}")
async def update_feature(
    feature_id: str,
    feature: FeatureUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Özellik güncelle"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin özellik güncelleyebilir")
    
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    # Özellik var mı kontrol et
    existing = await db.features.find_one({"id": feature_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Özellik bulunamadı")
    
    # Güncelleme verilerini hazırla
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if feature.title is not None:
        update_data["title"] = feature.title
    if feature.description is not None:
        update_data["description"] = feature.description
    if feature.image_url is not None:
        update_data["image_url"] = feature.image_url
    if feature.order is not None:
        update_data["order"] = feature.order
    if feature.is_active is not None:
        update_data["is_active"] = feature.is_active
    
    await db.features.update_one(
        {"id": feature_id, "org_id": org_id},
        {"$set": update_data}
    )
    
    return {"message": "Özellik güncellendi"}


@router.delete("/{feature_id}")
async def delete_feature(
    feature_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Özellik sil"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin özellik silebilir")
    
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    result = await db.features.delete_one({"id": feature_id, "org_id": org_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Özellik bulunamadı")
    
    return {"message": "Özellik silindi"}


@router.post("/init-defaults")
async def init_default_features(current_user: dict = Depends(get_current_user)):
    """Varsayılan özellikleri oluştur (ilk kullanım için)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin çalıştırabilir")
    
    db = await get_database()
    org_id = current_user.get("org_id") or current_user.get("id")
    
    # Zaten özellik var mı kontrol et
    existing_count = await db.features.count_documents({"org_id": org_id})
    if existing_count > 0:
        return {"message": "Özellikler zaten mevcut", "count": existing_count}
    
    # Varsayılan özellikler
    default_features = [
        {
            "id": f"feat_{int(datetime.now(timezone.utc).timestamp() * 1000)}_1",
            "org_id": org_id,
            "title": "Stok Yönetimi",
            "description": "Tüm araçlarınızı tek ekranda yönetin, stok durumunu anlık takip edin",
            "image_url": "",
            "order": 1,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": f"feat_{int(datetime.now(timezone.utc).timestamp() * 1000)}_2",
            "org_id": org_id,
            "title": "Finans Yönetimi",
            "description": "Gelir-gider takibi, kâr hesaplamaları ve finansal raporlar",
            "image_url": "",
            "order": 2,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": f"feat_{int(datetime.now(timezone.utc).timestamp() * 1000)}_3",
            "org_id": org_id,
            "title": "Müşteri Yönetimi",
            "description": "Müşterilerinizi yakından tanıyın, satış geçmişini görün",
            "image_url": "",
            "order": 3,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.features.insert_many(default_features)
    
    return {"message": "Varsayılan özellikler oluşturuldu", "count": len(default_features)}
