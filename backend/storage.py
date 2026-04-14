import os
import logging
from pathlib import Path
import mimetypes

logger = logging.getLogger(__name__)

# Local file storage configuration
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

# Public URL for accessing uploaded files
PUBLIC_URL = os.environ.get("PUBLIC_STORAGE_URL", "https://galeri.mactech.tr/uploads")

storage_key = "local"  # For compatibility


def init_storage():
    """Initialize local storage (no-op for local filesystem)"""
    global storage_key
    if not UPLOAD_DIR.exists():
        UPLOAD_DIR.mkdir(exist_ok=True, parents=True)
        logger.info(f"Created upload directory: {UPLOAD_DIR}")
    storage_key = "local"
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Save file to local filesystem"""
    file_path = UPLOAD_DIR / path
    file_path.parent.mkdir(exist_ok=True, parents=True)
    
    with open(file_path, 'wb') as f:
        f.write(data)
    
    public_url = f"{PUBLIC_URL}/{path}"
    
    logger.info(f"Saved file to {file_path}, public URL: {public_url}")
    
    return {
        "path": path,
        "url": public_url,
        "size": len(data),
        "content_type": content_type
    }


def get_object(path: str):
    """Retrieve file from local filesystem"""
    file_path = UPLOAD_DIR / path
    
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    
    with open(file_path, 'rb') as f:
        data = f.read()
    
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    
    return data, content_type
