import os
from typing import Optional
import re
import json
import requests
import logging
import tomllib
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config.settings import settings

logger = logging.getLogger(__name__)

def parse_aliases(sql):
    sql_upper = sql.upper().strip()
    if not sql_upper.startswith("SELECT"):
        return []
    from_index = -1
    paren_depth = 0
    for i in range(len(sql) - 4):
        char = sql[i]
        if char == '(':
            paren_depth += 1
        elif char == ')':
            paren_depth -= 1
        elif paren_depth == 0 and sql[i:i+4].upper() == "FROM":
            if (i == 0 or sql[i-1].isspace() or sql[i-1] in ',)') and (i+4 == len(sql) or sql[i+4].isspace() or sql[i+4] in '(,'):
                from_index = i
                break
    if from_index == -1:
        select_part = sql[6:].strip()
    else:
        select_part = sql[6:from_index].strip()
    parts = []
    current_part = []
    paren_depth = 0
    for char in select_part:
        if char == '(':
            paren_depth += 1
        elif char == ')':
            paren_depth -= 1
        elif char == ',' and paren_depth == 0:
            parts.append("".join(current_part).strip())
            current_part = []
            continue
        current_part.append(char)
    if current_part:
        parts.append("".join(current_part).strip())
    aliases = []
    for part in parts:
        as_match = re.search(r"\bAS\b\s+(\w+)", part, re.IGNORECASE)
        if as_match:
            aliases.append(as_match.group(1).strip().strip('"`[]'))
        else:
            last_word_match = re.search(r"(\w+)\s*$", part)
            if last_word_match:
                aliases.append(last_word_match.group(1))
    return aliases

_cf_session = None
_pragma_cache = {}

def get_cf_session():
    global _cf_session
    if _cf_session is None:
        _cf_session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=150,
            pool_maxsize=250,
            max_retries=3
        )
        _cf_session.mount("https://", adapter)
    return _cf_session

# Cloudflare D1 DBAPI 2.0 Compliance Driver for local SQLAlchemy support
class D1Cursor:
    def __init__(self, conn):
        self.conn = conn
        self.results = []
        self.description = None
        self.rowcount = -1
        self.lastrowid = None
        self._idx = 0

    def executemany(self, sql, seq_of_parameters):
        for parameters in seq_of_parameters:
            self.execute(sql, parameters)
        return self

    def execute(self, sql, parameters=None):
        if parameters is None:
            parameters = []
        else:
            parameters = list(parameters)
            for i, p in enumerate(parameters):
                if hasattr(p, "isoformat"):
                    parameters[i] = p.isoformat()
                elif hasattr(p, "strftime"):
                    parameters[i] = p.strftime("%Y-%m-%d %H:%M:%S")

        # Intercept unsupported PRAGMA settings (like READ_UNCOMMITTED)
        sql_upper = sql.upper().strip()
        if "READ_UNCOMMITTED" in sql_upper:
            self.rowcount = 0
            self.lastrowid = None
            self.results = [(0,)]
            self.description = [("read_uncommitted", None, None, None, None, None, None)]
            self._idx = 0
            return self

        # Intercept unsupported temp schema queries that fail with SQLITE_AUTH on Cloudflare D1
        if "TEMP.TABLE_INFO" in sql_upper:
            self.rowcount = 0
            self.lastrowid = None
            self.results = []
            self.description = []
            self._idx = 0
            return self

        # Cache lookup for table inspection to avoid redundant API roundtrips
        if sql_upper.startswith("PRAGMA MAIN.TABLE_INFO"):
            if sql in _pragma_cache:
                cached_res = _pragma_cache[sql]
                self.rowcount = cached_res["rowcount"]
                self.lastrowid = cached_res["lastrowid"]
                self.results = cached_res["results"]
                self.description = cached_res["description"]
                self._idx = 0
                return self

        # Cloudflare D1 query API URL
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.conn.account_id}/d1/database/{self.conn.database_id}/query"
        headers = {
            "Content-Type": "application/json"
        }
        
        # Check if the token is a legacy/global API Key (starts with cfk_)
        if self.conn.token and self.conn.token.startswith("cfk_"):
            headers["X-Auth-Key"] = self.conn.token
            headers["X-Auth-Email"] = self.conn.email or "Sunil.cyrixrjbemp@gmail.com"
        else:
            headers["Authorization"] = f"Bearer {self.conn.token}"
        
        payload = {
            "sql": sql,
            "params": parameters
        }
        
        session = get_cf_session()
        try:
            response = session.post(url, headers=headers, json=payload, timeout=15)
            if response.status_code != 200:
                raise Exception(f"D1 API HTTP Error: {response.status_code} - {response.text}")
                
            res_json = response.json()
            if not res_json.get("success"):
                errors = res_json.get("errors", [])
                err_msg = errors[0].get("message") if errors else "Unknown error"
                raise Exception(f"D1 query execution failed: {err_msg}")
                
            result_data = res_json.get("result", [])[0]
            if not result_data.get("success"):
                raise Exception("D1 Query returned unsuccessful execution flag")
                
            results_list = result_data.get("results", [])
            meta = result_data.get("meta", {})
            
            self.rowcount = meta.get("changes", len(results_list))
            self.lastrowid = meta.get("last_row_id")
            
            if results_list:
                keys = list(results_list[0].keys())
                self.description = [(k, None, None, None, None, None, None) for k in keys]
                self.results = [tuple(row[k] for k in keys) for row in results_list]
            else:
                aliases = parse_aliases(sql)
                if aliases:
                    self.description = [(alias, None, None, None, None, None, None) for alias in aliases]
                else:
                    self.description = []
                self.results = []

            # Cache successful table info queries
            if sql_upper.startswith("PRAGMA MAIN.TABLE_INFO"):
                _pragma_cache[sql] = {
                    "rowcount": self.rowcount,
                    "lastrowid": self.lastrowid,
                    "results": self.results,
                    "description": self.description
                }
        except Exception as e:
            logger.error(f"Error executing remote query on Cloudflare D1: {str(e)}")
            raise e
            
        self._idx = 0
        return self

    def fetchone(self):
        if self._idx < len(self.results):
            row = self.results[self._idx]
            self._idx += 1
            return row
        return None

    def fetchall(self):
        rows = self.results[self._idx:]
        self._idx = len(self.results)
        return rows

    def close(self):
        pass

