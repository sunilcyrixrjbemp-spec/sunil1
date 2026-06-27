from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import json
from datetime import datetime

from app.config.database import get_db
from app.api.routes.dependencies import get_current_user
from app.models.user import User
from app.models.expense import Expense
from app.models.approval import Approval
from app.models.expense_itinerary import ExpenseItinerary
from app.schemas.approval import ApprovalActionRequest, ApprovalResponse
from app.utils.push_notifications import send_push_to_user_by_code

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
    
    if not approvals:
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
    
    result = []
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
            
    cache.set(cache_key, result)
    return result

@router.post("/{expense_id}/approve")
async def approve_expense(
    expense_id: int,
    request: ApprovalActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve the expense claim at the current level. Saves itinerary leg edits, recalculates totals, and updates approval status."""
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

    # Save itinerary updates if present
    if request.itinerary_edits:
        for edit in request.itinerary_edits:
            leg = db.query(ExpenseItinerary).filter(
                ExpenseItinerary.exp_id == expense.expense_code,
                ExpenseItinerary.leg_number == edit.leg_number
            ).first()
            if leg:
                if edit.travel_amount is not None:
                    leg.travel_amount = edit.travel_amount
                if edit.sub_amount is not None:
                    leg.sub_amount = edit.sub_amount
                if edit.hotel_amount is not None:
                    leg.hotel_amount = edit.hotel_amount
                if edit.other_amount is not None:
                    leg.other_amount = edit.other_amount
        db.flush()

        # Recalculate totals
        legs = db.query(ExpenseItinerary).filter(ExpenseItinerary.exp_id == expense.expense_code).all()
        total_da = sum(l.da_amount or 0.0 for l in legs)
        total_hotel = sum(l.hotel_amount or 0.0 for l in legs)
        total_other = sum(l.other_amount or 0.0 for l in legs)
        total_travel = sum(l.travel_amount or 0.0 for l in legs)
        total_sub = sum(l.sub_amount or 0.0 for l in legs)

        expense.da_amount = total_da
        expense.hotel_amount = total_hotel
        expense.other_expense_amount = total_other
        expense.amount = total_travel + total_sub + total_da + total_hotel + total_other

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
        
    db.commit()

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
                create_notification(
                    db=db,
                    user_id=next_approver_user.user_id,
                    title="📥 Pending Approval Forwarded",
                    description=f"Claim {expense.expense_code} submitted by {expense.employeeName} (₹{expense.amount:,.0f}) has been forwarded to you for review.",
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
        for edit in request.itinerary_edits:
            leg = db.query(ExpenseItinerary).filter(
                ExpenseItinerary.exp_id == expense.expense_code,
                ExpenseItinerary.leg_number == edit.leg_number
            ).first()
            if leg:
                if edit.travel_amount is not None:
                    leg.travel_amount = edit.travel_amount
                if edit.sub_amount is not None:
                    leg.sub_amount = edit.sub_amount
                if edit.hotel_amount is not None:
                    leg.hotel_amount = edit.hotel_amount
                if edit.other_amount is not None:
                    leg.other_amount = edit.other_amount
        db.flush()

        # Recalculate totals
        legs = db.query(ExpenseItinerary).filter(ExpenseItinerary.exp_id == expense.expense_code).all()
        total_da = sum(l.da_amount or 0.0 for l in legs)
        total_hotel = sum(l.hotel_amount or 0.0 for l in legs)
        total_other = sum(l.other_amount or 0.0 for l in legs)
        total_travel = sum(l.travel_amount or 0.0 for l in legs)
        total_sub = sum(l.sub_amount or 0.0 for l in legs)

        expense.da_amount = total_da
        expense.hotel_amount = total_hotel
        expense.other_expense_amount = total_other
        expense.amount = total_travel + total_sub + total_da + total_hotel + total_other

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
    db.commit()

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
