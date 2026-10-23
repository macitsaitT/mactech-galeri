from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB bağlantısı - Railway için güvenli
mongo_url = os.environ.get('MONGO_URL', os.environ.get('DATABASE_URL', ''))
db_name = os.environ.get('DB_NAME', 'mactech_gallery')

if not mongo_url:
    raise Exception("MONGO_URL environment variable is required!")

print(f"[DB] Connecting to MongoDB... DB: {db_name}")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

print(f"[DB] MongoDB connection initialized")


# Helper function for routes
async def get_database():
    return db
