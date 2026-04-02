from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, Header
from fastapi.responses import Response
from datetime import datetime, timezone
import uuid
import jwt

from db import db
from auth import get_current_user, JWT_SECRET, JWT_ALGORITHM
from storage import put_object, get_object, APP_NAME
from security import validate_file_magic

router = APIRouter()


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    allowed = {"jpg", "jpeg", "png", "gif", "webp", "heic", "heif"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only image files allowed")

    data = await file.read()
    # Limit artırıldı: 25MB
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")

    if not validate_file_magic(data, ext):
        raise HTTPException(status_code=400, detail="Dosya içeriği uzantıyla eşleşmiyor")

    path = f"{APP_NAME}/uploads/{current_user['user_id']}/{uuid.uuid4()}.{ext}"

    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}
    result = put_object(path, data, mime.get(ext, "application/octet-stream"))

    file_doc = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "user_id": current_user["user_id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.files.insert_one(file_doc)

    return {"id": file_doc["id"], "path": result["path"], "filename": file.filename}


@router.get("/files/{file_path:path}")
async def download_file(file_path: str, auth: str = Query(None), authorization: str = Header(None)):
    auth_header = authorization or (f"Bearer {auth}" if auth else None)
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        token = auth_header.replace("Bearer ", "")
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    record = await db.files.find_one({"storage_path": file_path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    data, content_type = get_object(file_path)
    return Response(content=data, media_type=record.get("content_type", content_type))
