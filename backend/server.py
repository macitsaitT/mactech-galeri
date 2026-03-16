from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from db import db, client
from storage import init_storage
from routes.users import DEFAULT_PERMISSIONS

from routes.auth_routes import router as auth_router
from routes.cars import router as cars_router
from routes.customers import router as customers_router
from routes.transactions import router as transactions_router
from routes.appointments import router as appointments_router
from routes.users import router as users_router
from routes.stats import router as stats_router
from routes.uploads import router as uploads_router
from routes.exports import router as exports_router
from routes.encryption_routes import router as encryption_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Aslanbaş Oto CRM API")
api_router = APIRouter(prefix="/api")

# Include all route modules
api_router.include_router(auth_router)
api_router.include_router(cars_router)
api_router.include_router(customers_router)
api_router.include_router(transactions_router)
api_router.include_router(appointments_router)
api_router.include_router(users_router)
api_router.include_router(stats_router)
api_router.include_router(uploads_router)
api_router.include_router(exports_router)
api_router.include_router(encryption_router)


@api_router.get("/")
async def root():
    return {"message": "Aslanbaş Oto CRM API", "status": "running"}


@api_router.get("/health")
async def health():
    return {"status": "healthy"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Object Storage initialized")
    except Exception as e:
        logger.warning(f"Storage init deferred: {e}")

    await db.users.update_many(
        {"role": {"$exists": False}},
        {"$set": {"role": "admin"}}
    )

    users_without_org = await db.users.find({"org_id": {"$exists": False}}, {"_id": 0, "id": 1}).to_list(1000)
    for u in users_without_org:
        await db.users.update_one({"id": u["id"]}, {"$set": {"org_id": u["id"]}})

    for collection_name in ["cars", "customers", "transactions", "appointments"]:
        col = db[collection_name]
        docs = await col.find({"org_id": {"$exists": False}, "user_id": {"$exists": True}}, {"_id": 0, "id": 1, "user_id": 1}).to_list(10000)
        for d in docs:
            await col.update_one(
                {"id": d["id"]},
                {"$set": {"org_id": d["user_id"], "created_by": d["user_id"]}}
            )

    logger.info("Data migration complete (org_id, created_by, role)")

    orgs_with_perms = set()
    async for p in db.permissions.find({}, {"_id": 0, "org_id": 1}):
        orgs_with_perms.add(p["org_id"])

    admin_users = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1, "org_id": 1}).to_list(10000)
    for u in admin_users:
        oid = u.get("org_id", u["id"])
        if oid not in orgs_with_perms:
            await db.permissions.insert_one({
                "org_id": oid,
                "permissions": DEFAULT_PERMISSIONS,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    logger.info("Permissions migration complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
