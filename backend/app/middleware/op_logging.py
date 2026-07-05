"""
DB/KV Operation Logging Middleware with Batch Write Buffer.

WRITE LIMIT PROTECTION:
Instead of writing 1 DB row per request (= N writes for N requests),
this middleware batches logs in memory and flushes to DB every
FLUSH_EVERY requests OR every FLUSH_INTERVAL_SECONDS seconds,
whichever comes first.

Example: 1000 requests → only ~20 DB writes (batch of 50 each).
This keeps well within Cloudflare D1's 100K writes/day limit.
"""
import logging
import threading
import time as _time
from datetime import datetime, date as date_cls
from typing import List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from jose import jwt, JWTError
from app.config.settings import settings
from app.config.database import SessionLocal
from app.utils import op_tracker
from sqlalchemy import text

logger = logging.getLogger(__name__)

# ─── Batch Write Config ───────────────────────────────────────────────────────
FLUSH_EVERY   = 50    # flush buffer after this many records
FLUSH_INTERVAL = 30   # also flush every 30 seconds regardless

SKIP_PATHS = {
    "/api/health", "/api/test-kv", "/api/auth/refresh",
    "/static", "/docs", "/openapi.json", "/redoc", "/api/monitoring"
}

PAGE_MAP = {
    "/api/auth/login":               "Login",
    "/api/auth/logout":              "Login",
    "/api/auth/bootstrap":           "Home",
    "/api/auth/prefill-kv":          "Admin Panel",
    "/api/reports/mis-dashboard":    "MIS Report",
    "/api/reports/assets-inventory": "Asset Inventory",
    "/api/reports/assets-stats":     "Asset Inventory",
    "/api/reports/assets-filters":   "Asset Inventory",
    "/api/reports/penalty":          "Penalty Report",
    "/api/reports/upload-penalties": "Upload Data",
    "/api/reports/upload-assets":    "Upload Data",
    "/api/expense":                  "Submit Expense",
    "/api/approval":                 "Approval Center",
    "/api/admin":                    "Admin Panel",
    "/api/monitoring":               "DB Monitor",
    "/api/users":                    "Profile",
    "/api/notifications":            "Notifications",
    "/api/ticket":                   "Help Center"
}

# ─── In-Memory Buffer ─────────────────────────────────────────────────────────
_buffer: List[dict] = []
_buffer_lock = threading.Lock()
_last_flush = _time.monotonic()


def _get_page_name(path: str) -> str:
    path_lower = path.lower()
    # Match prefixes to menu screens
    if "auth/login" in path_lower or "auth/logout" in path_lower:
        return "Login"
    if "auth/bootstrap" in path_lower:
        return "Home"
    if "prefill-kv" in path_lower:
        return "Admin Panel"
    if "mis-dashboard" in path_lower:
        return "MIS Report"
    if "assets-inventory" in path_lower or "assets-stats" in path_lower or "assets-filters" in path_lower:
        return "Asset Inventory"
    if "penalty" in path_lower:
        return "Penalty Report"
    if "upload-" in path_lower:
        return "Upload Data"
    if "expense" in path_lower:
        return "Submit Expense"
    if "approval" in path_lower:
        return "Approval Center"
    if "admin" in path_lower:
        return "Admin Panel"
    if "monitoring" in path_lower:
        return "DB Monitor"
    if "users" in path_lower or "profile" in path_lower:
        return "Profile"
    if "ticket" in path_lower or "help" in path_lower:
        return "Help Center"
    if "kpi" in path_lower:
        return "KPI Dashboard"
    if "analysis" in path_lower:
        return "Analysis"
    if "month-report" in path_lower:
        return "Month Report"
    if "consolidated" in path_lower:
        return "Consolidated Report"
    if "gdrive" in path_lower or "upload/file" in path_lower:
        return "File Viewer"
    if "notifications" in path_lower:
        return "Notifications"

    # Default lookup in MAP
    for prefix, name in PAGE_MAP.items():
        if path.startswith(prefix):
            return name
            
    # Default fallback: extract path parts and title case
    parts = [p for p in path.split("/") if p and p != "api"]
    if parts:
        return " ".join(parts).title()
    return "General API"


