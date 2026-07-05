import logging
import json
import requests
from app.config.settings import settings

logger = logging.getLogger(__name__)

# Global in-memory cache for fallback or local speedups
_cache = {}

# Cloudflare KV Config
ACCOUNT_ID = settings.CLOUDFLARE_ACCOUNT_ID
API_TOKEN = settings.CLOUDFLARE_API_TOKEN
NAMESPACE_ID = settings.CLOUDFLARE_KV_NAMESPACE_ID

# Check if KV caching is active
IS_KV_ENABLED = bool(ACCOUNT_ID and API_TOKEN and NAMESPACE_ID)

if IS_KV_ENABLED:
    logger.info(f"Cloudflare KV Caching is ENABLED using Namespace: {NAMESPACE_ID}")
else:
    logger.warning("Cloudflare KV Caching is DISABLED (missing credentials). Falling back to local in-memory cache.")

def _make_kv_url(key):
    return f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/storage/kv/namespaces/{NAMESPACE_ID}/values/{key}"

def _get_kv_headers():
    headers = {}
    if API_TOKEN.startswith("cfk_"):
        headers["X-Auth-Key"] = API_TOKEN
        headers["X-Auth-Email"] = "Sunil.cyrixrjbemp@gmail.com"
    else:
        headers["Authorization"] = f"Bearer {API_TOKEN}"
    return headers

def _list_kv_keys(prefix):
    """List keys in Cloudflare KV matching prefix."""
    if not IS_KV_ENABLED:
        return []
    try:
        url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/storage/kv/namespaces/{NAMESPACE_ID}/keys?prefix={prefix}"
        headers = _get_kv_headers()
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            res_json = res.json()
            if res_json.get("success"):
                return [item.get("name") for item in res_json.get("result", [])]
            else:
                logger.error(f"Cloudflare KV LIST keys API returned success=False: {res.text}")
        else:
            logger.error(f"Cloudflare KV LIST keys failed: {res.status_code} - {res.text}")
    except Exception as e:
        logger.error(f"Error listing from Cloudflare KV: {str(e)}")
    return []

def _bulk_delete_kv_keys(keys):
    """Delete multiple keys in bulk from Cloudflare KV."""
    if not IS_KV_ENABLED or not keys:
        return
    try:
        batch_size = 1000
        for i in range(0, len(keys), batch_size):
            batch = keys[i:i+batch_size]
            url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/storage/kv/namespaces/{NAMESPACE_ID}/bulk/delete"
            headers = _get_kv_headers()
            headers["Content-Type"] = "application/json"
            res = requests.post(url, headers=headers, json=batch, timeout=10)
            if res.status_code != 200:
                logger.error(f"Cloudflare KV bulk delete failed: {res.status_code} - {res.text}")
            else:
                logger.info(f"Successfully bulk deleted {len(batch)} keys from Cloudflare KV.")
    except Exception as e:
        logger.error(f"Error performing bulk delete on Cloudflare KV: {str(e)}")

def get(key):
    """Retrieve item from cache."""
    # Check if key is transactional
    is_transactional = any(key.startswith(prefix) for prefix in ["user_init:", "user_expenses:", "team_expenses:", "pending_approvals:"])
    
    # 1. Try local RAM cache first (only for non-transactional data to prevent multi-instance mismatch)
    if not is_transactional:
        if key in _cache:
            return _cache[key]
            
    # 2. Try Cloudflare KV if enabled
    if IS_KV_ENABLED:
        try:
            url = _make_kv_url(key)
            headers = _get_kv_headers()
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code == 200:
                try:
                    val = json.loads(res.text)
                except Exception:
                    # Fallback for plain strings if json.loads fails
                    val = res.text
                
                # Store in RAM cache to avoid constant HTTP calls (only for non-transactional)
                if not is_transactional:
                    _cache[key] = val
                return val
            elif res.status_code == 404:
                return None
            else:
                logger.error(f"Cloudflare KV GET failed: {res.status_code} - {res.text}")
        except Exception as e:
            logger.error(f"Error reading from Cloudflare KV: {str(e)}")
            
    # 3. Fallback to RAM cache for transactional keys ONLY if KV is not enabled (development fallback)
    if is_transactional and not IS_KV_ENABLED:
        return _cache.get(key)
        
    return None

