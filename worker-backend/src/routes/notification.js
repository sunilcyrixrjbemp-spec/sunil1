import { runWrite } from "../utils/db.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * GET /api/notifications
 * Retrieve notifications for the current authenticated user
 */
export async function handleGetNotifications(request, env, params, query, user) {
  const result = await env.DB.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).bind(user.user_id).all();

  return jsonResponse(result.results || []);
}

/**
 * POST /api/notifications/:id/read
 * Mark a specific notification as read
 */
export async function handleMarkRead(request, env, params, query, user) {
  const notifId = parseInt(params.id, 10);
  
  const notif = await env.DB.prepare(`
    SELECT * FROM notifications WHERE id = ? AND user_id = ?
  `).bind(notifId, user.user_id).first();

  if (!notif) {
    return jsonResponse({ error: "Notification not found" }, 404);
  }

  await runWrite(env, `
    UPDATE notifications SET read = 1 WHERE id = ?
  `, [notifId]);

  return jsonResponse({ status: "success", message: "Notification marked as read" });
}

/**
 * POST /api/notifications/read-all
 * Mark all notifications of the current user as read
 */
export async function handleMarkAllRead(request, env, params, query, user) {
  await runWrite(env, `
    UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0
  `, [user.user_id]);

  return jsonResponse({ status: "success", message: "All notifications marked as read" });
}

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
export async function handleDeleteNotification(request, env, params, query, user) {
  const notifId = parseInt(params.id, 10);

  const notif = await env.DB.prepare(`
    SELECT * FROM notifications WHERE id = ? AND user_id = ?
  `).bind(notifId, user.user_id).first();

  if (!notif) {
    return jsonResponse({ error: "Notification not found" }, 404);
  }

  await runWrite(env, `
    DELETE FROM notifications WHERE id = ?
  `, [notifId]);

  return jsonResponse({ status: "success", message: "Notification deleted" });
}
