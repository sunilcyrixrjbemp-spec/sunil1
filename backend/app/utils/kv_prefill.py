"""
KV Prefill Engine - Full Database Mirror in Cloudflare KV

When admin logs in, this module fetches ALL data from ALL important tables
and stores it directly in Cloudflare KV. After this, every user request
is served from KV — zero database reads.

Tables pre-filled:
  - allowance_master      (small, single key)
  - facility_details      (medium, single key)
  - di_name_list          (medium, single key)
  - asset_value_master    (medium, single key)
  - critical_equipment    (medium, single key)
  - main_hospitals        (small, single key)
  - rj_penalties          (large, chunked by pages)
  - assets_inventory_v2   (large, chunked by pages)
  - assets_filters        (small, single key)
  - assets_stats          (small, single key)
  - global_dropdowns      (small, single key)
"""

import logging
from sqlalchemy import text
from app.utils import cache

logger = logging.getLogger(__name__)

KV_PAGE_SIZE = 500  # rows per KV page for large tables


def _rows_to_dicts(rows, keys):
    """Convert SQLAlchemy raw rows to list of dicts using column keys."""
    if not rows:
        return []
    return [dict(zip(keys, r)) for r in rows]


def _store_table_all(db, table_name: str, kv_key: str, order_by: str = "rowid"):
    """Fetch ALL rows of a small/medium table and store in a single KV key."""
    try:
        result = db.execute(text(f"SELECT * FROM {table_name} ORDER BY {order_by}"))
        keys = list(result.keys())
        rows = result.fetchall()
        data = _rows_to_dicts(rows, keys)
        cache.set(kv_key, {"success": True, "rows": data, "count": len(data)})
        logger.info(f"KV Prefill: {table_name} → {kv_key} ({len(data)} rows)")
        return len(data)
    except Exception as e:
        logger.warning(f"KV Prefill: {table_name} failed: {e}")
        return 0


def _store_table_paged(db, table_name: str, key_prefix: str, order_by: str = "rowid"):
    """Fetch ALL rows of a large table in pages and store each page in its own KV key."""
    try:
        total = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar() or 0
        pages = (total + KV_PAGE_SIZE - 1) // KV_PAGE_SIZE
        logger.info(f"KV Prefill: {table_name} → {pages} pages of {KV_PAGE_SIZE} rows each (total {total})")

        for page in range(1, pages + 1):
            offset = (page - 1) * KV_PAGE_SIZE
            result = db.execute(
                text(f"SELECT * FROM {table_name} ORDER BY {order_by} LIMIT :lim OFFSET :off"),
                {"lim": KV_PAGE_SIZE, "off": offset}
            )
            keys = list(result.keys())
            rows = result.fetchall()
            data = _rows_to_dicts(rows, keys)
            kv_key = f"{key_prefix}:page:{page}"
            cache.set(kv_key, {
                "success": True,
                "total": total,
                "page": page,
                "total_pages": pages,
                "page_size": KV_PAGE_SIZE,
                "rows": data
            })

        # Store meta key with total and page info
        cache.set(f"{key_prefix}:meta", {
            "success": True,
            "total": total,
            "total_pages": pages,
            "page_size": KV_PAGE_SIZE
        })
        logger.info(f"KV Prefill: {table_name} complete — {total} rows, {pages} pages.")
        return total
    except Exception as e:
        logger.warning(f"KV Prefill: {table_name} paged failed: {e}")
        return 0


def prefill_all_kv(db):
    """
    Main function: pre-fill ALL important table data into Cloudflare KV.
    Called as a background task when admin logs in.
    """
    if not cache.IS_KV_ENABLED:
        logger.warning("KV Prefill: KV is not enabled. Skipping prefill.")
        return

    logger.info("KV Prefill: Starting full database mirror to Cloudflare KV...")
    total_rows = 0

    # ─── Small/Medium tables (single KV key each) ─────────────────────────────

    total_rows += _store_table_all(db, "allowance_master",    "table:allowance_master",   order_by="rowid")
    total_rows += _store_table_all(db, "main_hospitals",      "table:main_hospitals",     order_by="rowid")
    total_rows += _store_table_all(db, "asset_value_master",  "table:asset_value_master", order_by="rowid")
    total_rows += _store_table_all(db, "critical_equipment",  "table:critical_equipment", order_by="rowid")

    # facility_details & di_name_list — medium size, stored whole
    total_rows += _store_table_all(db, "facility_details", "table:facility_details", order_by="rowid")
    total_rows += _store_table_all(db, "di_name_list",     "table:di_name_list",     order_by="rowid")

    # ─── Large tables (paged KV keys) ─────────────────────────────────────────

    # Check if rj_penalties table exists
    try:
        db.execute(text("SELECT 1 FROM rj_penalties LIMIT 1")).fetchone()
        total_rows += _store_table_paged(db, "rj_penalties",        "table:rj_penalties")
    except Exception:
        logger.info("KV Prefill: rj_penalties table not found, skipping.")

    # Check if assets_inventory_v2 table exists
    try:
        from app.api.routes.reports import ASSETS_INVENTORY_TABLE
        db.execute(text(f"SELECT 1 FROM {ASSETS_INVENTORY_TABLE} LIMIT 1")).fetchone()
        total_rows += _store_table_paged(db, ASSETS_INVENTORY_TABLE, "table:assets_inventory")
    except Exception:
        logger.info("KV Prefill: assets_inventory table not found, skipping.")

    # ─── Pre-built aggregate keys (for direct API use) ────────────────────────

    # assets_filters (single computed key)
    try:
        from app.api.routes.reports import _warm_assets_kv
        _warm_assets_kv(db)
        logger.info("KV Prefill: assets_filters + assets_stats + assets_inventory page 1 warmed.")
    except Exception as e:
        logger.warning(f"KV Prefill: _warm_assets_kv failed: {e}")

    # global_dropdowns (used by login page)
    try:
        from app.services.auth_service import AuthService, DESIGNATIONS, ZONE_DISTRICTS, ROLES
        from app.models.allowance_master import AllowanceMaster
        grades_query = db.query(AllowanceMaster.grade).distinct().all()
        grades = sorted(list(set([g[0] for g in grades_query if g[0]]))) or ["A", "B", "C", "D"]
        dropdowns = {
            "designations": DESIGNATIONS,
            "zones": ZONE_DISTRICTS,
            "roles": ROLES,
            "grades": grades
        }
        cache.set("global_dropdowns", dropdowns)
        logger.info("KV Prefill: global_dropdowns warmed.")
    except Exception as e:
        logger.warning(f"KV Prefill: global_dropdowns failed: {e}")

    logger.info(f"KV Prefill: ✅ Complete — {total_rows} total rows mirrored to Cloudflare KV.")