def set(key, value, ttl=None):
    """Set item in cache."""
    is_transactional = any(key.startswith(prefix) for prefix in ["user_init:", "user_expenses:", "team_expenses:", "pending_approvals:"])
    
    # 1. Save in local RAM (only if not transactional OR if KV is disabled as a fallback)
    if not is_transactional or not IS_KV_ENABLED:
        _cache[key] = value
        
    # 2. Save in Cloudflare KV
    if IS_KV_ENABLED:
        try:
            url = _make_kv_url(key)
            # Default TTL is 24 hours (86,400 seconds) if not specified
            if ttl is None:
                ttl = 86400
                
            if ttl is not None:
                if ttl < 60:
                    ttl = 60
                url += f"?expiration_ttl={int(ttl)}"
                
            headers = _get_kv_headers()
            headers["Content-Type"] = "application/json"
            
            payload = json.dumps(value)
            res = requests.put(url, headers=headers, data=payload, timeout=5)
            if res.status_code != 200:
                logger.error(f"Cloudflare KV PUT failed: {res.status_code} - {res.text}")
        except Exception as e:
            logger.error(f"Error writing to Cloudflare KV: {str(e)}")

def delete(key):
    """Delete a specific key from cache."""
    # Delete from RAM
    _cache.pop(key, None)
    
    # Delete from KV
    if IS_KV_ENABLED:
        try:
            url = _make_kv_url(key)
            headers = _get_kv_headers()
            res = requests.delete(url, headers=headers, timeout=5)
            if res.status_code not in [200, 404]:
                logger.error(f"Cloudflare KV DELETE failed: {res.status_code} - {res.text}")
        except Exception as e:
            logger.error(f"Error deleting from Cloudflare KV: {str(e)}")

def clear_prefix(prefix):
    """Clear all keys starting with prefix."""
    # Clear matching keys from local RAM
    keys_to_delete = [k for k in _cache.keys() if k.startswith(prefix)]
    for k in keys_to_delete:
        _cache.pop(k, None)
        
    # Clear matching keys from Cloudflare KV
    if IS_KV_ENABLED:
        kv_keys = _list_kv_keys(prefix)
        if kv_keys:
            _bulk_delete_kv_keys(kv_keys)
            
    if keys_to_delete:
        logger.info(f"Cleared local cache keys matching prefix '{prefix}': {keys_to_delete}")

def clear_static_caches():
    """Clear static dropdown, facility and allowance caches."""
    _cache.pop("global_dropdowns", None)
    _cache.pop("facilities_list", None)
    _cache.pop("allowances_list", None)
    
    delete("global_dropdowns")
    delete("facilities_list")
    delete("allowances_list")
    logger.info("Static caches cleared.")

def clear_user_cache(user_id):
    """Clear all cached keys related to a specific user_id."""
    user_str = str(user_id)
    keys_to_delete = []
    
    # Check RAM cache
    for k in list(_cache.keys()):
        if f":{user_str}:" in k or k.endswith(f":{user_str}") or k.endswith(f"_{user_str}"):
            keys_to_delete.append(k)
            
    for k in keys_to_delete:
        delete(k)
        
    # Check KV cache (listing keys for the user and deleting them)
    if IS_KV_ENABLED:
        for prefix in ["user_init:", "user_expenses:", "team_expenses:", "pending_approvals:"]:
            kv_keys = _list_kv_keys(prefix)
            user_kv_keys = []
            for k in kv_keys:
                if f":{user_str}:" in k or k.endswith(f":{user_str}") or k.endswith(f"_{user_str}"):
                    user_kv_keys.append(k)
            if user_kv_keys:
                _bulk_delete_kv_keys(user_kv_keys)

