"""
DB & KV Operation Monitoring API
Tracks per-user, per-page DB reads/writes and KV cache hits.
Admin-only endpoints with date/month/zone/district filtering.
Also fetches real Cloudflare Analytics (KV + D1) via GraphQL API.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date
import requests as http_req
import logging

from app.config.database import get_db
from app.api.routes.dependencies import get_current_user
from app.models.user import User
from app.utils.cache import ACCOUNT_ID, API_TOKEN, NAMESPACE_ID, IS_KV_ENABLED

logger = logging.getLogger(__name__)
router = APIRouter()

DAILY_READ_LIMIT  = 5_000_000
DAILY_WRITE_LIMIT = 100_000

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS db_op_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT,
    user_name   TEXT,
    user_role   TEXT,
    user_zone   TEXT,
    user_district TEXT,
    endpoint    TEXT,
    page_name   TEXT,
    method      TEXT,
    op_type     TEXT,
    db_reads    INTEGER DEFAULT 0,
    db_writes   INTEGER DEFAULT 0,
    kv_hits     INTEGER DEFAULT 0,
    log_date    TEXT,
    log_month   TEXT,
    log_year    INTEGER,
    created_at  TEXT
)
"""


def _ensure_table(db):
    try:
        db.execute(text(CREATE_TABLE_SQL))
        db.commit()
    except Exception as e:
        logger.warning(f"db_op_logs table create: {e}")


def _admin_check(current_user: User):
    allowed = {"Admin", "Super Admin", "admin", "super_admin"}
    if (current_user.role or "").strip() not in allowed:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required.")


def _build_where(date_str, month_str, zone, district, user_id, page_name, op_type):
    clauses = ["1=1"]
    params: dict = {}
    if date_str:
        clauses.append("log_date = :log_date")
        params["log_date"] = date_str
    elif month_str:
        clauses.append("log_month = :log_month")
        params["log_month"] = month_str
    if zone:
        clauses.append("LOWER(user_zone) = LOWER(:zone)")
        params["zone"] = zone
    if district:
        clauses.append("LOWER(user_district) = LOWER(:district)")
        params["district"] = district
    if user_id:
        clauses.append("user_id = :user_id")
        params["user_id"] = user_id
    if page_name:
        clauses.append("page_name = :page_name")
        params["page_name"] = page_name
    if op_type:
        clauses.append("op_type = :op_type")
        params["op_type"] = op_type
    return " AND ".join(clauses), params


