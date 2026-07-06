from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import json
from datetime import datetime
import logging

from app.config.database import get_db
from app.api.routes.dependencies import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
from app.models.expense import Expense
from app.models.approval import Approval
from app.models.expense_itinerary import ExpenseItinerary
from app.schemas.approval import ApprovalActionRequest, ApprovalResponse
from app.utils.push_notifications import send_push_to_user_by_code
from app.utils.db_notifications import create_notification

router = APIRouter()

def get_legacy_expense_hash_id(exp_id: str) -> int:
    import hashlib
    h = hashlib.md5(exp_id.encode('utf-8')).hexdigest()
    val = int(h[:7], 16)
    return -200000 - val

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

def apply_itinerary_edits_and_log(db: Session, expense: Expense, itinerary_edits: List, current_user: User, comments: str):
    from app.models.expense_itinerary import ExpenseItinerary
    from app.models.expense_edit_log import ExpenseEditLog
    
    for edit in itinerary_edits:
        leg = db.query(ExpenseItinerary).filter(
            ExpenseItinerary.exp_id == expense.expense_code,
            ExpenseItinerary.leg_number == edit.leg_number
        ).first()
        if leg:
            # Check if distance_km has changed
            is_km_modified = False
            if edit.distance_km is not None:
                old_km = getattr(leg, "distance_km") or 0.0
                try:
                    if round(float(old_km), 2) != round(float(edit.distance_km), 2):
                        is_km_modified = True
                except Exception:
                    pass

            fields_to_check = [
                ("travel_amount", edit.travel_amount),
                ("sub_amount", edit.sub_amount),
                ("hotel_amount", edit.hotel_amount),
                ("other_amount", edit.other_amount),
                ("distance_km", edit.distance_km),
                ("da_amount", edit.da_amount),
                ("local_purchase", edit.local_purchase)
            ]
            for field, new_val in fields_to_check:
                if new_val is not None:
                    # Skip logging travel_amount if distance_km is modified on Bike/Car (secondary auto-change)
                    skip_log = False
                    if field == "travel_amount" and is_km_modified and (leg.travel_mode or "").strip().lower() in ["bike", "car"]:
                        skip_log = True

                    old_val = getattr(leg, field) or 0.0
                    try:
                        # Float comparisons
                        if round(float(old_val), 2) != round(float(new_val), 2):
                            if not skip_log:
                                # Get specific remark for this field from client
                                field_remark = None
                                if hasattr(edit, "remarks") and isinstance(edit.remarks, dict):
                                    field_remark = edit.remarks.get(field)
                                    # Fallback mapping mapping: frontend da_amount is da
                                    if not field_remark and field == "da_amount":
                                        field_remark = edit.remarks.get("da") or edit.remarks.get("da_amount")
                                    elif not field_remark and field == "distance_km":
                                        field_remark = edit.remarks.get("km") or edit.remarks.get("distance_km")

                                log_rec = ExpenseEditLog(
                                    expense_id=expense.id,
                                    editor_id=current_user.id,
                                    editor_name=current_user.name,
                                    editor_role=current_user.role,
                                    leg_number=leg.leg_number,
                                    field_name=field,
                                    old_value=str(old_val),
                                    new_value=str(new_val),
                                    comment=field_remark or comments or "Adjusted during approval"
                                )
                                db.add(log_rec)
                            setattr(leg, field, new_val)
                    except Exception:
                        if str(old_val) != str(new_val):
                            if not skip_log:
                                field_remark = None
                                if hasattr(edit, "remarks") and isinstance(edit.remarks, dict):
                                    field_remark = edit.remarks.get(field)
                                    if not field_remark and field == "da_amount":
                                        field_remark = edit.remarks.get("da") or edit.remarks.get("da_amount")
                                    elif not field_remark and field == "distance_km":
                                        field_remark = edit.remarks.get("km") or edit.remarks.get("distance_km")

                                log_rec = ExpenseEditLog(
                                    expense_id=expense.id,
                                    editor_id=current_user.id,
                                    editor_name=current_user.name,
                                    editor_role=current_user.role,
                                    leg_number=leg.leg_number,
                                    field_name=field,
                                    old_value=str(old_val),
                                    new_value=str(new_val),
                                    comment=field_remark or comments or "Adjusted during approval"
                                )
                                db.add(log_rec)
                            setattr(leg, field, new_val)
            # Flush each leg's changes individually to avoid batch executemany issues with D1
            db.flush()

    # Recalculate totals including local purchase
    legs = db.query(ExpenseItinerary).filter(ExpenseItinerary.exp_id == expense.expense_code).all()
    total_da = sum(l.da_amount or 0.0 for l in legs)
    total_hotel = sum(l.hotel_amount or 0.0 for l in legs)
    total_other = sum(l.other_amount or 0.0 for l in legs)
    total_travel = sum(l.travel_amount or 0.0 for l in legs)
    total_sub = sum(l.sub_amount or 0.0 for l in legs)
    total_lp = sum(l.local_purchase or 0.0 for l in legs)

    expense.da_amount = total_da
    expense.hotel_amount = total_hotel
    expense.other_expense_amount = total_other
    expense.local_purchase_amount = total_lp
    expense.amount = total_travel + total_sub + total_da + total_hotel + total_other + total_lp

