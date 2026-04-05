from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
from typing import List
import uuid
import secrets
import requests as http_requests
from slowapi import Limiter
from slowapi.util import get_remote_address

from db import db
from auth import hash_password, verify_password, create_token, get_current_user
from models import UserCreate, UserLogin, ProfileUpdate
from security import validate_email, validate_password, sanitize_string

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

# QR Login Sessions - bellekte tutulur (production'da Redis kullanılabilir)
qr_sessions = {}


@router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, user: UserCreate):
    clean_email = validate_email(user.email)
    validate_password(user.password)

    existing = await db.users.find_one({"email": clean_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    verification_code = str(secrets.randbelow(900000) + 100000)
    user_id = str(uuid.uuid4())
    org_id = user_id
    user_doc = {
        "id": user_id, "email": clean_email,
        "password_hash": hash_password(user.password),
        "company_name": user.company_name, "phone": user.phone,
        "address": "", "logo_url": "", "theme": "dark",
        "role": "admin", "org_id": org_id,
        "email_verified": False, "verification_code": verification_code,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, clean_email, org_id, "admin")
    return {
        "token": token,
        "user": {"id": user_id, "email": clean_email, "company_name": user.company_name,
                 "phone": user.phone, "logo_url": "", "address": "", "role": "admin", "org_id": org_id},
        "verification_code": verification_code, "requires_verification": True
    }


@router.post("/auth/verify-email")
async def verify_email(data: dict):
    code = sanitize_string(data.get("code", ""))
    email = validate_email(data.get("email", ""))
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
@limiter.limit("10/minute")
async def login(request: Request, credentials: UserLogin):
    clean_email = validate_email(credentials.email)
    user = await db.users.find_one({"email": clean_email})
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
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0, "verification_code": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/auth/google")
async def google_auth(body: dict):
    session_id = body.get("session_id", "")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id gerekli")

    # Exchange session_id with Emergent Auth
    try:
        resp = http_requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Google doğrulama başarısız")
        google_data = resp.json()
    except http_requests.RequestException:
        raise HTTPException(status_code=502, detail="Google auth servisi ulaşılamıyor")

    google_email = google_data.get("email", "").strip().lower()
    google_name = google_data.get("name", "")
    google_picture = google_data.get("picture", "")

    if not google_email:
        raise HTTPException(status_code=400, detail="Google hesabından email alınamadı")

    # Check if user exists
    existing = await db.users.find_one({"email": google_email})

    if existing:
        # Returning user - update picture if changed
        if google_picture and existing.get("google_picture") != google_picture:
            await db.users.update_one({"email": google_email}, {"$set": {"google_picture": google_picture}})
        org_id = existing.get("org_id", existing["id"])
        role = existing.get("role", "admin")
        token = create_token(existing["id"], google_email, org_id, role)
        return {
            "token": token,
            "user": {
                "id": existing["id"], "email": google_email,
                "company_name": existing.get("company_name", google_name),
                "phone": existing.get("phone", ""), "address": existing.get("address", ""),
                "logo_url": existing.get("logo_url", ""), "google_picture": google_picture,
                "theme": existing.get("theme", "dark"), "role": role, "org_id": org_id
            },
            "is_new": False
        }
    else:
        # New user - create admin with own org
        user_id = str(uuid.uuid4())
        org_id = user_id
        user_doc = {
            "id": user_id, "email": google_email,
            "password_hash": "", "company_name": google_name,
            "phone": "", "address": "", "logo_url": "", "google_picture": google_picture,
            "theme": "dark", "role": "admin", "org_id": org_id,
            "auth_provider": "google", "email_verified": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)

        # Create default permissions for new org
        from routes.users import DEFAULT_PERMISSIONS
        await db.permissions.insert_one({
            "org_id": org_id,
            "permissions": DEFAULT_PERMISSIONS,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        token = create_token(user_id, google_email, org_id, "admin")
        return {
            "token": token,
            "user": {
                "id": user_id, "email": google_email,
                "company_name": google_name, "phone": "", "address": "",
                "logo_url": "", "google_picture": google_picture,
                "theme": "dark", "role": "admin", "org_id": org_id
            },
            "is_new": True
        }


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
        validate_password(update_data["password"])
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": current_user["user_id"]}, {"$set": update_data})
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0, "verification_code": 0})
    return user


# ==================== QR KOD İLE GİRİŞ ====================

@router.post("/auth/qr/generate")
async def generate_qr_session():
    """
    Bilgisayar için QR kod session'ı oluşturur
    Bu session_id QR kod içinde gösterilir
    """
    session_id = str(uuid.uuid4())
    qr_sessions[session_id] = {
        "status": "pending",  # pending, scanned, approved, expired
        "created_at": datetime.now(timezone.utc),
        "user_id": None,
        "token": None
    }
    
    # 5 dakika sonra expire olacak
    return {
        "session_id": session_id,
        "expires_in": 300  # 5 dakika
    }


@router.get("/auth/qr/status/{session_id}")
async def check_qr_status(session_id: str):
    """
    Bilgisayar bu endpoint'i polling ile kontrol eder
    Telefon onayladığında token döner
    """
    session = qr_sessions.get(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session bulunamadı veya süresi doldu")
    
    # 5 dakikadan eski session'ları temizle
    created_at = session["created_at"]
    if datetime.now(timezone.utc) - created_at > timedelta(minutes=5):
        del qr_sessions[session_id]
        raise HTTPException(status_code=410, detail="Session süresi doldu")
    
    if session["status"] == "approved" and session["token"]:
        # Giriş onaylandı - token'ı döndür ve session'ı temizle
        token = session["token"]
        user_id = session["user_id"]
        del qr_sessions[session_id]
        
        # Kullanıcı bilgilerini al
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        
        return {
            "status": "approved",
            "token": token,
            "user": user
        }
    
    return {"status": session["status"]}


@router.post("/auth/qr/scan")
async def scan_qr_code(data: dict, current_user: dict = Depends(get_current_user)):
    """
    Telefon QR kodu okuttuğunda bu endpoint çağrılır
    Giriş yapmış kullanıcı bilgisayara giriş izni verir
    """
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id gerekli")
    
    session = qr_sessions.get(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session bulunamadı veya süresi doldu")
    
    # Session'ı scanned olarak işaretle
    qr_sessions[session_id]["status"] = "scanned"
    
    return {
        "message": "QR kod okundu. Lütfen girişi onaylayın.",
        "session_id": session_id
    }


@router.post("/auth/qr/approve")
async def approve_qr_login(data: dict, current_user: dict = Depends(get_current_user)):
    """
    Telefon girişi onayladığında bu endpoint çağrılır
    Bilgisayar için token oluşturulur
    """
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id gerekli")
    
    session = qr_sessions.get(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session bulunamadı veya süresi doldu")
    
    # Kullanıcı bilgilerini al
    user = await db.users.find_one({"id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Yeni token oluştur
    org_id = user.get("org_id", user["id"])
    role = user.get("role", "admin")
    token = create_token(user["id"], user["email"], org_id, role)
    
    # Session'ı onayla
    qr_sessions[session_id]["status"] = "approved"
    qr_sessions[session_id]["user_id"] = user["id"]
    qr_sessions[session_id]["token"] = token
    
    return {
        "message": "Giriş onaylandı! Bilgisayarınızda oturum açıldı.",
        "success": True
    }


@router.post("/auth/qr/reject")
async def reject_qr_login(data: dict, current_user: dict = Depends(get_current_user)):
    """
    Telefon girişi reddederse
    """
    session_id = data.get("session_id")
    
    if session_id and session_id in qr_sessions:
        del qr_sessions[session_id]
    
    return {"message": "Giriş reddedildi.", "success": True}


# ==================== SSO (Single Sign-On) ====================

@router.post("/auth/sso-login")
async def sso_login(data: dict):
    """
    MACTech ana platformundan SSO ile giriş
    Ana site'den gelen sso_token ile kullanıcıyı doğrular
    """
    sso_token = data.get("sso_token")
    
    if not sso_token:
        raise HTTPException(status_code=400, detail="sso_token gerekli")
    
    try:
        # MACTech ana platformundan token'ı doğrula
        verify_url = "https://mactech.tr/api/platform/sso/verify"
        
        response = http_requests.post(
            verify_url,
            json={"sso_token": sso_token},
            timeout=10
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="SSO token geçersiz")
        
        sso_data = response.json()
        
        if not sso_data.get("valid"):
            raise HTTPException(status_code=401, detail="SSO token doğrulanamadı")
        
        # Kullanıcı bilgilerini al
        mactech_id = sso_data.get("user", {}).get("mactech_id")
        email = sso_data.get("user", {}).get("email")
        full_name = sso_data.get("user", {}).get("full_name", "")
        phone = sso_data.get("user", {}).get("phone", "")
        
        if not mactech_id or not email:
            raise HTTPException(status_code=400, detail="SSO yanıtında kullanıcı bilgileri eksik")
        
        # Kullanıcıyı mactech_id ile bul
        user = await db.users.find_one({"mactech_id": mactech_id})
        
        if not user:
            # Email ile de dene
            user = await db.users.find_one({"email": email})
            
            if user:
                # Mevcut kullanıcıya mactech_id ekle
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"mactech_id": mactech_id}}
                )
            else:
                # Yeni kullanıcı oluştur
                user_id = str(uuid.uuid4())
                now = datetime.now(timezone.utc).isoformat()
                
                user = {
                    "id": user_id,
                    "mactech_id": mactech_id,
                    "email": email,
                    "password_hash": None,  # SSO kullanıcısı, şifre yok
                    "company_name": full_name or "MACTech Kullanıcısı",
                    "phone": phone,
                    "address": "",
                    "logo_url": "",
                    "theme": "dark",
                    "role": "admin",
                    "org_id": user_id,
                    "email_verified": True,  # SSO ile gelen zaten doğrulanmış
                    "auth_provider": "sso",
                    "created_at": now,
                    "updated_at": now
                }
                
                await db.users.insert_one(user)
        
        # JWT token oluştur
        org_id = user.get("org_id", user["id"])
        role = user.get("role", "admin")
        token = create_token(user["id"], user["email"], org_id, role)
        
        # Son giriş zamanını güncelle
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Hassas bilgileri çıkar
        user_response = {k: v for k, v in user.items() if k not in ["_id", "password_hash", "verification_code"]}
        
        return {
            "token": token,
            "user": user_response,
            "message": "SSO ile giriş başarılı"
        }
        
    except http_requests.RequestException as e:
        raise HTTPException(status_code=503, detail=f"SSO servisi bağlantı hatası: {str(e)}")


@router.delete("/auth/delete-account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    await db.cars.delete_many({"user_id": user_id})
    await db.customers.delete_many({"user_id": user_id})
    await db.transactions.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})
    return {"success": True, "message": "Account and all data deleted"}