def _flush_buffer():
    """Write all buffered log rows to DB in a single batch INSERT."""
    global _last_flush
    with _buffer_lock:
        if not _buffer:
            return
        rows = _buffer.copy()
        _buffer.clear()
        _last_flush = _time.monotonic()

    if not rows:
        return

    db = SessionLocal()
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS db_op_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT, user_name TEXT, user_role TEXT,
                user_zone TEXT, user_district TEXT,
                endpoint TEXT, page_name TEXT, method TEXT, op_type TEXT,
                db_reads INTEGER DEFAULT 0, db_writes INTEGER DEFAULT 0,
                kv_hits INTEGER DEFAULT 0,
                log_date TEXT, log_month TEXT, log_year INTEGER, created_at TEXT
            )
        """))
        for row in rows:
            db.execute(text("""
                INSERT INTO db_op_logs
                    (user_id, user_name, user_role, user_zone, user_district,
                     endpoint, page_name, method, op_type,
                     db_reads, db_writes, kv_hits,
                     log_date, log_month, log_year, created_at)
                VALUES
                    (:user_id, :user_name, :user_role, :user_zone, :user_district,
                     :endpoint, :page_name, :method, :op_type,
                     :db_reads, :db_writes, :kv_hits,
                     :log_date, :log_month, :log_year, :created_at)
            """), row)
        db.commit()
        
        # Repair any historical logs that have missing names or roles, or developer page names
        try:
            db.execute(text("""
                UPDATE db_op_logs 
                SET user_name = (SELECT name FROM users WHERE users.user_id = db_op_logs.user_id),
                    user_role = (SELECT role FROM users WHERE users.user_id = db_op_logs.user_id),
                    user_zone = (SELECT zone FROM users WHERE users.user_id = db_op_logs.user_id),
                    user_district = (SELECT district FROM users WHERE users.user_id = db_op_logs.user_id)
                WHERE user_name IS NULL OR user_name = '';
            """))
            db.execute(text("""
                UPDATE db_op_logs
                SET page_name = 'File Viewer'
                WHERE page_name LIKE '%gdrive%' OR page_name LIKE '%upload/file%' OR endpoint LIKE '%gdrive%' OR endpoint LIKE '%upload/file%';
            """))
            db.execute(text("""
                UPDATE db_op_logs
                SET page_name = 'Upload Data'
                WHERE endpoint LIKE '%upload-%' OR endpoint LIKE '%upload_data%' OR page_name LIKE '%Upload%';
            """))
            db.commit()
        except Exception as ex:
            logger.debug(f"op_log historical repair failed: {ex}")
            
        logger.debug(f"op_log: flushed {len(rows)} buffered rows to DB (1 write)")
    except Exception as e:
        logger.debug(f"op_log flush failed: {e}")
    finally:
        db.close()


def _maybe_flush(force: bool = False):
    """Flush if buffer is full OR enough time has passed."""
    global _last_flush
    with _buffer_lock:
        buf_len = len(_buffer)
    elapsed = _time.monotonic() - _last_flush
    if force or buf_len >= FLUSH_EVERY or elapsed >= FLUSH_INTERVAL:
        _flush_buffer()


class DBOpLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path   = request.url.path
        method = request.method

        # Skip irrelevant paths
        if any(path.startswith(s) for s in SKIP_PATHS):
            return await call_next(request)

        # Decode JWT to identify user
        user_id = user_name = role = zone = district = ""
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                token   = auth_header.split(" ")[1]
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                user_id   = payload.get("sub", "")
                
                if user_id:
                    # Check cache for user info to prevent heavy database queries
                    from app.utils import cache
                    cache_key = f"user_profile_data:{user_id}"
                    cached_profile = cache.get(cache_key)
                    if cached_profile and isinstance(cached_profile, dict):
                        user_name = cached_profile.get("name", "")
                        role      = cached_profile.get("role", "")
                        zone      = cached_profile.get("zone", "")
                        district  = cached_profile.get("district", "")
                    else:
                        # Fetch from DB and cache for 24 hours
                        db_session = SessionLocal()
                        try:
                            from app.models.user import User
                            db_user = db_session.query(User).filter(User.user_id == user_id).first()
                            if db_user:
                                user_name = db_user.name or ""
                                role      = db_user.role or ""
                                zone      = db_user.zone or ""
                                district  = db_user.district or ""
                                cache.set(cache_key, {
                                    "name": user_name,
                                    "role": role,
                                    "zone": zone,
                                    "district": district
                                }, ttl=86400)
                        finally:
                            db_session.close()
            except JWTError:
                pass
            except Exception:
                pass

        # Init per-request KV counter
        op_tracker.start_request(
            user_id=user_id, user_name=user_name, role=role,
            zone=zone, district=district, endpoint=path, method=method
        )

        # Process request
        response = await call_next(request)

        stats    = op_tracker.get_stats()
        op_tracker.clear()

        # Only log authenticated requests
        if not user_id:
            return response

        # Compute accurate op counts
        op_type   = "read" if method == "GET" else "write"
        kv_hits   = stats["kv_hits"]  # exact count from cache.py

        if op_type == "read":
            # If KV served the response → 0 DB reads; else 1 DB read
            db_reads  = 0 if kv_hits > 0 else 1
            db_writes = 0
        else:
            db_reads  = 0
            # Bulk upload routes cost more writes than simple POSTs
            db_writes = 5 if "upload" in path else 1

        # Add to in-memory buffer (no DB write yet!)
        now       = datetime.utcnow()
        log_entry = {
            "user_id":    user_id,
            "user_name":  user_name,
            "user_role":  role,
            "user_zone":  zone,
            "user_district": district,
            "endpoint":   path,
            "page_name":  _get_page_name(path),
            "method":     method,
            "op_type":    op_type,
            "db_reads":   db_reads,
            "db_writes":  db_writes,
            "kv_hits":    kv_hits,
            "log_date":   date_cls.today().isoformat(),
            "log_month":  now.strftime("%Y-%m"),
            "log_year":   now.year,
            "created_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        }

        with _buffer_lock:
            _buffer.append(log_entry)

        # Flush if buffer full or time elapsed (non-blocking check)
        _maybe_flush()

        return response
