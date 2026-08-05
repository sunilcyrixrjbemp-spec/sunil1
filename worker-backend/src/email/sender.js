/**
 * ============================================================
 * Enterprise Email Sender — Cloudflare Email Workers API
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Uses ONLY Cloudflare Email Workers (MailChannels integration).
 * API Token: CF_EMAIL_API_TOKEN (secret)
 * From Address: EMAIL_FROM_ADDRESS (e.g. noreply@indrae.in)
 *
 * REMOVED: Google Apps Script email fallback (GAS)
 * 
 * Priority Queue:
 *   1 = OTP / Auth (instant, bypass rate limit)
 *   2 = Approval Actions (high)
 *   3 = Expense Status Updates (normal)
 *   4 = Manager Digest (low)
 *   5 = Reports / Bulk (background)
 * ============================================================
 */

import { staticLog } from "../utils/logger.js";
import { nowISO } from "../utils/timestamp.js";
import {
  otpTemplate,
  passwordResetTemplate,
  managerDigestTemplate,
  expenseSubmittedTemplate,
  expenseApprovedTemplate,
  expenseRejectedTemplate,
  welcomeTemplate,
  emailActionConfirmationTemplate,
} from "./templates.js";

// ─── Cloudflare Email Workers (Native) ───────────────────────────────────────

