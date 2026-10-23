import os
import base64
import logging
from pathlib import Path
import mimetypes

logger = logging.getLogger(__name__)

# Local file storage configuration (fallback for development)
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

# Public URL for accessing uploaded files
PUBLIC_URL = os.environ.get("PUBLIC_STORAGE_URL", "https://galeri.mactech.tr/uploads")

storage_key = "local"

# ✅ MongoDB GridFS-benzeri storage: dosyaları base64 olarak DB'ye saklar.
# Railway gibi ephemeral container'larda kalıcılık için zorunlu (restart'ta /app/uploads silinir).
# Her dosya tek bir doc: {path, content_type, data_base64, size, created_at}
_USE_DB = os.environ.get("FILE_STORAGE", "db").lower() == "db"


def init_storage():
    global storage_key
    if not UPLOAD_DIR.exists():
        UPLOAD_DIR.mkdir(exist_ok=True, parents=True)
    storage_key = "db" if _USE_DB else "local"
    logger.info(f"Storage backend: {storage_key}")
    return storage_key


async def put_object_db(path: str, data: bytes, content_type: str) -> dict:
    """Save file as base64 in MongoDB (kalıcı)."""
    from db import db
    from datetime import datetime, timezone
    encoded = base64.b64encode(data).decode("ascii")
    doc = {
        "path": path,
        "content_type": content_type,
        "data_base64": encoded,
        "size": len(data),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.update_one({"path": path}, {"$set": doc}, upsert=True)
    public_url = f"/api/files/{path}"
    return {"path": path, "url": public_url, "size": len(data), "content_type": content_type}


async def get_object_db(path: str):
    from db import db
    doc = await db.files.find_one({"path": path}, {"_id": 0})
    if not doc:
        return None
    data = base64.b64decode(doc["data_base64"])
    return {"data": data, "content_type": doc.get("content_type", "application/octet-stream")}


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Local filesystem fallback (development)."""
    file_path = UPLOAD_DIR / path
    file_path.parent.mkdir(exist_ok=True, parents=True)
    with open(file_path, 'wb') as f:
        f.write(data)
    public_url = f"{PUBLIC_URL}/{path}"
    return {"path": path, "url": public_url, "size": len(data), "content_type": content_type}


def get_object(path: str):
    file_path = UPLOAD_DIR / path
    
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    
    with open(file_path, 'rb') as f:
        data = f.read()
    
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    
    return data, content_type