def clear_all_transactional_caches():
    """Clear all user-specific, team-specific, and pending approvals caches."""
    keys_to_delete = []
    for k in list(_cache.keys()):
        if any(k.startswith(prefix) for prefix in ["user_init:", "user_expenses:", "team_expenses:", "pending_approvals:"]):
            keys_to_delete.append(k)
    for k in keys_to_delete:
        _cache.pop(k, None)
        
    # Clear matching keys from Cloudflare KV
    if IS_KV_ENABLED:
        for prefix in ["user_init:", "user_expenses:", "team_expenses:", "pending_approvals:"]:
            kv_keys = _list_kv_keys(prefix)
            if kv_keys:
                _bulk_delete_kv_keys(kv_keys)
                
    if keys_to_delete:
        logger.info(f"Cleared transactional caches: {keys_to_delete}")

def clear_user_and_managers_cache(db, user_id_val):
    """Surgically clear transactional caches for a user and their manager hierarchy to prevent global cache invalidation."""
    from app.models.user import User
    from app.models.approval_hierarchy import HierarchyRequester, HierarchyApprover
    
    user = None
    if isinstance(user_id_val, int):
        user = db.query(User).filter(User.id == user_id_val).first()
    else:
        user = db.query(User).filter(User.user_id == user_id_val).first()
        
    if not user:
        return
        
    uid_str = str(user.id)
    uuid_str = str(user.user_id)
    
    affected_ids = {uid_str, uuid_str, "Admin"}
    
    # 1. Managers & Coordinators
    for mgr in [user.manager, user.zonal_manager, user.coordinator]:
        if mgr and mgr.strip():
            mgr_clean = mgr.strip()
            mgr_user = db.query(User).filter(
                (User.user_id == mgr_clean) | (User.name == mgr_clean) | (User.e_code == mgr_clean)
            ).first()
            if mgr_user:
                affected_ids.add(mgr_user.user_id)
                
    # 2. Hierarchy Approvers
    req_map = db.query(HierarchyRequester.hierarchy_id).filter(HierarchyRequester.user_id == user.id).first()
    if req_map:
        h_id = req_map.hierarchy_id
        approvers = db.query(User).join(
            HierarchyApprover, User.id == HierarchyApprover.approver_id
        ).filter(HierarchyApprover.hierarchy_id == h_id).all()
        for app_usr in approvers:
            affected_ids.add(app_usr.user_id)
            
    # Clear specific keys in local RAM cache and KV case-insensitively
    keys_to_clear = []
    for k in list(_cache.keys()):
        for affected_id in affected_ids:
            aff_lower = affected_id.lower()
            k_lower = k.lower()
            if (k_lower.startswith("user_init:") and f":{aff_lower}:" in k_lower) or \
               k_lower == f"user_expenses:{aff_lower}" or \
               k_lower == f"team_expenses:{aff_lower}" or \
               k_lower == f"pending_approvals:{aff_lower}":
                keys_to_clear.append(k)
                break
                
    for k in keys_to_clear:
        delete(k)
        
    # Surgically delete known keys from Cloudflare KV directly
    if IS_KV_ENABLED:
        for affected_id in affected_ids:
            # Delete direct keys
            delete(f"user_expenses:{affected_id}")
            delete(f"team_expenses:{affected_id}")
            delete(f"pending_approvals:{affected_id}")
            
            # List user_init keys for this user and delete them
            user_init_keys = _list_kv_keys(f"user_init:{affected_id}:")
            if user_init_keys:
                _bulk_delete_kv_keys(user_init_keys)
                
    logger.info(f"Surgically cleared cache for user {user.user_id} and managers/approvers (RAM & KV).")
