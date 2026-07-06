import { runWrite } from "../utils/db.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Bulk-update closed tickets to Final Closed if closed > 36 hours
 */
async function checkAndAutoCloseTickets(env) {
  const limitTime = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  await runWrite(env, `
    UPDATE support_tickets 
    SET status = 'Final Closed' 
    WHERE status = 'Closed' AND closed_at IS NOT NULL AND closed_at < ?
  `, [limitTime]);
}

/**
 * GET /api/tickets
 */
export async function handleGetTickets(request, env, params, query, user) {
  await checkAndAutoCloseTickets(env);

  let result;
  if (user.role === "Admin") {
    result = await env.DB.prepare(`
      SELECT * FROM support_tickets ORDER BY created_at DESC
    `).all();
  } else {
    result = await env.DB.prepare(`
      SELECT * FROM support_tickets 
      WHERE created_by_code = ? OR assigned_to_name = ? OR assigned_to_role = ?
      ORDER BY created_at DESC
    `).bind(user.user_id, user.name, user.role).all();
  }

  return jsonResponse(result.results || []);
}

/**
 * POST /api/tickets
 */
export async function handleCreateTicket(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { concern_type, expense_id, expense_code, priority, description, assigned_to_name } = body;
  if (!concern_type || !description) {
    return jsonResponse({ error: "concern_type and description are required" }, 400);
  }

  let assignedRole = "Admin";
  let assignedName = "Admin System";
  let assignedUserCode = null;

  if (concern_type !== "Profile") {
    assignedName = (assigned_to_name || "").trim();
    const assignedUser = await env.DB.prepare("SELECT * FROM users WHERE name = ?").bind(assignedName).first();
    if (!assignedUser) {
      return jsonResponse({ error: `Assigned staff '${assignedName}' not found.` }, 404);
    }
    assignedRole = assignedUser.role;
    assignedUserCode = assignedUser.user_id;
  }

  // Generate ticket code TKT-YYYYMMDD-XXXX
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM support_tickets WHERE ticket_code LIKE ?
  `).bind(`TKT-${todayStr}-%`).first();
  const count = countResult?.cnt || 0;
  const ticketCode = `TKT-${todayStr}-${String(count + 1).padStart(4, "0")}`;
  const timestamp = new Date().toISOString();

  await runWrite(env, `
    INSERT INTO support_tickets (ticket_code, created_by_id, created_by_name, created_by_code, concern_type, expense_id, expense_code, priority, description, assigned_to_role, assigned_to_name, status, comments, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', '', ?, ?, ?)
  `, [
    ticketCode, user.id, user.name, user.user_id, concern_type, expense_id || null, expense_code || null,
    priority || "Medium", description.trim(), assignedRole, assignedName, timestamp, timestamp
  ]);

  // Send Notification to assigned user
  if (assignedUserCode) {
    await runWrite(env, `
      INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
      VALUES (?, ?, ?, 'warning', 0, '/help-center', ?)
    `, [
      assignedUserCode,
      "📥 Ticket Assigned",
      `${user.name} raised a ${priority || "Medium"} priority ticket ${ticketCode} (${concern_type}) and assigned it to you.`,
      timestamp
    ]);
  }

  const created = await env.DB.prepare("SELECT * FROM support_tickets WHERE ticket_code = ?").bind(ticketCode).first();
  return jsonResponse(created, 201);
}

/**
 * POST /api/tickets/:ticket_id/comment
 */
export async function handleAddComment(request, env, params, query, user) {
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

  const ticket = await env.DB.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  if (!ticket) return jsonResponse({ error: "Ticket not found" }, 404);

  const isCreator = ticket.created_by_code === user.user_id;
  const isAssignee = ticket.assigned_to_name === user.name;
  const isAdmin = user.role === "Admin";
  const isSupervisor = ["Manager", "Coordinator", "Project Head", "VP", "Division Manager"].includes(user.role);

  if (!(isCreator || isAssignee || isAdmin || isSupervisor)) {
    return jsonResponse({ error: "Not authorized to comment on this ticket" }, 403);
  }

  if (ticket.status === "Closed" && ticket.closed_at) {
    const closedTime = new Date(ticket.closed_at).getTime();
    if (Date.now() - closedTime > 36 * 60 * 60 * 1000) {
      await runWrite(env, "UPDATE support_tickets SET status = 'Final Closed' WHERE id = ?", [ticketId]);
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
  await runWrite(env, "UPDATE support_tickets SET comments = ?, status = ?, updated_at = ? WHERE id = ?", [
    newComments, newStatus, timestamp, ticketId
  ]);

  // Notifications
  const commentPreview = comment.trim().slice(0, 80) + (comment.trim().length > 80 ? "..." : "");
  if (isCreator) {
    const assignee = await env.DB.prepare("SELECT * FROM users WHERE name = ?").bind(ticket.assigned_to_name).first();
    if (assignee) {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, 'info', 0, '/help-center', ?)", [
        assignee.user_id, `Reply on Ticket ${ticket.ticket_code}`, `${user.name} commented: ${commentPreview}`, timestamp
      ]);
    }
  } else if (isAssignee) {
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, 'info', 0, '/help-center', ?)", [
      ticket.created_by_code, `Update on Ticket ${ticket.ticket_code}`, `${user.name} commented: ${commentPreview}`, timestamp
    ]);
  }

  const updated = await env.DB.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  return jsonResponse(updated);
}

/**
 * POST /api/tickets/:ticket_id/close
 */
export async function handleCloseTicket(request, env, params, query, user) {
  const ticketId = parseInt(params.ticket_id, 10);
  const ticket = await env.DB.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  if (!ticket) return jsonResponse({ error: "Ticket not found" }, 404);

  const isCreator = ticket.created_by_code === user.user_id;
  const isAssignee = ticket.assigned_to_name === user.name;
  const isAdmin = user.role === "Admin";

  if (!(isCreator || isAssignee || isAdmin)) {
    return jsonResponse({ error: "Not authorized to close this ticket" }, 403);
  }

  const timestamp = new Date().toISOString();
  await runWrite(env, "UPDATE support_tickets SET status = 'Closed', closed_at = ?, updated_at = ? WHERE id = ?", [
    timestamp, timestamp, ticketId
  ]);

  if (!isCreator) {
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '✅ Support Ticket Closed', ?, 'success', 0, '/help-center', ?)", [
      ticket.created_by_code, `Your ticket ${ticket.ticket_code} has been resolved and closed by ${user.name}.`, timestamp
    ]);
  }

  const updated = await env.DB.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  return jsonResponse(updated);
}

/**
 * POST /api/tickets/:ticket_id/reopen
 */
export async function handleReopenTicket(request, env, params, query, user) {
  const ticketId = parseInt(params.ticket_id, 10);
  const ticket = await env.DB.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  if (!ticket) return jsonResponse({ error: "Ticket not found" }, 404);

  if (ticket.created_by_code !== user.user_id) {
    return jsonResponse({ error: "Only the ticket creator can reopen it." }, 403);
  }

  if (ticket.status !== "Closed") {
    return jsonResponse({ error: "Only 'Closed' tickets can be reopened." }, 400);
  }

  const timestamp = new Date().toISOString();
  if (ticket.closed_at) {
    const closedTime = new Date(ticket.closed_at).getTime();
    if (Date.now() - closedTime > 36 * 60 * 60 * 1000) {
      await runWrite(env, "UPDATE support_tickets SET status = 'Final Closed', updated_at = ? WHERE id = ?", [timestamp, ticketId]);
      return jsonResponse({ error: "Ticket was closed more than 36 hours ago and is now Final Closed." }, 400);
    }
  }

  await runWrite(env, "UPDATE support_tickets SET status = 'Re-opened', closed_at = NULL, updated_at = ? WHERE id = ?", [
    timestamp, ticketId
  ]);

  const assignee = await env.DB.prepare("SELECT * FROM users WHERE name = ?").bind(ticket.assigned_to_name).first();
  if (assignee) {
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '🔄 Support Ticket Re-opened', ?, 'warning', 0, '/help-center', ?)", [
      assignee.user_id, `Ticket ${ticket.ticket_code} has been re-opened by ${user.name}.`, timestamp
    ]);
  }

  const updated = await env.DB.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  return jsonResponse(updated);
}

/**
 * POST /api/tickets/:ticket_id/followup
 */
export async function handleToggleFollowup(request, env, params, query, user) {
  const ticketId = parseInt(params.ticket_id, 10);
  const ticket = await env.DB.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  if (!ticket) return jsonResponse({ error: "Ticket not found" }, 404);

  const isCreator = ticket.created_by_code === user.user_id;
  const isAssignee = ticket.assigned_to_name === user.name;
  const isAdmin = user.role === "Admin";

  if (!(isCreator || isAssignee || isAdmin)) {
    return jsonResponse({ error: "Not authorized to toggle followup on this ticket." }, 403);
  }

  const newFollowup = ticket.needs_followup ? 0 : 1;
  const timestamp = new Date().toISOString();
  await runWrite(env, "UPDATE support_tickets SET needs_followup = ?, updated_at = ? WHERE id = ?", [
    newFollowup, timestamp, ticketId
  ]);

  const updated = await env.DB.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  return jsonResponse(updated);
}
