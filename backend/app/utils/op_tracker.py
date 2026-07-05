"""
Operation Tracker - Thread-local per-request DB/KV operation counter.
Tracks: DB reads, DB writes, KV cache hits per HTTP request.
"""
import threading

_local = threading.local()


def start_request(user_id: str = "", user_name: str = "", role: str = "",
                  zone: str = "", district: str = "", endpoint: str = "", method: str = "GET"):
    """Initialize counters for the current request thread."""
    _local.user_id = user_id
    _local.user_name = user_name
    _local.role = role
    _local.zone = zone
    _local.district = district
    _local.endpoint = endpoint
    _local.method = method
    _local.db_reads = 0
    _local.db_writes = 0
    _local.kv_hits = 0


def inc_db_read(count: int = 1):
    try:
        _local.db_reads = getattr(_local, "db_reads", 0) + count
    except Exception:
        pass


def inc_db_write(count: int = 1):
    try:
        _local.db_writes = getattr(_local, "db_writes", 0) + count
    except Exception:
        pass


def inc_kv_hit(count: int = 1):
    try:
        _local.kv_hits = getattr(_local, "kv_hits", 0) + count
    except Exception:
        pass


def get_stats() -> dict:
    return {
        "user_id":   getattr(_local, "user_id",   ""),
        "user_name": getattr(_local, "user_name", ""),
        "role":      getattr(_local, "role",      ""),
        "zone":      getattr(_local, "zone",      ""),
        "district":  getattr(_local, "district",  ""),
        "endpoint":  getattr(_local, "endpoint",  ""),
        "method":    getattr(_local, "method",    "GET"),
        "db_reads":  getattr(_local, "db_reads",  0),
        "db_writes": getattr(_local, "db_writes", 0),
        "kv_hits":   getattr(_local, "kv_hits",   0),
    }


def clear():
    for attr in ("user_id", "user_name", "role", "zone", "district",
                 "endpoint", "method", "db_reads", "db_writes", "kv_hits"):
        try:
            delattr(_local, attr)
        except AttributeError:
            pass
