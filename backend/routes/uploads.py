from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, Header, Form
from fastapi.responses import Response
from datetime import datetime, timezone
import uuid
import jwt
import base64
import io

from db import db
from auth import get_current_user, JWT_SECRET, JWT_ALGORITHM
from storage import put_object, get_object, put_object_db, get_object_db
from security import validate_file_magic

router = APIRouter()

# App name for file paths
APP_NAME = "mactechgaleri"

# Chunked upload için geçici depolama
chunk_storage = {}


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    allowed = {"jpg", "jpeg", "png", "gif", "webp", "heic", "heif"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only image files allowed")

    data = await file.read()
    # Limit: 25MB
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")

    if not validate_file_magic(data, ext):
        raise HTTPException(status_code=400, detail="Dosya içeriği uzantıyla eşleşmiyor")

    path = f"{APP_NAME}/uploads/{current_user['user_id']}/{uuid.uuid4()}.{ext}"

    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp", "heic": "image/heic", "heif": "image/heif"}
    # ✅ Kalıcı saklama için DB'ye kaydet (Railway ephemeral disk sorununu önler)
    result = await put_object_db(path, data, mime.get(ext, "application/octet-stream"))

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
    await db.uploaded_files.insert_one(file_doc)

    return {"id": file_doc["id"], "path": result["path"], "filename": file.filename}


@router.post("/upload-base64")
async def upload_file_base64(
    current_user: dict = Depends(get_current_user),
    filename: str = Form(...),
    data: str = Form(...)
):
    """
    Base64 encoded dosya yükleme - Büyük dosyalar için alternatif
    Network timeout sorunlarını çözmek için
    """
    ext = filename.split(".")[-1].lower() if "." in filename else "bin"
    allowed = {"jpg", "jpeg", "png", "gif", "webp", "heic", "heif"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only image files allowed")

    try:
        # Base64 decode
        file_data = base64.b64decode(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")

    # Limit: 25MB
    if len(file_data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")

    if not validate_file_magic(file_data, ext):
        raise HTTPException(status_code=400, detail="Dosya içeriği uzantıyla eşleşmiyor")

    path = f"{APP_NAME}/uploads/{current_user['user_id']}/{uuid.uuid4()}.{ext}"

    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp", "heic": "image/heic", "heif": "image/heif"}
    # ✅ Kalıcı saklama (DB)
    result = await put_object_db(path, file_data, mime.get(ext, "application/octet-stream"))

    file_doc = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": filename,
        "content_type": mime.get(ext, "application/octet-stream"),
        "size": result.get("size", len(file_data)),
        "user_id": current_user["user_id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.uploaded_files.insert_one(file_doc)

    return {"id": file_doc["id"], "path": result["path"], "filename": filename}


@router.post("/upload-chunk")
async def upload_chunk(
    current_user: dict = Depends(get_current_user),
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    filename: str = Form(...),
    chunk_data: str = Form(...)
):
    """
    Chunked upload - Büyük dosyalar için parçalı yükleme
    Her chunk 1MB
    """
    key = f"{current_user['user_id']}:{upload_id}"
    
    try:
        decoded_chunk = base64.b64decode(chunk_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 chunk data")
    
    if key not in chunk_storage:
        chunk_storage[key] = {
            "chunks": {},
            "filename": filename,
            "total_chunks": total_chunks,
            "created_at": datetime.now(timezone.utc)
        }
    
    chunk_storage[key]["chunks"][chunk_index] = decoded_chunk
    
    # Tüm chunk'lar geldi mi?
    if len(chunk_storage[key]["chunks"]) == total_chunks:
        # Chunk'ları birleştir
        all_chunks = []
        for i in range(total_chunks):
            if i not in chunk_storage[key]["chunks"]:
                raise HTTPException(status_code=400, detail=f"Missing chunk {i}")
            all_chunks.append(chunk_storage[key]["chunks"][i])
        
        file_data = b"".join(all_chunks)
        
        # Temizle
        del chunk_storage[key]
        
        ext = filename.split(".")[-1].lower() if "." in filename else "bin"
        allowed = {"jpg", "jpeg", "png", "gif", "webp", "heic", "heif"}
        if ext not in allowed:
            raise HTTPException(status_code=400, detail="Only image files allowed")
        
        # Limit: 25MB
        if len(file_data) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 25MB)")
        
        path = f"{APP_NAME}/uploads/{current_user['user_id']}/{uuid.uuid4()}.{ext}"
        
        mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp", "heic": "image/heic", "heif": "image/heif"}
        # ✅ Kalıcı saklama (DB)
        result = await put_object_db(path, file_data, mime.get(ext, "application/octet-stream"))

        file_doc = {
            "id": str(uuid.uuid4()),
            "storage_path": result["path"],
            "original_filename": filename,
            "content_type": mime.get(ext, "application/octet-stream"),
            "size": result.get("size", len(file_data)),
            "user_id": current_user["user_id"],
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.uploaded_files.insert_one(file_doc)
        
        return {
            "status": "complete",
            "id": file_doc["id"],
            "path": result["path"],
            "filename": filename
        }
    
    return {
        "status": "chunk_received",
        "chunk_index": chunk_index,
        "received_chunks": len(chunk_storage[key]["chunks"]),
        "total_chunks": total_chunks
    }


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

    record = await db.uploaded_files.find_one({"storage_path": file_path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    # ✅ Önce DB'den dene (yeni dosyalar), olmazsa filesystem fallback (eski dosyalar)
    db_obj = await get_object_db(file_path)
    if db_obj:
        return Response(content=db_obj["data"], media_type=record.get("content_type", db_obj["content_type"]))
    # Filesystem fallback
    try:
        data, content_type = get_object(file_path)
        return Response(content=data, media_type=record.get("content_type", content_type))
    except Exception:
        raise HTTPException(status_code=404, detail="File data not found")
