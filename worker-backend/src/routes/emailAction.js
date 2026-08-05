/**
 * ============================================================
 * Email Action Handler
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Handles one-click approve/reject actions from manager email links.
 *
 * Security:
 *   - JWT signed token (HMAC-SHA256, 48-hour expiry)
 *   - Single-use (token marked as used in DB)
 *   - IP logged for audit
 *   - Returns HTML confirmation page (not JSON)
 *
 * Flow:
 *   Manager clicks "Approve" in email
 *   → GET /api/expense/email-action?token=SIGNED_TOKEN
 *   → Verify token signature + expiry
 *   → Check single-use status
 *   → Execute approval in DB
 *   → Mark token as used
 *   → Return HTML confirmation page
 * ============================================================
 */

import { verifyApprovalToken, sha256 } from "../utils/security.js";
import { htmlResponse, errorResponse } from "../utils/http.js";
import { getClientIP } from "../utils/rateLimit.js";
import { nowISO } from "../utils/timestamp.js";
import { staticLog } from "../utils/logger.js";
import { emailActionConfirmationTemplate } from "../email/templates.js";

/**
 * GET /api/expense/email-action?token=SIGNED_JWT
 * Public endpoint — no JWT auth required (token IS the auth).
 */
export async function handleEmailAction(request, env, params, query) {
  const token = query.get("token");
  const ip = getClientIP(request);

  if (!token) {
    return htmlResponse(confirmationPage("error", "Invalid Link", "Missing token. Please use the link from your email."));
  }

  // Step 1: Verify the signed JWT token
  const secret = env.APPROVAL_SECRET || env.API_SECRET;
  let payload;
  try {
    payload = await verifyApprovalToken(token, secret);
  } catch (e) {
    return htmlResponse(confirmationPage("error", "Invalid Link", "This link is invalid or malformed."));
  }

  if (!payload) {
    return htmlResponse(confirmationPage("error", "Link Expired", "This approval link has expired or is invalid. Please log in to the portal to approve expenses."));
  }

  const { expenseId, action, approverId } = payload;

  if (!expenseId || !action || !approverId) {
    return htmlResponse(confirmationPage("error", "Invalid Link", "This link is missing required information."));
  }

  if (action !== "approve" && action !== "reject") {
    return htmlResponse(confirmationPage("error", "Invalid Action", "Unknown action type in this link."));
  }

  // Step 2: Check single-use status in approval_tokens table
  const tokenHash = await sha256(token);
  let tokenRow;
  try {
    tokenRow = await env.DB.prepare(
      "SELECT * FROM approval_tokens WHERE token_hash = ? LIMIT 1"
    ).bind(tokenHash).first();
  } catch (e) {
    staticLog.error("Email action: DB error checking token", { error: e.message });
    return htmlResponse(confirmationPage("error", "Server Error", "A server error occurred. Please try again or use the portal."));
  }

  if (tokenRow) {
    if (tokenRow.used_at) {
      return htmlResponse(confirmationPage("warning", "Already Used", "This approval link has already been used. No action was taken."));
    }
    if (tokenRow.is_revoked) {
      return htmlResponse(confirmationPage("error", "Link Revoked", "This approval link has been revoked. Please use the portal."));
    }
  }

  // Step 3: Fetch expense details
  let expense;
  try {
    expense = await env.DB.prepare(
      "SELECT * FROM expenses WHERE id = ? LIMIT 1"
    ).bind(expenseId).first();
  } catch (e) {
    return htmlResponse(confirmationPage("error", "Expense Not Found", "Could not find this expense claim."));
  }

  if (!expense) {
    return htmlResponse(confirmationPage("error", "Expense Not Found", "This expense claim no longer exists."));
  }

  // Step 4: Verify approver is still authorized
  const approver = await env.DB.prepare(
    "SELECT * FROM users WHERE user_id = ? LIMIT 1"
  ).bind(approverId).first();

  if (!approver) {
    return htmlResponse(confirmationPage("error", "Unauthorized", "Your account was not found."));
  }

  const employee = await env.DB.prepare(
    "SELECT name, mail_id FROM users WHERE user_id = ? LIMIT 1"
  ).bind(expense.employee_id).first();

  // Step 5: Execute the action
  const newStatus = action === "approve" ? "approved" : "rejected";
  const comments = `Action taken via email link by ${approver.name} from IP ${ip}`;

  try {
    await env.DB.prepare(`
      UPDATE expenses
      SET status = ?, approved_by = ?, approved_at = ?, manager_comments = ?
      WHERE id = ? AND status IN ('submitted', 'pending_approval')
    `).bind(newStatus, approverId, nowISO(), comments, expenseId).run();

    // Mark token as used
    if (tokenRow) {
      await env.DB.prepare(`
        UPDATE approval_tokens SET used_at = ?, used_from_ip = ? WHERE token_hash = ?
      `).bind(nowISO(), ip, tokenHash).run();
    } else {
      // Store token record (for future idempotency checks)
      await env.DB.prepare(`
        INSERT OR IGNORE INTO approval_tokens
        (expense_id, expense_code, approver_id, action, token_hash, expires_at, used_at, used_from_ip, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '+48 hours'), ?, ?, ?)
      `).bind(
        expenseId, expense.expense_code, approverId, action,
        tokenHash, nowISO(), ip, nowISO()
      ).run();
    }

    // Audit log
    await env.DB.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, performed_by_id, performed_by_name,
        performed_by_role, new_value, ip_address, success, created_at)
      VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, 1, ?)
    `).bind(
      `expense.${action}`, String(expenseId), approverId, approver.name,
      approver.role, JSON.stringify({ status: newStatus, via: "email_action" }),
      ip, nowISO()
    ).run();

    staticLog.info("Email action executed", {
      expenseId, action, approverId, ip, expenseCode: expense.expense_code
    });

    // Return confirmation page
    const { html } = emailActionConfirmationTemplate({
      action,
      expenseCode: expense.expense_code || `#${expenseId}`,
      approverName: approver.name,
      employeeName: employee?.name || "Employee",
      amount: expense.total_amount || 0,
    });

    return htmlResponse(html, 200);
  } catch (e) {
    staticLog.error("Email action execution failed", { expenseId, action, error: e.message });
    return htmlResponse(confirmationPage("error", "Action Failed", "Could not complete the action. Please try again from the portal: <a href='https://indrae.in'>indrae.in</a>"));
  }
}

/**
 * Generate a simple HTML confirmation/error page.
 */
function confirmationPage(type, title, message) {
  const colors = { success: "#27ae60", warning: "#e8a135", error: "#e74c3c" };
  const icons = { success: "✓", warning: "⚠", error: "✗" };
  const color = colors[type] || colors.error;
  const icon = icons[type] || icons.error;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title} — Cyrix Field Connect</title>
<style>
  body{margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .card{background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.1);padding:40px;max-width:480px;text-align:center;}
  .icon{width:80px;height:80px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:40px;color:#fff;}
  h1{color:${color};margin:0 0 12px;font-size:24px;} p{color:#555;margin:0 0 24px;line-height:1.6;}
  a.btn{background:#1a2e4a;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;}
</style></head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://indrae.in" class="btn">Go to Portal →</a>
  </div>
</body></html>`;
}