@router.get("/", response_model=List[ApprovalResponse])
async def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all expense approvals assigned to the logged-in user that are pending active review"""
    from app.utils import cache
    cache_key = f"pending_approvals:{current_user.user_id}"
    cached_val = cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    # Only show approvals that are in 'pending' status (it is this user's turn to approve)
    approvals = db.query(Approval).filter(
        Approval.approver_id == current_user.id,
        Approval.status == "pending"
    ).all()
    
    result = []

    # 1. Fetch pending limit requests assigned to this manager
    from app.models.limit_approval_request import LimitApprovalRequest
    pending_limits = db.query(LimitApprovalRequest).filter(
        LimitApprovalRequest.manager_id == current_user.user_id,
        LimitApprovalRequest.status == "Pending"
    ).all()
    
    for pl in pending_limits:
        submitter = db.query(User).filter(User.user_id == pl.user_id).first()
        mock_app = Approval(
            id=-pl.id,
            expense_id=-pl.id,
            approver_id=current_user.id,
            level_number=1,
            status="pending",
            comments="",
            created_at=pl.created_at,
            updated_at=pl.updated_at
        )
        mock_app.expense_code = f"LIMIT-{pl.request_type}-{pl.id}"
        mock_app.employeeName = submitter.name if submitter else f"Employee {pl.user_id}"
        mock_app.eCode = pl.user_id
        mock_app.purpose = f"Request additional {pl.requested_value:.1f} {pl.request_type} limit for month {pl.for_month}"
        mock_app.category = "Limit Request"
        mock_app.amount = pl.requested_value
        mock_app.date = pl.for_month
        mock_app.itinerariesCount = 0
        result.append(mock_app)
        
    if not approvals and not pending_limits:
        cache.set(cache_key, [])
        return []
        
    expense_ids = [a.expense_id for a in approvals]
    expenses = db.query(Expense).filter(Expense.id.in_(expense_ids)).all()
    expenses_by_id = {e.id: e for e in expenses}
    
    submitter_ids = [e.user_id for e in expenses]
    submitters = db.query(User).filter(User.id.in_(submitter_ids)).all()
    submitters_by_id = {s.id: s for s in submitters}
    
    expense_codes = [e.expense_code for e in expenses]
    iti_counts = db.query(
        ExpenseItinerary.exp_id, func.count(ExpenseItinerary.id)
    ).filter(
        ExpenseItinerary.exp_id.in_(expense_codes)
    ).group_by(
        ExpenseItinerary.exp_id
    ).all()
    iti_counts_by_code = {code: count for code, count in iti_counts}
    
    for app in approvals:
        expense = expenses_by_id.get(app.expense_id)
        if expense:
            submitter = submitters_by_id.get(expense.user_id)
            iti_count = iti_counts_by_code.get(expense.expense_code, 0)
            
            app.expense_code = expense.expense_code
            app.employeeName = submitter.name if submitter else "Unknown Employee"
            app.eCode = submitter.user_id if submitter else "N/A"
            app.purpose = expense.description
            app.category = expense.travel_mode
            app.amount = expense.amount
            app.date = expense.itinerary
            app.itinerariesCount = iti_count
            result.append(app)
        else:
            result.append(app)
            
    # Query legacy pending claims from expense_master table
    try:
        from sqlalchemy import text
        legacy_query = text("""
            SELECT m.exp_id, m.user_id, m.expense_date, m.total_amount, m.status,
                   m.da_amount, m.hotel_amount, m.other_expense_amount,
                   m.level_first_approver, m.level_second_approver,
                   u.full_name, u.e_code
            FROM expense_master m
            JOIN user u ON m.user_id = u.user_id
            WHERE 
                ((m.status = 'Pending L1' OR m.status = 'Pending') AND m.level_first_approver = :user_id)
                OR
                (m.status = 'Pending L2' AND m.level_second_approver = :user_id)
        """)
        legacy_rows = db.execute(legacy_query, {"user_id": current_user.user_id}).fetchall()
        for row in legacy_rows:
            exp_id = row[0]
            user_id_str = row[1]
            expense_date = row[2]
            total_amount = float(row[3]) if row[3] else 0.0
            status_val = row[4]
            full_name = row[10]
            e_code = row[11]
            
            level_number = 2 if status_val == "Pending L2" else 1
            mock_id = get_legacy_expense_hash_id(exp_id)
            
            # Fetch itineraries count for this legacy expense
            iti_count_query = text("SELECT COUNT(itinerary_id) FROM expense_itinerary WHERE exp_id = :exp_id")
            iti_count = db.execute(iti_count_query, {"exp_id": exp_id}).scalar() or 0
            
            # Get category (travel_mode) and purpose (visit_purpose)
            purpose = ""
            category = "Travel"
            master_info = db.execute(text("SELECT visit_purpose FROM expense_master WHERE exp_id = :exp_id"), {"exp_id": exp_id}).first()
            if master_info and master_info[0]:
                purpose = master_info[0]
                
            first_iti = db.execute(text("SELECT travel_mode FROM expense_itinerary WHERE exp_id = :exp_id ORDER BY leg_number LIMIT 1"), {"exp_id": exp_id}).first()
            if first_iti and first_iti[0]:
                category = first_iti[0]
                
            try:
                created_dt = datetime.strptime(expense_date, "%Y-%m-%d")
            except Exception:
                created_dt = datetime.now()
                
            mock_app = Approval(
                id=mock_id,
                expense_id=mock_id,
                approver_id=current_user.id,
                level_number=level_number,
                status="pending",
                comments="",
                created_at=created_dt,
                updated_at=created_dt
            )
            mock_app.expense_code = exp_id
            mock_app.employeeName = full_name if full_name else "Unknown Employee"
            mock_app.eCode = e_code if e_code else "N/A"
            mock_app.purpose = purpose if purpose else "Legacy Mobile Claim"
            mock_app.category = category
            mock_app.amount = total_amount
            mock_app.date = expense_date
            mock_app.itinerariesCount = iti_count
            result.append(mock_app)
    except Exception as e:
        logger.error(f"Error querying legacy pending approvals: {e}")
            
    cache.set(cache_key, result)
    return result

@router.post("/{expense_id}/approve")
async def approve_expense(
    expense_id: int,
    request: ApprovalActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if expense_id < 0:
        if expense_id <= -200000:
            # Find the matching exp_id by hashing all exp_ids from expense_master
            from sqlalchemy import text
            all_rows = db.execute(text("SELECT exp_id FROM expense_master")).fetchall()
            matching_exp_id = None
            for row in all_rows:
                if get_legacy_expense_hash_id(row[0]) == expense_id:
                    matching_exp_id = row[0]
                    break
                    
            if not matching_exp_id:
                raise HTTPException(status_code=404, detail="Legacy expense claim not found.")
                
            # Query legacy details
            exp = db.execute(
                text("SELECT user_id, status, level_first_approver, level_second_approver, total_amount FROM expense_master WHERE exp_id = :exp_id"),
                {"exp_id": matching_exp_id}
            ).first()
            
            if not exp:
                raise HTTPException(status_code=404, detail="Legacy expense claim details not found.")
                
            submitter_id, current_status, l1_app, l2_app, total_amount = exp
            
            # Check permissions
            is_l1 = (l1_app == current_user.user_id)
            is_l2 = (l2_app == current_user.user_id)
            
            if not is_l1 and not is_l2 and current_user.role != "Admin":
                raise HTTPException(status_code=403, detail="Access denied to approve this claim.")
                
            # Determine the action level
            if (current_status in ["Pending L1", "Pending"]) and is_l1:
                new_status = "Pending L2" if (l2_app and l2_app.strip() and l2_app != "None") else "Approved"
                db.execute(
                    text("UPDATE expense_master SET status = :status, approved_by = :approved_by, level_first_approver_time = datetime('now') WHERE exp_id = :exp_id"),
                    {"status": new_status, "approved_by": current_user.user_id, "exp_id": matching_exp_id}
                )
                
                # Send notifications
                try:
                    from app.utils.db_notifications import create_notification
                    if new_status == "Pending L2":
                        create_notification(
                            db=db,
                            user_id=submitter_id,
                            title="🔄 Claim Approved at Level 1",
                            description=f"Your claim {matching_exp_id} has been approved at Level 1 by {current_user.name} and is pending Level 2 approval.",
                            notification_type="info",
                            link="/home"
                        )
                        create_notification(
                            db=db,
                            user_id=l2_app,
                            title="📥 Pending Approval",
                            description=f"New claim {matching_exp_id} submitted by {submitter_id} (₹{total_amount:,.0f}) is pending your Level 2 approval.",
                            notification_type="warning",
                            link="/approval-center"
                        )
                    else:
                        create_notification(
                            db=db,
                            user_id=submitter_id,
                            title="✅ Expense Claim Approved!",
                            description=f"Your claim {matching_exp_id} has been fully approved by {current_user.name}.",
                            notification_type="success",
                            link="/home"
                        )
                except Exception as e:
                    logger.warning(f"Failed to create notification: {str(e)}")
                    
            elif current_status == "Pending L2" and is_l2:
                db.execute(
                    text("UPDATE expense_master SET status = 'Approved', approved_by = :approved_by, level_second_approver_time = datetime('now') WHERE exp_id = :exp_id"),
                    {"approved_by": current_user.user_id, "exp_id": matching_exp_id}
                )
                
                # Send notification
                try:
                    from app.utils.db_notifications import create_notification
                    create_notification(
                        db=db,
                        user_id=submitter_id,
                        title="✅ Expense Claim Approved!",
                        description=f"Your claim {matching_exp_id} has been fully approved by {current_user.name}.",
                        notification_type="success",
                        link="/home"
                    )
                except Exception as e:
                    logger.warning(f"Failed to create notification: {str(e)}")
            else:
                raise HTTPException(status_code=400, detail="Cannot action this claim at this time or invalid status.")
                
            db.commit()
            from app.utils import cache
            cache.clear_user_and_managers_cache(db, submitter_id)
            
            return {
                "status": "success",
                "message": "Expense claim approved successfully.",
                "expense_status": "Approved"
            }

        limit_id = -expense_id
        from app.models.limit_approval_request import LimitApprovalRequest
        pl = db.query(LimitApprovalRequest).filter(LimitApprovalRequest.id == limit_id).first()
        if not pl:
            raise HTTPException(status_code=404, detail="Limit approval request not found.")
        
        if pl.manager_id != current_user.user_id and current_user.role != "Admin":
            raise HTTPException(status_code=403, detail="Access denied to approve this request.")
        if request.approved_value is not None:
            pl.approved_value = request.approved_value
        else:
            pl.approved_value = pl.requested_value

        pl.status = "Approved"
        db.commit()
        
        # Clear the caches
        from app.utils import cache
        cache.clear_user_and_managers_cache(db, pl.user_id)
        
        # Create database notification for the requester
        try:
            create_notification(
                db=db,
                user_id=pl.user_id,
                title=f"Limit Request {pl.request_type} Approved",
                description=f"Your request for additional {pl.requested_value:.1f} {pl.request_type} has been approved by your manager.",
                notification_type="success",
                link="/expense"
            )
        except Exception as e:
            logger.warning(f"Failed to create approval notification: {str(e)}")
            
        return {
            "status": "success",
            "message": "Limit request approved successfully."
        }

    # Find the pending approval step for this approver
    active_approval = db.query(Approval).filter(
        Approval.expense_id == expense_id,
        Approval.approver_id == current_user.id,
        Approval.status == "pending"
    ).first()
    
    if not active_approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending approval task found for you on this expense claim."
        )
        
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense claim not found.")

    # Save itinerary updates if present — flush each leg individually to avoid executemany batch issues
    if request.itinerary_edits:
        try:
            apply_itinerary_edits_and_log(db, expense, request.itinerary_edits, current_user, request.comments)
        except Exception as edit_err:
            db.rollback()
            logger.error(f"Failed to apply itinerary edits for expense {expense_id}: {edit_err}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to save edits: {str(edit_err)}")

    # Update active approval
    active_approval.status = "approved"
    active_approval.comments = request.comments
    
    if request.client_timestamp:
        client_dt = parse_client_timestamp(request.client_timestamp)
        active_approval.updated_at = client_dt
        expense.updated_at = client_dt
    
    # Get all approvals for this expense to find the next level
    all_approvals = db.query(Approval).filter(
        Approval.expense_id == expense_id
    ).order_by(Approval.level_number).all()
    
    # Find next level (first level number greater than current one)
    next_approval = None
    for a in all_approvals:
        if a.level_number > active_approval.level_number and a.status == "waiting":
            next_approval = a
            break
            
    if next_approval:
        # Move next level to pending
        next_approval.status = "pending"
        expense.status = f"submitted_l{next_approval.level_number}"
        if request.client_timestamp:
            client_dt = parse_client_timestamp(request.client_timestamp)
            next_approval.created_at = client_dt
            next_approval.updated_at = client_dt
    else:
        # No more levels, expense is fully approved!
        expense.status = "approved"
        
    try:
        db.commit()
    except Exception as commit_err:
        db.rollback()
        logger.error(f"Failed to commit approval for expense {expense_id}: {commit_err}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to approve: {str(commit_err)}")

    from app.utils import cache
    cache.clear_user_and_managers_cache(db, expense.user_id)

    # Database and Push notifications
    try:
        from app.utils.db_notifications import create_notification
        submitter = db.query(User).filter(User.id == expense.user_id).first()
        if submitter:
            if expense.status == "approved":
                create_notification(
                    db=db,
                    user_id=submitter.user_id,
                    title="✅ Expense Claim Approved!",
                    description=f"Your claim {expense.expense_code} (₹{expense.amount:,.0f}) has been fully approved by {current_user.name}.",
                    notification_type="success",
                    link="/home"
                )
            else:
                create_notification(
                    db=db,
                    user_id=submitter.user_id,
                    title="🔄 Claim Forwarded",
                    description=f"Your claim {expense.expense_code} has been approved by {current_user.name} and forwarded to the next level.",
                    notification_type="info",
                    link="/home"
                )

        if next_approval:
            next_approver_user = db.query(User).filter(User.id == next_approval.approver_id).first()
            if next_approver_user:
                sub_name = submitter.name if submitter else "Unknown Employee"
                create_notification(
                    db=db,
                    user_id=next_approver_user.user_id,
                    title="📥 Pending Approval Forwarded",
                    description=f"Claim {expense.expense_code} submitted by {sub_name} (₹{expense.amount:,.0f}) has been forwarded to you for review.",
                    notification_type="warning",
                    link="/approval-center"
                )
    except Exception as notif_err:
        logger.error(f"FCM/DB Notification error in approve_expense: {notif_err}")

    return {
        "status": "success",
        "message": "Expense claim approved successfully.",
        "expense_status": expense.status
    }

@router.post("/{expense_id}/reject")
async def reject_expense(
    expense_id: int,
    request: ApprovalActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if expense_id < 0:
        if expense_id <= -200000:
            # Find the matching exp_id by hashing all exp_ids from expense_master
            from sqlalchemy import text
            all_rows = db.execute(text("SELECT exp_id FROM expense_master")).fetchall()
            matching_exp_id = None
            for row in all_rows:
                if get_legacy_expense_hash_id(row[0]) == expense_id:
                    matching_exp_id = row[0]
                    break
                    
            if not matching_exp_id:
                raise HTTPException(status_code=404, detail="Legacy expense claim not found.")
                
            # Query legacy details
            exp = db.execute(
                text("SELECT user_id, status, level_first_approver, level_second_approver FROM expense_master WHERE exp_id = :exp_id"),
                {"exp_id": matching_exp_id}
            ).first()
            
            if not exp:
                raise HTTPException(status_code=404, detail="Legacy expense claim details not found.")
                
            submitter_id, current_status, l1_app, l2_app = exp
            
            # Check permissions
            is_l1 = (l1_app == current_user.user_id)
            is_l2 = (l2_app == current_user.user_id)
            
            if not is_l1 and not is_l2 and current_user.role != "Admin":
                raise HTTPException(status_code=403, detail="Access denied to reject this claim.")
                
            # Determine L1 or L2 rejection
            if (current_status in ["Pending L1", "Pending"]) and is_l1:
                db.execute(
                    text("UPDATE expense_master SET status = 'Rejected', reject_reason = :reason, approved_by = 'L1', level_first_approver_time = datetime('now') WHERE exp_id = :exp_id"),
                    {"reason": request.comments, "exp_id": matching_exp_id}
                )
            elif current_status == "Pending L2" and is_l2:
                db.execute(
                    text("UPDATE expense_master SET status = 'Rejected', reject_reason = :reason, approved_by = 'L2', level_second_approver_time = datetime('now') WHERE exp_id = :exp_id"),
                    {"reason": request.comments, "exp_id": matching_exp_id}
                )
            else:
                raise HTTPException(status_code=400, detail="Cannot reject this claim at this time or invalid status.")
                
            # Send rejection notification
            try:
                from app.utils.db_notifications import create_notification
                remark = (request.comments or "").strip()[:80]
                create_notification(
                    db=db,
                    user_id=submitter_id,
                    title="❌ Expense Claim Rejected",
                    description=f"Your claim {matching_exp_id} has been rejected by {current_user.name}. Reason: {remark}",
                    notification_type="error",
                    link="/home"
                )
            except Exception as e:
                logger.warning(f"Failed to create rejection notification: {str(e)}")
                
            db.commit()
            from app.utils import cache
            cache.clear_user_and_managers_cache(db, submitter_id)
            
            return {
                "status": "success",
                "message": "Expense claim has been rejected.",
                "expense_status": "Rejected"
            }

        limit_id = -expense_id
        from app.models.limit_approval_request import LimitApprovalRequest
        pl = db.query(LimitApprovalRequest).filter(LimitApprovalRequest.id == limit_id).first()
        if not pl:
            raise HTTPException(status_code=404, detail="Limit approval request not found.")
        
        if pl.manager_id != current_user.user_id and current_user.role != "Admin":
            raise HTTPException(status_code=403, detail="Access denied to reject this request.")
            
        pl.status = "Rejected"
        db.commit()
        
        # Clear the caches
        from app.utils import cache
        cache.clear_user_and_managers_cache(db, pl.user_id)
        
        try:
            create_notification(
                db=db,
                user_id=pl.user_id,
                title=f"Limit Request {pl.request_type} Rejected",
                description=f"Your request for additional {pl.requested_value:.1f} {pl.request_type} has been rejected by your manager.",
                notification_type="danger",
                link="/expense"
            )
        except Exception as e:
            logger.warning(f"Failed to create rejection notification: {str(e)}")
            
        return {
            "status": "success",
            "message": "Limit request rejected successfully."
        }

    """Reject the expense claim. Remarks/Comments are strictly mandatory."""
    if not request.comments or not request.comments.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection comments/remark is mandatory."
        )

    # Find the pending approval step for this approver
    active_approval = db.query(Approval).filter(
        Approval.expense_id == expense_id,
        Approval.approver_id == current_user.id,
        Approval.status == "pending"
    ).first()
    
    if not active_approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending approval task found for you on this expense claim."
        )
        
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense claim not found.")

    # Save itinerary updates if present (in case they want to reject with updated values)
    if request.itinerary_edits:
        try:
            apply_itinerary_edits_and_log(db, expense, request.itinerary_edits, current_user, request.comments)
        except Exception as edit_err:
            db.rollback()
            logger.error(f"Failed to apply itinerary edits for expense {expense_id}: {edit_err}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to save edits: {str(edit_err)}")

    # Update active approval to rejected
    active_approval.status = "rejected"
    active_approval.comments = request.comments
    
    if request.client_timestamp:
        client_dt = parse_client_timestamp(request.client_timestamp)
        active_approval.updated_at = client_dt
        expense.updated_at = client_dt
    
    # Cancel all subsequent levels
    other_approvals = db.query(Approval).filter(
        Approval.expense_id == expense_id,
        Approval.level_number > active_approval.level_number,
        Approval.status == "waiting"
    ).all()
    for a in other_approvals:
        a.status = "cancelled"
        if request.client_timestamp:
            a.updated_at = parse_client_timestamp(request.client_timestamp)
        
    expense.status = "rejected"
    try:
        db.commit()
    except Exception as commit_err:
        db.rollback()
        logger.error(f"Failed to commit rejection for expense {expense_id}: {commit_err}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to reject: {str(commit_err)}")

    from app.utils import cache
    cache.clear_user_and_managers_cache(db, expense.user_id)

    # Trigger notification to the submitter about rejection
    try:
        submitter = db.query(User).filter(User.id == expense.user_id).first()
        if submitter:
            remark = (request.comments or "").strip()[:80]
            from app.utils.db_notifications import create_notification
            create_notification(
                db=db,
                user_id=submitter.user_id,
                title="❌ Expense Claim Rejected",
                description=f"Your claim {expense.expense_code} has been rejected by {current_user.name}. Reason: {remark}",
                notification_type="error",
                link="/home"
            )
    except Exception as notif_err:
        logger.error(f"FCM/DB Notification error in reject_expense: {notif_err}")

    return {
        "status": "success",
        "message": "Expense claim has been rejected.",
        "expense_status": expense.status
    }