@router.get("/summary")
async def get_summary(
    date_str:  str = Query(None, alias="date"),
    month_str: str = Query(None, alias="month"),
    zone:      str = None,
    district:  str = None,
    user_id:   str = None,
    page_name: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _admin_check(current_user)
    _ensure_table(db)
    if not date_str and not month_str:
        date_str = date.today().isoformat()
    where, params = _build_where(date_str, month_str, zone, district, user_id, page_name, None)
    try:
        row = db.execute(text(f"""
            SELECT COALESCE(SUM(db_reads),0), COALESCE(SUM(db_writes),0),
                   COALESCE(SUM(kv_hits),0),  COUNT(*)
            FROM db_op_logs WHERE {where}
        """), params).fetchone()
        db_reads  = int(row[0] or 0)
        db_writes = int(row[1] or 0)
        kv_hits   = int(row[2] or 0)
        requests  = int(row[3] or 0)
        total_reads = db_reads + kv_hits
        kv_pct = round((kv_hits / total_reads * 100) if total_reads > 0 else 0, 1)
        return {
            "success": True, "date": date_str, "month": month_str,
            "db_reads": db_reads, "db_writes": db_writes, "kv_hits": kv_hits,
            "total_requests": requests, "kv_savings_pct": kv_pct,
            "daily_read_limit": DAILY_READ_LIMIT, "daily_write_limit": DAILY_WRITE_LIMIT,
            "reads_used_pct":  round(db_reads / DAILY_READ_LIMIT * 100, 3),
            "writes_used_pct": round(db_writes / DAILY_WRITE_LIMIT * 100, 3),
        }
    except Exception as e:
        logger.error(f"monitoring/summary error: {e}")
        return {"success": False, "message": str(e)}


@router.get("/user-breakdown")
async def get_user_breakdown(
    date_str:  str = Query(None, alias="date"),
    month_str: str = Query(None, alias="month"),
    zone:      str = None,
    district:  str = None,
    page_name: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _admin_check(current_user)
    _ensure_table(db)
    if not date_str and not month_str:
        date_str = date.today().isoformat()
    where, params = _build_where(date_str, month_str, zone, district, None, page_name, None)
    try:
        rows = db.execute(text(f"""
            SELECT user_id, user_name, user_role, user_zone, user_district,
                   SUM(db_reads), SUM(db_writes), SUM(kv_hits), COUNT(*)
            FROM db_op_logs WHERE {where}
            GROUP BY user_id, user_name, user_role, user_zone, user_district
            ORDER BY SUM(db_reads) DESC LIMIT 100
        """), params).fetchall()
        return {"success": True, "users": [
            {"user_id": r[0], "user_name": r[1], "role": r[2], "zone": r[3], "district": r[4],
             "db_reads": int(r[5] or 0), "db_writes": int(r[6] or 0),
             "kv_hits": int(r[7] or 0), "requests": int(r[8] or 0)}
            for r in rows
        ]}
    except Exception as e:
        return {"success": False, "message": str(e), "users": []}


@router.get("/page-breakdown")
async def get_page_breakdown(
    date_str:  str = Query(None, alias="date"),
    month_str: str = Query(None, alias="month"),
    zone: str = None, district: str = None, user_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _admin_check(current_user)
    _ensure_table(db)
    if not date_str and not month_str:
        date_str = date.today().isoformat()
    where, params = _build_where(date_str, month_str, zone, district, user_id, None, None)
    try:
        rows = db.execute(text(f"""
            SELECT page_name, SUM(db_reads), SUM(db_writes), SUM(kv_hits), COUNT(*)
            FROM db_op_logs WHERE {where}
            GROUP BY page_name ORDER BY SUM(db_reads) DESC
        """), params).fetchall()
        return {"success": True, "pages": [
            {"page_name": r[0], "db_reads": int(r[1] or 0), "db_writes": int(r[2] or 0),
             "kv_hits": int(r[3] or 0), "request_count": int(r[4] or 0)}
            for r in rows
        ]}
    except Exception as e:
        return {"success": False, "message": str(e), "pages": []}


@router.get("/timeline")
async def get_timeline(
    month_str: str = Query(None, alias="month"),
    zone: str = None, district: str = None, user_id: str = None,
    page_name: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _admin_check(current_user)
    _ensure_table(db)
    if not month_str:
        month_str = date.today().strftime("%Y-%m")
    where, params = _build_where(None, month_str, zone, district, user_id, page_name, None)
    try:
        rows = db.execute(text(f"""
            SELECT log_date, SUM(db_reads), SUM(db_writes), SUM(kv_hits)
            FROM db_op_logs WHERE {where}
            GROUP BY log_date ORDER BY log_date ASC
        """), params).fetchall()
        return {"success": True, "timeline": [
            {"date": r[0], "db_reads": int(r[1] or 0),
             "db_writes": int(r[2] or 0), "kv_hits": int(r[3] or 0)}
            for r in rows
        ]}
    except Exception as e:
        return {"success": False, "message": str(e), "timeline": []}


@router.get("/logs")
async def get_logs(
    date_str:  str = Query(None, alias="date"),
    month_str: str = Query(None, alias="month"),
    zone: str = None, district: str = None, user_id: str = None,
    page_name: str = None, op_type: str = None,
    page: int = 1, page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _admin_check(current_user)
    _ensure_table(db)
    if not date_str and not month_str:
        date_str = date.today().isoformat()
    where, params = _build_where(date_str, month_str, zone, district, user_id, page_name, op_type)
    try:
        total = db.execute(text(f"SELECT COUNT(*) FROM db_op_logs WHERE {where}"), params).scalar() or 0
        offset = (page - 1) * page_size
        rows = db.execute(text(f"""
            SELECT id, user_id, user_name, user_role, user_zone, user_district,
                   endpoint, page_name, method, op_type,
                   db_reads, db_writes, kv_hits, log_date, created_at
            FROM db_op_logs WHERE {where}
            ORDER BY id DESC LIMIT :lim OFFSET :off
        """), {**params, "lim": page_size, "off": offset}).fetchall()
        cols = ["id","user_id","user_name","role","zone","district",
                "endpoint","page_name","method","op_type",
                "db_reads","db_writes","kv_hits","log_date","created_at"]
        return {"success": True, "total": total, "page": page,
                "page_size": page_size, "logs": [dict(zip(cols, r)) for r in rows]}
    except Exception as e:
        return {"success": False, "message": str(e), "logs": []}


@router.get("/cloudflare-official")
async def get_cloudflare_official(
    date_str:  str = Query(None, alias="date"),
    month_str: str = Query(None, alias="month"),
    current_user: User = Depends(get_current_user)
):
    """Fetch official Cloudflare account analytics for D1 & KV via Cloudflare GraphQL API."""
    _admin_check(current_user)
    
    if not IS_KV_ENABLED:
        return {
            "success": False,
            "message": "Cloudflare integration is not configured or missing credentials."
        }

    import calendar
    from datetime import datetime
    
    start_time = None
    end_time = None
    
    if date_str:
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            start_time = dt.strftime("%Y-%m-%dT00:00:00Z")
            end_time = dt.strftime("%Y-%m-%dT23:59:59Z")
        except ValueError:
            date_str = None
            
    if month_str and not date_str:
        try:
            dt = datetime.strptime(month_str, "%Y-%m")
            start_time = dt.strftime("%Y-%m-%dT00:00:00Z")
            last_day = calendar.monthrange(dt.year, dt.month)[1]
            end_time = f"{month_str}-{last_day:02d}T23:59:59Z"
        except ValueError:
            month_str = None
            
    if not start_time or not end_time:
        # Default to today
        dt = datetime.today()
        start_time = dt.strftime("%Y-%m-%dT00:00:00Z")
        end_time = dt.strftime("%Y-%m-%dT23:59:59Z")

    from app.config.settings import settings
    d1_db_id = getattr(settings, "CLOUDFLARE_DATABASE_ID", "")
    
    headers = {}
    if API_TOKEN.startswith("cfk_"):
        headers["X-Auth-Key"] = API_TOKEN
        headers["X-Auth-Email"] = "Sunil.cyrixrjbemp@gmail.com"
    else:
        headers["Authorization"] = f"Bearer {API_TOKEN}"
    headers["Content-Type"] = "application/json"
    
    # Build GraphQL query for D1 and KV analytics with start and end times
    query_body = f"""
    query {{
      viewer {{
        accounts(filter: {{ accountTag: "{ACCOUNT_ID}" }}) {{
          kvOperationsAdaptiveGroups(
            limit: 100
            filter: {{
              namespaceId: "{NAMESPACE_ID}"
              datetime_geq: "{start_time}"
              datetime_leq: "{end_time}"
            }}
          ) {{
            dimensions {{
              actionType
            }}
            sum {{
              requests
            }}
          }}
          d1AnalyticsAdaptiveGroups(
            limit: 100
            filter: {{
              databaseId: "{d1_db_id}"
              datetime_geq: "{start_time}"
              datetime_leq: "{end_time}"
            }}
          ) {{
            sum {{
              readQueries
              writeQueries
              rowsRead
              rowsWritten
            }}
          }}
        }}
      }}
    }}
    """
    
    try:
        res = http_req.post(
            "https://api.cloudflare.com/client/v4/graphql",
            headers=headers,
            json={"query": query_body},
            timeout=8
        )
        if res.status_code != 200:
            return {
                "success": False,
                "message": f"Cloudflare API returned HTTP {res.status_code}",
                "suggestion": "Verify that your Cloudflare API Token has permissions to read Analytics."
            }
            
        data = res.json()
        if "errors" in data and data["errors"]:
            err_msg = data["errors"][0].get("message", "GraphQL Query Failed")
            return {
                "success": False,
                "message": err_msg,
                "suggestion": "Your Cloudflare token might lack Account Analytics Read permissions."
            }
            
        accounts = data.get("data", {}).get("viewer", {}).get("accounts", [])
        
        kv_reads = 0
        kv_writes = 0
        d1_reads = 0
        d1_writes = 0
        d1_rows_read = 0
        d1_rows_written = 0
        
        if accounts:
            acc = accounts[0]
            # Sum up KV operations
            kv_groups = acc.get("kvOperationsAdaptiveGroups", []) or []

            for grp in kv_groups:
                action = grp.get("dimensions", {}).get("actionType", "") or ""
                sum_reqs = grp.get("sum", {}).get("requests", 0) or 0
                if action == "read":
                    kv_reads += sum_reqs
                elif action in ("write", "put", "set", "delete"):
                    kv_writes += sum_reqs

                
            # Sum up D1 operations
            d1_groups = acc.get("d1AnalyticsAdaptiveGroups", []) or []
            for grp in d1_groups:
                s = grp.get("sum", {}) or {}
                d1_reads += s.get("readQueries", 0) or 0
                d1_writes += s.get("writeQueries", 0) or 0
                d1_rows_read += s.get("rowsRead", 0) or 0
                d1_rows_written += s.get("rowsWritten", 0) or 0
                
        return {
            "success": True,
            "kv_reads": kv_reads,
            "kv_writes": kv_writes,
            "d1_reads": d1_reads,
            "d1_writes": d1_writes,
            "d1_rows_read": d1_rows_read,
            "d1_rows_written": d1_rows_written
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Could not contact Cloudflare API: {str(e)}"
        }

