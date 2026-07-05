"""
Real-time Database to Cloudflare KV Synchronization Engine
"""
import logging
from sqlalchemy import text
from app.config.database import SessionLocal
from app.utils import cache
from app.utils.kv_prefill import _store_table_all, _store_table_paged

logger = logging.getLogger(__name__)

def run_sync_in_background(tables):
    """Refreshes Cloudflare KV caches for the modified tables in a background thread."""
    logger.info(f"DB Sync: Triggered real-time KV sync for modified tables: {tables}")
    db = SessionLocal()
    try:
        for table in tables:
            table_lower = table.lower()
            if table_lower == "allowance_master":
                _store_table_all(db, "allowance_master", "table:allowance_master")
            elif table_lower == "main_hospitals":
                _store_table_all(db, "main_hospitals", "table:main_hospitals")
            elif table_lower == "asset_value_master":
                _store_table_all(db, "asset_value_master", "table:asset_value_master")
            elif table_lower == "critical_equipment":
                _store_table_all(db, "critical_equipment", "table:critical_equipment")
            elif table_lower == "facility_details":
                _store_table_all(db, "facility_details", "table:facility_details")
            elif table_lower == "di_name_list":
                _store_table_all(db, "di_name_list", "table:di_name_list")
            elif table_lower == "rj_penalties":
                _store_table_paged(db, "rj_penalties", "table:rj_penalties")
            elif table_lower in ("assets_inventory_v2", "assets_inventory"):
                # Refresh inventory pages, stats and filter caches
                try:
                    from app.api.routes.reports import ASSETS_INVENTORY_TABLE, _warm_assets_kv
                    _store_table_paged(db, ASSETS_INVENTORY_TABLE, "table:assets_inventory")
                    _warm_assets_kv(db)
                except Exception as ex:
                    logger.error(f"DB Sync: Failed to warm assets cache: {ex}")
            else:
                # If a new or other table gets updated/created
                try:
                    db.execute(text(f"SELECT 1 FROM {table} LIMIT 1")).fetchone()
                    _store_table_all(db, table, f"table:{table_lower}")
                    logger.info(f"DB Sync: Synced custom table {table} to KV.")
                except Exception:
                    # Table was dropped! Clear it from KV
                    cache.clear_prefix(f"table:{table_lower}")
                    logger.info(f"DB Sync: Custom table {table} dropped. Cleared from KV.")
        logger.info("DB Sync: KV cache sync completed successfully.")
    except Exception as e:
        logger.error(f"DB Sync: Sync failed: {e}")
    finally:
        db.close()
