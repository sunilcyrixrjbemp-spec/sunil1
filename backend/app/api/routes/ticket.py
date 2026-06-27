from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel
from jose import jwt
from app.config.settings import settings

from app.config.database import get_db
from app.api.routes.dependencies import get_current_user
from app.models.user import User
from app.models.ticket import SupportTicket
from app.models.expense import Expense
from app.utils.push_notifications import send_push_to_user_by_name, send_push_to_user_by_code

router = APIRouter()

class TicketCreateRequest(BaseModel):
    concern_type: str  # Expense, Profile, TA/DA
    expense_id: Optional[int] = None
    expense_code: Optional[str] = None
    priority: str  # Low, Medium, High, Critical
    description: str
    assigned_to_name: str  # The name of the selected manager or coordinator

class TicketCommentRequest(BaseModel):
    comment: str

def check_and_auto_close_tickets(db: Session):
    """Bulk-update any tickets that were closed more than 36 hours ago to Final Closed.
    Uses a single SQL UPDATE query instead of a Python loop for maximum speed."""
    limit_time = datetime.now() - timedelta(hours=36)
    try:
        db.query(SupportTicket).filter(
            SupportTicket.status == "Closed",
            SupportTicket.closed_at != None,
            SupportTicket.closed_at < limit_time
        ).update({SupportTicket.status: "Final Closed"}, synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()

@router.get("/")
def get_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all tickets visible to the logged-in user.
    - Engineers see tickets they created.
    - Admins see Profile tickets, or all tickets to assist.
    - Managers & Coordinators see tickets assigned to them, or created by them.
    """
    # Run bulk auto-close check (single SQL query)
    check_and_auto_close_tickets(db)
    
    query = db.query(SupportTicket)
    
    if current_user.role == "Admin":
        # Admins can view all tickets
        tickets = query.all()
    else:
        # Filter tickets: created by user OR assigned directly to user by name
        tickets = query.filter(
            (SupportTicket.created_by_code == current_user.user_id) | 
            (SupportTicket.assigned_to_name == current_user.name) |
            (SupportTicket.assigned_to_role == current_user.role)
        ).all()
        
    return tickets

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_ticket(
    request: TicketCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Raise a new concern / support ticket"""
    # 1. Determine assigned role
    assigned_role = "Admin"
    assigned_name = "Admin System"
    
    if request.concern_type != "Profile":
        # Verify the selected manager/coordinator exists
        assigned_name = request.assigned_to_name.strip()
        assigned_user = db.query(User).filter(User.name == assigned_name).first()
        if not assigned_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assigned staff '{assigned_name}' not found."
            )
        assigned_role = assigned_user.role

    # 2. Generate unique ticket code TKT-YYYYMMDD-XXXX
    today_str = datetime.now().strftime("%Y%m%d")
    count = db.query(SupportTicket).filter(SupportTicket.ticket_code.like(f"TKT-{today_str}-%")).count()
    ticket_code = f"TKT-{today_str}-{str(count + 1).zfill(4)}"

    # 3. Create ticket
    new_ticket = SupportTicket(
        ticket_code=ticket_code,
        created_by_id=current_user.id,
        created_by_name=current_user.name,
        created_by_code=current_user.user_id,
        concern_type=request.concern_type,
        expense_id=request.expense_id,
        expense_code=request.expense_code,
        priority=request.priority,
        description=request.description.strip(),
        assigned_to_role=assigned_role,
        assigned_to_name=assigned_name,
        status="Open",
        comments=""
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    # Database and Push notifications to the assigned person
    try:
        from app.utils.db_notifications import create_notification
        create_notification(
            db=db,
            user_id=assigned_user.user_id,
            title="📥 Ticket Assigned",
            description=f"{current_user.name} raised a {request.priority} priority ticket {ticket_code} ({request.concern_type}) and assigned it to you.",
            notification_type="warning",
            link="/help-center"
        )
    except Exception as notif_err:
        logger.error(f"FCM/DB Notification error in create_ticket: {notif_err}")

    return new_ticket

@router.post("/{ticket_id}/comment")
def add_comment(
    ticket_id: int,
    request: TicketCommentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a discussion message or updates to the support ticket logs"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    # Check if the user is authorized (creator, assignee, or admin)
    is_creator = ticket.created_by_code == current_user.user_id
    is_assignee = ticket.assigned_to_name == current_user.name
    is_admin = current_user.role == "Admin"
    
    if not (is_creator or is_assignee or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to comment on this ticket.")

    # Check if ticket is closed past 36 hours
    if ticket.status == "Closed" and ticket.closed_at:
        if datetime.now() - ticket.closed_at > timedelta(hours=36):
            ticket.status = "Final Closed"
            db.commit()
            raise HTTPException(status_code=400, detail="Ticket is final closed and cannot be modified.")

    # Append comment
    now_str = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
    log_entry = f"{current_user.name} ({now_str}): {request.comment.strip()}"
    if ticket.comments:
        ticket.comments += f"\n{log_entry}"
    else:
        ticket.comments = log_entry

    # If assignee replies, mark as "Updated" to notify creator
    if is_assignee and ticket.status == "Open":
        ticket.status = "Updated"

    db.commit()
    db.refresh(ticket)

    # Database and Push notifications
    try:
        from app.utils.db_notifications import create_notification
        comment_preview = request.comment.strip()[:80] + ("..." if len(request.comment.strip()) > 80 else "")
        if is_creator:
            assignee = db.query(User).filter(User.name == ticket.assigned_to_name).first()
            if assignee:
                create_notification(
                    db=db,
                    user_id=assignee.user_id,
                    title=f"Reply on Ticket {ticket.ticket_code}",
                    description=f"{current_user.name} commented: {comment_preview}",
                    notification_type="info",
                    link="/help-center"
                )
        elif is_assignee:
            create_notification(
                db=db,
                user_id=ticket.created_by_code,
                title=f"Update on Ticket {ticket.ticket_code}",
                description=f"{current_user.name} commented: {comment_preview}",
                notification_type="info",
                link="/help-center"
            )
    except Exception as notif_err:
        logger.error(f"FCM/DB Notification error in add_comment: {notif_err}")

    return ticket

@router.post("/{ticket_id}/close")
def close_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Close an open support ticket"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    is_creator = ticket.created_by_code == current_user.user_id
    is_assignee = ticket.assigned_to_name == current_user.name
    is_admin = current_user.role == "Admin"
    
    if not (is_creator or is_assignee or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to close this ticket.")

    ticket.status = "Closed"
    ticket.closed_at = datetime.now()
    db.commit()
    db.refresh(ticket)

    # Database and Push notifications
    try:
        if not is_creator:
            from app.utils.db_notifications import create_notification
            create_notification(
                db=db,
                user_id=ticket.created_by_code,
                title="✅ Support Ticket Closed",
                description=f"Your ticket {ticket.ticket_code} has been resolved and closed by {current_user.name}.",
                notification_type="success",
                link="/help-center"
            )
    except Exception as notif_err:
        logger.error(f"FCM/DB Notification error in close_ticket: {notif_err}")

    return ticket

@router.post("/{ticket_id}/reopen")
def reopen_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reopen a closed ticket within 36 hours of closure"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    is_creator = ticket.created_by_code == current_user.user_id
    if not is_creator:
        raise HTTPException(status_code=403, detail="Only the ticket creator can reopen it.")

    if ticket.status != "Closed":
        raise HTTPException(status_code=400, detail="Only 'Closed' tickets can be reopened.")

    if not ticket.closed_at or datetime.now() - ticket.closed_at > timedelta(hours=36):
        ticket.status = "Final Closed"
        db.commit()
        raise HTTPException(status_code=400, detail="Ticket was closed more than 36 hours ago and is now Final Closed.")

    ticket.status = "Re-opened"
    ticket.closed_at = None
    db.commit()
    db.refresh(ticket)

    # Database and Push notifications
    try:
        assignee = db.query(User).filter(User.name == ticket.assigned_to_name).first()
        if assignee:
            from app.utils.db_notifications import create_notification
            create_notification(
                db=db,
                user_id=assignee.user_id,
                title="🔄 Support Ticket Re-opened",
                description=f"Ticket {ticket.ticket_code} has been re-opened by {current_user.name}.",
                notification_type="warning",
                link="/help-center"
            )
    except Exception as notif_err:
        logger.error(f"FCM/DB Notification error in reopen_ticket: {notif_err}")

    return ticket

@router.post("/{ticket_id}/followup")
def toggle_followup(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle followup flag on ticket"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    
    is_creator = ticket.created_by_code == current_user.user_id
    is_assignee = ticket.assigned_to_name == current_user.name
    is_admin = current_user.role == "Admin"
    
    if not (is_creator or is_assignee or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to toggle followup on this ticket.")

    ticket.needs_followup = not ticket.needs_followup
    db.commit()
    db.refresh(ticket)
    return ticket


class TicketConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, ticket_id: int, websocket: WebSocket):
        await websocket.accept()
        if ticket_id not in self.active_connections:
            self.active_connections[ticket_id] = []
        self.active_connections[ticket_id].append(websocket)

    def disconnect(self, ticket_id: int, websocket: WebSocket):
        if ticket_id in self.active_connections:
            self.active_connections[ticket_id].remove(websocket)
            if not self.active_connections[ticket_id]:
                del self.active_connections[ticket_id]

    async def broadcast(self, ticket_id: int, message: dict):
        if ticket_id in self.active_connections:
            for connection in self.active_connections[ticket_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = TicketConnectionManager()


@router.websocket("/ws/{ticket_id}")
async def ticket_websocket(
    websocket: WebSocket,
    ticket_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    try:
        # Validate JWT token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        await websocket.close(code=1011)
        return

    await manager.connect(ticket_id, websocket)

    try:
        while True:
            # Wait for JSON payload from client
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "typing":
                # Broadcast typing status to everyone except sender
                await manager.broadcast(
                    ticket_id,
                    {
                        "type": "typing",
                        "user_id": user.user_id,
                        "user_name": user.name,
                        "is_typing": data.get("is_typing", False)
                    }
                )
            elif msg_type == "message":
                comment_text = data.get("text", "").strip()
                if comment_text:
                    # Append new comment log entry
                    now_str = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
                    log_entry = f"{user.name} ({now_str}): {comment_text}"
                    if ticket.comments:
                        ticket.comments += f"\n{log_entry}"
                    else:
                        ticket.comments = log_entry

                    # If assignee answers, toggle status from Open to Updated
                    is_assignee = ticket.assigned_to_name == user.name
                    if is_assignee and ticket.status == "Open":
                        ticket.status = "Updated"

                    db.commit()
                    db.refresh(ticket)

                    # Broadcast the new comments and status to all connected users
                    await manager.broadcast(
                        ticket_id,
                        {
                            "type": "message",
                            "ticket_id": ticket_id,
                            "comments": ticket.comments,
                            "status": ticket.status
                        }
                    )
    except WebSocketDisconnect:
        manager.disconnect(ticket_id, websocket)
        # Clear typing status for this user
        await manager.broadcast(
            ticket_id,
            {
                "type": "typing",
                "user_id": user.user_id,
                "user_name": user.name,
                "is_typing": False
            }
        )
    except Exception:
        manager.disconnect(ticket_id, websocket)