/**
 * Send email via Cloudflare Email Workers binding (env.EMAIL_SENDER).
 * This is the native Cloudflare solution — no third-party API needed.
 * Docs: https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/
 *
 * Requirements:
 *   - [[send_email]] binding in wrangler.toml
 *   - Email Routing enabled on domain (Cloudflare Dashboard → Email → Email Routing)
 *   - From address verified in Email Routing
 *
 * @param {Object} env
 * @param {Object} opts - { to, toName, subject, html }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendViaCloudflareMail(env, opts) {
  const { to, toName, subject, html, text, cc = [] } = opts;

  const fromEmail = env.EMAIL_FROM_ADDRESS || "noreply@indrae.in";
  const replyTo   = env.EMAIL_REPLY_TO     || "support@indrae.in";
  const fromName  = env.EMAIL_FROM_NAME   || "Cyrix Field Connect";
  const textBody  = text || "Cyrix Field Connect Security Verification Email.";
  const ccHeader  = cc.length > 0 ? cc.join(", ") : null;

  // ── Primary: MailChannels API (Sends TO + CC in 1 single transaction — no multi-send count) ──
  try {
    const mcPayload = {
      personalizations: [{
        to: [{ email: to, name: toName || to }],
        ...(cc.length > 0 ? { cc: cc.map(e => ({ email: e })) } : {})
      }],
      from: { email: fromEmail, name: fromName },
      reply_to: { email: replyTo, name: fromName },
      subject: subject,
      content: [
        { type: "text/plain", value: textBody },
        { type: "text/html", value: html }
      ]
    };
    const mcRes = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mcPayload)
    });
    if (mcRes.ok || mcRes.status === 202) {
      const msgId = `mc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      staticLog.info("Email sent via MailChannels (single transaction)", { to, cc, subject: subject.slice(0, 50), msgId });
      return { success: true, messageId: msgId };
    }
    const mcErrText = await mcRes.text();
    staticLog.warn("MailChannels API send non-200, attempting CF Email Workers fallback", { status: mcRes.status, text: mcErrText });
  } catch (mcErr) {
    staticLog.warn("MailChannels API exception, attempting CF Email Workers fallback", { error: mcErr.message });
  }

  // ── Secondary Fallback: Cloudflare Email Workers binding ──────────────────
  if (env.EMAIL_SENDER) {
    try {
      const { EmailMessage } = await import("cloudflare:email");

      const msgId    = `<${Date.now()}.${Math.random().toString(36).slice(2)}@indrae.in>`;
      const dateStr  = new Date().toUTCString();
      const toHeader = toName ? `${toName} <${to}>` : to;
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Base64 encode HTML body to avoid 998-character SMTP line length violations
      const b64Html = btoa(unescape(encodeURIComponent(html))).match(/.{1,76}/g).join("\r\n");
      const b64Text = btoa(unescape(encodeURIComponent(textBody))).match(/.{1,76}/g).join("\r\n");

      // Only Base64 encode subject if it contains non-ASCII characters
      const hasNonAscii = /[^\x00-\x7F]/.test(subject);
      const formattedSubject = hasNonAscii
        ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
        : subject;

      const headers = [
        `MIME-Version: 1.0`,
        `Date: ${dateStr}`,
        `Message-ID: ${msgId}`,
        `From: ${fromName} <${fromEmail}>`,
        `To: ${toHeader}`,
        `Reply-To: ${fromName} <${replyTo}>`,
        ...(ccHeader ? [`Cc: ${ccHeader}`] : []),
        `Subject: ${formattedSubject}`,
        `Organization: Cyrix HealthCare Private Limited`,
        `X-Mailer: Cyrix FieldConnect Mail Engine`,
        `Auto-Submitted: auto-generated`,
        `X-Auto-Response-Suppress: All`,
        `List-Unsubscribe: <mailto:${replyTo}?subject=unsubscribe>`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        b64Text,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        b64Html,
        ``,
        `--${boundary}--`
      ];

      const rawMessage = headers.join("\r\n");
      const message = new EmailMessage(fromEmail, to, rawMessage);
      await env.EMAIL_SENDER.send(message);

      // Send CC recipients
      for (const ccEmail of cc) {
        try {
          const ccMsg = new EmailMessage(fromEmail, ccEmail, rawMessage);
          await env.EMAIL_SENDER.send(ccMsg);
        } catch (_) {}
      }

      staticLog.info("Email sent via CF Email Workers", { to, cc, subject: subject.slice(0, 50), msgId });
      return { success: true, messageId: msgId };

    } catch (e) {
      staticLog.error("CF Email Workers send failed", { to, error: e.message });
    }
  }

  // ── Tertiary Fallback: Google Apps Script Webhook ─────────────────────────
  if (env.GAS_DASHBOARD_URL) {
    try {
      const gasRes = await fetch(env.GAS_DASHBOARD_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send_email", to, subject, html, text: textBody })
      });
      if (gasRes.ok) {
        const msgId = `gas_${Date.now()}`;
        staticLog.info("Email sent via GAS Webhook fallback", { to, subject: subject.slice(0, 50) });
        return { success: true, messageId: msgId };
      }
    } catch (gasErr) {
      staticLog.warn("GAS Webhook send failed", { error: gasErr.message });
    }
  }

  staticLog.error("All email providers failed", { to });
  return {
    success: false,
    error: "All email delivery methods (CF Email Workers, MailChannels API, GAS Webhook) failed.",
  };
}


// ─── Email Log Helpers ────────────────────────────────────────────────────────

async function logEmailIntent(env, { to, toName, userId, subject, templateName, priority, relatedEntityType, relatedEntityId }) {
  if (!env.DB) return null;
  try {
    const r = await env.DB.prepare(`
      INSERT INTO email_logs (
        recipient_email, recipient_name, recipient_user_id, subject,
        template_name, status, attempts, priority,
        related_entity_type, related_entity_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)
    `).bind(
      to, toName || null, userId || null, subject,
      templateName || null, priority || 5,
      relatedEntityType || null, relatedEntityId || null,
      nowISO(), nowISO(),
    ).run();
    return r.meta?.last_row_id || null;
  } catch (e) {
    staticLog.error("Failed to log email intent", { error: e.message });
    return null;
  }
}

async function updateEmailLog(env, id, status, error, messageId) {
  if (!env.DB || !id) return;
  try {
    await env.DB.prepare(`
      UPDATE email_logs
      SET status = ?, error_message = ?, message_id = ?,
          sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END,
          attempts = attempts + 1, last_attempt_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      status, error || null, messageId || null,
      status, status === "sent" ? nowISO() : null,
      nowISO(), nowISO(), id,
    ).run();
  } catch (_) {}
}

// ─── Core Send Function ───────────────────────────────────────────────────────

/**
 * Queue an email for async delivery (non-blocking).
 * Logs intent to DB, then sends to EMAIL_QUEUE.
 *
 * @param {Object} env
 * @param {Object} opts - { to, toName, userId, subject, html, templateName, priority, bypassRateLimit, relatedEntityType, relatedEntityId }
 * @returns {Promise<boolean>}
 */
