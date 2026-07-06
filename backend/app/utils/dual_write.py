"""
Dual-Write Replication Engine
Replays every INSERT, UPDATE, DELETE operation from Primary DB to Secondary DB
in a background thread after each successful commit.
"""
import logging
import threading
import requests
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

# Secondary DB connection details (loaded from settings)
_secondary_config = None
_repl_session = None


def _get_repl_session():
    """Get or create a persistent HTTP session for replication."""
    global _repl_session
    if _repl_session is None:
        _repl_session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=10,
            pool_maxsize=20,
            max_retries=2
        )
        _repl_session.mount("https://", adapter)
    return _repl_session


def _get_secondary_config():
    """Lazy-load secondary DB config from settings."""
    global _secondary_config
    if _secondary_config is None:
        from app.config.settings import settings
        _secondary_config = {
            "account_id": settings.SECONDARY_CLOUDFLARE_ACCOUNT_ID,
            "database_id": settings.SECONDARY_CLOUDFLARE_DATABASE_ID,
            "token": settings.SECONDARY_CLOUDFLARE_API_TOKEN,
            "email": settings.SECONDARY_CLOUDFLARE_EMAIL,
        }
    return _secondary_config


def replicate_to_secondary(sql: str, params: list = None):
    """Execute a single SQL statement on the Secondary D1 database via HTTP API."""
    config = _get_secondary_config()
    if not config["account_id"] or not config["database_id"] or not config["token"]:
        return False

    url = f"https://api.cloudflare.com/client/v4/accounts/{config['account_id']}/d1/database/{config['database_id']}/query"
    headers = {
        "Content-Type": "application/json",
    }

    # Use legacy API key format
    if config["token"].startswith("cfk_"):
        headers["X-Auth-Key"] = config["token"]
        headers["X-Auth-Email"] = config.get("email", "suniljani012@gmail.com")
    else:
        headers["Authorization"] = f"Bearer {config['token']}"

    payload = {
        "sql": sql,
        "params": params or []
    }

    session = _get_repl_session()
    try:
        response = session.post(url, headers=headers, json=payload, timeout=15)
        if response.status_code != 200:
            logger.error(f"DualWrite: HTTP {response.status_code} - {response.text[:200]}")
            return False

        res_json = response.json()
        if not res_json.get("success"):
            errors = res_json.get("errors", [])
            err_msg = errors[0].get("message") if errors else "Unknown"
            logger.error(f"DualWrite: Query failed on secondary: {err_msg}")
            return False

        return True
    except Exception as e:
        logger.error(f"DualWrite: Replication error: {e}")
        return False


def replicate_batch(statements: List[Tuple[str, list]]):
    """Replicate a batch of SQL statements to the Secondary DB.
    Each item is (sql, params). Executed sequentially in order."""
    success_count = 0
    fail_count = 0

    for sql, params in statements:
        if replicate_to_secondary(sql, params):
            success_count += 1
        else:
            fail_count += 1

    if fail_count > 0:
        logger.warning(f"DualWrite: Batch replication: {success_count} ok, {fail_count} failed")
    else:
        logger.info(f"DualWrite: Batch replication: {success_count} statements replicated successfully")


def replicate_batch_in_background(statements: List[Tuple[str, list]]):
    """Run batch replication in a background thread to avoid blocking the main request."""
    if not statements:
        return
    thread = threading.Thread(target=replicate_batch, args=(statements,), daemon=True)
    thread.start()