class D1Connection:
    def __init__(self, account_id, database_id, token, email=None):
        self.account_id = account_id
        self.database_id = database_id
        self.token = token
        self.email = email

    def cursor(self):
        return D1Cursor(self)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass

    # Mock sqlite3-specific connection features required by SQLAlchemy sqlite dialect
    def create_function(self, name, num_params, func, *args, **kwargs):
        pass
        
    def create_collation(self, name, func):
        pass


# Check if force local database is enabled - allow override in testing or CI environments
import sys

def read_secret_file(name: str) -> Optional[str]:
    for path in [name, f"/app/{name}"]:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    return f.read().strip()
            except Exception:
                pass
    return None

force_local_val = os.getenv("FORCE_LOCAL_DB") or read_secret_file("FORCE_LOCAL_DB")
if force_local_val is not None:
    force_local = force_local_val.lower() in ("true", "1")
else:
    force_local = settings.FORCE_LOCAL_DB or "pytest" in sys.modules or os.getenv("GITHUB_ACTIONS") == "true"

token = (
    settings.CLOUDFLARE_API_TOKEN
    or os.getenv("CLOUDFLARE_API_TOKEN")
    or os.getenv("CF_API_TOKEN")
    or os.getenv("CF_TOKEN")
    or read_secret_file("CLOUDFLARE_API_TOKEN")
)
account_id = (
    settings.CLOUDFLARE_ACCOUNT_ID
    or os.getenv("CLOUDFLARE_ACCOUNT_ID")
    or read_secret_file("CLOUDFLARE_ACCOUNT_ID")
)
database_id = (
    settings.CLOUDFLARE_DATABASE_ID
    or os.getenv("CLOUDFLARE_DATABASE_ID")
    or read_secret_file("CLOUDFLARE_DATABASE_ID")
)

# If token is empty in settings, try reading it from the user's active wrangler session
if not token:
    appdata = os.getenv("APPDATA")
    if appdata:
        toml_path = os.path.join(appdata, "xdg.config", ".wrangler", "config", "default.toml")
        if os.path.exists(toml_path):
            try:
                with open(toml_path, "rb") as f:
                    toml_data = tomllib.load(f)
                    token = toml_data.get("oauth_token")
                    logger.info("Successfully loaded Cloudflare OAuth token from active wrangler session.")
            except Exception as e:
                logger.warning(f"Could not load wrangler OAuth config from {toml_path}: {str(e)}")