export async function queueEmail(env, opts) {
  const {
    to, toName, userId, subject, html, templateName,
    priority = 5, bypassRateLimit = false,
    relatedEntityType, relatedEntityId,
  } = opts;

  if (!to || !subject || !html) {
    staticLog.warn("queueEmail: missing required fields", { to: !!to, subject: !!subject });
    return false;
  }

  // Rate limit: max 10 emails/hour per user (OTPs bypass)
  if (!bypassRateLimit && userId && env.OTPS_KV) {
    const rlKey = `email_rl:${userId}`;
    const count = parseInt(await env.OTPS_KV.get(rlKey) || "0");
    const limit = parseInt(env.RATE_LIMIT_EMAIL || "10");
    if (count >= limit) {
      staticLog.warn("Email rate limit hit", { userId, count });
      return false;
    }
    await env.OTPS_KV.put(rlKey, String(count + 1), { expirationTtl: 3600 });
  }

  // Log intent to DB
  const emailLogId = await logEmailIntent(env, { to, toName, userId, subject, templateName, priority, relatedEntityType, relatedEntityId });

  // Queue for async delivery (non-blocking)
  if (env.EMAIL_QUEUE && env.ENABLE_QUEUES !== "false") {
    try {
      await env.EMAIL_QUEUE.send({ emailLogId, to, toName, subject, html, templateName, priority, queuedAt: nowISO() });
      return true;
    } catch (e) {
      staticLog.warn("EMAIL_QUEUE send failed — sending directly", { error: e.message });
    }
  }

  // Direct send (fallback: queue unavailable or dev mode)
  return await sendEmailDirect(env, { to, toName, subject, html, emailLogId });
}

/**
 * Send immediately without queueing.
 * Called by the queue processor and as direct fallback.
 */
export async function sendEmailDirect(env, { to, toName, subject, html, text, cc, emailLogId }) {
  if (env.ENABLE_EMAIL === "false") {
    staticLog.info("Email disabled by ENABLE_EMAIL flag", { to });
    await updateEmailLog(env, emailLogId, "disabled", null, null);
    return false;
  }

  const result = await sendViaCloudflareMail(env, { to, toName, subject, html, text, cc: cc || [] });

  if (result.success) {
    await updateEmailLog(env, emailLogId, "sent", null, result.messageId);
    return true;
  }

  await updateEmailLog(env, emailLogId, "failed", result.error, null);
  return false;
}

// ─── Queue Consumer ───────────────────────────────────────────────────────────

export async function processEmailBatch(batch, env) {
  for (const message of batch.messages) {
    try {
      const { to, toName, subject, html, emailLogId } = message.body;
      const ok = await sendEmailDirect(env, { to, toName, subject, html, emailLogId });
      if (ok) message.ack();
      else message.retry();
    } catch (e) {
      staticLog.error("Email queue processor error", { error: e.message });
      message.retry();
    }
  }
}

// ─── Convenience Wrappers ─────────────────────────────────────────────────────

export async function sendOTPEmail(env, { to, name, otp, userId, purpose = "Account Unlock" }) {
  const tmpl = otpTemplate({ name, otp, userId, purpose });
  const emailLogId = await logEmailIntent(env, {
    to, toName: name, userId, subject: tmpl.subject,
    templateName: "otp", priority: 1
  });
  return sendEmailDirect(env, {
    to, toName: name, subject: tmpl.subject, html: tmpl.html, text: tmpl.text, emailLogId
  });
}

export async function sendPasswordResetEmail(env, { to, name, otp, userId }) {
  const tmpl = passwordResetTemplate({ name, otp, userId });
  const emailLogId = await logEmailIntent(env, {
    to, toName: name, userId, subject: tmpl.subject,
    templateName: "password_reset", priority: 1
  });
  return sendEmailDirect(env, {
    to, toName: name, subject: tmpl.subject, html: tmpl.html, text: tmpl.text, emailLogId
  });
}

