from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid
import secrets

from db import db
from auth import hash_password, verify_password, create_token, get_current_user
from models import UserCreate, UserLogin, ProfileUpdate

router = APIRouter()


@router.post("/auth/register")
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    verification_code = str(secrets.randbelow(900000) + 100000)
    user_id = str(uuid.uuid4())
    org_id = user_id
    user_doc = {
        "id": user_id, "email": user.email,
        "password_hash": hash_password(user.password),
        "company_name": user.company_name, "phone": user.phone,
        "address": "", "logo_url": "", "theme": "dark",
        "role": "admin", "org_id": org_id,
        "email_verified": False, "verification_code": verification_code,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, user.email, org_id, "admin")
    return {
        "token": token,
        "user": {"id": user_id, "email": user.email, "company_name": user.company_name,
                 "phone": user.phone, "logo_url": "", "address": "", "role": "admin", "org_id": org_id},
        "verification_code": verification_code, "requires_verification": True
    }


@router.post("/auth/verify-email")
async def verify_email(data: dict):
    code = data.get("code", "")
    email = data.get("email", "")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("email_verified"):
        return {"verified": True, "message": "Email already verified"}
    if user.get("verification_code") != code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    await db.users.update_one({"email": email}, {"$set": {"email_verified": True}, "$unset": {"verification_code": ""}})
    return {"verified": True, "message": "Email verified successfully"}


@router.post("/auth/resend-verification")
async def resend_verification(data: dict):
    email = data.get("email", "")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("email_verified"):
        return {"message": "Email already verified"}
    new_code = str(secrets.randbelow(900000) + 100000)
    await db.users.update_one({"email": email}, {"$set": {"verification_code": new_code}})
    return {"verification_code": new_code, "message": "New code generated"}


@router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    org_id = user.get("org_id", user["id"])
    role = user.get("role", "admin")
    token = create_token(user["id"], user["email"], org_id, role)
    return {
        "token": token,
        "user": {
            "id": user["id"], "email": user["email"],
            "company_name": user.get("company_name", ""), "phone": user.get("phone", ""),
            "address": user.get("address", ""), "logo_url": user.get("logo_url", ""),
            "theme": user.get("theme", "dark"), "role": role, "org_id": org_id
        }
    }


@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/org/owner")
async def get_org_owner(current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("org_id", current_user["user_id"])
    owner = await db.users.find_one({"id": org_id}, {"_id": 0, "password_hash": 0})
    if not owner:
        raise HTTPException(status_code=404, detail="Organization owner not found")
    return {"company_name": owner.get("company_name", ""), "phone": owner.get("phone", ""),
            "logo_url": owner.get("logo_url", ""), "address": owner.get("address", "")}


@router.put("/auth/profile")
async def update_profile(profile: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in profile.model_dump().items() if v is not None}
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": current_user["user_id"]}, {"$set": update_data})
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    return user


@router.delete("/auth/delete-account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    await db.cars.delete_many({"user_id": user_id})
    await db.customers.delete_many({"user_id": user_id})
    await db.transactions.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})
    return {"success": True, "message": "Account and all data deleted"}
