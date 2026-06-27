from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import os

from app.config.database import engine, Base, SessionLocal
from app.config.seed import seed_admin_user, seed_approval_levels, run_schema_updates, seed_allowance_master, seed_facility_details
from app.api.routes import auth, expense, dashboard, approval, admin, upload, reports, users, ticket, notification
import app.models


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.config.database import force_local
    if force_local:
        logger.info("Initializing database tables (local mode)...")
        Base.metadata.create_all(bind=engine)
        
        # Create DB session for seeding
        db = SessionLocal()
        try:
            run_schema_updates(db)
            seed_admin_user(db)
            seed_approval_levels(db)
            seed_allowance_master(db)
            seed_facility_details(db)
        except Exception as e:
            logger.error(f"Error during seeding or schema updates: {str(e)}")
        finally:
            db.close()
    else:
        logger.info("Initializing database tables (production mode)...")
        try:
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            try:
                run_schema_updates(db)
            finally:
                db.close()
            logger.info("Production database tables initialized successfully.")
        except Exception as e:
            logger.error(f"Error during production database initialization: {str(e)}")
        
    yield
    logger.info("Shutting down API service...")

app = FastAPI(
    title="Field Operations API",
    description="Backend API for field operations management system with secure authentication",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static uploads directory
static_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(static_path, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_path), name="static")

# Register routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(expense.router, prefix="/api/expense", tags=["expense"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(approval.router, prefix="/api/approval", tags=["approval"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(ticket.router, prefix="/api/ticket", tags=["ticket"])
app.include_router(notification.router, prefix="/api/notifications", tags=["notifications"])

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "API is running"}
