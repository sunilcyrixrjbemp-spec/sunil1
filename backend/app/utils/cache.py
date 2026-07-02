import logging

logger = logging.getLogger(__name__)

# Global in-memory cache
_cache = {}

def get(key):
    """Retrieve item from cache."""
    # Prevent transactional user data from getting cached in local worker memory
    if any(key.startswith(prefix) for prefix in ["user_init:", "user_expenses:", "team_expenses:", "pending_approvals:"]):
        return None
    return _cache.get(key)

def set(key, value):
    """Set item in cache."""
    _cache[key] = value

def delete(key):
    """Delete a specific key from cache."""
    _cache.pop(key, None)

def clear_prefix(prefix):
    """Clear all keys starting with prefix."""
    keys_to_delete = [k for k in _cache.keys() if k.startswith(prefix)]
    for k in keys_to_delete:
        _cache.pop(k, None)
    if keys_to_delete:
        logger.info(f"Cleared cache keys matching prefix '{prefix}': {keys_to_delete}")

def clear_static_caches():
    """Clear static dropdown, facility and allowance caches."""
    _cache.pop("global_dropdowns", None)
    _cache.pop("facilities_list", None)
    _cache.pop("allowances_list", None)
    logger.info("Static caches cleared.")

def clear_user_cache(user_id):
    """Clear all cached keys related to a specific user_id."""
    # User ID can be the integer user.id or string user.user_id
    user_str = str(user_id)
    keys_to_delete = []
    for k in list(_cache.keys()):
        if f":{user_str}:" in k or k.endswith(f":{user_str}") or k.endswith(f"_{user_str}"):
            keys_to_delete.append(k)
    for k in keys_to_delete:
        _cache.pop(k, None)
    if keys_to_delete:
        logger.info(f"Cleared cache keys for user {user_id}: {keys_to_delete}")

def clear_all_transactional_caches():
    """Clear all user-specific, team-specific, and pending approvals caches."""
    keys_to_delete = []
    for k in list(_cache.keys()):
        if any(k.startswith(prefix) for prefix in ["user_init:", "user_expenses:", "team_expenses:", "pending_approvals:"]):
            keys_to_delete.append(k)
    for k in keys_to_delete:
        _cache.pop(k, None)
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
            
    # Clear specific keys in cache case-insensitively
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
        _cache.pop(k, None)
        
    if keys_to_clear:
        logger.info(f"Surgically cleared cache for user {user.user_id} and managers/approvers: {keys_to_clear}")