export async function sendExpenseStatusEmail(env, { to, name, userId, action, ...data }) {
  // ── Approved path: simple, no changes ──────────────────────────────────────
  if (action === "approved") {
    const tmpl = expenseApprovedTemplate({ employeeName: name, ...data });
    return queueEmail(env, {
      to, toName: name, userId, ...tmpl,
      templateName: "expense_approved", priority: 3,
      relatedEntityType: "expense", relatedEntityId: data.expenseCode,
    });
  }

  // ── Rejected path: enrich with leg details + CC manager + coordinator ─────
  let legs = [];
  let employeeExtra = {};
  let managerEmail = null;
  let coordinatorEmail = null;
  let approverDesig = null;

  // ── Parallel DB fetch: all queries fire at once ───────────────────────────
  const expId = data.expenseCode || data.expenseId;
  const expNumId = data.expenseNumericId;   // numeric PK from expenses table
  const rejectorName = data.approverName || data.approvedBy;

  if (env.DB) {
    try {
      // Round 1 — all parallel: legs, employee extra info, rejector designation, all approvers
      const [legRows, emp, appr, approverRows] = await Promise.all([
        // Leg-wise itinerary
        (expId)
          ? env.DB.prepare(
              `SELECT leg_number, from_district, to_district, from_location, to_location,
                      travel_mode, sub_mode, distance_km, travel_amount, sub_km, sub_amount,
                      da_amount, hotel_amount, other_amount, other_desc, local_purchase,
                      visit_purpose, activity_details, calls_assigned, calls_completed
               FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC, id ASC`
            ).bind(expId).all()
          : Promise.resolve({ results: [] }),

        // Employee's own designation (for display in email)
        userId
          ? env.DB.prepare(
              `SELECT designation FROM users WHERE user_id = ? LIMIT 1`
            ).bind(userId).first()
          : Promise.resolve(null),

        // Rejector's designation
        rejectorName
          ? env.DB.prepare(
              `SELECT designation FROM users WHERE name = ? LIMIT 1`
            ).bind(rejectorName).first()
          : Promise.resolve(null),

        // ALL approvers for this expense (L1, L2, L3... every level)
        // approvals.approver_id stores numeric users.id (NOT users.user_id string)
        (expNumId)
          ? env.DB.prepare(
              `SELECT DISTINCT u.mail_id, u.name, a.level_number
               FROM approvals a
               INNER JOIN users u ON u.id = CAST(a.approver_id AS INTEGER)
               WHERE a.expense_id = ?
                 AND u.mail_id IS NOT NULL AND u.mail_id != ''
               ORDER BY a.level_number ASC`
            ).bind(expNumId).all()
          : Promise.resolve({ results: [] }),
      ]);

      legs = legRows?.results || [];
      approverDesig = appr?.designation || null;
      employeeExtra.designation = emp?.designation || "";

      // Build CC list from all approvers
      const approvers = approverRows?.results || [];
      const ccEmails = approvers
        .map(a => a.mail_id)
        .filter(email => email && email !== to);
      // Deduplicate
      const uniqueCC = [...new Set(ccEmails)];

      // Set managerEmail as the first approver (for compatibility), rest go via ccList
      if (uniqueCC.length > 0) managerEmail = uniqueCC[0];
      if (uniqueCC.length > 1) coordinatorEmail = uniqueCC[1];

      // Store full list for later use
      employeeExtra._allApproverEmails = uniqueCC;

      staticLog.info("Rejection email CC from approvals table", {
        userId, expNumId,
        approversFound: approvers.length,
        ccList: uniqueCC,
      });

    } catch (e) {
      staticLog.error("Rejection email DB fetch failed", { error: e.message });
    }
  }

  const rejectedAt = data.rejectedAt || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";

  const tmpl = expenseRejectedTemplate({
    employeeName: name,
    employeeId: userId,
    designation: employeeExtra.designation,
    expenseCode: data.expenseCode,
    travelName: data.travelName,
    expenseMonth: data.expenseMonth,
    claimedAmount: data.claimedAmount || data.totalAmount,
    approvedAmount: data.approvedAmount || 0,
    approverName: data.approverName,
    approverDesig,
    rejectionReason: data.rejectionReason || data.managerComments || data.comments,
    rejectedAt,
    legs,
  });

  // CC list = all approvers fetched from approvals table (already deduped, primary To excluded)
  const ccList = employeeExtra._allApproverEmails || [];

  // Log intent and dispatch — use waitUntil so API returns instantly
  const emailLogId = await logEmailIntent(env, {
    to, toName: name, userId,
    subject: tmpl.subject,
    templateName: "expense_rejected", priority: 2,
    relatedEntityType: "expense", relatedEntityId: data.expenseCode,
  });

  const sendPromise = sendEmailDirect(env, {
    to, toName: name,
    subject: tmpl.subject,
    html: tmpl.html,
    text: tmpl.text,
    cc: ccList,
    emailLogId,
  });

  // Non-blocking: if ctx.waitUntil available, return immediately
  if (env.ctx?.waitUntil) {
    env.ctx.waitUntil(sendPromise);
    return true;
  }
  return sendPromise;
}

