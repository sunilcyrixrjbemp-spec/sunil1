from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List

from app.config.database import get_db
from app.api.routes.dependencies import get_current_user
from app.models.user import User
from app.models.user_role import UserRole
from app.models.password_history import PasswordHistory
from app.models.approval_hierarchy import ApprovalHierarchy, HierarchyRequester, HierarchyApprover
from app.schemas.user import (
    UserResponse, UserCreateRequest, UserEditRequest,
    ApprovalHierarchyResponse, ApprovalHierarchyCreateRequest,
    HierarchyApproverSchema, HierarchyRequesterSchema
)
from app.utils.security import get_password_hash

router = APIRouter()

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
    
    # 1. Check if user already exists
    existing = db.query(User).filter(User.user_id == e_code_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with Employee Code / ID '{e_code_clean}' already exists."
        )
        
    # 2. Create User
    hashed = get_password_hash(request.password)
    user = User(
        user_id=e_code_clean, # e_code is the user_id!
        e_code=e_code_clean,
        name=request.name.strip(),
        hashed_password=hashed,
        user_status="active",
        designation=request.designation,
        grade=request.grade,
        district=request.district,
        zone=request.zone,
        manager=request.manager,
        zonal_manager=request.zonal_manager,
        coordinator=request.coordinator,
        mobile_number=request.mobile_number,
        mail_id=request.mail_id,
        role=request.role,
        type=request.type or "Employee",
        date_of_joining=request.date_of_joining,
        date_of_birth=request.date_of_birth,
        e_upkaran_id=request.e_upkaran_id.strip() if request.e_upkaran_id else None,
        allowed_windows=request.allowed_windows or "home,approval,expense,analysis,report,help,profile"
    )
    db.add(user)
    db.flush()
    
    # 3. Add to password history
    pwd_hist = PasswordHistory(
        user_id=user.id,
        hashed_password=hashed
    )
    db.add(pwd_hist)
    
    # 4. Add to user roles table
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
        
    # Update fields if provided
    if request.name is not None:
        user.name = request.name.strip()
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
    payload: List[UserCreateRequest],
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin)
):
    """Bulk create users from JSON payload (e.g. parsed CSV on frontend)"""
    created_count = 0
    errors = []
    
    for index, item in enumerate(payload):
        e_code_clean = item.e_code.strip()
        if not e_code_clean:
            errors.append(f"Row {index + 1}: Missing Employee Code")
            continue
            
        existing = db.query(User).filter(User.user_id == e_code_clean).first()
        if existing:
            errors.append(f"Row {index + 1}: User with Employee Code '{e_code_clean}' already exists")
            continue
            
        try:
            hashed = get_password_hash(item.password)
            user = User(
                user_id=e_code_clean,
                e_code=e_code_clean,
                name=item.name.strip(),
                hashed_password=hashed,
                user_status="active",
                designation=item.designation,
                grade=item.grade,
                district=item.district,
                zone=item.zone,
                manager=item.manager,
                zonal_manager=item.zonal_manager,
                coordinator=item.coordinator,
                mobile_number=item.mobile_number,
                mail_id=item.mail_id,
                role=item.role,
                type=item.type or "Employee",
                date_of_joining=item.date_of_joining,
                date_of_birth=item.date_of_birth,
                e_upkaran_id=item.e_upkaran_id.strip() if item.e_upkaran_id else None,
                allowed_windows=item.allowed_windows or "home,approval,expense,analysis,report,help,profile"
            )
            db.add(user)
            db.flush()
            
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
