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

const emailWrapper = (content, previewText = "") => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>Cyrix Field Connect</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${LIGHT_BG};font-family:Arial,sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:20px 32px;text-align:left;">
            <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">⚡ Cyrix Field Connect</span>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f0f0f0;padding:16px 32px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#888;font-size:12px;">
              This is an automated message from Cyrix Field Connect.<br/>
              If you did not request this, please ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ─── Template 1: OTP ─────────────────────────────────────────────────────────

export function otpTemplate({ name, otp, expiryMinutes = 10 }) {
  const content = `
    <h2 style="margin:0 0 8px;color:${BRAND_COLOR};">Your One-Time Password</h2>
    <p style="color:#555;margin:0 0 24px;">Hello ${name || "there"},</p>
    <p style="color:#555;margin:0 0 16px;">Your OTP for Cyrix Field Connect login is:</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;background:${LIGHT_BG};border:2px solid ${ACCENT_COLOR};border-radius:8px;padding:16px 40px;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:${BRAND_COLOR};">${otp}</span>
      </div>
    </div>
    <p style="color:#e74c3c;font-weight:bold;text-align:center;margin:0 0 24px;">
      ⏰ This OTP expires in ${expiryMinutes} minutes.
    </p>
    <p style="color:#555;font-size:13px;">Never share this OTP with anyone. Cyrix support will never ask for your OTP.</p>
  `;
  return {
    subject: `${otp} — Your OTP for Cyrix Field Connect`,
    html: emailWrapper(content, `Your OTP is ${otp}`),
  };
}

// ─── Template 2: Password Reset ───────────────────────────────────────────────

export function passwordResetTemplate({ name, otp }) {
  const content = `
    <h2 style="margin:0 0 8px;color:${BRAND_COLOR};">Password Reset Request</h2>
    <p style="color:#555;margin:0 0 16px;">Hello ${name || "there"},</p>
    <p style="color:#555;margin:0 0 16px;">We received a request to reset your password. Use the OTP below:</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;background:${LIGHT_BG};border:2px solid ${DANGER_COLOR};border-radius:8px;padding:16px 40px;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:${DANGER_COLOR};">${otp}</span>
      </div>
    </div>
    <p style="color:#e74c3c;font-weight:bold;text-align:center;">⏰ This OTP expires in 10 minutes.</p>
    <p style="color:#555;font-size:13px;">If you did not request a password reset, your account may be at risk. Contact your administrator immediately.</p>
  `;
  return {
    subject: "Password Reset — Cyrix Field Connect",
    html: emailWrapper(content, "Reset your Cyrix Field Connect password"),
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
