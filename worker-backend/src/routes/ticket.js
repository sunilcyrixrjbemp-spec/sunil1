import { getDrizzleDb } from "../db/client.js";
import { supportTickets, users } from "../db/schema.js";
import { eq, and, or, desc, isNotNull, lt, like, sql } from "drizzle-orm";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function formatTicketResponse(ticket) {
  if (!ticket) return null;
  let tCode = ticket.ticketCode || ticket.ticket_code || "";
  if (!tCode || !tCode.startsWith("CYR-RJ-")) {
    const num = ticket.id || 1;
    tCode = `CYR-RJ-${String(num).padStart(7, "0")}`;
  }
  const cByCode = ticket.createdByCode || ticket.created_by_code || "";
  const cByName = ticket.createdByName || ticket.created_by_name || "";
  const cById = ticket.createdById || ticket.created_by_id || null;
  const cType = ticket.concernType || ticket.concern_type || "";
  const expId = ticket.expenseId || ticket.expense_id || null;
  const expCode = ticket.expenseCode || ticket.expense_code || null;
  const pri = ticket.priority || "Medium";
  const desc = ticket.description || "";
  const aRole = ticket.assignedToRole || ticket.assigned_to_role || "";
  const aName = ticket.assignedToName || ticket.assigned_to_name || "";
  const stat = ticket.status || "Open";
  const comms = ticket.comments || "";
  const fUp = ticket.needsFollowup !== undefined ? ticket.needsFollowup : (ticket.needs_followup || 0);
  const cAt = ticket.closedAt || ticket.closed_at || null;
  const crAt = ticket.createdAt || ticket.created_at || new Date().toISOString();
  const uAt = ticket.updatedAt || ticket.updated_at || crAt;

  return {
    id: ticket.id,
    ticketCode: tCode,
    ticket_code: tCode,
    createdById: cById,
    created_by_id: cById,
    createdByName: cByName,
    created_by_name: cByName,
    createdByCode: cByCode,
    created_by_code: cByCode,
    concernType: cType,
    concern_type: cType,
    expenseId: expId,
    expense_id: expId,
    expenseCode: expCode,
    expense_code: expCode,
    priority: pri,
    description: desc,
    assignedToRole: aRole,
    assigned_to_role: aRole,
    assignedToName: aName,
    assigned_to_name: aName,
    status: stat,
    comments: comms,
    needsFollowup: fUp,
    needs_followup: fUp,
    closedAt: cAt,
    closed_at: cAt,
    createdAt: crAt,
    created_at: crAt,
    updatedAt: uAt,
    updated_at: uAt
  };
}

/**
 * Bulk-update closed tickets to Final Closed if closed > 36 hours
 */
async function checkAndAutoCloseTickets(env) {
  const db = getDrizzleDb(env);
  const limitTime = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  
  await db.update(supportTickets)
    .set({ status: 'Final Closed' })
    .where(and(
      eq(supportTickets.status, 'Closed'),
      isNotNull(supportTickets.closedAt),
      lt(supportTickets.closedAt, limitTime)
    ));
}

/**
 * GET /api/tickets
 */
export async function handleGetTickets(request, env, params, query, user) {
  await checkAndAutoCloseTickets(env);
  const db = getDrizzleDb(env, request);

  let results;
  if (user.role === "Admin") {
    results = await db.select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
  } else {
    results = await db.select()
      .from(supportTickets)
      .where(or(
        eq(supportTickets.createdByCode, user.user_id),
        eq(supportTickets.assignedToName, user.name),
        eq(supportTickets.assignedToRole, user.role)
      ))
      .orderBy(desc(supportTickets.createdAt));
  }

  const formatted = (results || []).map(formatTicketResponse);
  return jsonResponse(formatted);
}

/**
 * POST /api/tickets
 */
export async function handleCreateTicket(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { concern_type, expense_id, expense_code, priority, description, assigned_to_name } = body;
  const finalDesc = (description || "").trim();
  const concernType = concern_type || "General Support";

  if (!finalDesc) {
    return jsonResponse({ error: "Ticket description is required" }, 400);
  }

  let assignedRole = "Admin";
  let assignedName = "Support Desk";

  if (assigned_to_name && assigned_to_name.trim() && assigned_to_name.trim() !== "System Admin" && assigned_to_name.trim() !== "Support Desk") {
    const targetName = assigned_to_name.trim();
    const [assignedUser] = await db.select()
      .from(users)
      .where(eq(users.name, targetName))
      .limit(1);

    if (assignedUser) {
      assignedName = assignedUser.name;
      assignedRole = assignedUser.role || "Admin";
    }
  }

  // Generate unique ticket code CYR-RJ-0000001
  const [maxResult] = await db.select({
    maxId: sql`MAX(id)`
  }).from(supportTickets);

  const [countResult] = await db.select({
    cnt: sql`COUNT(*)`
  }).from(supportTickets);

  const maxId = maxResult?.maxId || 0;
  const count = countResult?.cnt || 0;
  const nextNum = Math.max(maxId, count) + 1;
  const ticketCode = `CYR-RJ-${String(nextNum).padStart(7, "0")}`;
  const timestamp = new Date().toISOString();

  await db.insert(supportTickets).values({
    ticketCode,
    createdById: user.id,
    createdByName: user.name,
    createdByCode: user.user_id,
    concernType: concernType,
    expenseId: expense_id || null,
    expenseCode: expense_code || null,
    priority: priority || "Medium",
    description: finalDesc,
    assignedToRole: assignedRole,
    assignedToName: assignedName,
    status: 'Open',
    comments: '',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const [created] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.ticketCode, ticketCode))
    .limit(1);

  return jsonResponse(formatTicketResponse(created || {
    ticketCode,
    created_by_code: user.user_id,
    concern_type: concernType,
    description: finalDesc,
    status: 'Open'
  }), 201);
}

