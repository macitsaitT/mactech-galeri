from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
import jwt
import bcrypt
import os

JWT_SECRET = os.environ.get('JWT_SECRET', 'aslanbasoto-secret-key-2024')
JWT_ALGORITHM = "HS256"

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str, email: str, org_id: str = "", role: str = "admin") -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "org_id": org_id,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 30
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {
            "user_id": user_id,
            "email": payload.get("email"),
            "org_id": payload.get("org_id", user_id),
            "role": payload.get("role", "admin")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
