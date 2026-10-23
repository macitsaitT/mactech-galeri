from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from db import db
from auth import get_current_user
from models import AppointmentBase
from helpers import build_data_filter

router = APIRouter()


@router.get("/appointments")
async def get_appointments(current_user: dict = Depends(get_current_user)):
    query = build_data_filter(current_user)
    return await db.appointments.find(query, {"_id": 0}).sort("date", 1).to_list(1000)


@router.post("/appointments")
async def create_appointment(appointment: AppointmentBase, current_user: dict = Depends(get_current_user)):
    doc = appointment.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = current_user["user_id"]
    doc["org_id"] = current_user.get("org_id", current_user["user_id"])
    doc["created_by"] = current_user["user_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["deleted"] = False
    await db.appointments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    data.pop("_id", None)
    data.pop("id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.appointments.update_one({"id": appointment_id, "org_id": org_id}, {"$set": data})
    return await db.appointments.find_one({"id": appointment_id}, {"_id": 0})


@router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, permanent: bool = False, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.appointments.find_one({"id": appointment_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if permanent:
        await db.appointments.delete_one({"id": appointment_id})
    else:
        await db.appointments.update_one({"id": appointment_id}, {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True}


@router.post("/appointments/{appointment_id}/restore")
async def restore_appointment(appointment_id: str, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    existing = await db.appointments.find_one({"id": appointment_id, "org_id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await db.appointments.update_one({"id": appointment_id}, {"$set": {"deleted": False, "deleted_at": None}})
    return await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
