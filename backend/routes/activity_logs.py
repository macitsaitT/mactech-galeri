from fastapi import APIRouter, Depends, Query
from typing import Optional

from db import db
from auth import get_current_user
from helpers import build_data_filter

router = APIRouter()


@router.get("/activity-logs")
async def get_activity_logs(
    entity_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),  # ISO date (YYYY-MM-DD)
    end_date: Optional[str] = Query(None),
    limit: int = Query(300, ge=1, le=2000),
    current_user: dict = Depends(get_current_user),
):
    """İşlem geçmişi — filtreli. Admin / muhasebe herkesin loglarını,
    diğerleri yalnızca kendi oluşturduklarını görür.
    """
    role = current_user.get("role", "admin")
    query = build_data_filter(current_user)

    if role not in ("admin", "muhasebe"):
        query["user_id"] = current_user["user_id"]

    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id

    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = f"{start_date}T00:00:00+00:00"
        if end_date:
            date_q["$lte"] = f"{end_date}T23:59:59+00:00"
        if date_q:
            query["created_at"] = date_q

    logs = await db.activity_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"logs": logs, "count": len(logs)}


@router.delete("/activity-logs/clear")
async def clear_activity_logs(current_user: dict = Depends(get_current_user)):
    """Admin: tüm activity log'ları temizle (organizasyon bazlı)."""
    if current_user.get("role", "admin") != "admin":
        return {"success": False, "detail": "Yetkisiz"}
    org_id = current_user.get("org_id", current_user["user_id"])
    res = await db.activity_logs.delete_many({"org_id": org_id})
    return {"success": True, "deleted": res.deleted_count}
