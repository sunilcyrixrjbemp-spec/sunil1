"""
DB/KV Operation Logging Middleware
Intercepts every HTTP request, identifies the user, and logs
DB reads, DB writes, and KV cache hits to the db_op_logs table.
"""
import logging
from datetime import datetime, date as date_cls
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from jose import jwt, JWTError
from app.config.settings import settings
from app.config.database import SessionLocal
from app.utils import op_tracker
from sqlalchemy import text

logger = logging.getLogger(__name__)

SKIP_PATHS = {
    "/api/health", "/api/test-kv", "/api/auth/refresh",
    "/static", "/docs", "/openapi.json", "/redoc"
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


def _get_page_name(path: str) -> str:
    for prefix, name in PAGE_MAP.items():
        if path.startswith(prefix):
            return name
    return path


class DBOpLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path   = request.url.path
        method = request.method

        if any(path.startswith(s) for s in SKIP_PATHS):
            return await call_next(request)

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
            except Exception:
                pass

        op_tracker.start_request(
            user_id=user_id, user_name=user_name, role=role,
            zone=zone, district=district, endpoint=path, method=method
        )

        response = await call_next(request)

        stats = op_tracker.get_stats()
        op_tracker.clear()

        if not user_id:
            return response

        op_type   = "read" if method == "GET" else "write"
        kv_hits   = stats["kv_hits"]
        db_reads  = 0 if (op_type == "read" and kv_hits > 0) else (1 if op_type == "read" else 0)
        db_writes = (5 if "upload" in path else 1) if op_type == "write" else 0

        try:
            now        = datetime.utcnow()
            log_date   = date_cls.today().isoformat()
            log_month  = now.strftime("%Y-%m")
            log_year   = now.year
            created_at = now.strftime("%Y-%m-%d %H:%M:%S")
            page_name  = _get_page_name(path)

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
                """), {
                    "user_id":    user_id,   "user_name":  user_name,
                    "user_role":  role,       "user_zone":  zone,
                    "user_district": district,
                    "endpoint":   path,       "page_name":  page_name,
                    "method":     method,     "op_type":    op_type,
                    "db_reads":   db_reads,   "db_writes":  db_writes,
                    "kv_hits":    kv_hits,    "log_date":   log_date,
                    "log_month":  log_month,  "log_year":   log_year,
                    "created_at": created_at,
                })
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.debug(f"op_log insert failed (non-critical): {e}")

        return response
