from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, case, text
from typing import List, Optional
import json
import os
import time
import shutil
from datetime import datetime

from app.config.database import get_db
from app.api.routes.dependencies import get_current_user
from app.models.user import User
from app.models.expense import Expense
from app.models.approval import Approval
from app.models.approval_hierarchy import HierarchyRequester, HierarchyApprover
from app.models.allowance_master import AllowanceMaster
from app.models.facility_detail import FacilityDetail
from app.models.expense_itinerary import ExpenseItinerary
from app.models.expense_attachment import ExpenseAttachment
from app.models.limit_approval_request import LimitApprovalRequest
from app.config.settings import settings

router = APIRouter()
def parse_client_timestamp(ts_str: str | None) -> datetime:
    if not ts_str:
        return datetime.now()
    try:
        dt = datetime.fromisoformat(ts_str)
        if dt.tzinfo:
            dt = dt.replace(tzinfo=None)
        return dt
    except Exception:
        try:
            return datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
        except Exception:
            return datetime.now()

def save_upload_file(upload_file: UploadFile, exp_id: str, type_str: str) -> str:
    """Saves uploaded file to Google Drive (with month-wise folders and fallback to R2/Local)."""
    if not upload_file or not upload_file.filename:
        return ""
        
    import logging
    logger = logging.getLogger(__name__)

    # Clean filename
    safe_name = upload_file.filename.replace(" ", "_")
    filename = f"{exp_id}_{type_str}_{int(time.time()*1000)}_{safe_name}"
    
    # 1. Try Google Drive Upload
    try:
        from app.config.database import SessionLocal
        from app.models.expense import Expense
        
        month_name = "General"
        year_val = 2026
        expense_code = str(exp_id)
        
        # Retrieve expense details from DB
        try:
            db_session = SessionLocal()
            expense = db_session.query(Expense).filter(Expense.id == int(exp_id)).first()
            if expense:
                month_name = expense.month or "General"
                year_val = expense.year or 2026
                expense_code = expense.expense_code or str(exp_id)
            db_session.close()
        except Exception as db_err:
            logger.error(f"GDrive: DB lookup error: {str(db_err)}")
            
        # Clean expense code for file naming
        clean_code = expense_code.replace("/", "-")
        drive_filename = f"{clean_code}_{type_str}_{safe_name}"
        
        # Read file bytes
        upload_file.file.seek(0)
        file_bytes = upload_file.file.read()
        
        from app.utils.gdrive import upload_file_to_drive
        file_id = upload_file_to_drive(
            file_content=file_bytes,
            filename=drive_filename,
            mime_type=upload_file.content_type or "application/octet-stream",
            month_name=month_name,
            year=year_val
        )
        logger.info(f"Successfully uploaded file to Google Drive: {drive_filename} (ID: {file_id})")
        return f"/api/upload/file/gdrive/{file_id}"
    except Exception as drive_err:
        logger.error(f"GDrive: Upload failed, falling back to R2/Local. Error: {str(drive_err)}")

    # 2. R2 / Local Fallback (original code logic)
    key = f"images/{filename}"
    if settings.CLOUDFLARE_API_TOKEN and settings.CLOUDFLARE_ACCOUNT_ID and settings.CLOUDFLARE_R2_BUCKET_NAME:
        try:
            import requests
            upload_file.file.seek(0)
            file_content = upload_file.file.read()
            url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/{settings.CLOUDFLARE_R2_BUCKET_NAME}/objects/{key}"
            headers = {
                "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}",
                "Content-Type": upload_file.content_type or "application/octet-stream"
            }
            response = requests.put(url, headers=headers, data=file_content, timeout=30)
            if response.status_code == 200:
                logger.info(f"Successfully uploaded {key} to Cloudflare R2 bucket: {settings.CLOUDFLARE_R2_BUCKET_NAME}")
                return f"/api/upload/file/{key}"
            else:
                logger.error(f"R2 Upload API returned status {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Failed to upload {key} to R2: {str(e)}")
            
    # Local fallback path
    try:
        from app.api.routes.upload import UPLOAD_DIR
        target_dir = os.path.join(UPLOAD_DIR, "images")
        os.makedirs(target_dir, exist_ok=True)
        filepath = os.path.join(target_dir, filename)
        upload_file.file.seek(0)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
        return f"/api/upload/file/{key}"
    except Exception as e:
        logger.error(f"Failed to save upload locally: {str(e)}")
        return ""

@router.get("/init")
async def init_expense(
    user_id: str,
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initializes user limits, allowance rules, submitted dates, and facilities for the claim builder."""
    # Fallback to current month if not specified
    if not month:
        month = datetime.now().isoformat()[:7]  # YYYY-MM
        
    try:
        dt = datetime.strptime(month, "%Y-%m")
        month_name = dt.strftime("%B")
        year_val = dt.year
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Expected YYYY-MM.")

    from app.utils import cache
    cache_key = f"user_init:{user_id}:{month}"
    cached_val = cache.get(cache_key)
    if cached_val:
        return cached_val

    # Get User details (using the login string user_id)
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in system.")

    # 1 & 2. Accumulated KM and Auto stats this month (Consolidated into 1 query)
    stats = db.query(
        func.sum(case((ExpenseItinerary.travel_mode.in_(["Bike", "Car"]), ExpenseItinerary.distance_km), else_=0.0)),
        func.sum(case((ExpenseItinerary.travel_mode == "Auto", ExpenseItinerary.travel_amount), else_=0.0)),
        func.sum(case((ExpenseItinerary.sub_mode == "Auto", ExpenseItinerary.sub_amount), else_=0.0))
    ).select_from(ExpenseItinerary).join(
        Expense, ExpenseItinerary.exp_id == Expense.expense_code
    ).filter(
        Expense.user_id == user.id,
        Expense.month == month_name,
        Expense.year == year_val
    ).first()

    accum_km = stats[0] or 0.0 if stats else 0.0
    accum_auto_main = stats[1] or 0.0 if stats else 0.0
    accum_auto_sub = stats[2] or 0.0 if stats else 0.0
    accum_auto = accum_auto_main + accum_auto_sub

    # 3. Facilities mapping by district
    facilities = cache.get("facilities_mapped")
    if not facilities:
        facilities = {}
        facilities_list = db.query(FacilityDetail).all()
        for f in facilities_list:
            d_name = f.district_name
            f_name = f.facility_name
            if d_name not in facilities:
                facilities[d_name] = []
            facilities[d_name].append(f_name)
        cache.set("facilities_mapped", facilities)

    # 4. Dates this user has already submitted expenses for this month
    submitted_expenses = db.query(Expense.itinerary).filter(
        Expense.user_id == user.id,
        Expense.month == month_name,
        Expense.year == year_val
    ).all()
    submitted_dates = [e.itinerary for e in submitted_expenses if e.itinerary]

    # 5. Approved limit extension requests (Consolidated into 1 query)
    limits = db.query(
        func.sum(case((LimitApprovalRequest.request_type == "KM", LimitApprovalRequest.requested_value), else_=0.0)),
        func.sum(case((LimitApprovalRequest.request_type == "AUTO", LimitApprovalRequest.requested_value), else_=0.0))
    ).filter(
        LimitApprovalRequest.user_id == user.user_id,
        func.lower(LimitApprovalRequest.status) == "approved",
        LimitApprovalRequest.for_month == month
    ).first()

    approved_km = limits[0] or 0.0 if limits else 0.0
    approved_auto = limits[1] or 0.0 if limits else 0.0

    # 6. Existing limit requests (Consolidated into 1 query)
    limit_reqs = db.query(LimitApprovalRequest).filter(
        LimitApprovalRequest.user_id == user.user_id,
        LimitApprovalRequest.for_month == month
    ).all()
    
    km_reqs = [r for r in limit_reqs if r.request_type == "KM"]
    auto_reqs = [r for r in limit_reqs if r.request_type == "AUTO"]
    
    existing_km = sorted(km_reqs, key=lambda r: r.id, reverse=True)[0] if km_reqs else None
    existing_auto = sorted(auto_reqs, key=lambda r: r.id, reverse=True)[0] if auto_reqs else None

    existing_km_req = {
        "status": existing_km.status,
        "requested_value": existing_km.requested_value
    } if existing_km else None

    existing_auto_req = {
        "status": existing_auto.status,
        "requested_value": existing_auto.requested_value
    } if existing_auto else None

    # 7. Allowance Rules lookup
    allowance_dict = cache.get(f"allowance_master:{user.grade}")
    if not allowance_dict:
        allowance = db.query(AllowanceMaster).filter(AllowanceMaster.grade == user.grade).first()
        if allowance:
            hotel_limit = max(
                allowance.hotel_in_state_s or 0,
                allowance.hotel_in_state_d or 0,
                allowance.hotel_out_state_s or 0,
                allowance.hotel_out_state_d or 0
            )
            allowance_dict = {
                "daily_in_district": allowance.daily_in_district,
                "daily_out_district": allowance.daily_out_district,
                "daily_hotel": allowance.daily_hotel,
                "daily_out_state": allowance.daily_out_state,
                "hotel_in_state_s": hotel_limit if hotel_limit > 0 else 1500,
                "max_km_per_month": allowance.max_km_per_month,
                "rate_bike": allowance.rate_per_km if allowance.vehicle_type == "Bike" else 4.5,
                "rate_car": allowance.rate_per_km if allowance.vehicle_type == "Car" else 9.0,
                "vehicle_type": allowance.vehicle_type
            }
        else:
            allowance_dict = {
                "daily_in_district": 250,
                "daily_out_district": 400,
                "daily_hotel": 350,
                "daily_out_state": 600,
                "hotel_in_state_s": 1500,
                "max_km_per_month": 2000,
                "rate_bike": 4.5,
                "rate_car": 9.0,
                "vehicle_type": "Bike"
            }
        cache.set(f"allowance_master:{user.grade}", allowance_dict)

    # Make a copy of allowance dict before modifying with monthly totals
    allowance_dict = dict(allowance_dict)
    allowance_dict["current_month_km"] = accum_km
    allowance_dict["current_month_auto"] = accum_auto
    allowance_dict["max_auto_per_month"] = 1000

    # 8. RJ-MM/YY-PENDING sequence generator
    mm = datetime.now().strftime("%m")
    yy = datetime.now().strftime("%y")

    res_dict = {
        "success": True,
        "user": {
            "full_name": user.name,
            "e_code": user.e_code,
            "grade": user.grade,
            "home_district": user.district or "Jodhpur",
            "level_first_approver": user.manager or "Admin",
            "level_second_approver": user.zonal_manager or "Admin"
        },
        "allowance": allowance_dict,
        "facilities": facilities,
        "submitted_dates": submitted_dates,
        "approved_km": approved_km,
        "approved_auto": approved_auto,
        "existing_km_req": existing_km_req,
        "existing_auto_req": existing_auto_req,
        "next_exp_id": f"RJ-{mm}/{yy}-PENDING"
    }
    
    cache.set(cache_key, res_dict)
    return res_dict

@router.post("/limit-request")
async def create_limit_request(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submits a limit request for manager approval when limits are exceeded."""
    user_id = payload.get("user_id")
    req_type = payload.get("type")
    amount = payload.get("amount")
    month = payload.get("month") or datetime.now().isoformat()[:7]

    if not req_type or amount is None:
        raise HTTPException(status_code=400, detail="Type ('KM'/'AUTO') and amount are required.")

    try:
        parsed_amount = float(amount)
        if parsed_amount <= 0:
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=400, detail="Please enter a valid requested amount greater than 0.")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Resolve manager ID from hierarchy, fallback to user.manager
    manager_id = None
    requester_map = db.query(HierarchyRequester).filter(HierarchyRequester.user_id == user.id).first()
    if requester_map:
        l1_approver = db.query(HierarchyApprover).filter(
            HierarchyApprover.hierarchy_id == requester_map.hierarchy_id,
            HierarchyApprover.level_number == 1
        ).first()
        if l1_approver:
            approver_user = db.query(User).filter(User.id == l1_approver.approver_id).first()
            if approver_user:
                manager_id = approver_user.user_id

    if not manager_id:
        manager_id = user.manager or "Admin"

    # Check if request already exists
    existing = db.query(LimitApprovalRequest).filter(
        LimitApprovalRequest.user_id == user.user_id,
        LimitApprovalRequest.request_type == req_type,
        LimitApprovalRequest.for_month == month
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Limit request denied: You have already submitted a request for {req_type} this month. Status: '{existing.status}'."
        )

    req = LimitApprovalRequest(
        user_id=user.user_id,
        manager_id=manager_id,
        request_type=req_type,
        requested_value=parsed_amount,
        status="Pending",
        for_month=month
    )
    db.add(req)
    db.commit()

    from app.utils import cache
    cache.clear_user_and_managers_cache(db, user.user_id)

    return {
        "success": True,
        "message": f"Limit approval request for additional {parsed_amount} {req_type} successfully saved and sent to manager ({manager_id})."
    }