/**
 * POST /api/tickets/:ticket_id/comment
 */
export async function handleAddComment(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const ticketId = parseInt(params.ticket_id, 10);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { comment } = body;
  if (!comment || !comment.trim()) {
    return jsonResponse({ error: "Comment text is required" }, 400);
  }

  const [ticket] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!ticket) return jsonResponse({ error: "Ticket not found" }, 404);

  const isCreator = ticket.createdByCode === user.user_id;
  const isAssignee = ticket.assignedToName === user.name;
  const isAdmin = user.role === "Admin";
  const isSupervisor = ["Manager", "Coordinator", "Project Head", "VP", "Division Manager"].includes(user.role);

  if (!(isCreator || isAssignee || isAdmin || isSupervisor)) {
    return jsonResponse({ error: "Not authorized to comment on this ticket" }, 403);
  }

  if (ticket.status === "Closed" && ticket.closedAt) {
    const closedTime = new Date(ticket.closedAt).getTime();
    if (Date.now() - closedTime > 36 * 60 * 60 * 1000) {
      await db.update(supportTickets)
        .set({ status: 'Final Closed' })
        .where(eq(supportTickets.id, ticketId));
      return jsonResponse({ error: "Ticket is final closed and cannot be modified." }, 400);
    }
  }

  const dateOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const nowStr = new Date().toLocaleString('en-GB', dateOptions).replace(/,/g, '');
  const logEntry = `${user.name} (${nowStr}): ${comment.trim()}`;
  const newComments = ticket.comments ? `${ticket.comments}\n${logEntry}` : logEntry;

  let newStatus = ticket.status;
  if (isAssignee && ticket.status === "Open") {
    newStatus = "Updated";
  }

  const timestamp = new Date().toISOString();
  await db.update(supportTickets)
    .set({
      comments: newComments,
      status: newStatus,
      updatedAt: timestamp
    })
    .where(eq(supportTickets.id, ticketId));

  const [updated] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  return jsonResponse(formatTicketResponse(updated));
}

/**
 * POST /api/tickets/:ticket_id/close
 */
export async function handleCloseTicket(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const ticketId = parseInt(params.ticket_id, 10);
  
  const [ticket] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!ticket) return jsonResponse({ error: "Ticket not found" }, 404);

  const isCreator = ticket.createdByCode === user.user_id;
  const isAssignee = ticket.assignedToName === user.name;
  const isAdmin = user.role === "Admin";

  if (!(isCreator || isAssignee || isAdmin)) {
    return jsonResponse({ error: "Not authorized to close this ticket" }, 403);
  }

  const timestamp = new Date().toISOString();
  await db.update(supportTickets)
    .set({
      status: 'Closed',
      closedAt: timestamp,
      updatedAt: timestamp
    })
    .where(eq(supportTickets.id, ticketId));

  const [updated] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  return jsonResponse(formatTicketResponse(updated));
}

/**
 * POST /api/tickets/:ticket_id/reopen
 */
export async function handleReopenTicket(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const ticketId = parseInt(params.ticket_id, 10);
  
  const [ticket] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!ticket) return jsonResponse({ error: "Ticket not found" }, 404);

  if (ticket.createdByCode !== user.user_id) {
    return jsonResponse({ error: "Only the ticket creator can reopen it." }, 403);
  }

  if (ticket.status !== "Closed") {
    return jsonResponse({ error: "Only 'Closed' tickets can be reopened." }, 400);
  }

  const timestamp = new Date().toISOString();
  if (ticket.closedAt) {
    const closedTime = new Date(ticket.closedAt).getTime();
    if (Date.now() - closedTime > 36 * 60 * 60 * 1000) {
      await db.update(supportTickets)
        .set({ status: 'Final Closed', updatedAt: timestamp })
        .where(eq(supportTickets.id, ticketId));
      return jsonResponse({ error: "Ticket was closed more than 36 hours ago and is now Final Closed." }, 400);
    }
  }

  await db.update(supportTickets)
    .set({
      status: 'Re-opened',
      closedAt: null,
      updatedAt: timestamp
    })
    .where(eq(supportTickets.id, ticketId));

  const [updated] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  return jsonResponse(formatTicketResponse(updated));
}

/**
 * POST /api/tickets/:ticket_id/followup
 */
export async function handleToggleFollowup(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const ticketId = parseInt(params.ticket_id, 10);
  
  const [ticket] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!ticket) return jsonResponse({ error: "Ticket not found" }, 404);

  const isCreator = ticket.createdByCode === user.user_id;
  const isAssignee = ticket.assignedToName === user.name;
  const isAdmin = user.role === "Admin";

  if (!(isCreator || isAssignee || isAdmin)) {
    return jsonResponse({ error: "Not authorized to toggle followup on this ticket." }, 403);
  }

  const newFollowup = ticket.needsFollowup ? 0 : 1;
  const timestamp = new Date().toISOString();
  
  await db.update(supportTickets)
    .set({
      needsFollowup: newFollowup,
      updatedAt: timestamp
    })
    .where(eq(supportTickets.id, ticketId));

  const [updated] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  return jsonResponse(formatTicketResponse(updated));
}
