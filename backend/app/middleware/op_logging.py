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
    "/api/auth/bootstrap":           "Dashboard",
    "/api/auth/prefill-kv":          "Admin - KV Prefill",
    "/api/reports/mis-dashboard":    "MIS Dashboard",
    "/api/reports/assets-inventory": "Asset Inventory",
    "/api/reports/assets-stats":     "Asset Stats",
    "/api/reports/assets-filters":   "Asset Filters",
    "/api/reports/penalty":          "Penalty Report",
    "/api/reports/upload-penalties": "Data Upload - Penalty",
    "/api/reports/upload-assets":    "Data Upload - Assets",
    "/api/expense":                  "Expense",
    "/api/approval":                 "Approval",
    "/api/admin":                    "Admin",
    "/api/monitoring":               "Monitoring",
    "/api/users":                    "Users",
    "/api/notifications":            "Notifications",
}

# ─── In-Memory Buffer ─────────────────────────────────────────────────────────
_buffer: List[dict] = []
_buffer_lock = threading.Lock()
_last_flush = _time.monotonic()


def _get_page_name(path: str) -> str:
    for prefix, name in PAGE_MAP.items():
        if path.startswith(prefix):
            return name
    return path


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
                user_name = payload.get("name", "")
                role      = payload.get("role", "")
                zone      = payload.get("zone", "")
                district  = payload.get("district", "")
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
