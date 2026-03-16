import os
import hashlib
import base64
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

fernet = None


def get_fernet():
    enc_key = os.environ.get('ENCRYPTION_KEY')
    if not enc_key:
        enc_key = Fernet.generate_key().decode()
        logger.info(f"Generated new encryption key. Store this: {enc_key}")
    if len(enc_key) == 44 and enc_key.endswith('='):
        return Fernet(enc_key.encode())
    key_bytes = hashlib.sha256(enc_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def encrypt_value(value: str) -> str:
    global fernet
    if not fernet:
        fernet = get_fernet()
    if not value:
        return value
    return fernet.encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    global fernet
    if not fernet:
        fernet = get_fernet()
    if not value:
        return value
    try:
        return fernet.decrypt(value.encode()).decode()
    except Exception:
        return value
