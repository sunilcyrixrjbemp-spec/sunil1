from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from datetime import date, datetime

from app.config.database import get_db
from app.api.routes.dependencies import get_current_user
from app.models.user import User
from app.models.user_role import UserRole
from app.models.password_history import PasswordHistory
from app.models.approval_hierarchy import ApprovalHierarchy, HierarchyRequester, HierarchyApprover
from app.schemas.user import (
    UserResponse, UserCreateRequest, UserEditRequest,
    ApprovalHierarchyResponse, ApprovalHierarchyCreateRequest,
    HierarchyApproverSchema, HierarchyRequesterSchema,
    BulkHierarchyImportRequest, BulkHierarchyRow
)
from app.utils.security import get_password_hash

router = APIRouter()

def resolve_or_blank(val: str, db: Session) -> str:
    if not val or not val.strip():
        return ""
    val_clean = val.strip()
    existing = db.query(User).filter(
        (User.user_id.ilike(val_clean)) |
        (User.e_code.ilike(val_clean)) |
        (User.name.ilike(val_clean))
    ).first()
    if existing:
        return val_clean
    return ""

# Helper to verify requester is Admin
def verify_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only system administrators can perform this action."
        )
    return current_user

@router.get("/users", response_model=List[UserResponse])
async def get_users(db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    """Get all registered users"""
    from app.utils import cache
    cached = cache.get("admin_users_list")
    if cached is not None:
        return cached
    users = db.query(User).order_by(User.name).all()
    from fastapi.encoders import jsonable_encoder
    serialized = jsonable_encoder(users)
    cache.set("admin_users_list", serialized)
    return users

@router.post("/users", response_model=UserResponse)
async def create_user(
    request: UserCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin)
):
    """Create a single user with automatic e_code mapping to user_id"""
    e_code_clean = request.e_code.strip()
    
    # 1. Resolve manager, zonal_manager, coordinator to blank if not exist
    manager_clean = resolve_or_blank(request.manager, db)
    zonal_manager_clean = resolve_or_blank(request.zonal_manager, db)
    coordinator_clean = resolve_or_blank(request.coordinator, db)

    # 2. Check if user already exists
    existing = db.query(User).filter(User.user_id == e_code_clean).first()
    if existing:
        if request.name and request.name.strip():
            existing.name = request.name.strip()
        if request.password and request.password.strip():
            existing.hashed_password = get_password_hash(request.password)
        if request.designation and request.designation.strip():
            existing.designation = request.designation.strip()
        if request.grade and request.grade.strip():
            existing.grade = request.grade.strip()
        if request.district and request.district.strip():
            existing.district = request.district.strip()
        if request.zone and request.zone.strip():
            existing.zone = request.zone.strip()
        if manager_clean and manager_clean.strip():
            existing.manager = manager_clean
        if zonal_manager_clean and zonal_manager_clean.strip():
            existing.zonal_manager = zonal_manager_clean
        if coordinator_clean and coordinator_clean.strip():
            existing.coordinator = coordinator_clean
        if request.mobile_number and request.mobile_number.strip():
            existing.mobile_number = request.mobile_number.strip()
        if request.mail_id and request.mail_id.strip():
            existing.mail_id = request.mail_id.strip()
        if request.role and request.role.strip():
            existing.role = request.role.strip()
        if request.type and request.type.strip():
            existing.type = request.type.strip()
        if request.date_of_joining:
            existing.date_of_joining = request.date_of_joining
        if request.date_of_birth:
            existing.date_of_birth = request.date_of_birth
        if request.e_upkaran_id and request.e_upkaran_id.strip():
            existing.e_upkaran_id = request.e_upkaran_id.strip()
            
        if request.allowed_windows and request.allowed_windows.strip():
            existing.allowed_windows = request.allowed_windows.strip()
        elif request.role and request.role.strip():
            existing.allowed_windows = (
                "home,expense,help,profile" if request.role.strip().lower() == "engineer"
                else "home,approval,expense,help,profile" if request.role.strip().lower() == "manager"
                else "home,approval,expense,analysis,report,help,profile"
            )
        
        if request.password:
            pwd_hist = PasswordHistory(
                user_id=existing.id,
                hashed_password=existing.hashed_password
            )
            db.add(pwd_hist)
            
        role_entry = db.query(UserRole).filter(UserRole.user_id == existing.user_id).first()
        if role_entry:
            role_entry.role = existing.role
        else:
            role_entry = UserRole(user_id=existing.user_id, role=existing.role)
            db.add(role_entry)
            
        db.commit()
        db.refresh(existing)
        
        from app.utils import cache
        cache.delete("admin_users_list")
        cache.delete("admin_eligible_approvers_list")
        cache.clear_all_transactional_caches()
        return existing

    # 3. Create User
    hashed = get_password_hash(request.password)
    user = User(
        user_id=e_code_clean,
        e_code=e_code_clean,
        name=request.name.strip(),
        hashed_password=hashed,
        user_status="active",
        designation=request.designation,
        grade=request.grade,
        district=request.district,
        zone=request.zone,
        manager=manager_clean,
        zonal_manager=zonal_manager_clean,
        coordinator=coordinator_clean,
        mobile_number=request.mobile_number,
        mail_id=request.mail_id,
        role=request.role,
        type=request.type or "Employee",
        date_of_joining=request.date_of_joining,
        date_of_birth=request.date_of_birth,
        e_upkaran_id=request.e_upkaran_id.strip() if request.e_upkaran_id else None,
        allowed_windows=request.allowed_windows or (
            "home,expense,help,profile" if request.role.strip().lower() == "engineer"
            else "home,approval,expense,help,profile" if request.role.strip().lower() == "manager"
            else "home,approval,expense,analysis,report,help,profile"
        )
    )
    db.add(user)
    db.flush()
    
    # Add to password history
    pwd_hist = PasswordHistory(
        user_id=user.id,
        hashed_password=hashed
    )
    db.add(pwd_hist)
    
    # Add to user roles table
    role_entry = UserRole(
        user_id=user.user_id,
        role=user.role
    )
    db.add(role_entry)
    
    db.commit()
    db.refresh(user)
    
    from app.utils import cache
    cache.delete("admin_users_list")
    cache.delete("admin_eligible_approvers_list")
    cache.clear_all_transactional_caches()
    
    return user

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    request: UserEditRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin)
):
    """Update a user's details and status (Active, Locked, Disabled)"""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found."
        )

    # Check if they are trying to edit user_id, e_code, or password
    new_uid_val = request.new_user_id.strip() if request.new_user_id is not None else None
    new_ecode_val = request.new_e_code.strip() if request.new_e_code is not None else None

    is_uid_changed = new_uid_val is not None and new_uid_val != user.user_id
    is_ecode_changed = new_ecode_val is not None and new_ecode_val != user.e_code
    is_password_changed = request.password is not None and request.password.strip() != ""

    if is_uid_changed or is_ecode_changed or is_password_changed:
        # Require security password
        if not request.admin_update_password or request.admin_update_password.strip() != "012001@Sunil":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid admin security password to change User ID / Employee Code / Password."
            )
        
        # Check if new user_id is already taken
        if is_uid_changed:
            existing_uid = db.query(User).filter(User.user_id == new_uid_val).first()
            if existing_uid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"The User ID '{new_uid_val}' is already in use by another user."
                )
        
        # Check if new e_code is already taken
        if is_ecode_changed:
            existing_ecode = db.query(User).filter(User.e_code == new_ecode_val).first()
            if existing_ecode:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"The Employee Code '{new_ecode_val}' is already in use by another user."
                )

        # Apply changes safely
        old_user_id = user.user_id
        target_uid = new_uid_val if is_uid_changed else old_user_id
        target_ecode = new_ecode_val if is_ecode_changed else user.e_code

        if is_uid_changed:
            # Fetch user roles for the old user_id
            existing_roles = db.query(UserRole).filter(UserRole.user_id == old_user_id).all()
            roles_to_recreate = [(r.role, r.assigned_at) for r in existing_roles]
            
            # Delete roles for old user_id
            db.query(UserRole).filter(UserRole.user_id == old_user_id).delete()
            db.flush()
            
            # Update the user_id and e_code on the User record
            user.user_id = target_uid
            user.e_code = target_ecode
            db.flush()
            
            # Re-insert roles with new user_id
            for r_name, r_assigned in roles_to_recreate:
                db.add(UserRole(user_id=target_uid, role=r_name, assigned_at=r_assigned))
            db.flush()
            
            # Cascade updates on other tables without FKs using SQL
            from sqlalchemy import text
            db.execute(text("UPDATE notifications SET user_id = :new_uid WHERE user_id = :old_uid"), {"new_uid": target_uid, "old_uid": old_user_id})
            db.execute(text("UPDATE limit_approval_requests SET user_id = :new_uid WHERE user_id = :old_uid"), {"new_uid": target_uid, "old_uid": old_user_id})
            db.execute(text("UPDATE limit_approval_requests SET manager_id = :new_uid WHERE manager_id = :old_uid"), {"new_uid": target_uid, "old_uid": old_user_id})
        else:
            # Only e_code changed
            user.e_code = target_ecode
            db.flush()

        if is_password_changed:
            user.hashed_password = get_password_hash(request.password.strip())
            # Add to password history
            pwd_hist = PasswordHistory(
                user_id=user.id,
                hashed_password=user.hashed_password
            )
            db.add(pwd_hist)
            db.flush()
        
    # Update other fields if provided
    if request.name is not None:
        new_name = request.name.strip()
        if new_name != user.name:
            old_name = user.name
            user.name = new_name
            # Cascade name changes to other users' string mappings
            db.query(User).filter(User.manager == old_name).update({User.manager: new_name}, synchronize_session=False)
            db.query(User).filter(User.zonal_manager == old_name).update({User.zonal_manager: new_name}, synchronize_session=False)
            db.query(User).filter(User.coordinator == old_name).update({User.coordinator: new_name}, synchronize_session=False)
    if request.designation is not None:
        user.designation = request.designation
    if request.grade is not None:
        user.grade = request.grade
    if request.district is not None:
        user.district = request.district
    if request.zone is not None:
        user.zone = request.zone
    if request.manager is not None:
        user.manager = request.manager
    if request.zonal_manager is not None:
        user.zonal_manager = request.zonal_manager
    if request.coordinator is not None:
        user.coordinator = request.coordinator
    if request.mobile_number is not None:
        user.mobile_number = request.mobile_number
    if request.mail_id is not None:
        user.mail_id = request.mail_id
    if request.type is not None:
        user.type = request.type
    if request.date_of_joining is not None:
        user.date_of_joining = request.date_of_joining
    if request.date_of_birth is not None:
        user.date_of_birth = request.date_of_birth
    if request.e_upkaran_id is not None:
        user.e_upkaran_id = request.e_upkaran_id.strip()
    if request.allowed_windows is not None:
        user.allowed_windows = request.allowed_windows
        
    if request.user_status is not None:
        status_clean = request.user_status.strip().lower()
        if status_clean not in ["active", "locked", "disabled"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status must be either 'active', 'locked', or 'disabled'."
            )
        user.user_status = status_clean
        # Reset failed attempts if unlocked
        if status_clean == "active":
            user.failed_attempt = 0
            
    if request.role is not None:
        old_role = user.role
        user.role = request.role
        
        # Sync roles table
        if old_role != request.role:
            db.query(UserRole).filter(UserRole.user_id == user.user_id, UserRole.role == old_role).delete()
            # Insert new role if it doesn't already exist
            existing_role = db.query(UserRole).filter(UserRole.user_id == user.user_id, UserRole.role == request.role).first()
            if not existing_role:
                db.add(UserRole(user_id=user.user_id, role=request.role))
                
    db.commit()
    db.refresh(user)
    
    from app.utils import cache
    cache.delete("admin_users_list")
    cache.delete("admin_eligible_approvers_list")
    cache.delete(f"auth_user:{user.user_id}")
    cache.clear_all_transactional_caches()
    
    return user

