import os
import time

# Enforce Indian Standard Time (IST) globally
os.environ["TZ"] = "Asia/Kolkata"
if hasattr(time, "tzset"):
    time.tzset()

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

# CORS Middleware config - Configured for robust token-based CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import collections
from datetime import datetime, timedelta
from jose import jwt
from app.config.settings import settings

# DDoS IP Auto-Ban and Request tracker maps
banned_ips = {}  # ip: ban_expiry_datetime
suspicious_strikes = collections.defaultdict(int)  # ip: strike_count

ip_request_history = collections.defaultdict(list)  # ip: [timestamp]
user_request_history = collections.defaultdict(list)  # user_id: [timestamp]

# Configurable security thresholds
SENSITIVE_PATHS = {
    "/api/auth/login", 
    "/api/auth/reset-password", 
    "/api/auth/verify-otp", 
    "/api/auth/send-otp",
    "/api/admin/users/bulk"
}
SENSITIVE_LIMIT = 10  # Max 10 requests per 60s for authentication endpoints
GENERAL_LIMIT = 150  # Max 150 requests per 60s for generic API paths
WINDOW_SIZE = 60  # seconds

@app.middleware("http")
async def security_and_rate_limiting_middleware(request: Request, call_next):
    # 1. IP Blocklist validation
    ip = request.client.host if request.client else "unknown"
    now = datetime.utcnow()
    
    if ip in banned_ips:
        expiry = banned_ips[ip]
        if now < expiry:
            return JSONResponse(
                status_code=403,
                content={"detail": "Your IP is temporarily banned due to suspicious traffic patterns. Try again later."}
            )
        else:
            del banned_ips[ip]
            suspicious_strikes[ip] = 0

    # 2. Extract Auth Token to prevent botnets bypassing IP blocks via proxy rotation
    auth_header = request.headers.get("Authorization")
    user_id = None
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
        except Exception:
            pass # Invalid tokens are safely intercepted by route dependencies

    # 3. Path-based threshold assessment
    path = request.url.path
    limit = SENSITIVE_LIMIT if path in SENSITIVE_PATHS else GENERAL_LIMIT

    # 4. Filter expired history entries
    ip_history = ip_request_history[ip]
    ip_history = [t for t in ip_history if (now - t).total_seconds() < WINDOW_SIZE]
    ip_request_history[ip] = ip_history

    user_history = []
    if user_id:
        user_history = user_request_history[user_id]
        user_history = [t for t in user_history if (now - t).total_seconds() < WINDOW_SIZE]
        user_request_history[user_id] = user_history

    # Check IP limits and register suspicious strikes
    if len(ip_history) >= limit:
        suspicious_strikes[ip] += 1
        if suspicious_strikes[ip] >= 3:
            # Auto-ban IP for 15 minutes
            banned_ips[ip] = now + timedelta(minutes=15)
            logger.warning(f"Suspect IP {ip} banned for 15 minutes due to aggressive request rates on {path}.")
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Suspicious request sequence detected."}
        )

    # Check User session limits to prevent account spam
    if user_id and len(user_history) >= GENERAL_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"detail": "Account session rate limit exceeded. Connection throttled."}
        )

    # Log current hits
    ip_request_history[ip].append(now)
    if user_id:
        user_request_history[user_id].append(now)

    # 5. Process Request
    response = await call_next(request)

    # 6. Inject Premium Hardened HTTP Security Headers (Defends against clickjacking, MitM, sniffing)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    response.headers["Referrer-Policy"] = "no-referrer-when-downgrade"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self' https:; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
        "style-src 'self' 'unsafe-inline' https:; "
        "img-src 'self' data: https:; "
        "font-src 'self' data: https:; "
        "connect-src 'self' https:;"
    )
    return response

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"SQLAlchemy Database Error on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "A secure database transaction error occurred. Raw query details have been logged."}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Server Error on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. System paths and tracebacks are secured."}
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
    return {"status": "ok", "message": "API is running", "version": "v1.0.3-clean-pem"}

@app.get("/api/test-kv")
def test_kv_check():
    from app.utils import cache
    return {
        "kv_enabled": cache.IS_KV_ENABLED,
        "kv_namespace": bool(cache.NAMESPACE_ID),
        "has_token": bool(cache.API_TOKEN),
        "has_account": bool(cache.ACCOUNT_ID)
    }
