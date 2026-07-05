"""
Cloudflare KV In-Memory Query Engine
Allows querying, filtering and paginating table data cached in KV directly in memory.
"""
import logging
from app.utils import cache

logger = logging.getLogger(__name__)

def get_full_table_from_kv(table_name: str) -> list:
    """
    Retrieves the full list of records for a table from Cloudflare KV.
    Combines pages for large tables, and caches the complete table in local RAM.
    """
    ram_key = f"full_table_rows:{table_name}"
    cached_full = cache._cache.get(ram_key)
    if cached_full is not None:
        return cached_full

    if not cache.IS_KV_ENABLED:
        return None

    try:
        # 1. Handle small/medium master tables (stored under a single KV key)
        small_tables = ["allowance_master", "main_hospitals", "asset_value_master", "critical_equipment", "facility_details", "di_name_list"]
        if table_name in small_tables:
            data = cache.get(f"table:{table_name}")
            if data and isinstance(data, dict) and "rows" in data:
                rows = data["rows"]
                cache._cache[ram_key] = rows
                return rows
            return None

        # 2. Handle large paginated tables (combined from multiple pages)
        if table_name in ["rj_penalties", "assets_inventory"]:
            meta_key = f"table:{table_name}:meta"
            meta = cache.get(meta_key)
            if not meta or not isinstance(meta, dict):
                return None

            total_pages = meta.get("total_pages", 0)
            if total_pages <= 0:
                return []

            all_rows = []
            for p in range(1, total_pages + 1):
                page_data = cache.get(f"table:{table_name}:page:{p}")
                if page_data and isinstance(page_data, dict) and "rows" in page_data:
                    all_rows.extend(page_data["rows"])
                else:
                    # If any page is missing, fail fast so we fall back to database
                    return None

            cache._cache[ram_key] = all_rows
            return all_rows

    except Exception as e:
        logger.warning(f"KV Query: failed to load table {table_name} from KV: {e}")
    
    return None


def query_kv_table(
    table_name: str, 
    filters: dict = None, 
    search_fields: list = None, 
    search_val: str = None, 
    order_by: str = None, 
    desc: bool = False, 
    page: int = 1, 
    page_size: int = 100
):
    """
    Filters and paginates a table from KV cache in memory.
    Returns (total_count, paginated_rows) if successful, else None.
    """
    rows = get_full_table_from_kv(table_name)
    if rows is None:
        return None

    filtered_rows = rows

    # 1. Apply exact column filters
    if filters:
        for col, val in filters.items():
            if val is not None:
                val_str = str(val).strip().lower()
                filtered_rows = [
                    r for r in filtered_rows
                    if r.get(col) is not None and str(r.get(col)).strip().lower() == val_str
                ]

    # 2. Apply text search filters
    if search_val and search_fields:
        search_val_lower = str(search_val).strip().lower()
        if search_val_lower:
            filtered_rows = [
                r for r in filtered_rows
                if any(r.get(f) is not None and search_val_lower in str(r.get(f)).lower() for f in search_fields)
            ]

    # 3. Apply sorting logic
    if order_by:
        def get_sort_key(r):
            val = r.get(order_by)
            if val is None:
                return ""
            try:
                return float(val)
            except (ValueError, TypeError):
                return str(val).lower()

        filtered_rows.sort(key=get_sort_key, reverse=desc)

    # 4. Apply pagination slice
    total_count = len(filtered_rows)
    offset = (page - 1) * page_size
    paginated_rows = filtered_rows[offset:offset + page_size]

    return total_count, paginated_rows