@router.post("/users/bulk")
async def bulk_create_users(
    payload: List[dict],
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin)
):
    """Bulk create users from JSON payload with in-memory lookup optimization, duplicate check, and per-row error skipping"""
    # Pre-fetch all users to build in-memory maps to optimize database queries
    all_users = db.query(User).all()
    user_map = {u.user_id: u for u in all_users}
    
    # Track user_id, e_code, and name values that are valid for resolve_or_blank
    user_ids = {u.user_id.lower() for u in all_users}
    e_codes = {u.e_code.lower() for u in all_users if u.e_code}
    names = {u.name.strip().lower() for u in all_users}
    
    # Track new users created in this batch in memory
    batch_created_user_ids = set()
    batch_created_names = set()
    
    # Build a lookup for existing roles
    user_roles_map = {r.user_id: r for r in db.query(UserRole).all()}
    
    created_count = 0
    errors = []
    
    def resolve_or_blank_opt(val: str) -> str:
        if not val or not val.strip():
            return ""
        val_clean = val.strip().lower()
        if (val_clean in user_ids or 
            val_clean in e_codes or 
            val_clean in names or 
            val_clean in batch_created_user_ids or 
            val_clean in batch_created_names):
            return val.strip()
        return ""

    def try_parse_date(val) -> Optional[date]:
        if not val:
            return None
        val_str = str(val).strip()
        if not val_str or val_str.lower() in ("none", "null", ""):
            return None
        
        # Strip timestamp part if present (e.g. 2020-05-15T00:00:00)
        if "t" in val_str.lower():
            val_str = val_str.lower().split("t")[0]
        if " " in val_str:
            val_str = val_str.split(" ")[0]
            
        formats = [
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y/%m/%d",
            "%d-%b-%Y",
            "%d-%b-%y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(val_str, fmt).date()
            except ValueError:
                continue
        return None

    for index, item in enumerate(payload):
        e_code_clean = str(item.get("e_code", "")).strip()
        if not e_code_clean:
            errors.append(f"Row {index + 1}: Missing Employee Code. Skipped.")
            continue
            
        existing = user_map.get(e_code_clean)
        
        # If new user, validate name and other mandatory fields
        name_clean = str(item.get("name", "")).strip()
        if not existing:
            if not name_clean:
                errors.append(f"Row {index + 1} ({e_code_clean}): Missing Name. Skipped.")
                continue
            mandatory_fields = [
                ("role", "Role"),
                ("designation", "Designation"),
                ("grade", "Grade"),
                ("district", "District"),
                ("zone", "Zone"),
                ("mobile_number", "Mobile Number"),
                ("mail_id", "Email Address"),
                ("password", "Password")
            ]
            missing = [label for key, label in mandatory_fields if not str(item.get(key, "")).strip()]
            if missing:
                errors.append(f"Row {index + 1} ({e_code_clean}): Missing mandatory columns: {', '.join(missing)}. Skipped.")
                continue

        # Try parsing dates
        doj_raw = item.get("date_of_joining")
        dob_raw = item.get("date_of_birth")
        
        doj = None
        dob = None
        
        if doj_raw:
            doj = try_parse_date(doj_raw)
            if not doj:
                errors.append(f"Row {index + 1} ({e_code_clean}): Invalid date_of_joining format '{doj_raw}'. Skipped.")
                continue
        elif not existing:
            errors.append(f"Row {index + 1} ({e_code_clean}): Date of Joining is required for new user. Skipped.")
            continue
            
        if dob_raw:
            dob = try_parse_date(dob_raw)
            if not dob:
                errors.append(f"Row {index + 1} ({e_code_clean}): Invalid date_of_birth format '{dob_raw}'. Skipped.")
                continue
        elif not existing:
            errors.append(f"Row {index + 1} ({e_code_clean}): Date of Birth is required for new user. Skipped.")
            continue
            
        if existing:
            try:
                # Resolve manager, zonal_manager, coordinator using optimized in-memory logic
                manager_clean = resolve_or_blank_opt(str(item.get("manager", "")))
                zonal_manager_clean = resolve_or_blank_opt(str(item.get("zonal_manager", "")))
                coordinator_clean = resolve_or_blank_opt(str(item.get("coordinator", "")))
                
                # Check if anything changed (excluding name and e_code)
                has_changed = False
                
                pwd_raw = str(item.get("password", "")).strip()
                desig_raw = str(item.get("designation", "")).strip()
                grade_raw = str(item.get("grade", "")).strip()
                dist_raw = str(item.get("district", "")).strip()
                zone_raw = str(item.get("zone", "")).strip()
                mobile_raw = str(item.get("mobile_number", "")).strip()
                mail_raw = str(item.get("mail_id", "")).strip()
                role_raw = str(item.get("role", "")).strip()
                type_raw = str(item.get("type", "")).strip()
                upk_raw = str(item.get("e_upkaran_id", "")).strip()
                win_raw = str(item.get("allowed_windows", "")).strip()
                
                if pwd_raw:
                    has_changed = True
                if desig_raw and desig_raw != (existing.designation or "").strip():
                    has_changed = True
                if grade_raw and grade_raw != (existing.grade or "").strip():
                    has_changed = True
                if dist_raw and dist_raw != (existing.district or "").strip():
                    has_changed = True
                if zone_raw and zone_raw != (existing.zone or "").strip():
                    has_changed = True
                if manager_clean != (existing.manager or ""):
                    has_changed = True
                if zonal_manager_clean != (existing.zonal_manager or ""):
                    has_changed = True
                if coordinator_clean != (existing.coordinator or ""):
                    has_changed = True
                if mobile_raw and mobile_raw != (existing.mobile_number or "").strip():
                    has_changed = True
                if mail_raw and mail_raw != (existing.mail_id or "").strip():
                    has_changed = True
                if role_raw and role_raw != (existing.role or "").strip():
                    has_changed = True
                if type_raw and type_raw != (existing.type or "").strip():
                    has_changed = True
                if doj and doj != existing.date_of_joining:
                    has_changed = True
                if dob and dob != existing.date_of_birth:
                    has_changed = True
                if upk_raw and upk_raw != (existing.e_upkaran_id or "").strip():
                    has_changed = True
                if win_raw and win_raw != (existing.allowed_windows or "").strip():
                    has_changed = True
                    
                if has_changed:
                    if pwd_raw:
                        existing.hashed_password = get_password_hash(pwd_raw)
                        pwd_hist = PasswordHistory(
                            user_id=existing.id,
                            hashed_password=existing.hashed_password
                        )
                        db.add(pwd_hist)
                    if desig_raw:
                        existing.designation = desig_raw
                    if grade_raw:
                        existing.grade = grade_raw
                    if dist_raw:
                        existing.district = dist_raw
                    if zone_raw:
                        existing.zone = zone_raw
                    existing.manager = manager_clean
                    existing.zonal_manager = zonal_manager_clean
                    existing.coordinator = coordinator_clean
                    if mobile_raw:
                        existing.mobile_number = mobile_raw
                    if mail_raw:
                        existing.mail_id = mail_raw
                    
                    old_role = existing.role
                    if role_raw:
                        existing.role = role_raw
                    if type_raw:
                        existing.type = type_raw
                    if doj:
                        existing.date_of_joining = doj
                    if dob:
                        existing.date_of_birth = dob
                    if upk_raw:
                        existing.e_upkaran_id = upk_raw
                    if win_raw:
                        existing.allowed_windows = win_raw
                    elif role_raw:
                        existing.allowed_windows = (
                            "home,expense,help,profile" if role_raw.lower() == "engineer"
                            else "home,approval,expense,help,profile" if role_raw.lower() == "manager"
                            else "home,approval,expense,analysis,report,help,profile"
                        )
                    
                    # Sync roles table using in-memory map
                    if old_role != existing.role:
                        role_entry = user_roles_map.get(existing.user_id)
                        if role_entry:
                            role_entry.role = existing.role
                        else:
                            role_entry = UserRole(user_id=existing.user_id, role=existing.role)
                            db.add(role_entry)
                            user_roles_map[existing.user_id] = role_entry
                    
                    created_count += 1
            except Exception as ex:
                errors.append(f"Row {index + 1} ({e_code_clean}): Failed to update due to {str(ex)}")
            continue
            
        try:
            pwd_raw = str(item.get("password", "")).strip()
            hashed = get_password_hash(pwd_raw)
            manager_clean = resolve_or_blank_opt(str(item.get("manager", "")))
            zonal_manager_clean = resolve_or_blank_opt(str(item.get("zonal_manager", "")))
            coordinator_clean = resolve_or_blank_opt(str(item.get("coordinator", "")))
            
            role_raw = str(item.get("role", "")).strip()
            type_raw = str(item.get("type", "Employee")).strip()
            upk_raw = str(item.get("e_upkaran_id", "")).strip()
            win_raw = str(item.get("allowed_windows", "")).strip()
            
            user = User(
                user_id=e_code_clean,
                e_code=e_code_clean,
                name=name_clean,
                hashed_password=hashed,
                user_status="active",
                designation=str(item.get("designation", "")).strip(),
                grade=str(item.get("grade", "")).strip(),
                district=str(item.get("district", "")).strip(),
                zone=str(item.get("zone", "")).strip(),
                manager=manager_clean,
                zonal_manager=zonal_manager_clean,
                coordinator=coordinator_clean,
                mobile_number=str(item.get("mobile_number", "")).strip(),
                mail_id=str(item.get("mail_id", "")).strip(),
                role=role_raw,
                type=type_raw,
                date_of_joining=doj,
                date_of_birth=dob,
                e_upkaran_id=upk_raw if upk_raw else None,
                allowed_windows=win_raw or (
                    "home,expense,help,profile" if role_raw.lower() == "engineer"
                    else "home,approval,expense,help,profile" if role_raw.lower() == "manager"
                    else "home,approval,expense,analysis,report,help,profile"
                )
            )
            db.add(user)
            db.flush()
            
            # Update preloaded maps so subsequent rows can link to this newly created user!
            user_ids.add(e_code_clean.lower())
            e_codes.add(e_code_clean.lower())
            names.add(name_clean.lower())
            batch_created_user_ids.add(e_code_clean.lower())
            batch_created_names.add(name_clean.lower())
            
            pwd_hist = PasswordHistory(
                user_id=user.id,
                hashed_password=hashed
            )
            db.add(pwd_hist)
            
            role_entry = UserRole(
                user_id=user.user_id,
                role=user.role
            )
            db.add(role_entry)
            user_roles_map[user.user_id] = role_entry
            created_count += 1
        except Exception as ex:
            errors.append(f"Row {index + 1} ({e_code_clean}): Failed to create due to {str(ex)}")
            
    db.commit()
    
    from app.utils import cache
    cache.delete("admin_users_list")
    cache.delete("admin_eligible_approvers_list")
    cache.clear_all_transactional_caches()
    
    return {
        "status": "success",
        "created_count": created_count,
        "failed_count": len(errors),
        "errors": errors
    }

@router.get("/eligible-approvers", response_model=List[UserResponse])
async def get_eligible_approvers(db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    """Get all users eligible to be approvers"""
    from app.utils import cache
    cached = cache.get("admin_eligible_approvers_list")
    if cached is not None:
        return cached
    users = db.query(User).order_by(User.name).all()
    from fastapi.encoders import jsonable_encoder
    serialized = jsonable_encoder(users)
    cache.set("admin_eligible_approvers_list", serialized)
    return users

@router.get("/hierarchies", response_model=List[ApprovalHierarchyResponse])
async def get_hierarchies(db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    """Get all configured team hierarchies"""
    from app.utils import cache
    cached = cache.get("admin_hierarchies_list")
    if cached is not None:
        return cached

    hierarchies = db.query(ApprovalHierarchy)\
        .options(selectinload(ApprovalHierarchy.requesters), selectinload(ApprovalHierarchy.approvers))\
        .order_by(ApprovalHierarchy.name).all()
    
    # Pre-fetch all users in a single query to avoid database hit amplification in loop
    users_map = {u.id: u for u in db.query(User).all()}

    result = []
    for h in hierarchies:
        requesters = []
        for r in h.requesters:
            user = users_map.get(r.user_id)
            if user:
                requesters.append(HierarchyRequesterSchema(
                    id=r.id,
                    user_id=r.user_id,
                    user_name=user.name,
                    user_code=user.user_id
                ))
        approvers = []
        for a in h.approvers:
            user = users_map.get(a.approver_id)
            if user:
                approvers.append(HierarchyApproverSchema(
                    id=a.id,
                    level_number=a.level_number,
                    approver_id=a.approver_id,
                    approver_name=user.name,
                    approver_code=user.user_id,
                    approver_role=user.role
                ))
        approvers.sort(key=lambda x: x.level_number)
        result.append(ApprovalHierarchyResponse(
            id=h.id,
            name=h.name,
            requesters=requesters,
            approvers=approvers
        ))
        
    from fastapi.encoders import jsonable_encoder
    serialized = jsonable_encoder(result)
    cache.set("admin_hierarchies_list", serialized)
    return result

@router.get("/hierarchies/export")
async def export_hierarchies_csv(
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin)
):
    """Export all team hierarchies to a CSV file structure"""
    import csv
    import io
    from fastapi.responses import StreamingResponse

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "hierarchy_name", 
        "requester_e_codes", 
        "level_1_approver", 
        "level_2_approver", 
        "level_3_approver", 
        "level_4_approver", 
        "level_5_approver"
    ])
    
    hierarchies = db.query(ApprovalHierarchy).all()
    for h in hierarchies:
        # Requesters
        req_codes = []
        for r in h.requesters:
            if r.user:
                req_codes.append(r.user.e_code or r.user.user_id)
        
        # Approvers (levels 1-5)
        lvl_apps = ["", "", "", "", ""]
        for a in h.approvers:
            if a.approver and 1 <= a.level_number <= 5:
                lvl_apps[a.level_number - 1] = a.approver.e_code or a.approver.user_id
                
        writer.writerow([
            h.name,
            ",".join(req_codes),
            lvl_apps[0],
            lvl_apps[1],
            lvl_apps[2],
            lvl_apps[3],
            lvl_apps[4]
        ])
        
    output.seek(0)
    response = StreamingResponse(output, media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=team_hierarchies.csv"
    return response

@router.post("/hierarchies/bulk")
async def bulk_import_hierarchies(
    request: BulkHierarchyImportRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin)
):
    """Bulk import team hierarchies via JSON payload (parsed CSV) with O(1) in-memory checks and bulk database operations"""
    errors = []
    
    # 1. Pre-fetch all users to build a single fast in-memory lookup map
    all_users = db.query(User).all()
    user_lookup = {}
    for u in all_users:
        if u.e_code:
            user_lookup[u.e_code.strip().lower()] = u
        if u.user_id:
            user_lookup[u.user_id.strip().lower()] = u
        if u.name:
            user_lookup[u.name.strip().lower()] = u

    # Validate all rows in memory first
    for index, row in enumerate(request.rows):
        h_name = row.hierarchy_name.strip()
        if not h_name:
            errors.append(f"Row {index + 1}: Hierarchy name is empty")
            continue
            
        # Parse requesters
        req_codes = [c.strip() for c in row.requester_e_codes.split(",") if c.strip()]
        for code in req_codes:
            u = user_lookup.get(code.lower())
            if not u:
                errors.append(f"Row {index + 1}: Requester '{code}' not found in database")
                
        # Parse level approvers
        for lvl in range(1, 6):
            app_code = getattr(row, f"level_{lvl}_approver", "")
            if app_code and app_code.strip():
                app_code_clean = app_code.strip()
                u = user_lookup.get(app_code_clean.lower())
                if not u:
                    errors.append(f"Row {index + 1}: Level {lvl} Approver '{app_code_clean}' not found in database")
                    
    if errors:
        raise HTTPException(
            status_code=400,
            detail={"errors": errors}
        )
        
    # If no validation errors, proceed to update/create in bulk
    try:
        from app.utils import cache
        
        # 2. Pre-fetch existing hierarchies for mapping
        all_hierarchies = db.query(ApprovalHierarchy).all()
        hierarchy_map = {h.name.strip().lower(): h for h in all_hierarchies}
        
        # Collect all hierarchy names from this bulk operation
        imported_names = {row.hierarchy_name.strip().lower() for row in request.rows if row.hierarchy_name.strip()}
        
        # Bulk delete existing relationships of hierarchies being imported to prevent N+1 deletes
        hierarchy_ids_to_clear = [h.id for name, h in hierarchy_map.items() if name in imported_names]
        if hierarchy_ids_to_clear:
            db.query(HierarchyRequester).filter(HierarchyRequester.hierarchy_id.in_(hierarchy_ids_to_clear)).delete(synchronize_session=False)
            db.query(HierarchyApprover).filter(HierarchyApprover.hierarchy_id.in_(hierarchy_ids_to_clear)).delete(synchronize_session=False)
            db.flush()
            
        # Collect all user IDs of imported requesters to clear their mapping to other hierarchies in a single query
        imported_requester_user_ids = []
        for row in request.rows:
            req_codes = [c.strip() for c in row.requester_e_codes.split(",") if c.strip()]
            for code in req_codes:
                u = user_lookup.get(code.lower())
                if u:
                    imported_requester_user_ids.append(u.id)
                    
        # Bulk clear requester mappings in other hierarchies
        if imported_requester_user_ids:
            db.query(HierarchyRequester).filter(HierarchyRequester.user_id.in_(imported_requester_user_ids)).delete(synchronize_session=False)
            db.flush()
            
        # 3. Create or update hierarchies and append relationships
        for row in request.rows:
            h_name = row.hierarchy_name.strip()
            h = hierarchy_map.get(h_name.lower())
            if not h:
                h = ApprovalHierarchy(name=h_name)
                db.add(h)
                db.flush()
                hierarchy_map[h_name.lower()] = h
                
            # Add requesters
            req_codes = [c.strip() for c in row.requester_e_codes.split(",") if c.strip()]
            for code in req_codes:
                u = user_lookup.get(code.lower())
                if u:
                    db.add(HierarchyRequester(hierarchy_id=h.id, user_id=u.id))
                    
            # Add approvers
            for lvl in range(1, 6):
                app_code = getattr(row, f"level_{lvl}_approver", "")
                if app_code and app_code.strip():
                    app_code_clean = app_code.strip()
                    u = user_lookup.get(app_code_clean.lower())
                    if u:
                        db.add(HierarchyApprover(
                            hierarchy_id=h.id,
                            level_number=lvl,
                            approver_id=u.id
                        ))
                        
        db.commit()
        cache.delete("admin_hierarchies_list")
        cache.clear_all_transactional_caches()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction error: {str(e)}")
        
    return {"status": "success", "message": "All team hierarchies successfully imported/updated."}