# If wrangler-account has account details, load account ID and name dynamically
cloudflare_email = "Sunil.cyrixrjbemp@gmail.com"
if os.path.exists(".wrangler/cache/wrangler-account.json"):
    try:
        with open(".wrangler/cache/wrangler-account.json", "r") as f:
            acc_data = json.load(f)
            account_id = acc_data.get("account", {}).get("id", account_id)
            acc_name = acc_data.get("account", {}).get("name", "")
            if acc_name and "'s" in acc_name:
                cloudflare_email = acc_name.split("'s")[0].strip()
            elif acc_name and "@" in acc_name:
                cloudflare_email = acc_name.strip()
    except Exception as e:
        logger.warning(f"Error reading wrangler-account cache: {str(e)}")

# Strictly connect to Cloudflare D1 Remote Database (No local fallback allowed in prod)
if (token and account_id and database_id) and not force_local:
    logger.info(f"Connecting to Cloudflare D1 Remote Database: {database_id} using account: {account_id}")
    creator_func = lambda: D1Connection(account_id, database_id, token, cloudflare_email)
    engine = create_engine(
        "sqlite://",
        creator=creator_func,
        poolclass=NullPool,
        echo=settings.DEBUG
    )
elif force_local or (not token and not account_id and not database_id and os.getenv("GITHUB_ACTIONS") == "true"):
    logger.info("Using local SQLite database fallback (test or CI mode).")
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
        echo=settings.DEBUG
    )
else:
    missing = []
    if not token:
        missing.append("CLOUDFLARE_API_TOKEN")
    if not account_id:
        missing.append("CLOUDFLARE_ACCOUNT_ID")
    if not database_id:
        missing.append("CLOUDFLARE_DATABASE_ID")
    raise RuntimeError(
        f"Cloudflare D1 Connection Error: Missing required credentials ({', '.join(missing)}). "
        "Please add these environment variables in your Render Dashboard settings."
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Global event listeners to enforce IST for created_at and updated_at on all models
from sqlalchemy import event
from sqlalchemy.orm import Mapper
from datetime import datetime, timedelta, timezone

def get_ist_now():
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).replace(tzinfo=None)

@event.listens_for(Mapper, "before_insert")
def set_created_at(mapper, connection, target):
    if hasattr(target, "created_at"):
        target.created_at = get_ist_now()
    if hasattr(target, "updated_at"):
        target.updated_at = get_ist_now()

@event.listens_for(Mapper, "before_update")
def set_updated_at(mapper, connection, target):
    if hasattr(target, "updated_at"):
        target.updated_at = get_ist_now()


# ─── Real-Time Cloudflare KV Cache Sync event listeners ─────────────────────────
import threading
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

_modified_tables = threading.local()

def mark_table_modified(table_name: str):
    if not table_name:
        return
    table_name = table_name.strip('"`[]').lower()
    if table_name in ("db_op_logs", "sqlite_sequence", "sqlite_schema", "sqlite_master"):
        return
    if not hasattr(_modified_tables, "items"):
        _modified_tables.items = set()
    _modified_tables.items.add(table_name)

@event.listens_for(Mapper, "after_insert")
def orm_after_insert(mapper, connection, target):
    try:
        table_name = mapper.mapped_table.name
        mark_table_modified(table_name)
    except Exception:
        pass

@event.listens_for(Mapper, "after_update")
def orm_after_update(mapper, connection, target):
    try:
        table_name = mapper.mapped_table.name
        mark_table_modified(table_name)
    except Exception:
        pass

@event.listens_for(Mapper, "after_delete")
def orm_after_delete(mapper, connection, target):
    try:
        table_name = mapper.mapped_table.name
        mark_table_modified(table_name)
    except Exception:
        pass

@event.listens_for(Engine, "after_execute")
def engine_after_execute(conn, clauseelement, multiparams, params, execution_options, result):
    try:
        stmt = str(clauseelement).lower()
        if any(kw in stmt for kw in ["insert", "update", "delete", "drop", "create", "alter"]):
            target_tables = [
                "allowance_master", "main_hospitals", "asset_value_master",
                "critical_equipment", "facility_details", "di_name_list",
                "rj_penalties", "assets_inventory_v2", "assets_inventory"
            ]
            for t in target_tables:
                if t.lower() in stmt:
                    mark_table_modified(t)
    except Exception:
        pass

@event.listens_for(Session, "after_commit")
def session_after_commit(session):
    try:
        if hasattr(_modified_tables, "items") and _modified_tables.items:
            tables_to_sync = list(_modified_tables.items)
            _modified_tables.items.clear()
            
            # Trigger sync in background thread
            from app.utils.database_sync import run_sync_in_background
            threading.Thread(target=run_sync_in_background, args=(tables_to_sync,)).start()
    except Exception as e:
        logger.warning(f"DB Sync event error: {e}")

