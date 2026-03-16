from fastapi import APIRouter, HTTPException, Depends

from db import db
from auth import get_current_user
from encryption import encrypt_value

router = APIRouter()


@router.post("/encrypt-customer/{customer_id}")
async def encrypt_customer_data(customer_id: str, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id, "org_id": current_user.get("org_id", current_user["user_id"])})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    encrypted_fields = {}
    if customer.get("phone"):
        encrypted_fields["phone_encrypted"] = encrypt_value(customer["phone"])
    if customer.get("notes"):
        encrypted_fields["notes_encrypted"] = encrypt_value(customer["notes"])

    encrypted_fields["is_encrypted"] = True
    await db.customers.update_one({"id": customer_id}, {"$set": encrypted_fields})

    return {"success": True, "message": "Customer data encrypted"}