@router.get("/hierarchies/{hierarchy_id}", response_model=ApprovalHierarchyResponse)
async def get_hierarchy(hierarchy_id: int, db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    """Get a single hierarchy by ID"""
    h = db.query(ApprovalHierarchy).filter(ApprovalHierarchy.id == hierarchy_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hierarchy team not found")
        
    # Pre-fetch users in single query
    users_map = {u.id: u for u in db.query(User).all()}

    requesters = []
    for r in h.requesters:
        user = users_map.get(r.user_id)
        if user:
            requesters.append(HierarchyRequesterSchema(
                id=r.id,
                user_id=r.user_id,
                user_name=user.name,
                user_code=user.user_id
            ))
    approvers = []
    for a in h.approvers:
        user = users_map.get(a.approver_id)
        if user:
            approvers.append(HierarchyApproverSchema(
                id=a.id,
                level_number=a.level_number,
                approver_id=a.approver_id,
                approver_name=user.name,
                approver_code=user.user_id,
                approver_role=user.role
            ))
    approvers.sort(key=lambda x: x.level_number)
    return ApprovalHierarchyResponse(
        id=h.id,
        name=h.name,
        requesters=requesters,
        approvers=approvers
    )

@router.post("/hierarchies", response_model=ApprovalHierarchyResponse)
async def save_hierarchy(
    request: ApprovalHierarchyCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin)
):
    """Create or update a team hierarchy config"""
    name_clean = request.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Hierarchy name cannot be empty")
        
    if request.id:
        existing = db.query(ApprovalHierarchy).filter(ApprovalHierarchy.id == request.id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Hierarchy not found for update")
        dup = db.query(ApprovalHierarchy).filter(ApprovalHierarchy.name == name_clean, ApprovalHierarchy.id != request.id).first()
        if dup:
            raise HTTPException(status_code=400, detail=f"Hierarchy with name '{name_clean}' already exists")
        existing.name = name_clean
        h = existing
    else:
        dup = db.query(ApprovalHierarchy).filter(ApprovalHierarchy.name == name_clean).first()
        if dup:
            raise HTTPException(status_code=400, detail=f"Hierarchy with name '{name_clean}' already exists")
        h = ApprovalHierarchy(name=name_clean)
        db.add(h)
        db.flush()
        
    # Validate approvers
    for app_data in request.approvers:
        app_id = app_data.get("approver_id")
        approver_user = db.query(User).filter(User.id == app_id).first()
        if not approver_user:
            raise HTTPException(status_code=400, detail=f"Approver with ID {app_id} not found")
            
    # Validate requesters (Uniqueness constraint across all hierarchies)
    for req_id in request.requester_ids:
        req_user = db.query(User).filter(User.id == req_id).first()
        if not req_user:
            raise HTTPException(status_code=400, detail=f"Requester user with ID {req_id} not found")
        existing_req = db.query(HierarchyRequester).filter(HierarchyRequester.user_id == req_id).first()
        if existing_req and existing_req.hierarchy_id != h.id:
            other_h = db.query(ApprovalHierarchy).filter(ApprovalHierarchy.id == existing_req.hierarchy_id).first()
            h_name = other_h.name if other_h else f"ID {existing_req.hierarchy_id}"
            raise HTTPException(
                status_code=400,
                detail=f"User '{req_user.name}' is already assigned as requester to another hierarchy team ('{h_name}')"
            )
            
    # Rebuild relationships
    if request.id:
        db.query(HierarchyRequester).filter(HierarchyRequester.hierarchy_id == h.id).delete()
        db.query(HierarchyApprover).filter(HierarchyApprover.hierarchy_id == h.id).delete()
        
    for req_id in request.requester_ids:
        db.add(HierarchyRequester(hierarchy_id=h.id, user_id=req_id))
        
    for app_data in request.approvers:
        db.add(HierarchyApprover(
            hierarchy_id=h.id,
            level_number=app_data.get("level_number"),
            approver_id=app_data.get("approver_id")
        ))
        
    db.commit()
    db.refresh(h)
    
    from app.utils import cache
    cache.delete("admin_hierarchies_list")
    cache.clear_all_transactional_caches()
    
    # Return mapped response
    requesters = []
    for r in h.requesters:
        user = db.query(User).filter(User.id == r.user_id).first()
        if user:
            requesters.append(HierarchyRequesterSchema(
                id=r.id,
                user_id=r.user_id,
                user_name=user.name,
                user_code=user.user_id
            ))
    approvers = []
    for a in h.approvers:
        user = db.query(User).filter(User.id == a.approver_id).first()
        if user:
            approvers.append(HierarchyApproverSchema(
                id=a.id,
                level_number=a.level_number,
                approver_id=a.approver_id,
                approver_name=user.name,
                approver_code=user.user_id,
                approver_role=user.role
            ))
    approvers.sort(key=lambda x: x.level_number)
    return ApprovalHierarchyResponse(
        id=h.id,
        name=h.name,
        requesters=requesters,
        approvers=approvers
    )

@router.delete("/hierarchies/{hierarchy_id}")
async def delete_hierarchy(hierarchy_id: int, db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    """Delete a team hierarchy"""
    h = db.query(ApprovalHierarchy).filter(ApprovalHierarchy.id == hierarchy_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hierarchy not found")
    db.delete(h)
    db.commit()
    
    from app.utils import cache
    cache.delete("admin_hierarchies_list")
    cache.clear_all_transactional_caches()
    
    return {"status": "success", "message": "Hierarchy successfully deleted."}



@router.get("/assets")
async def get_assets(db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    """Get asset master list (stub)"""
    return {"assets": []}

@router.get("/reports")
async def get_reports(db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    """Get system reports (stub)"""
    return {"reports": []}

@router.post("/logout-all")
async def force_logout_all_users(db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    """Force logout all active users (excludes the current admin)"""
    db.query(User).filter(User.user_id != admin.user_id).update({User.active_session_id: None})
    db.commit()
    return {"status": "success", "message": "All users have been force logged out."}

@router.post("/logout-user/{user_code}")
async def force_logout_single_user(user_code: str, db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    """Force logout a specific user by employee code"""
    user = db.query(User).filter(User.user_id == user_code).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.active_session_id = None
    db.commit()
    return {"status": "success", "message": f"User {user.name} has been force logged out."}