export async function sendExpenseSubmittedEmail(env, { to, name, userId, ...data }) {
  const tmpl = expenseSubmittedTemplate({ employeeName: name, ...data });
  return queueEmail(env, {
    to, toName: name, userId, ...tmpl,
    templateName: "expense_submitted", priority: 3,
  });
}

export async function sendWelcomeEmail(env, { to, name, userId, temporaryPassword }) {
  const tmpl = welcomeTemplate({ name, userId, temporaryPassword });
  return queueEmail(env, {
    to, toName: name, userId, ...tmpl,
    templateName: "welcome", priority: 2, bypassRateLimit: true,
  });
}

// ─── Manager Daily Digest (Cron: 10:00 AM IST daily) ─────────────────────────

export async function sendManagerDigests(env) {
  if (!env.DB || env.ENABLE_EMAIL_DIGESTS !== "true") return;

  try {
    const managers = await env.DB.prepare(`
      SELECT DISTINCT u.user_id, u.name, u.mail_id, COUNT(e.id) as pending_count
      FROM users u
      INNER JOIN expenses e ON (
        e.pending_manager = u.user_id OR
        e.pending_zonal_manager = u.user_id OR
        e.pending_coordinator = u.user_id
      )
      WHERE e.status IN ('submitted', 'pending_approval')
        AND u.mail_id IS NOT NULL AND u.mail_id != ''
      GROUP BY u.user_id HAVING pending_count > 0
    `).all();

    for (const manager of (managers?.results || [])) {
      const pending = await env.DB.prepare(`
        SELECT e.expense_code, e.total_amount, u.name as employee_name
        FROM expenses e
        LEFT JOIN users u ON e.employee_id = u.user_id
        WHERE (e.pending_manager = ? OR e.pending_zonal_manager = ? OR e.pending_coordinator = ?)
          AND e.status IN ('submitted', 'pending_approval')
        LIMIT 20
      `).bind(manager.user_id, manager.user_id, manager.user_id).all();

      const tmpl = managerDigestTemplate({
        managerName: manager.name,
        pendingApprovals: (pending?.results || []).map(e => ({
          ...e,
          approveToken: "SEE_PORTAL",
          rejectToken: "SEE_PORTAL",
        })),
        approvalBaseUrl: "https://indrae.in",
      });

      await queueEmail(env, {
        to: manager.mail_id,
        toName: manager.name,
        userId: manager.user_id,
        ...tmpl,
        templateName: "manager_digest",
        priority: 4,
        bypassRateLimit: true,
      });

      staticLog.info("Manager digest queued", { managerId: manager.user_id, pending: manager.pending_count });
    }
  } catch (e) {
    staticLog.error("Manager digest generation failed", { error: e.message });
  }
}
