from fastapi import FastAPI, APIRouter, Request
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse
import os
import logging
from pathlib import Path
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from db import db, client
from storage import init_storage
from security import SecurityHeadersMiddleware
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
from routes.year_end import router as year_end_router
from routes.invoices import router as invoices_router
from routes.webhooks import router as webhooks_router
from routes.notifications import router as notifications_router
from routes.capital import router as capital_router
from routes.installments import router as installments_router
from routes.branches import router as branches_router
from routes.data_recovery import router as recovery_router
from routes.activity_logs import router as activity_logs_router
from routes.digest import router as digest_router, run_weekly_digest_for_all
from routes.wanted_cars import router as wanted_cars_router
from routes.ocr import router as ocr_router
from routes.ai_render import router as ai_render_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="Aslanbaş Oto CRM API")
app.state.limiter = limiter
api_router = APIRouter(prefix="/api")


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Çok fazla istek. Lütfen biraz bekleyin."})

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
api_router.include_router(year_end_router)
api_router.include_router(invoices_router)
api_router.include_router(webhooks_router)
api_router.include_router(notifications_router)
api_router.include_router(capital_router)
api_router.include_router(installments_router)
api_router.include_router(branches_router)
api_router.include_router(recovery_router)
api_router.include_router(activity_logs_router)
api_router.include_router(digest_router)
api_router.include_router(wanted_cars_router)
api_router.include_router(ocr_router)
api_router.include_router(ai_render_router)


@api_router.get("/")
async def root():
    return {"message": "Aslanbaş Oto CRM API", "status": "running"}


@api_router.get("/health")
async def health():
    return {"status": "healthy"}


app.include_router(api_router)

# Static file serving for uploads
upload_dir = Path("/app/uploads")
upload_dir.mkdir(exist_ok=True, parents=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

# Middleware (order matters: last added = first executed)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)

# CORS - Tüm domainlere izin ver (Railway için)
cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    allow_origins = ["*"]
else:
    allow_origins = [origin.strip() for origin in cors_origins.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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

    # ✅ Eski satışların sold_by_user_id alanını backfill et — Dashboard "Satış Elemanları" widget'ı
    try:
        from migrations.migrate_sold_by_user_id import backfill_sold_by_user_id
        await backfill_sold_by_user_id(db)
    except Exception as e:
        logger.warning(f"sold_by backfill failed: {e}")

    # ✅ Digest scheduler — saatlik tick, kullanıcı başına day/hour kontrolü digest.py içinde
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        sched = AsyncIOScheduler(timezone=os.environ.get("DIGEST_TIMEZONE", "Europe/Istanbul"))
        # Her saat başı tetikle; run_weekly_digest_for_all her org için kayıtlı day/hour ile karşılaştırır
        sched.add_job(
            run_weekly_digest_for_all,
            CronTrigger(minute=0),
            id="digest_hourly_tick",
            replace_existing=True,
        )
        sched.start()
        app.state.scheduler = sched
        logger.info("Digest scheduler started (hourly tick, per-org day/hour)")
    except Exception as e:
        logger.warning(f"Scheduler could not start: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    try:
        sched = getattr(app.state, "scheduler", None)
        if sched:
            sched.shutdown(wait=False)
    except Exception:
        pass
    client.close()
