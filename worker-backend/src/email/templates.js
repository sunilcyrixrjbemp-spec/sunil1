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
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"/>
  <title>Cyrix HealthCare Private Limited</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  ${previewText ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:24px 32px;text-align:left;border-bottom:3px solid #0284c7;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;line-height:1.2;">CYRIX HEALTHCARE PRIVATE LIMITED</div>
                    <div style="color:#94a3b8;font-size:12px;margin-top:4px;font-weight:500;">Enterprise Field Operations & Authentication Portal</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style="padding:32px;background-color:#ffffff;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 6px 0;color:#64748b;font-size:12px;font-weight:600;">
                Cyrix HealthCare Private Limited
              </p>
              <p style="margin:0 0 8px 0;color:#94a3b8;font-size:11px;line-height:1.4;">
                This is an automated system notification. Please do not reply to this email.<br/>
                For support inquiries, contact your system administrator or support team.
              </p>
              <p style="margin:0;color:#cbd5e1;font-size:10px;">
                &copy; ${new Date().getFullYear()} Cyrix HealthCare Pvt. Ltd. All rights reserved.
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

export function otpTemplate({ name, otp, userId, purpose = "Account Unlock Verification", expiryMinutes = 10 }) {
  const content = `
    <div style="margin-bottom:20px;">
      <h2 style="margin:0 0 6px 0;color:#0f172a;font-size:20px;font-weight:700;">Security Verification Code</h2>
      <p style="margin:0;color:#64748b;font-size:14px;">Use the verification code below to complete your authentication request.</p>
    </div>

    <!-- Recipient & Details Table -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <tr>
        <td style="font-size:13px;color:#334155;line-height:1.7;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td width="140" style="color:#64748b;font-weight:600;">Recipient Name:</td>
              <td style="color:#0f172a;font-weight:600;">${name || "User"}</td>
            </tr>
            ${userId ? `
            <tr>
              <td style="color:#64748b;font-weight:600;">User / Employee ID:</td>
              <td style="color:#0f172a;font-weight:600;">${userId}</td>
            </tr>` : ""}
            <tr>
              <td style="color:#64748b;font-weight:600;">Request Type:</td>
              <td style="color:#0f172a;font-weight:600;">${purpose}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-weight:600;">Issued At:</td>
              <td style="color:#0f172a;">${new Date().toUTCString()}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="color:#334155;font-size:14px;margin:0 0 16px 0;line-height:1.5;">
      Hello <strong>${name || "User"}</strong>,<br/>
      Your official One-Time Password (OTP) for account verification is:
    </p>

    <!-- OTP Code Display Card -->
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background-color:#f1f5f9;border:2px solid #0284c7;border-radius:8px;padding:16px 36px;">
        <span style="font-family:'Courier New', Courier, monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#0f172a;">${otp}</span>
      </div>
      <div style="margin-top:10px;color:#475569;font-size:12px;font-weight:600;">
        This code is valid for ${expiryMinutes} minutes.
      </div>
    </div>

    <!-- Security Instructions -->
    <div style="background-color:#fffbe0;border-left:4px solid #d97706;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
      <p style="margin:0;color:#92400e;font-size:12px;line-height:1.5;">
        <strong>Security Notice:</strong> Do not share this OTP with anyone. Cyrix support or IT personnel will never request your verification code or password. If you did not initiate this request, please contact IT Security immediately.
      </p>
    </div>
  `;

  return {
    subject: `Security Verification Code: ${purpose} — Cyrix HealthCare`,
    html: emailWrapper(content, `Verification code: ${otp}`),
  };
}

// ─── Template 2: Password Reset ───────────────────────────────────────────────

export function passwordResetTemplate({ name, otp, userId, expiryMinutes = 10 }) {
  const content = `
    <div style="margin-bottom:20px;">
      <h2 style="margin:0 0 6px 0;color:#0f172a;font-size:20px;font-weight:700;">Password Reset Authorization</h2>
      <p style="margin:0;color:#64748b;font-size:14px;">We received a request to reset your Cyrix Field Connect account password.</p>
    </div>

    <!-- Recipient & Details Table -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <tr>
        <td style="font-size:13px;color:#334155;line-height:1.7;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td width="140" style="color:#64748b;font-weight:600;">Recipient Name:</td>
              <td style="color:#0f172a;font-weight:600;">${name || "User"}</td>
            </tr>
            ${userId ? `
            <tr>
              <td style="color:#64748b;font-weight:600;">User / Employee ID:</td>
              <td style="color:#0f172a;font-weight:600;">${userId}</td>
            </tr>` : ""}
            <tr>
              <td style="color:#64748b;font-weight:600;">Request Type:</td>
              <td style="color:#0f172a;font-weight:600;">Password Reset Request</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-weight:600;">Issued At:</td>
              <td style="color:#0f172a;">${new Date().toUTCString()}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="color:#334155;font-size:14px;margin:0 0 16px 0;line-height:1.5;">
      Hello <strong>${name || "User"}</strong>,<br/>
      Use the official verification code below to authorize your password reset:
    </p>

    <!-- OTP Code Display Card -->
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background-color:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px 36px;">
        <span style="font-family:'Courier New', Courier, monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#991b1b;">${otp}</span>
      </div>
      <div style="margin-top:10px;color:#475569;font-size:12px;font-weight:600;">
        This code is valid for ${expiryMinutes} minutes.
      </div>
    </div>

    <!-- Security Warning -->
    <div style="background-color:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
      <p style="margin:0;color:#991b1b;font-size:12px;line-height:1.5;">
        <strong>Security Warning:</strong> If you did not request a password reset, someone may be attempting to access your account. Please notify your IT Security administrator immediately.
      </p>
    </div>
  `;

  return {
    subject: `Password Reset Verification Code — Cyrix HealthCare`,
    html: emailWrapper(content, `Password reset authorization code: ${otp}`),
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
