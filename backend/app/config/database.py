import os
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
            pool_connections=20,
            pool_maxsize=20,
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
force_local = os.getenv("FORCE_LOCAL_DB", "false").lower() == "true" or "pytest" in sys.modules or os.getenv("GITHUB_ACTIONS") == "true"

token = None
account_id = None
database_id = None

# Attempt to load Cloudflare token/account configuration from settings
token = settings.CLOUDFLARE_API_TOKEN
account_id = settings.CLOUDFLARE_ACCOUNT_ID
database_id = settings.CLOUDFLARE_DATABASE_ID

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
    raise RuntimeError(
        "Cloudflare D1 Connection Error: Missing required credentials (token, account ID, or database ID). "
        "Local SQLite database fallback is strictly disabled."
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
