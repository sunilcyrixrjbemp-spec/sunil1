/**
 * ============================================================
 * Enterprise Email Templates
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * HTML email templates for all system emails.
 * All templates are self-contained, inline-CSS HTML
 * (required for email client compatibility).
 * ============================================================
 */

const BRAND_COLOR = "#1a2e4a";
const ACCENT_COLOR = "#e8a135";
const SUCCESS_COLOR = "#27ae60";
const DANGER_COLOR = "#e74c3c";
const LIGHT_BG = "#f5f7fa";

const emailWrapper = (content, previewText = "") => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>Cyrix HealthCare Private Limited</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  ${previewText ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:20px 28px;text-align:left;border-bottom:3px solid #2563eb;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.5px;">CYRIX HEALTHCARE</div>
                    <div style="color:#94a3b8;font-size:12px;margin-top:2px;">Field Connect System</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 28px;background-color:#ffffff;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px 0;color:#64748b;font-size:12px;font-weight:600;">
                Cyrix HealthCare Private Limited
              </p>
              <p style="margin:0;color:#94a3b8;font-size:11px;">
                This is an automated message from Cyrix Field Connect system.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── Template 1: OTP ─────────────────────────────────────────────────────────

export function otpTemplate({ name, otp, userId, purpose = "Account Unlock", expiryMinutes = 10 }) {
  const istTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const content = `
    <p style="margin:0 0 18px 0;font-size:15px;color:#1e293b;line-height:1.6;">
      Dear <strong>${name || "User"}</strong>,
    </p>

    <p style="margin:0 0 20px 0;font-size:14px;color:#334155;line-height:1.6;">
      We have received a request for <strong>${purpose}</strong> on your Cyrix Field Connect account.
      Please use the verification code below to proceed.
    </p>

    <!-- OTP Box -->
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background-color:#eff6ff;border:2px solid #2563eb;border-radius:10px;padding:16px 40px;">
        <div style="font-size:11px;color:#64748b;margin-bottom:6px;letter-spacing:1px;text-transform:uppercase;">Verification Code</div>
        <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#1e40af;">${otp}</span>
        <div style="margin-top:8px;color:#64748b;font-size:12px;">Valid for ${expiryMinutes} minutes only</div>
      </div>
    </div>

    <p style="margin:0 0 8px 0;font-size:13px;color:#475569;line-height:1.6;">
      <strong>Employee ID:</strong> ${userId || "—"} &nbsp;|&nbsp; <strong>Requested at:</strong> ${istTime} IST
    </p>

    <p style="margin:20px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;">
      Do not share this code with anyone. If you did not make this request, please contact your system administrator immediately.
    </p>

    <p style="margin:20px 0 0 0;font-size:14px;color:#1e293b;line-height:1.6;">
      Thanks,<br/>
      <strong>Cyrix HealthCare Team</strong>
    </p>
  `;

  const textPlain = `Dear ${name || "User"},\n\nWe have received a request for ${purpose} on your Cyrix Field Connect account.\n\nYour Verification Code (OTP): ${otp}\nValid for: ${expiryMinutes} minutes\n\nEmployee ID: ${userId || "—"}\nRequested at: ${istTime} IST\n\nDo not share this code with anyone. If you did not make this request, please contact your system administrator immediately.\n\nThanks,\nCyrix HealthCare Team`;

  return {
    subject: `Verification Code for ${purpose} — Cyrix HealthCare`,
    html: emailWrapper(content, `Your verification code is ${otp}`),
    text: textPlain,
  };
}

// ─── Template 2: Password Reset ───────────────────────────────────────────────

export function passwordResetTemplate({ name, otp, userId, expiryMinutes = 10 }) {
  const istTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const content = `
    <p style="margin:0 0 18px 0;font-size:15px;color:#1e293b;line-height:1.6;">
      Dear <strong>${name || "User"}</strong>,
    </p>

    <p style="margin:0 0 20px 0;font-size:14px;color:#334155;line-height:1.6;">
      We have received a password reset request for your Cyrix Field Connect account.
      Please use the code below to complete your password reset.
    </p>

    <!-- OTP Box -->
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background-color:#fff7ed;border:2px solid #ea580c;border-radius:10px;padding:16px 40px;">
        <div style="font-size:11px;color:#64748b;margin-bottom:6px;letter-spacing:1px;text-transform:uppercase;">Password Reset Code</div>
        <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#c2410c;">${otp}</span>
        <div style="margin-top:8px;color:#64748b;font-size:12px;">Valid for ${expiryMinutes} minutes only</div>
      </div>
    </div>

    <p style="margin:0 0 8px 0;font-size:13px;color:#475569;line-height:1.6;">
      <strong>Employee ID:</strong> ${userId || "—"} &nbsp;|&nbsp; <strong>Requested at:</strong> ${istTime} IST
    </p>

    <p style="margin:20px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;">
      If you did not request a password reset, please ignore this email and contact IT Security immediately.
    </p>

    <p style="margin:20px 0 0 0;font-size:14px;color:#1e293b;line-height:1.6;">
      Thanks,<br/>
      <strong>Cyrix HealthCare Team</strong>
    </p>
  `;

  const textPlain = `Dear ${name || "User"},\n\nWe have received a password reset request for your Cyrix Field Connect account.\n\nYour Password Reset Code (OTP): ${otp}\nValid for: ${expiryMinutes} minutes\n\nEmployee ID: ${userId || "—"}\nRequested at: ${istTime} IST\n\nIf you did not request a password reset, please ignore this email and contact IT Security immediately.\n\nThanks,\nCyrix HealthCare Team`;

  return {
    subject: `Password Reset Code — Cyrix HealthCare`,
    html: emailWrapper(content, `Your password reset code is ${otp}`),
    text: textPlain,
  };
}

// ─── Template 3: Manager Daily Digest ────────────────────────────────────────

export function managerDigestTemplate({ managerName, pendingApprovals, approvalBaseUrl }) {
  const rows = (pendingApprovals || []).map(exp => `
    <tr style="border-bottom:1px solid #e0e0e0;">
      <td style="padding:10px 8px;font-size:13px;color:#333;">${exp.employee_name || "N/A"}</td>
      <td style="padding:10px 8px;font-size:13px;color:#333;">${exp.expense_code || ""}</td>
      <td style="padding:10px 8px;font-size:13px;color:#333;">₹${(exp.total_amount || 0).toLocaleString("en-IN")}</td>
      <td style="padding:10px 8px;font-size:13px;">
        <a href="${approvalBaseUrl}/api/expense/email-action?token=${exp.approveToken}&action=approve"
           style="background:${SUCCESS_COLOR};color:#fff;padding:6px 12px;border-radius:4px;text-decoration:none;font-size:12px;display:inline-block;margin-right:4px;">✓ Approve</a>
        <a href="${approvalBaseUrl}/api/expense/email-action?token=${exp.rejectToken}&action=reject"
           style="background:${DANGER_COLOR};color:#fff;padding:6px 12px;border-radius:4px;text-decoration:none;font-size:12px;display:inline-block;">✗ Reject</a>
      </td>
    </tr>
  `).join("");

  const content = `
    <h2 style="margin:0 0 8px;color:${BRAND_COLOR};">Daily Approval Digest</h2>
    <p style="color:#555;margin:0 0 16px;">Hello ${managerName},</p>
    <p style="color:#555;margin:0 0 24px;">You have <strong>${pendingApprovals?.length || 0}</strong> expense claim(s) pending your approval:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:${BRAND_COLOR};">
          <th style="color:#fff;padding:10px 8px;text-align:left;font-size:12px;">Engineer</th>
          <th style="color:#fff;padding:10px 8px;text-align:left;font-size:12px;">Expense Code</th>
          <th style="color:#fff;padding:10px 8px;text-align:left;font-size:12px;">Amount</th>
          <th style="color:#fff;padding:10px 8px;text-align:left;font-size:12px;">Action</th>
        </tr>
      </thead>
      <tbody>${rows || "<tr><td colspan='4' style='padding:16px;text-align:center;color:#888;'>No pending approvals</td></tr>"}</tbody>
    </table>
    <p style="color:#888;font-size:12px;">One-click approval links are valid for 48 hours. To view full details, log in to the <a href="https://indrae.in" style="color:${BRAND_COLOR};">Field Connect portal</a>.</p>
  `;
  return {
    subject: `[Daily Digest] ${pendingApprovals?.length || 0} Expense Claim(s) Pending Approval`,
    html: emailWrapper(content, `${pendingApprovals?.length || 0} expense claims need your approval`),
  };
}

// ─── Template 4: Expense Submitted ───────────────────────────────────────────

export function expenseSubmittedTemplate({ employeeName, expenseCode, totalAmount, travelName, submittedAt }) {
  const content = `
    <h2 style="margin:0 0 8px;color:${BRAND_COLOR};">Expense Claim Submitted ✓</h2>
    <p style="color:#555;margin:0 0 16px;">Hello ${employeeName},</p>
    <p style="color:#555;margin:0 0 24px;">Your expense claim has been submitted successfully and is pending manager approval.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};border-radius:6px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;"><strong style="color:${BRAND_COLOR};">Expense Code:</strong></td><td style="color:#333;">${expenseCode}</td></tr>
      <tr><td style="padding:6px 0;"><strong style="color:${BRAND_COLOR};">Travel Name:</strong></td><td style="color:#333;">${travelName}</td></tr>
      <tr><td style="padding:6px 0;"><strong style="color:${BRAND_COLOR};">Total Amount:</strong></td><td style="color:#333;font-weight:bold;">₹${(totalAmount || 0).toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding:6px 0;"><strong style="color:${BRAND_COLOR};">Submitted At:</strong></td><td style="color:#333;">${submittedAt}</td></tr>
    </table>
    <p style="color:#555;font-size:13px;">You will receive another email once your claim is approved or returned.</p>
  `;
  return {
    subject: `Expense Submitted: ${expenseCode} — ₹${(totalAmount || 0).toLocaleString("en-IN")}`,
    html: emailWrapper(content, `Your expense ${expenseCode} has been submitted`),
  };
}

// ─── Template 5: Expense Approved ────────────────────────────────────────────

export function expenseApprovedTemplate({ employeeName, expenseCode, totalAmount, approverName, approvedAt }) {
  const content = `
    <h2 style="margin:0 0 8px;color:${SUCCESS_COLOR};">Expense Claim Approved ✓</h2>
    <p style="color:#555;margin:0 0 16px;">Hello ${employeeName},</p>
    <p style="color:#555;margin:0 0 24px;">Great news! Your expense claim has been approved.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};border-radius:6px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;"><strong>Expense Code:</strong></td><td>${expenseCode}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Approved Amount:</strong></td><td style="color:${SUCCESS_COLOR};font-weight:bold;">₹${(totalAmount || 0).toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Approved By:</strong></td><td>${approverName}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Approved At:</strong></td><td>${approvedAt}</td></tr>
    </table>
    <p style="color:#555;font-size:13px;">Your reimbursement will be processed as per your company's payment cycle.</p>
  `;
  return {
    subject: `✓ Approved: ${expenseCode} — ₹${(totalAmount || 0).toLocaleString("en-IN")}`,
    html: emailWrapper(content, `Your expense ${expenseCode} has been approved`),
  };
}

// ─── Template 6: Expense Rejected ────────────────────────────────────────────

export function expenseRejectedTemplate({ employeeName, expenseCode, totalAmount, approverName, rejectionReason, rejectedAt }) {
  const content = `
    <h2 style="margin:0 0 8px;color:${DANGER_COLOR};">Expense Claim Returned ✗</h2>
    <p style="color:#555;margin:0 0 16px;">Hello ${employeeName},</p>
    <p style="color:#555;margin:0 0 24px;">Your expense claim has been returned by your manager.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};border-radius:6px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;"><strong>Expense Code:</strong></td><td>${expenseCode}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Amount:</strong></td><td>₹${(totalAmount || 0).toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Returned By:</strong></td><td>${approverName}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Reason:</strong></td><td style="color:${DANGER_COLOR};">${rejectionReason || "No reason provided"}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Date:</strong></td><td>${rejectedAt}</td></tr>
    </table>
    <p style="color:#555;font-size:13px;">Please review the feedback, make necessary corrections, and resubmit your claim. Log in to the <a href="https://indrae.in" style="color:${BRAND_COLOR};">Field Connect portal</a> for details.</p>
  `;
  return {
    subject: `✗ Returned: ${expenseCode} — Please Review`,
    html: emailWrapper(content, `Your expense ${expenseCode} was returned`),
  };
}

// ─── Template 7: Welcome / Account Created ────────────────────────────────────

export function welcomeTemplate({ name, userId, temporaryPassword }) {
  const content = `
    <h2 style="margin:0 0 8px;color:${BRAND_COLOR};">Welcome to Cyrix Field Connect!</h2>
    <p style="color:#555;margin:0 0 16px;">Hello ${name},</p>
    <p style="color:#555;margin:0 0 24px;">Your account has been created. Here are your login credentials:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};border-radius:6px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;"><strong>User ID:</strong></td><td>${userId}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Temporary Password:</strong></td><td style="font-family:monospace;font-size:16px;color:${BRAND_COLOR};font-weight:bold;">${temporaryPassword}</td></tr>
    </table>
    <p style="color:#e74c3c;font-size:13px;font-weight:bold;">⚠️ Please change your password immediately after your first login.</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="https://indrae.in" style="background:${BRAND_COLOR};color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Login Now →</a>
    </div>
  `;
  return {
    subject: "Welcome to Cyrix Field Connect — Your Account is Ready",
    html: emailWrapper(content, "Your Cyrix Field Connect account has been created"),
  };
}

// ─── Template 8: Email Action Confirmation ────────────────────────────────────

export function emailActionConfirmationTemplate({ action, expenseCode, approverName, employeeName, amount }) {
  const isApprove = action === "approve";
  const color = isApprove ? SUCCESS_COLOR : DANGER_COLOR;
  const icon = isApprove ? "✓" : "✗";
  const actionText = isApprove ? "Approved" : "Returned";

  const content = `
    <div style="text-align:center;padding:16px 0;">
      <div style="width:80px;height:80px;background:${color};border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:40px;">${icon}</span>
      </div>
      <h2 style="color:${color};margin:0 0 8px;">Claim ${actionText}!</h2>
      <p style="color:#555;margin:0 0 8px;">You successfully ${actionText.toLowerCase()} the expense claim:</p>
      <p style="font-size:18px;font-weight:bold;color:${BRAND_COLOR};margin:0 0 8px;">${expenseCode}</p>
      <p style="color:#555;margin:0 0 24px;">Employee: ${employeeName} | Amount: ₹${(amount || 0).toLocaleString("en-IN")}</p>
      <a href="https://indrae.in" style="background:${BRAND_COLOR};color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;">View All Approvals →</a>
    </div>
  `;
  return {
    subject: `${icon} ${actionText}: ${expenseCode}`,
    html: emailWrapper(content),
  };
}