@router.post("/")
async def submit_expense(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submits multi-leg itinerary claim with totals calculation and allowance verification."""
    form_data = await request.form()
    
    exp_date = form_data.get("exp_date")
    total_amount = float(form_data.get("total_amount") or 0.0)
    itineraries_str = form_data.get("itineraries")

    if not exp_date or not itineraries_str:
        raise HTTPException(status_code=400, detail="Date and itineraries are required.")

    # Check if this is an edit or new submission
    edit_id = form_data.get("edit_expense_id")
    client_timestamp = form_data.get("client_timestamp")
    
    existing_expense = None
    if edit_id:
        existing_expense = db.query(Expense).filter(
            Expense.id == int(edit_id),
            Expense.user_id == current_user.id
        ).first()
        if not existing_expense:
            raise HTTPException(status_code=404, detail="Expense claim to edit not found.")
        if existing_expense.status not in ["draft", "submitted"]:
            raise HTTPException(status_code=400, detail="Cannot edit a claim that has already been reviewed by L1.")

    # Check duplicate submission (excluding the one being edited)
    dup_query = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.itinerary == exp_date
    )
    if existing_expense:
        dup_query = dup_query.filter(Expense.id != existing_expense.id)
    existing_dup = dup_query.first()
    if existing_dup:
        raise HTTPException(status_code=400, detail=f"An expense claim for {exp_date} has already been submitted.")

    # Clean up dependencies if editing
    old_att_map = {}
    deleted_attachments = []
    deleted_attachments_str = form_data.get("deleted_attachments")
    if deleted_attachments_str:
        try:
            deleted_attachments = json.loads(deleted_attachments_str)
        except Exception:
            pass

    if existing_expense:
        old_attachments = db.query(ExpenseAttachment).filter(ExpenseAttachment.exp_id == existing_expense.expense_code).all()
        for a in old_attachments:
            try:
                leg_num = int(a.itinerary_id.split("-")[-1])
                is_deleted = any(
                    int(d.get("leg")) == leg_num and d.get("type") == a.bill_type
                    for d in deleted_attachments if d.get("leg") is not None
                )
                if not is_deleted:
                    old_att_map[(leg_num, a.bill_type)] = a.file_url
            except Exception:
                pass
        # Get old itinerary IDs and clear breakdown records manually to avoid orphans
        old_iti_ids = [r[0] for r in db.query(ExpenseItinerary.itinerary_id).filter(
            ExpenseItinerary.exp_id == existing_expense.expense_code
        ).all()]
        if old_iti_ids:
            from app.models.expense_breakdown_call import ExpenseBreakdownCall
            from app.models.expense_pms_call import ExpensePmsCall
            from app.models.expense_asset_tagging import ExpenseAssetTagging
            from app.models.expense_asset_mobilise import ExpenseAssetMobilise
            from app.models.expense_calibration import ExpenseCalibration
            from app.models.expense_other_activity import ExpenseOtherActivity
            
            db.query(ExpenseBreakdownCall).filter(ExpenseBreakdownCall.itinerary_id.in_(old_iti_ids)).delete(synchronize_session=False)
            db.query(ExpensePmsCall).filter(ExpensePmsCall.itinerary_id.in_(old_iti_ids)).delete(synchronize_session=False)
            db.query(ExpenseAssetTagging).filter(ExpenseAssetTagging.itinerary_id.in_(old_iti_ids)).delete(synchronize_session=False)
            db.query(ExpenseAssetMobilise).filter(ExpenseAssetMobilise.itinerary_id.in_(old_iti_ids)).delete(synchronize_session=False)
            db.query(ExpenseCalibration).filter(ExpenseCalibration.itinerary_id.in_(old_iti_ids)).delete(synchronize_session=False)
            db.query(ExpenseOtherActivity).filter(ExpenseOtherActivity.itinerary_id.in_(old_iti_ids)).delete(synchronize_session=False)

        db.query(ExpenseItinerary).filter(ExpenseItinerary.exp_id == existing_expense.expense_code).delete()
        db.query(ExpenseAttachment).filter(ExpenseAttachment.exp_id == existing_expense.expense_code).delete()
        db.query(Approval).filter(Approval.expense_id == existing_expense.id).delete()

    # Mapped approval hierarchy
    requester_map = db.query(HierarchyRequester).filter(HierarchyRequester.user_id == current_user.id).first()
    approvers = []
    if requester_map:
        approvers = db.query(HierarchyApprover).filter(
            HierarchyApprover.hierarchy_id == requester_map.hierarchy_id
        ).order_by(HierarchyApprover.level_number).all()
    
    # If not mapped in a hierarchy, Admin can bypass it (auto-approves)
    if not requester_map and current_user.role != "Admin":
        raise HTTPException(
            status_code=400,
            detail="You are not assigned to any approval hierarchy team. Please contact the administrator."
        )
        
    if requester_map and not approvers:
        raise HTTPException(
            status_code=400,
            detail="The approval team hierarchy you belong to has no approvers configured."
        )

    try:
        itineraries = json.loads(itineraries_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid itineraries payload.")

    # Calculate leg-level totals and monthly caps
    total_da = 0.0
    total_hotel = 0.0
    total_other = 0.0
    total_local_purchase = 0.0
    total_assigned = 0
    total_completed = 0
    total_pms = 0
    total_asset = 0
    total_calibration = 0
    total_mobilise = 0

    incoming_km = 0.0
    incoming_auto = 0.0

    for iti in itineraries:
        total_da += float(iti.get("da") or 0.0)
        total_hotel += float(iti.get("hotel") or 0.0)
        total_other += float(iti.get("oth_amount") or 0.0)
        total_local_purchase += float(iti.get("local_purchase") or 0.0)
        total_assigned += int(iti.get("ws_assigned") or 0)
        total_completed += int(iti.get("ws_closed") or 0)
        total_pms += int(iti.get("ws_pms") or 0)
        total_asset += int(iti.get("ws_asset") or 0)
        total_calibration += int(iti.get("calibration_count") or 0)
        total_mobilise += int(iti.get("mobilise_asset_count") or 0)

        mode = iti.get("mode")
        if mode in ["Bike", "Car"]:
            incoming_km += float(iti.get("km") or 0.0)
        elif mode == "Auto":
            incoming_auto += float(iti.get("amount") or 0.0)

        sub_mode = iti.get("sub_mode")
        if sub_mode == "Auto":
            incoming_auto += float(iti.get("sub_amount") or 0.0)

    # Monthly caps check
    try:
        dt = datetime.strptime(exp_date, "%Y-%m-%d")
        month_name = dt.strftime("%B")
        year_val = dt.year
        month_str = exp_date[:7]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    # Monthly accumulated stats (Consolidated into 1 query)
    stats = db.query(
        func.sum(case((ExpenseItinerary.travel_mode.in_(["Bike", "Car"]), ExpenseItinerary.distance_km), else_=0.0)),
        func.sum(case((ExpenseItinerary.travel_mode == "Auto", ExpenseItinerary.travel_amount), else_=0.0)),
        func.sum(case((ExpenseItinerary.sub_mode == "Auto", ExpenseItinerary.sub_amount), else_=0.0))
    ).select_from(ExpenseItinerary).join(
        Expense, ExpenseItinerary.exp_id == Expense.expense_code
    ).filter(
        Expense.user_id == current_user.id,
        Expense.month == month_name,
        Expense.year == year_val
    ).first()

    accum_km = stats[0] or 0.0 if stats else 0.0
    accum_auto_main = stats[1] or 0.0 if stats else 0.0
    accum_auto_sub = stats[2] or 0.0 if stats else 0.0
    accum_auto = accum_auto_main + accum_auto_sub

    # Allowance master
    allowance = db.query(AllowanceMaster).filter(AllowanceMaster.grade == current_user.grade).first()
    max_km = allowance.max_km_per_month if allowance else 2000
    max_auto = 1000

    # Approved extensions (Consolidated into 1 query)
    limits = db.query(
        func.sum(case((LimitApprovalRequest.request_type == "KM", LimitApprovalRequest.requested_value), else_=0.0)),
        func.sum(case((LimitApprovalRequest.request_type == "AUTO", LimitApprovalRequest.requested_value), else_=0.0))
    ).filter(
        LimitApprovalRequest.user_id == current_user.user_id,
        func.lower(LimitApprovalRequest.status) == "approved",
        LimitApprovalRequest.for_month == month_str
    ).first()

    approved_km = limits[0] or 0.0 if limits else 0.0
    approved_auto = limits[1] or 0.0 if limits else 0.0

    if (accum_km + incoming_km) > (max_km + approved_km):
        excess = (accum_km + incoming_km) - (max_km + approved_km)
        raise HTTPException(
            status_code=400,
            detail=f"Submission Locked: Exceeded monthly KM limit by {excess:.2f} km. Request extension from L1 Manager first."
        )

    if (accum_auto + incoming_auto) > (max_auto + approved_auto):
        excess = (accum_auto + incoming_auto) - (max_auto + approved_auto)
        raise HTTPException(
            status_code=400,
            detail=f"Submission Locked: Exceeded monthly Auto limit by ₹{excess:.2f}. Request extension from L1 Manager first."
        )

    # Validate each itinerary leg against grade allowance rules
    allowed_vehicle = allowance.vehicle_type if allowance else "Bike"
    rate_bike = allowance.rate_per_km if (allowance and allowance.vehicle_type == "Bike") else 4.5
    rate_car = allowance.rate_per_km if (allowance and allowance.vehicle_type == "Car") else 9.0
    daily_in = allowance.daily_in_district if allowance else 250
    daily_out = allowance.daily_out_district if allowance else 400
    daily_hotel = allowance.daily_hotel if allowance else 350
    daily_out_state = allowance.daily_out_state if allowance else 600
    hotel_limit = allowance.hotel_in_state_s if allowance else 1500

    for idx, iti in enumerate(itineraries):
        leg_num = int(iti.get("leg") or (idx + 1))
        mode = iti.get("mode")
        distance_km = float(iti.get("km") or 0.0)
        travel_amount = float(iti.get("amount") or 0.0)
        da_amount = float(iti.get("da") or 0.0)
        hotel_amount = float(iti.get("hotel") or 0.0)
        to_dist = iti.get("district") or "Jodhpur"

        # 1. Vehicle Type Validation
        if mode == "Car" and allowed_vehicle != "Car":
            raise HTTPException(
                status_code=400,
                detail=f"Leg {leg_num}: Car travel is not allowed for your grade ({current_user.grade})."
            )

        # 2. KM rate validation for Bike/Car
        if mode == "Bike":
            expected_max = distance_km * rate_bike
            if travel_amount > (expected_max + 1.0):
                raise HTTPException(
                    status_code=400,
                    detail=f"Leg {leg_num}: Travel amount (₹{travel_amount}) exceeds the maximum allowed for Bike (₹{expected_max:.2f})."
                )
        elif mode == "Car":
            expected_max = distance_km * rate_car
            if travel_amount > (expected_max + 1.0):
                raise HTTPException(
                    status_code=400,
                    detail=f"Leg {leg_num}: Travel amount (₹{travel_amount}) exceeds the maximum allowed for Car (₹{expected_max:.2f})."
                )

        # 3. Hotel limit validation
        if hotel_amount > hotel_limit:
            raise HTTPException(
                status_code=400,
                detail=f"Leg {leg_num}: Hotel charge (₹{hotel_amount}) exceeds the maximum limit for your grade (₹{hotel_limit})."
            )

        # 4. Daily Allowance (DA) validation
        if leg_num == 1:
            hDist = current_user.district or "Jodhpur"
            if not to_dist:
                max_da = 0.0
            elif to_dist == hDist:
                max_da = daily_hotel if hotel_amount > 0 else daily_in
            else:
                max_da = daily_out_state if hotel_amount > 0 else daily_out

            if da_amount > (max_da + 1.0):
                raise HTTPException(
                    status_code=400,
                    detail=f"Leg {leg_num}: Daily Allowance (₹{da_amount}) exceeds the maximum limit (₹{max_da})."
                )

        # 5. Local Purchase validation
        local_purchase = float(iti.get("local_purchase") or 0.0)
        if local_purchase >= 300:
            has_lp_file = form_data.get(f"local_purchase_bill_{leg_num}") is not None
            has_old_lp = old_att_map.get((leg_num, "Local_Purchase")) is not None
            if not (has_lp_file or has_old_lp):
                raise HTTPException(
                    status_code=400,
                    detail=f"Leg {leg_num}: Local purchase amount is ₹{local_purchase}, which is ₹300 or above. A bill attachment is required."
                )

    major_mode = itineraries[0].get("mode") if itineraries else "Other"
    first_purpose = itineraries[0].get("visit_purpose") or "Field visit"

    # RJ-MM/YY-XXXXXX sequence generation or reuse edited one
    if existing_expense:
        final_exp_id = existing_expense.expense_code
        expense = existing_expense
        expense.month = month_name
        expense.year = year_val
        expense.amount = total_amount
        expense.status = "approved" if len(approvers) == 0 else "submitted"
        expense.travel_mode = major_mode
        expense.itinerary = exp_date
        expense.description = first_purpose
        expense.da_amount = total_da
        expense.hotel_amount = total_hotel
        expense.other_expense_amount = total_other
        expense.local_purchase_amount = total_local_purchase
        expense.calls_assigned = total_assigned
        expense.calls_completed = total_completed
        expense.pms_count = total_pms
        expense.asset_tagging = total_asset
        expense.calibration_count = total_calibration
        expense.mobilise_count = total_mobilise
        
        # Populate original values on submission/update
        expense.original_amount = total_amount
        expense.original_da_amount = total_da
        expense.original_hotel_amount = total_hotel
        expense.original_other_expense_amount = total_other
        expense.original_local_purchase_amount = total_local_purchase

        if client_timestamp:
            expense.updated_at = parse_client_timestamp(client_timestamp)
        db.flush()
    else:
        # Retry loop to solve concurrency conflicts on new sequence generation
        max_attempts = 15
        attempt = 0
        inserted_master = False
        final_exp_id = None
        
        while not inserted_master and attempt < max_attempts:
            month_prefix = dt.strftime("%m/%y")
            matching_rows = db.query(Expense.expense_code).filter(Expense.expense_code.like(f"RJ-{month_prefix}-%")).all()
            max_seq = 0
            for r in matching_rows:
                parts = r[0].split("-")
                if len(parts) == 3:
                    try:
                        num = int(parts[2])
                        if num > max_seq:
                            max_seq = num
                    except ValueError:
                        pass
            
            seq_num = max_seq + 1
            final_exp_id = f"RJ-{month_prefix}-{str(seq_num).zfill(6)}"
            
            # Start nested transaction (Savepoint)
            db.begin_nested()
            try:
                expense = Expense(
                    user_id=current_user.id,
                    expense_code=final_exp_id,
                    month=month_name,
                    year=year_val,
                    amount=total_amount,
                    status="approved" if len(approvers) == 0 else "submitted",
                    travel_mode=major_mode,
                    itinerary=exp_date,  # date string YYYY-MM-DD
                    description=first_purpose,
                    attachments="[]",
                    da_amount=total_da,
                    hotel_amount=total_hotel,
                    other_expense_amount=total_other,
                    local_purchase_amount=total_local_purchase,
                    calls_assigned=total_assigned,
                    calls_completed=total_completed,
                    pms_count=total_pms,
                    asset_tagging=total_asset,
                    calibration_count=total_calibration,
                    mobilise_count=total_mobilise,
                    
                    # Populate original values on submission
                    original_amount=total_amount,
                    original_da_amount=total_da,
                    original_hotel_amount=total_hotel,
                    original_other_expense_amount=total_other,
                    original_local_purchase_amount=total_local_purchase
                )
                if client_timestamp:
                    client_dt = parse_client_timestamp(client_timestamp)
                    expense.created_at = client_dt
                    expense.updated_at = client_dt
                
                db.add(expense)
                db.flush()  # Forces unique constraint verification in database
                inserted_master = True
            except Exception as e:
                db.rollback()  # Rollback only the savepoint sub-transaction
                attempt += 1
                logger.warning(f"Concurrency warning: expense_code {final_exp_id} already exists. Retrying with next sequence (attempt {attempt}/{max_attempts})")
                if attempt >= max_attempts:
                    logger.error(f"Failed to generate unique expense code after {max_attempts} attempts: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail="Concurrency conflict: Could not generate unique expense code. Please submit again."
                    )

    # Process and save itinerary legs and uploaded files
    attachments_list = []
    
    for idx, iti in enumerate(itineraries):
        leg_num = int(iti.get("leg") or (idx + 1))
        iti_id = f"{final_exp_id}-{leg_num}"
        from_dist = iti.get("district_from") or current_user.district or "Jodhpur"
        to_dist = iti.get("district") or "Jodhpur"

        leg_item = ExpenseItinerary(
            itinerary_id=iti_id,
            exp_id=final_exp_id,
            leg_number=leg_num,
            from_district=from_dist,
            to_district=to_dist,
            from_location=iti.get("from"),
            to_location=iti.get("to"),
            travel_mode=iti.get("mode"),
            distance_km=float(iti.get("km") or 0.0),
            travel_amount=float(iti.get("amount") or 0.0),
            sub_mode=iti.get("sub_mode"),
            sub_km=float(iti.get("sub_km") or 0.0),
            sub_amount=float(iti.get("sub_amount") or 0.0),
            da_amount=float(iti.get("da") or 0.0),
            hotel_amount=float(iti.get("hotel") or 0.0),
            local_purchase=float(iti.get("local_purchase") or 0.0),
            other_desc=iti.get("oth_desc"),
            other_amount=float(iti.get("oth_amount") or 0.0),
            calls_assigned=int(iti.get("ws_assigned") or 0),
            calls_completed=int(iti.get("ws_closed") or 0),
            pms_count=int(iti.get("ws_pms") or 0),
            asset_tagging=int(iti.get("ws_asset") or 0),
            calibration_count=int(iti.get("calibration_count") or 0),
            mobilise_count=int(iti.get("mobilise_asset_count") or 0),
            visit_purpose=iti.get("visit_purpose"),
            activity_details=iti.get("activity_details") if isinstance(iti.get("activity_details"), str) else json.dumps(iti.get("activity_details")) if iti.get("activity_details") else None,
            
            # Populate original leg values
            original_distance_km=float(iti.get("km") or 0.0),
            original_travel_amount=float(iti.get("amount") or 0.0),
            original_sub_amount=float(iti.get("sub_amount") or 0.0),
            original_da_amount=float(iti.get("da") or 0.0),
            original_hotel_amount=float(iti.get("hotel") or 0.0),
            original_other_amount=float(iti.get("oth_amount") or 0.0),
            original_local_purchase=float(iti.get("local_purchase") or 0.0)
        )
        db.add(leg_item)
        
        # Flush itinerary immediately to catch DB errors per-leg
        try:
            db.flush()
        except Exception as flush_err:
            logger.error(f"FLUSH ERROR for itinerary leg {leg_num}: {str(flush_err)}")
            raise HTTPException(status_code=500, detail=f"Database error saving itinerary leg {leg_num}: {str(flush_err)}")

        # Save activities breakdown into structured tables
        raw_act = iti.get("activity_details")
        # Handle both string and dict forms of activity_details
        act_details = None
        if raw_act:
            if isinstance(raw_act, str):
                try:
                    act_details = json.loads(raw_act)
                except Exception:
                    act_details = None
            elif isinstance(raw_act, dict):
                act_details = raw_act
        if act_details:
            try:
                selected_acts = act_details.get("selected_activities") or []
                
                from app.models.expense_breakdown_call import ExpenseBreakdownCall
                from app.models.expense_pms_call import ExpensePmsCall
                from app.models.expense_asset_tagging import ExpenseAssetTagging
                from app.models.expense_asset_mobilise import ExpenseAssetMobilise
                from app.models.expense_calibration import ExpenseCalibration

                # 1. Calls list
                if "Calls" in selected_acts:
                    for call in act_details.get("calls_list") or []:
                        asset = call.get("asset_details") or {}
                        call_rec = ExpenseBreakdownCall(
                            itinerary_id=iti_id,
                            barcode=call.get("barcode"),
                            call_type=call.get("type"),
                            call_status=call.get("status"),
                            district_name=asset.get("district_name"),
                            hospital_name=asset.get("hospital_name"),
                            equipment_name=asset.get("equipment_name"),
                            model_name=asset.get("model_name"),
                            inventory_status=asset.get("inventory_status"),
                            photo_url=call.get("photo_url")
                        )
                        db.add(call_rec)
                        
                # 2. PMS list
                if "PMS" in selected_acts:
                    for pms in act_details.get("pms_list") or []:
                        asset = pms.get("asset_details") or {}
                        pms_rec = ExpensePmsCall(
                            itinerary_id=iti_id,
                            barcode=pms.get("barcode"),
                            pms_frequency=pms.get("frequency"),
                            district_name=asset.get("district_name"),
                            hospital_name=asset.get("hospital_name"),
                            equipment_name=asset.get("equipment_name"),
                            model_name=asset.get("model_name"),
                            inventory_status=asset.get("inventory_status"),
                            photo_url=pms.get("photo_url")
                        )
                        db.add(pms_rec)
                        
                # 3. Asset Tagging list
                if "Asset Tagging" in selected_acts:
                    for asset in act_details.get("assets_list") or []:
                        tag_rec = ExpenseAssetTagging(
                            itinerary_id=iti_id,
                            equipment_name=asset.get("equipment_name"),
                            quantity=int(asset.get("quantity") or 0)
                        )
                        db.add(tag_rec)
                        
                # 4. Mobilise Asset Update
                if "Mobilise Asset Update" in selected_acts:
                    qty = int(act_details.get("mobilise_asset_count") or 0)
                    if qty > 0:
                        mob_rec = ExpenseAssetMobilise(
                            itinerary_id=iti_id,
                            quantity=qty
                        )
                        db.add(mob_rec)
                        
                # 5. Calibration
                if "Calibration" in selected_acts:
                    qty = int(act_details.get("calibration_count") or 0)
                    if qty > 0:
                        cal_rec = ExpenseCalibration(
                            itinerary_id=iti_id,
                            quantity=qty
                        )
                        db.add(cal_rec)

                # 6. Other Activity
                if "Other" in selected_acts:
                    other_desc = act_details.get("activity_other_desc")
                    if other_desc and other_desc.strip():
                        from app.models.expense_other_activity import ExpenseOtherActivity
                        other_rec = ExpenseOtherActivity(
                            itinerary_id=iti_id,
                            description=other_desc.strip()
                        )
                        db.add(other_rec)
                
                # Flush breakdown records to catch errors immediately
                db.flush()
            except Exception as e:
                logger.error(f"Error saving activity details breakdown for leg {leg_num}: {str(e)}")

        # Main receipt image
        main_file = form_data.get(f"main_bill_{leg_num}")
        main_type = iti.get("mode") or "Bill"
        if main_file and hasattr(main_file, "filename") and main_file.filename:
            url_path = save_upload_file(main_file, final_exp_id, main_type)
            att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type=main_type, file_url=url_path)
            db.add(att)
            attachments_list.append(url_path)
        else:
            old_url = old_att_map.get((leg_num, main_type))
            if old_url:
                att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type=main_type, file_url=old_url)
                db.add(att)
                attachments_list.append(old_url)

        # Connection receipt image
        sub_file = form_data.get(f"sub_bill_{leg_num}")
        sub_type = iti.get("sub_mode")
        if sub_file and hasattr(sub_file, "filename") and sub_file.filename and sub_type:
            url_path = save_upload_file(sub_file, final_exp_id, sub_type)
            att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type=sub_type, file_url=url_path)
            db.add(att)
            attachments_list.append(url_path)
        elif sub_type:
            old_url = old_att_map.get((leg_num, sub_type))
            if old_url:
                att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type=sub_type, file_url=old_url)
                db.add(att)
                attachments_list.append(old_url)

        # Communication Mail image (outdoor requirement)
        comm_file = form_data.get(f"comm_mail_{leg_num}")
        if comm_file and hasattr(comm_file, "filename") and comm_file.filename:
            url_path = save_upload_file(comm_file, final_exp_id, "Communication_Mail")
            att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type="Communication_Mail", file_url=url_path)
            db.add(att)
            attachments_list.append(url_path)
        else:
            old_url = old_att_map.get((leg_num, "Communication_Mail"))
            if old_url:
                att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type="Communication_Mail", file_url=old_url)
                db.add(att)
                attachments_list.append(old_url)

        # Hotel stay image (Leg 1 only)
        if leg_num == 1:
            hotel_file = form_data.get("hotel_bill_1")
            if hotel_file and hasattr(hotel_file, "filename") and hotel_file.filename:
                url_path = save_upload_file(hotel_file, final_exp_id, "Hotel")
                att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type="Hotel", file_url=url_path)
                db.add(att)
                attachments_list.append(url_path)
            else:
                old_url = old_att_map.get((1, "Hotel"))
                if old_url:
                    att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type="Hotel", file_url=old_url)
                    db.add(att)
                    attachments_list.append(old_url)

        # Other expenses receipt image
        oth_file = form_data.get(f"oth_bill_{leg_num}")
        if oth_file and hasattr(oth_file, "filename") and oth_file.filename:
            url_path = save_upload_file(oth_file, final_exp_id, "Other_Expense")
            att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type="Other_Expense", file_url=url_path)
            db.add(att)
            attachments_list.append(url_path)
        else:
            old_url = old_att_map.get((leg_num, "Other_Expense"))
            if old_url:
                att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type="Other_Expense", file_url=old_url)
                db.add(att)
                attachments_list.append(old_url)

        # Local Purchase receipt image
        lp_file = form_data.get(f"local_purchase_bill_{leg_num}")
        if lp_file and hasattr(lp_file, "filename") and lp_file.filename:
            url_path = save_upload_file(lp_file, final_exp_id, "Local_Purchase")
            att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type="Local_Purchase", file_url=url_path)
            db.add(att)
            attachments_list.append(url_path)
        else:
            old_url = old_att_map.get((leg_num, "Local_Purchase"))
            if old_url:
                att = ExpenseAttachment(exp_id=final_exp_id, itinerary_id=iti_id, bill_type="Local_Purchase", file_url=old_url)
                db.add(att)
                attachments_list.append(old_url)

    expense.attachments = json.dumps(attachments_list)

    # Generate sequential approvals flow
    for index, app in enumerate(approvers):
        app_status = "pending" if index == 0 else "waiting"
        approval_step = Approval(
            expense_id=expense.id,
            approver_id=app.approver_id,
            level_number=app.level_number,
            status=app_status,
            comments=""
        )
        if client_timestamp:
            client_dt = parse_client_timestamp(client_timestamp)
            approval_step.created_at = client_dt
            approval_step.updated_at = client_dt
        db.add(approval_step)

    db.commit()

    # Trigger notification to the first approver
    try:
        if approvers:
            approver_user = db.query(User).filter(User.id == approvers[0].approver_id).first()
            if approver_user:
                from app.utils.db_notifications import create_notification
                create_notification(
                    db=db,
                    user_id=approver_user.user_id,
                    title="📥 New Pending Approval",
                    description=f"New claim {expense.expense_code} submitted by {current_user.name} (₹{expense.amount:,.0f}) is waiting for your review.",
                    notification_type="warning",
                    link="/approval-center"
                )
    except Exception as notif_err:
        logger.error(f"FCM/DB Notification error in submit_expense: {notif_err}")

    from app.utils import cache
    cache.clear_user_and_managers_cache(db, current_user.user_id)

    return {
        "success": True,
        "message": f"Expense claim submitted successfully.",
        "exp_id": final_exp_id
    }

@router.get("/month-summary")
async def get_month_summary(
    month: Optional[str] = None,
    year: Optional[int] = None,
    district: Optional[str] = None,
    engineer: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Engineer-wise approved expense summary grouped by month/year. Used for Month Summary report page."""
    # Role-based scoping: Admin/Superadmin/Accounts see all; Managers/Coordinators see team
    role = current_user.role or ""
    name_clean = current_user.name.strip()
    uid_clean = current_user.user_id.strip()

    if role in ["Admin", "Superadmin", "MIS", "Accounts"]:
        scope_users = db.query(User).all()
    else:
        scope_users = db.query(User).filter(
            (func.lower(User.manager) == func.lower(name_clean)) |
            (func.lower(User.manager) == func.lower(uid_clean)) |
            (func.lower(User.coordinator) == func.lower(name_clean)) |
            (func.lower(User.coordinator) == func.lower(uid_clean)) |
            (func.lower(User.zonal_manager) == func.lower(name_clean)) |
            (func.lower(User.zonal_manager) == func.lower(uid_clean))
        ).all()

    if not scope_users:
        return {"success": True, "data": [], "districts": []}

    scope_user_ids = [u.id for u in scope_users]
    user_map = {u.id: u for u in scope_users}

    # Query approved expenses (fully approved = status "approved")
    q = db.query(Expense).filter(
        Expense.user_id.in_(scope_user_ids),
        Expense.status == "approved"
    )
    if month:
        q = q.filter(Expense.month == month)
    if year:
        q = q.filter(Expense.year == year)
    expenses = q.all()

    if not expenses:
        districts = sorted({u.district for u in scope_users if u.district})
        return {"success": True, "data": [], "districts": list(districts)}

    # Pre-fetch itineraries for distance/travel computations
    expense_codes = [e.expense_code for e in expenses if e.expense_code]
    all_legs = db.query(ExpenseItinerary).filter(ExpenseItinerary.exp_id.in_(expense_codes)).all()
    legs_by_code: dict = {}
    for leg in all_legs:
        legs_by_code.setdefault(leg.exp_id, []).append(leg)

    # Group by (user_id, month, year)
    from collections import defaultdict
    groups: dict = defaultdict(list)
    for exp in expenses:
        groups[(exp.user_id, exp.month, exp.year)].append(exp)

    rows = []
    for (uid, mon, yr), exps in groups.items():
        user = user_map.get(uid)
        if not user:
            continue
        # Apply engineer filter
        if engineer:
            eng_lower = engineer.lower()
            if eng_lower not in (user.name or "").lower() and eng_lower not in (user.e_code or "").lower() and eng_lower not in (user.user_id or "").lower():
                continue
        # Apply district filter
        if district and (user.district or "") != district:
            continue

        total_amount = sum(e.amount or 0.0 for e in exps)
        total_da = sum(e.da_amount or 0.0 for e in exps)
        total_hotel = sum(e.hotel_amount or 0.0 for e in exps)
        total_other = sum(e.other_expense_amount or 0.0 for e in exps)
        total_local = sum(e.local_purchase_amount or 0.0 for e in exps)

        total_km = 0.0
        total_bike_amount = 0.0
        total_car_amount = 0.0
        total_auto_amount = 0.0
        for exp in exps:
            legs = legs_by_code.get(exp.expense_code, [])
            total_km += sum(l.distance_km or 0.0 for l in legs if l.travel_mode in ["Bike", "Car"])
            total_bike_amount += sum(l.travel_amount or 0.0 for l in legs if l.travel_mode == "Bike")
            total_car_amount += sum(l.travel_amount or 0.0 for l in legs if l.travel_mode == "Car")
            total_auto_amount += (
                sum(l.travel_amount or 0.0 for l in legs if l.travel_mode == "Auto") +
                sum(l.sub_amount or 0.0 for l in legs if l.sub_mode == "Auto")
            )

        rows.append({
            "user_id": user.user_id,
            "e_code": user.e_code or user.user_id,
            "name": user.name,
            "designation": user.designation or "Engineer",
            "grade": user.grade or "",
            "district": user.district or "",
            "zone": user.zone or "",
            "manager": user.manager or "",
            "month": mon,
            "year": yr,
            "claims_count": len(exps),
            "total_amount": round(total_amount, 2),
            "da_amount": round(total_da, 2),
            "hotel_amount": round(total_hotel, 2),
            "bike_amount": round(total_bike_amount, 2),
            "car_amount": round(total_car_amount, 2),
            "auto_amount": round(total_auto_amount, 2),
            "other_amount": round(total_other, 2),
            "local_purchase_amount": round(total_local, 2),
            "total_km": round(total_km, 2),
            "expense_codes": [e.expense_code for e in exps if e.expense_code],
            "expense_ids": [e.id for e in exps],
        })

    # Sort: year desc, month asc, name asc
    month_order = {"January":1,"February":2,"March":3,"April":4,"May":5,"June":6,
                   "July":7,"August":8,"September":9,"October":10,"November":11,"December":12}
    rows.sort(key=lambda r: (-r["year"], month_order.get(r["month"], 0), r["name"]))

    districts = sorted({u.district for u in scope_users if u.district})
    return {"success": True, "data": rows, "districts": list(districts)}


@router.get("/engineer-month-claims")
async def get_engineer_month_claims(
    user_code: str,
    month: str,
    year: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all individual approved expense claims (with per-leg itinerary detail) for a specific engineer
    in a given month/year. Used for detailed PDF generation on the Month Summary page."""
    # Resolve the target engineer
    target_user = db.query(User).filter(
        (User.user_id == user_code) | (User.e_code == user_code)
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Engineer not found")

    # Scope check: Admin/Superadmin/Accounts can access any; others must manage the engineer
    role = current_user.role or ""
    if role not in ["Admin", "Superadmin", "MIS", "Accounts"]:
        name_c = current_user.name.strip().lower()
        uid_c = current_user.user_id.strip().lower()
        mgr = (target_user.manager or "").strip().lower()
        coord = (target_user.coordinator or "").strip().lower()
        zm = (target_user.zonal_manager or "").strip().lower()
        is_manager = name_c in (mgr, zm, coord) or uid_c in (mgr, zm, coord)
        # Also check hierarchy
        is_hierarchy = db.query(HierarchyApprover).join(
            HierarchyRequester,
            HierarchyApprover.hierarchy_id == HierarchyRequester.hierarchy_id
        ).filter(
            HierarchyApprover.approver_id == current_user.id,
            HierarchyRequester.user_id == target_user.id
        ).first() is not None
        if not is_manager and not is_hierarchy:
            raise HTTPException(status_code=403, detail="Access denied")

    # Fetch approved expenses
    expenses = db.query(Expense).filter(
        Expense.user_id == target_user.id,
        Expense.month == month,
        Expense.year == year,
        Expense.status == "approved"
    ).order_by(Expense.itinerary).all()

    if not expenses:
        return {"success": True, "claims": [], "user": {
            "name": target_user.name,
            "e_code": target_user.e_code or target_user.user_id,
            "grade": target_user.grade or "",
            "designation": target_user.designation or "Engineer",
            "district": target_user.district or "",
            "zone": target_user.zone or "",
            "manager": target_user.manager or "",
            "month": month, "year": year
        }}

    expense_codes = [e.expense_code for e in expenses if e.expense_code]
    
    # Fetch asset value master into a dictionary: equipment_name -> tender_cost
    asset_costs = {}
    try:
        sql = text("SELECT equipment_name, rmsc_tender_cost FROM asset_value_master")
        results = db.execute(sql).fetchall()
        asset_costs = {r[0].strip().lower(): float(r[1] or 0.0) for r in results if r[0]}
    except Exception:
        pass

    # Query all asset taggings for these legs in batch
    all_legs = db.query(ExpenseItinerary).filter(
        ExpenseItinerary.exp_id.in_(expense_codes)
    ).order_by(ExpenseItinerary.exp_id, ExpenseItinerary.leg_number).all()
    
    iti_ids = [l.itinerary_id for l in all_legs]
    from app.models.expense_asset_tagging import ExpenseAssetTagging
    taggings = db.query(ExpenseAssetTagging).filter(
        ExpenseAssetTagging.itinerary_id.in_(iti_ids)
    ).all()
    taggings_by_iti: dict = {}
    for t in taggings:
        taggings_by_iti.setdefault(t.itinerary_id, []).append(t)

    legs_by_code: dict = {}
    for leg in all_legs:
        legs_by_code.setdefault(leg.exp_id, []).append(leg)

    claims = []
    for exp in expenses:
        legs = legs_by_code.get(exp.expense_code, [])
        leg_data = []
        for leg in legs:
            auto_amt = 0.0
            if leg.travel_mode == "Auto":
                auto_amt = leg.travel_amount or 0.0
            if leg.sub_mode == "Auto":
                auto_amt += leg.sub_amount or 0.0
            bike_km = leg.distance_km if leg.travel_mode == "Bike" else 0.0
            car_km = leg.distance_km if leg.travel_mode == "Car" else 0.0
            bike_amt = leg.travel_amount if leg.travel_mode == "Bike" else 0.0
            car_amt = leg.travel_amount if leg.travel_mode == "Car" else 0.0
            
            # Extract barcodes from activity_details
            barcodes = []
            raw_act = leg.activity_details
            if raw_act:
                try:
                    act_details = json.loads(raw_act) if isinstance(raw_act, str) else raw_act
                    if isinstance(act_details, dict):
                        for item in (act_details.get("calls_list") or []):
                            if item.get("barcode"):
                                barcodes.append(item.get("barcode"))
                        for item in (act_details.get("pms_list") or []):
                            if item.get("barcode") and item.get("barcode") not in barcodes:
                                barcodes.append(item.get("barcode"))
                except Exception:
                    pass

            # Calculate total asset tagging qty and value
            leg_tags = taggings_by_iti.get(leg.itinerary_id, [])
            total_tag_qty = sum(t.quantity or 0 for t in leg_tags)
            total_tag_val = sum((t.quantity or 0) * asset_costs.get((t.equipment_name or "").strip().lower(), 0.0) for t in leg_tags)

            tag_info = ""
            if total_tag_qty > 0:
                tag_info = f"Qty: {total_tag_qty} | ₹{total_tag_val:,.0f}"
            
            barcode_ticket_str = ", ".join(barcodes) if barcodes else ""
            if tag_info:
                if barcode_ticket_str:
                    barcode_ticket_str += f" | {tag_info}"
                else:
                    barcode_ticket_str = tag_info

            leg_data.append({
                "leg_number": leg.leg_number,
                "from_location": leg.from_location or leg.from_district or "—",
                "to_location": leg.to_location or leg.to_district or "—",
                "travel_mode": leg.travel_mode or "—",
                "distance_km": leg.distance_km or 0.0,
                "bike_km": bike_km,
                "car_km": car_km,
                "bike_amount": bike_amt or 0.0,
                "car_amount": car_amt or 0.0,
                "auto_amount": auto_amt,
                "da_amount": leg.da_amount or 0.0,
                "hotel_amount": leg.hotel_amount or 0.0,
                "local_purchase": leg.local_purchase or 0.0,
                "other_amount": leg.other_amount or 0.0,
                "other_desc": leg.other_desc or "",
                "visit_purpose": leg.visit_purpose or "",
                "calls_assigned": leg.calls_assigned or 0,
                "calls_completed": leg.calls_completed or 0,
                "pms_count": leg.pms_count or 0,
                "worked_district": leg.to_district or leg.from_district or "",
                "ta_amount": (leg.travel_amount or 0.0) if leg.travel_mode in ["Train", "Bus"] else 0.0,
                "sub_mode": leg.sub_mode or "",
                "sub_amount": leg.sub_amount or 0.0,
                "barcode_ticket": barcode_ticket_str,
                "asset_tagging_qty": total_tag_qty,
                "asset_tagging_val": total_tag_val,
                "calibration_count": leg.calibration_count or 0,
                "activity_details": leg.activity_details or "",
            })
        claims.append({
            "expense_code": exp.expense_code,
            "date": exp.itinerary,
            "amount": exp.amount or 0.0,
            "da_amount": exp.da_amount or 0.0,
            "hotel_amount": exp.hotel_amount or 0.0,
            "other_amount": exp.other_expense_amount or 0.0,
            "local_purchase_amount": exp.local_purchase_amount or 0.0,
            "legs": leg_data,
        })

    # Query all attachments for these expenses (excluding PMS/calls since those aren't in this table)
    attachments_list = db.query(ExpenseAttachment).filter(
        ExpenseAttachment.exp_id.in_(expense_codes)
    ).all()
    
    expense_date_map = {e.expense_code: e.itinerary for e in expenses if e.expense_code}
    valid_attachments = [
        {
            "file_url": a.file_url,
            "date": expense_date_map.get(a.exp_id, "")
        }
        for a in attachments_list
        if a.file_url and not any(x in (a.bill_type or "").lower() for x in ["pms", "call"])
    ]

    return {
        "success": True,
        "user": {
            "name": target_user.name,
            "user_id": target_user.user_id,
            "e_code": target_user.e_code or target_user.user_id,
            "grade": target_user.grade or "",
            "designation": target_user.designation or "Engineer",
            "district": target_user.district or "",
            "zone": target_user.zone or "",
            "manager": target_user.manager or "",
            "coordinator": target_user.coordinator or "",
            "mobile": target_user.mobile_number or "",
            "type": target_user.type or (target_user.zone or ""),
            "month": month,
            "year": year
        },
        "claims": claims,
        "attachments": valid_attachments
    }


@router.get("/")
async def get_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all submitted expense claims for the current user."""
    # Disable caching to ensure fresh zone and district maps are processed
    pass

    expenses = db.query(Expense).filter(Expense.user_id == current_user.id).order_by(Expense.created_at.desc()).all()
    if not expenses:
        return []
        
    expense_codes = [e.expense_code for e in expenses]
    
    # Pre-fetch all itineraries for user's expenses in one query
    all_legs = db.query(ExpenseItinerary).filter(ExpenseItinerary.exp_id.in_(expense_codes)).all()
    legs_by_code = {}
    for l in all_legs:
        if l.exp_id not in legs_by_code:
            legs_by_code[l.exp_id] = []
        legs_by_code[l.exp_id].append(l)

    result = []
    # Pre-fetch submitter details for current user's expenses
    submitter_cache = {current_user.id: current_user}
    for exp in expenses:
        sub_obj = submitter_cache.get(exp.user_id)
        if not sub_obj:
            sub_obj = db.query(User).filter(User.id == exp.user_id).first()
            if sub_obj:
                submitter_cache[exp.user_id] = sub_obj
        
        legs = legs_by_code.get(exp.expense_code, [])
        tot_km = sum(l.distance_km or 0.0 for l in legs if l.travel_mode in ["Bike", "Car"])
        tot_auto = sum(l.travel_amount or 0.0 for l in legs if l.travel_mode == "Auto") + \
                   sum(l.sub_amount or 0.0 for l in legs if l.sub_mode == "Auto")
        
        bike_amount = sum(l.travel_amount or 0.0 for l in legs if l.travel_mode == "Bike")
        car_amount = sum(l.travel_amount or 0.0 for l in legs if l.travel_mode == "Car")
        
        result.append({
            "id": exp.id,
            "expense_code": exp.expense_code,
            "user_id": exp.user_id,
            "month": exp.month,
            "year": exp.year,
            "amount": exp.amount,
            "status": exp.status,
            "travel_mode": exp.travel_mode,
            "itinerary": exp.itinerary,
            "description": exp.description,
            "attachments": exp.attachments,
            "da_amount": exp.da_amount or 0.0,
            "hotel_amount": exp.hotel_amount or 0.0,
            "other_expense_amount": exp.other_expense_amount or 0.0,
            "local_purchase_amount": exp.local_purchase_amount or 0.0,
            "calls_assigned": exp.calls_assigned,
            "calls_completed": exp.calls_completed,
            "pms_count": exp.pms_count,
            "asset_tagging": exp.asset_tagging,
            "created_at": exp.created_at,
            "updated_at": exp.updated_at,
            "total_km": tot_km,
            "total_auto": tot_auto,
            "bike_amount": bike_amount,
            "car_amount": car_amount,
            "auto_amount": tot_auto,
            "district": sub_obj.district if sub_obj and sub_obj.district else "Ganganar",
            "zone": sub_obj.zone if sub_obj and sub_obj.zone else "Bikaner",
            "legs": [
                {
                    "leg": l.leg_number,
                    "from_district": l.from_district,
                    "to_district": l.to_district,
                    "from": l.from_location or "",
                    "to": l.to_location or "",
                    "mode": l.travel_mode,
                    "km": l.distance_km,
                    "amount": l.travel_amount,
                    "sub_mode": l.sub_mode,
                    "sub_amount": l.sub_amount,
                    "da": l.da_amount,
                    "hotel": l.hotel_amount,
                    "local_purchase": l.local_purchase,
                    "other_desc": l.other_desc or "",
                    "other_amount": l.other_amount,
                    "visit_purpose": l.visit_purpose or "",
                    "activity_details": l.activity_details or ""
                }
                for l in legs
            ]
        })
    return result

@router.get("/team")
async def get_team_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all submitted expense claims for the user's team members."""
    # Disable caching to ensure fresh zone and district maps are processed
    pass

    # Check if user has approval access or is mapped to manage someone
    name_clean = current_user.name.strip()
    uid_clean = current_user.user_id.strip()
    allowed_windows = current_user.allowed_windows.split(",") if current_user.allowed_windows else []
    allowed_windows = [w.strip().lower() for w in allowed_windows]
    
    # Query team members
    query_users = db.query(User)
    if current_user.role in ["Admin", "MIS", "VP", "Accountant"]:
        # Admin, MIS, VP, and Accountant can see all expenses
        team_users = query_users.all()
    else:
        # Pre-fetch direct reports upfront to avoid redundant DB checks
        direct_reports = query_users.filter(
            (func.lower(User.manager) == func.lower(name_clean)) |
            (func.lower(User.manager) == func.lower(uid_clean)) |
            (func.lower(User.coordinator) == func.lower(name_clean)) |
            (func.lower(User.coordinator) == func.lower(uid_clean)) |
            (func.lower(User.zonal_manager) == func.lower(name_clean)) |
            (func.lower(User.zonal_manager) == func.lower(uid_clean))
        ).all()
        has_direct_reports = len(direct_reports) > 0

        # Check if configured as an approver in any hierarchy
        is_hierarchy_approver = db.query(HierarchyApprover).filter(
            HierarchyApprover.approver_id == current_user.id
        ).first() is not None

        is_team_lead = (
            "approval" in allowed_windows or
            has_direct_reports or
            is_hierarchy_approver
        )
        if not is_team_lead:
            return []

        hierarchy_ids_query = db.query(HierarchyApprover.hierarchy_id).filter(
            HierarchyApprover.approver_id == current_user.id
        ).subquery()
        
        hierarchy_requester_ids = db.query(HierarchyRequester.user_id).filter(
            HierarchyRequester.hierarchy_id.in_(hierarchy_ids_query)
        ).subquery()
        
        hierarchy_reports = query_users.filter(User.id.in_(hierarchy_requester_ids)).all()
        
        # Merge lists and de-duplicate
        reports_map = {u.id: u for u in (direct_reports + hierarchy_reports)}
        team_users = list(reports_map.values())
        
    if not team_users:
        return []
        
    team_user_ids = [u.id for u in team_users]
    submitters_by_id = {u.id: u for u in team_users}
    
    # Retrieve all expenses for team members
    expenses = db.query(Expense).filter(Expense.user_id.in_(team_user_ids)).order_by(Expense.created_at.desc()).all()
    if not expenses:
        return []
        
    expense_codes = [e.expense_code for e in expenses]
    
    # Pre-fetch all team itineraries in a single query
    all_legs = db.query(ExpenseItinerary).filter(ExpenseItinerary.exp_id.in_(expense_codes)).all()
    legs_by_code = {}
    for l in all_legs:
        if l.exp_id not in legs_by_code:
            legs_by_code[l.exp_id] = []
        legs_by_code[l.exp_id].append(l)
    
    result = []
    for exp in expenses:
        submitter = submitters_by_id.get(exp.user_id)
        if not submitter:
            # Direct database fallback query to prevent unmapped user settings
            submitter = db.query(User).filter(User.id == exp.user_id).first()
            if submitter:
                submitters_by_id[exp.user_id] = submitter
        legs = legs_by_code.get(exp.expense_code, [])
        tot_km = sum(l.distance_km or 0.0 for l in legs if l.travel_mode in ["Bike", "Car"])
        tot_auto = sum(l.travel_amount or 0.0 for l in legs if l.travel_mode == "Auto") + \
                   sum(l.sub_amount or 0.0 for l in legs if l.sub_mode == "Auto")
        
        bike_amount = sum(l.travel_amount or 0.0 for l in legs if l.travel_mode == "Bike")
        car_amount = sum(l.travel_amount or 0.0 for l in legs if l.travel_mode == "Car")
        
        result.append({
            "id": exp.id,
            "expense_code": exp.expense_code,
            "submitter_name": submitter.name if submitter else "Unknown",
            "submitter_code": submitter.user_id if submitter else "N/A",
            "submitter_designation": submitter.designation if submitter and submitter.designation else "Engineer",
            "month": exp.month,
            "year": exp.year,
            "amount": exp.amount,
            "status": exp.status,
            "category": exp.travel_mode,
            "date": exp.itinerary,
            "purpose": exp.description,
            "created_at": exp.created_at,
            "total_km": tot_km,
            "total_auto": tot_auto,
            "bike_amount": bike_amount,
            "car_amount": car_amount,
            "auto_amount": tot_auto,
            "da_amount": exp.da_amount or 0.0,
            "hotel_amount": exp.hotel_amount or 0.0,
            "other_expense_amount": exp.other_expense_amount or 0.0,
            "local_purchase_amount": exp.local_purchase_amount or 0.0,
            "district": submitter.district if submitter and submitter.district else "Ganganar",
            "zone": submitter.zone if submitter and submitter.zone else "Bikaner"
        })
        
    return result

@router.get("/verify-barcode")
async def verify_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if len(barcode) != 8:
        raise HTTPException(status_code=400, detail="Barcode must be exactly 8 digits.")
    
    # Query assets_inventory matching right-most 8 characters of qr_code
    sql = text("""
        SELECT district_name, hospital_name, equipment_name, model_name, qr_code, inventory_status 
        FROM assets_inventory 
        WHERE substr(qr_code, -8) = :barcode
    """)
    result = db.execute(sql, {"barcode": barcode}).fetchone()
    if not result:
        return {"success": False, "message": "Barcode not found in assets inventory."}
    
    return {
        "success": True,
        "data": {
            "district_name": result[0],
            "hospital_name": result[1],
            "equipment_name": result[2],
            "model_name": result[3],
            "qr_code": result[4],
            "inventory_status": result[5]
        }
    }

@router.get("/asset-value-master")
async def get_asset_value_master(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sql = text("SELECT equipment_name, rmsc_tender_cost FROM asset_value_master")
    results = db.execute(sql).fetchall()
    return [
        {"equipment_name": r[0], "rmsc_tender_cost": r[1]}
        for r in results
    ]

from pydantic import BaseModel

class EngineerAdvanceUpsertSchema(BaseModel):
    user_code: str
    month: str
    year: int
    advance_amount: float

@router.get("/engineer-advance")
async def get_engineer_advance(
    user_code: str,
    month: str,
    year: int,
    db: Session = Depends(get_db)
):
    from app.models.engineer_advance import EngineerAdvance
    adv = db.query(EngineerAdvance).filter(
        EngineerAdvance.user_id == user_code,
        EngineerAdvance.month == month,
        EngineerAdvance.year == year
    ).first()
    
    return {
        "success": True,
        "exists": adv is not None,
        "advance_amount": adv.advance_amount if adv else 0.0
    }

@router.post("/engineer-advance")
async def upsert_engineer_advance(
    req: EngineerAdvanceUpsertSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_lower = current_user.role.lower().strip() if current_user.role else ""
    if role_lower not in ["coordinator", "accountant", "travel desk", "admin", "superadmin"]:
        raise HTTPException(
            status_code=403, 
            detail="Only coordinators, accountants, travel desks, and admins can set advance amounts."
        )
        
    from app.models.engineer_advance import EngineerAdvance
    adv = db.query(EngineerAdvance).filter(
        EngineerAdvance.user_id == req.user_code,
        EngineerAdvance.month == req.month,
        EngineerAdvance.year == req.year
    ).first()
    
    if adv:
        adv.advance_amount = req.advance_amount
        adv.created_by = current_user.user_id
    else:
        adv = EngineerAdvance(
            user_id=req.user_code,
            month=req.month,
            year=req.year,
            advance_amount=req.advance_amount,
            created_by=current_user.user_id
        )
        db.add(adv)
        
    db.commit()
    return {
        "success": True,
        "message": "Advance amount saved successfully",
        "advance_amount": req.advance_amount
    }

@router.get("/consolidated-report")
async def get_consolidated_report(
    month: str,
    year: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Role or Allowed Windows checking
    role_lower = current_user.role.lower().strip() if current_user.role else ""
    allowed_wins = [w.strip().lower() for w in (current_user.allowed_windows or "").split(",") if w.strip()]
    
    if (role_lower not in ["coordinator", "accountant", "travel desk", "admin", "superadmin", "mis", "hr", "vp"]
        and "consolidated_report" not in allowed_wins):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view consolidated reports."
        )

    # 1. Query all users (to map user details)
    users = db.query(User).all()
    user_map = {u.id: u for u in users}
    user_by_code = {u.user_id: u for u in users}

    # 2. Query all approved expenses for the given month and year
    expenses = db.query(Expense).filter(
        Expense.month == month,
        Expense.year == year,
        Expense.status == "approved"
    ).all()

    if not expenses:
        return {"success": True, "data": []}

    expense_ids = [e.id for e in expenses]
    expense_codes = [e.expense_code for e in expenses if e.expense_code]

    # 3. Query all itineraries for these expenses
    legs = db.query(ExpenseItinerary).filter(
        ExpenseItinerary.exp_id.in_(expense_codes)
    ).all()

    legs_by_code = {}
    for leg in legs:
        legs_by_code.setdefault(leg.exp_id, []).append(leg)

    # 4. Query all advances for these users in this month/year
    from app.models.engineer_advance import EngineerAdvance
    advances = db.query(EngineerAdvance).filter(
        EngineerAdvance.month == month,
        EngineerAdvance.year == year
    ).all()
    advances_map = {adv.user_id: adv.advance_amount for adv in advances}

    # 5. Query all edit logs for these expenses
    from app.models.expense_edit_log import ExpenseEditLog
    edit_logs = db.query(ExpenseEditLog).filter(
        ExpenseEditLog.expense_id.in_(expense_ids)
    ).all()

    comments_by_expense = {}
    for log in edit_logs:
        if log.comment and log.comment.strip():
            comments_by_expense.setdefault(log.expense_id, []).append(log.comment.strip())

    # 6. Group expenses by user
    expenses_by_user = {}
    for exp in expenses:
        # Find the user object (exp.user_id is user.id in users table)
        usr = user_map.get(exp.user_id)
        if not usr:
            continue
        expenses_by_user.setdefault(usr.user_id, []).append(exp)

    # 7. Compile report rows
    report_rows = []
    for user_code, user_exps in expenses_by_user.items():
        usr = user_by_code.get(user_code)
        if not usr:
            continue

        # Initialize sums
        travel_expense = 0.0
        bike_km = 0.0
        car_km = 0.0
        auto_amount = 0.0
        train_bus_amount = 0.0
        da_allowance = 0.0
        spare_purchase = 0.0
        courier_charges = 0.0
        boarding_lodging = 0.0
        printing_stationery = 0.0
        claimed_amount = 0.0

        all_comments = []

        for exp in user_exps:
            claimed_amount += (exp.original_amount or exp.amount or 0.0)
            
            # Fetch comments for this expense
            exp_comments = comments_by_expense.get(exp.id, [])
            all_comments.extend(exp_comments)

            exp_legs = legs_by_code.get(exp.expense_code, [])
            for leg in exp_legs:
                # Travel Modes calculation:
                # Bike: KM * 4.5
                # Car: KM * 9.0
                # Auto: travel_amount if mode Auto, plus sub_amount if sub_mode Auto
                # Train/Bus: travel_amount if mode Train/Bus
                mode = (leg.travel_mode or "").strip().lower()
                sub_mode = (leg.sub_mode or "").strip().lower()

                km_part = 0.0
                if mode == "bike":
                    km_part = (leg.distance_km or 0.0) * 4.5
                    bike_km += (leg.distance_km or 0.0)
                elif mode == "car":
                    km_part = (leg.distance_km or 0.0) * 9.0
                    car_km += (leg.distance_km or 0.0)

                auto_part = 0.0
                if mode == "auto":
                    auto_part += (leg.travel_amount or 0.0)
                    auto_amount += (leg.travel_amount or 0.0)
                if sub_mode == "auto":
                    auto_part += (leg.sub_amount or 0.0)
                    auto_amount += (leg.sub_amount or 0.0)

                ta_part = 0.0
                if mode in ["train", "bus"]:
                    ta_part += (leg.travel_amount or 0.0)
                    train_bus_amount += (leg.travel_amount or 0.0)

                travel_expense += (km_part + auto_part + ta_part)

                # DA
                da_allowance += (leg.da_amount or 0.0)

                # Local spare purchase
                spare_purchase += (leg.local_purchase or 0.0)

                # Hotel (Boarding & Lodging)
                boarding_lodging += (leg.hotel_amount or 0.0)

                # Courier & Printing/Stationery categorization from other_amount
                oth_desc = (leg.other_desc or "").strip().lower()
                oth_amt = (leg.other_amount or 0.0)
                if oth_amt > 0:
                    if "courier" in oth_desc or "courrier" in oth_desc:
                        courier_charges += oth_amt
                    elif any(k in oth_desc for k in ["print", "stationery", "photocopy", "photo copy", "xerox", "copy"]):
                        printing_stationery += oth_amt
                    else:
                        printing_stationery += oth_amt

        # Advance
        user_advance = advances_map.get(usr.user_id, 0.0)

        # Total columns sum
        row_total = (travel_expense + da_allowance + spare_purchase + 
                     courier_charges + boarding_lodging + printing_stationery)

        # Net payable
        net_payable = row_total - user_advance

        # Unique comments
        deduction_reason = "; ".join(list(set(all_comments)))

        report_rows.append({
            "zone": usr.zone or "",
            "ee_code": usr.e_code or usr.user_id,
            "grade": usr.grade or "",
            "cc": usr.district or "",
            "ee_name": usr.name,
            "doj": usr.date_of_joining or "",
            "travel_expense": round(travel_expense, 2),
            "bike_km": round(bike_km, 2),
            "car_km": round(car_km, 2),
            "auto_amount": round(auto_amount, 2),
            "train_bus_amount": round(train_bus_amount, 2),
            "da_allowance": round(da_allowance, 2),
            "spare_purchase": round(spare_purchase, 2),
            "courier_charges": round(courier_charges, 2),
            "boarding_lodging": round(boarding_lodging, 2),
            "printing_stationery": round(printing_stationery, 2),
            "misc_expenses": 0.0,
            "fuel_expenses": 0.0,
            "total": round(row_total, 2),
            "advance": round(user_advance, 2),
            "net_payable": round(net_payable, 2),
            "gst_bills": "",
            "deduction_reason": deduction_reason,
            "remarks": "",
            "claimed_amount": round(claimed_amount, 2)
        })

    return {"success": True, "data": report_rows}

@router.get("/{expense_id}")
async def get_expense_details(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves full details of a specific claim, including itineraries, attachments, and approvals."""
    # Look up expense by PK ID or generated expense_code
    query = db.query(Expense)
    if expense_id.isdigit():
        expense = query.filter((Expense.id == int(expense_id)) | (Expense.expense_code == expense_id)).first()
    else:
        expense = query.filter(Expense.expense_code == expense_id).first()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense claim not found.")

    # Permissions check: Submit user or assigned approver or Admin
    approvals = db.query(Approval).filter(Approval.expense_id == expense.id).order_by(Approval.level_number).all()
    
    # Pre-fetch all approver users in a single batch query (avoids N+1)
    approver_ids = list(set(a.approver_id for a in approvals))
    approver_users = {u.id: u for u in db.query(User).filter(User.id.in_(approver_ids)).all()} if approver_ids else {}
    
    approvals_list = []
    is_approver = False
    
    for a in approvals:
        if a.approver_id == current_user.id:
            is_approver = True
        approver_user = approver_users.get(a.approver_id)
        approvals_list.append({
            "id": a.id,
            "level_number": a.level_number,
            "approver_name": approver_user.name if approver_user else f"Approver ID {a.approver_id}",
            "approver_code": approver_user.user_id if approver_user else "",
            "approver_role": approver_user.role if approver_user else "",
            "status": a.status,
            "comments": a.comments,
            "updated_at": a.updated_at
        })

    if expense.user_id != current_user.id and current_user.role != "Admin" and not is_approver:
        raise HTTPException(status_code=403, detail="Access denied to view this expense claim.")

    submitter = db.query(User).filter(User.id == expense.user_id).first()
    
    # Load itineraries
    itineraries = db.query(ExpenseItinerary).filter(
        ExpenseItinerary.exp_id == expense.expense_code
    ).order_by(ExpenseItinerary.leg_number).all()

    # Load attachments
    attachments = db.query(ExpenseAttachment).filter(ExpenseAttachment.exp_id == expense.expense_code).all()

    # Load edit logs history
    from app.models.expense_edit_log import ExpenseEditLog
    edit_logs = db.query(ExpenseEditLog).filter(ExpenseEditLog.expense_id == expense.id).order_by(ExpenseEditLog.created_at.desc()).all()
    edit_history_list = [
        {
            "id": el.id,
            "editor_name": el.editor_name,
            "editor_role": el.editor_role,
            "leg_number": el.leg_number,
            "field_name": el.field_name,
            "old_value": el.old_value,
            "new_value": el.new_value,
            "comment": el.comment,
            "created_at": el.created_at
        } for el in edit_logs
    ]

    return {
        "id": expense.id,
        "expense_code": expense.expense_code,
        "user_id": expense.user_id,
        "submitter_name": submitter.name if submitter else "",
        "submitter_code": submitter.user_id if submitter else "",
        "month": expense.month,
        "year": expense.year,
        "amount": expense.amount,
        "status": expense.status,
        "category": expense.travel_mode,
        "date": expense.itinerary,
        "purpose": expense.description,
        
        # Original master totals
        "original_amount": expense.original_amount or expense.amount,
        "original_da_amount": expense.original_da_amount or expense.da_amount,
        "original_hotel_amount": expense.original_hotel_amount or expense.hotel_amount,
        "original_other_expense_amount": expense.original_other_expense_amount or expense.other_expense_amount,
        "original_local_purchase_amount": expense.original_local_purchase_amount or expense.local_purchase_amount,

        "attachments": [a.file_url for a in attachments],
        "attachments_detailed": [
            {
                "file_url": a.file_url,
                "itinerary_id": a.itinerary_id,
                "bill_type": a.bill_type
            } for a in attachments
        ],
        "itineraries": [
            {
                "leg": i.leg_number,
                "from_district": i.from_district,
                "to_district": i.to_district,
                "from": i.from_location,
                "to": i.to_location,
                "mode": i.travel_mode,
                "km": i.distance_km,
                "amount": i.travel_amount,
                "sub_mode": i.sub_mode,
                "sub_amount": i.sub_amount,
                "da": i.da_amount,
                "hotel": i.hotel_amount,
                "local_purchase": i.local_purchase,
                "oth_desc": i.other_desc,
                "oth_amount": i.other_amount,
                "ws_assigned": i.calls_assigned,
                "ws_closed": i.calls_completed,
                "ws_pms": i.pms_count,
                "ws_asset": i.asset_tagging,
                "calibration_count": i.calibration_count,
                "mobilise_count": i.mobilise_count,
                "visit_purpose": i.visit_purpose,
                "activity_details": i.activity_details,
                
                # Original leg values
                "original_km": i.original_distance_km or i.distance_km,
                "original_amount": i.original_travel_amount or i.travel_amount,
                "original_sub_amount": i.original_sub_amount or i.sub_amount,
                "original_da": i.original_da_amount or i.da_amount,
                "original_hotel": i.original_hotel_amount or i.hotel_amount,
                "original_oth_amount": i.original_other_amount or i.other_amount,
                "original_local_purchase": i.original_local_purchase or i.local_purchase
            } for i in itineraries
        ],
        "created_at": expense.created_at,
        "updated_at": expense.updated_at,
        "approvals": approvals_list,
        "edit_history": edit_history_list
    }

@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes an expense claim and clean up itineraries and approval steps."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense claim not found.")
        
    if expense.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete someone else's claim.")
        
    if expense.status not in ["draft", "submitted"]:
        raise HTTPException(status_code=400, detail="Cannot delete a claim that has already been reviewed.")
        
    # Delete dependent tables
    db.query(ExpenseItinerary).filter(ExpenseItinerary.exp_id == expense.expense_code).delete()
    db.query(ExpenseAttachment).filter(ExpenseAttachment.exp_id == expense.expense_code).delete()
    db.query(Approval).filter(Approval.expense_id == expense.id).delete()
    
    db.delete(expense)
    db.commit()
    from app.utils import cache
    cache.clear_user_and_managers_cache(db, current_user.user_id)
    return {"status": "success", "message": "Expense claim deleted successfully."}






