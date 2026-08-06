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
  <meta name="color-scheme" content="light dark"/>
  <meta name="supported-color-schemes" content="light dark"/>
  <title>Cyrix HealthCare Private Limited</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #0f172a !important; }
      .email-card { background-color: #1e293b !important; border-color: #334155 !important; }
      .dark-text, p, td, th { color: #f1f5f9 !important; }
      .dm-label { color: #cbd5e1 !important; }
      .dm-val { color: #ffffff !important; }
      .dm-bg-alt { background-color: #0f172a !important; }
      .dm-bg-main { background-color: #1e293b !important; }
      .dm-border { border-color: #334155 !important; }
      .dm-box-red { background-color: #2d1215 !important; border-color: #991b1b !important; }
      .dm-reason { color: #fca5a5 !important; }
      .dm-box-amber { background-color: #2e1d0c !important; border-color: #92400e !important; }
      .dm-amber-title { color: #fbbf24 !important; }
      .dm-amber-text { color: #fde68a !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  ${previewText ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="email-bg" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="email-card" style="max-width:720px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
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
            <td style="padding:28px 28px;background-color:#ffffff;" class="email-card">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;" class="dm-bg-alt">
              <p style="margin:0 0 4px 0;color:#64748b;font-size:12px;font-weight:600;" class="dm-label">
                Cyrix HealthCare Private Limited
              </p>
              <p style="margin:0;color:#94a3b8;font-size:11px;" class="dm-label">
                This is an automated notification. For further support, contact <a href="mailto:sunil.vishnoi@indrae.in" style="color:#2563eb;text-decoration:none;font-weight:600;">sunil.vishnoi@indrae.in</a>
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

    <!-- Junk/Spam notice -->
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;margin-top:16px;font-size:12px;color:#92400e;line-height:1.5;">
      💡 <strong>Note:</strong> If you cannot find this email in your Inbox, please check your <strong>Junk / Spam folder</strong> and mark it as "Not Spam" or move it to Inbox.
    </div>

    <p style="margin:20px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;">
      Do not share this code with anyone. If you did not make this request or need assistance, please contact <a href="mailto:sunil.vishnoi@indrae.in" style="color:#2563eb;font-weight:600;">sunil.vishnoi@indrae.in</a> immediately.
    </p>

    <p style="margin:20px 0 0 0;font-size:14px;color:#1e293b;line-height:1.6;">
      Thanks,<br/>
      <strong>Cyrix HealthCare Team</strong>
    </p>
  `;

  const textPlain = `Dear ${name || "User"},\n\nWe have received a request for ${purpose} on your Cyrix Field Connect account.\n\nYour Verification Code (OTP): ${otp}\nValid for: ${expiryMinutes} minutes\n\nIf you cannot find this email in your Inbox, please check your Junk / Spam folder.\nDo not share this code with anyone. If you did not make this request, contact sunil.vishnoi@indrae.in immediately.\n\nThanks,\nCyrix HealthCare Team`;

  return {
    subject: `Verification Code for ${purpose} - Cyrix HealthCare`,
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

    <p style="margin:20px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;">
      If you did not request a password reset, please ignore this email and contact <a href="mailto:sunil.vishnoi@indrae.in" style="color:#ea580c;font-weight:600;">sunil.vishnoi@indrae.in</a> immediately.
    </p>

    <p style="margin:20px 0 0 0;font-size:14px;color:#1e293b;line-height:1.6;">
      Thanks,<br/>
      <strong>Cyrix HealthCare Team</strong>
    </p>
  `;

  const textPlain = `Dear ${name || "User"},\n\nWe have received a password reset request for your Cyrix Field Connect account.\n\nYour Password Reset Code (OTP): ${otp}\nValid for: ${expiryMinutes} minutes\n\nIf you did not request a password reset, please ignore this email and contact IT Security immediately.\n\nThanks,\nCyrix HealthCare Team`;

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
    <p style="color:#555;font-size:13px;">You will receive another email once your claim is approved or returned. For further support, contact <a href="mailto:sunil.vishnoi@indrae.in" style="color:#2563eb;font-weight:600;">sunil.vishnoi@indrae.in</a>.</p>
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
    <p style="color:#555;font-size:13px;">Your reimbursement will be processed as per your company's payment cycle. For further support, contact <a href="mailto:sunil.vishnoi@indrae.in" style="color:#2563eb;font-weight:600;">sunil.vishnoi@indrae.in</a>.</p>
  `;
  return {
    subject: `✓ Approved: ${expenseCode} — ₹${(totalAmount || 0).toLocaleString("en-IN")}`,
    html: emailWrapper(content, `Your expense ${expenseCode} has been approved`),
  };
}

// ─── Template 6: Expense Rejected ────────────────────────────────────────────

/**
 * expenseRejectedTemplate
 * @param {Object} params
 * @param {string} params.employeeName
 * @param {string} params.employeeId       - e_code / user_id of employee
 * @param {string} params.designation      - employee designation
 * @param {string} params.expenseCode      - expense code / ID
 * @param {string} params.travelName       - name/purpose of the travel
 * @param {string} params.expenseMonth     - e.g. "July 2026"
 * @param {number} params.claimedAmount    - original claimed amount
 * @param {number} params.approvedAmount   - approved amount (may be 0)
 * @param {string} params.approverName     - who rejected
 * @param {string} params.approverDesig    - rejector's designation
 * @param {string} params.rejectionReason  - reason for rejection
 * @param {string} params.rejectedAt       - IST date-time string
 * @param {Array}  params.legs             - array of itinerary leg objects
 */
export function expenseRejectedTemplate({
  employeeName, employeeId, designation,
  expenseCode, travelName, expenseMonth,
  claimedAmount, approvedAmount,
  approverName, approverDesig,
  rejectionReason, rejectedAt,
  legs = []
}) {
  const fmt = (v) => `₹${parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dash = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

  // ── Leg rows (correct column names from expense_itineraries) ───────────────
  let legTotalTravel = 0, legTotalDA = 0, legTotalHotel = 0, legTotalOther = 0;

  const legRowsHtml = legs.length > 0
    ? legs.map((leg, idx) => {
        const from    = dash(leg.from_location || leg.from_district);
        const to      = dash(leg.to_location   || leg.to_district);
        const purpose = dash(leg.visit_purpose || leg.activity_details);
        const mode    = dash(leg.travel_mode);
        const subMode = leg.sub_mode ? ` (${leg.sub_mode})` : "";
        const km      = parseFloat(leg.distance_km || leg.sub_km || 0);
        const travel  = parseFloat(leg.travel_amount || 0);
        const sub     = parseFloat(leg.sub_amount || 0);
        const da      = parseFloat(leg.da_amount || 0);
        const hotel   = parseFloat(leg.hotel_amount || 0);
        const other   = parseFloat(leg.other_amount || 0);
        const legTotal = travel + sub + da + hotel + other;
        legTotalTravel += (travel + sub);
        legTotalDA     += da;
        legTotalHotel  += hotel;
        legTotalOther  += other;
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        const bgClass = idx % 2 === 0 ? "dm-bg-main" : "dm-bg-alt";
        return `
          <tr class="${bgClass}" style="background:${bg};">
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">${idx + 1}</td>
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;">${from}</td>
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;">${to}</td>
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;">${purpose}</td>
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">${mode}${subMode}</td>
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">${km > 0 ? km + " km" : "—"}</td>
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;">${(travel + sub) > 0 ? fmt(travel + sub) : "—"}</td>
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;">${da > 0 ? fmt(da) : "—"}</td>
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;">${hotel > 0 ? fmt(hotel) : "—"}</td>
            <td class="dm-val" style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${legTotal > 0 ? fmt(legTotal) : "—"}</td>
          </tr>`;
      }).join("") +
      `<tr style="background:#0f172a;">
        <td colspan="6" style="padding:9px 10px;font-size:12px;color:#94a3b8;font-weight:600;text-align:right;letter-spacing:0.3px;">TOTAL</td>
        <td style="padding:9px 10px;font-size:12px;color:#ffffff;font-weight:700;text-align:right;">${fmt(legTotalTravel)}</td>
        <td style="padding:9px 10px;font-size:12px;color:#ffffff;font-weight:700;text-align:right;">${fmt(legTotalDA)}</td>
        <td style="padding:9px 10px;font-size:12px;color:#ffffff;font-weight:700;text-align:right;">${fmt(legTotalHotel)}</td>
        <td style="padding:9px 10px;font-size:12px;color:#fbbf24;font-weight:700;text-align:right;">${fmt(legTotalTravel + legTotalDA + legTotalHotel + legTotalOther)}</td>
      </tr>`
    : `<tr><td colspan="10" style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;font-style:italic;">No leg-wise travel data found for this claim.</td></tr>`;

  const content = `
    <div class="dm-box-red" style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
      <div class="dm-reason" style="font-size:13px;font-weight:700;color:#dc2626;letter-spacing:0.3px;margin-bottom:2px;">EXPENSE CLAIM REJECTED</div>
      <div class="dm-label" style="font-size:12px;color:#6b7280;">Please review the rejection reason below and make the necessary corrections before resubmitting.</div>
    </div>

    <p style="margin:0 0 6px 0;font-size:15px;color:#1e293b;line-height:1.6;" class="dm-val">Dear <strong>${employeeName}</strong>,</p>
    <p style="margin:0 0 22px 0;font-size:13px;color:#475569;line-height:1.6;" class="dm-label">
      Your expense claim <strong>${expenseCode}</strong> has been reviewed and rejected by
      <strong class="dm-val">${approverName || "your reporting manager"}</strong>.
      The complete details of the rejected claim are provided below for your reference.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="dm-border" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;overflow:hidden;">
      <tr style="background:#0f172a;">
        <td colspan="4" style="padding:10px 16px;">
          <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.3px;">CLAIM SUMMARY</span>
        </td>
      </tr>
      <tr class="dm-bg-alt" style="background:#f8fafc;">
        <td class="dm-label" style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;width:25%;">EXPENSE ID</td>
        <td class="dm-val" style="padding:10px 16px;font-size:13px;color:#1e293b;font-weight:700;width:25%;">${expenseCode}</td>
        <td class="dm-label" style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;width:25%;">DATE OF EXPENSE</td>
        <td class="dm-val" style="padding:10px 16px;font-size:13px;color:#1e293b;width:25%;">${expenseMonth || "—"}</td>
      </tr>
      <tr class="dm-bg-main" style="background:#ffffff;">
        <td class="dm-label" style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;">TOTAL CLAIMED</td>
        <td class="dm-reason" style="padding:10px 16px;font-size:13px;color:#dc2626;font-weight:700;">${fmt(claimedAmount)}</td>
        <td class="dm-label" style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;">REJECTED ON</td>
        <td class="dm-val" style="padding:10px 16px;font-size:13px;color:#1e293b;">${rejectedAt || "—"}</td>
      </tr>
    </table>

    <div class="dm-val" style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:10px;letter-spacing:0.3px;">TRAVEL DETAILS (LEG-WISE)</div>
    <div style="overflow-x:auto;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="dm-border" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:collapse;min-width:680px;">
        <thead>
          <tr style="background:#1e293b;">
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:center;border-bottom:1px solid #334155;">#</th>
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:left;border-bottom:1px solid #334155;">FROM</th>
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:left;border-bottom:1px solid #334155;">TO</th>
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:left;border-bottom:1px solid #334155;">PURPOSE / WORK</th>
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:center;border-bottom:1px solid #334155;">MODE</th>
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:center;border-bottom:1px solid #334155;">KM</th>
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:right;border-bottom:1px solid #334155;">TRAVEL</th>
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:right;border-bottom:1px solid #334155;">DA</th>
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:right;border-bottom:1px solid #334155;">HOTEL</th>
            <th style="padding:9px 10px;font-size:11px;color:#e2e8f0;font-weight:600;text-align:right;border-bottom:1px solid #334155;">TOTAL</th>
          </tr>
        </thead>
        <tbody>${legRowsHtml}</tbody>
      </table>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="dm-box-red" style="border:1px solid #fecaca;border-radius:8px;background:#fff5f5;margin-bottom:24px;overflow:hidden;">
      <tr style="background:#dc2626;">
        <td colspan="2" style="padding:10px 16px;">
          <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.3px;">REJECTION DETAILS</span>
        </td>
      </tr>
      <tr class="dm-bg-main" style="background:#ffffff;">
        <td class="dm-label" style="padding:12px 16px;font-size:12px;color:#64748b;font-weight:600;width:35%;vertical-align:top;">REJECTED BY</td>
        <td class="dm-val" style="padding:12px 16px;font-size:13px;color:#1e293b;vertical-align:top;">
          <strong>${approverName || "—"}</strong>
        </td>
      </tr>
      <tr class="dm-bg-alt" style="background:#fff8f8;">
        <td class="dm-label" style="padding:12px 16px;font-size:12px;color:#64748b;font-weight:600;vertical-align:top;">REASON FOR REJECTION</td>
        <td class="dm-reason" style="padding:12px 16px;font-size:13px;color:#dc2626;font-weight:600;line-height:1.7;vertical-align:top;">
          ${rejectionReason || "No specific reason provided. Please contact your manager for clarification."}
        </td>
      </tr>
    </table>

    <div class="dm-box-amber" style="background:#fffbeb;border:1px solid #fbbf24;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
      <div class="dm-amber-title" style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px;">ACTION REQUIRED</div>
      <div class="dm-amber-text" style="font-size:13px;color:#78350f;line-height:1.6;">
        Please review the rejection reason carefully and contact
        <strong class="dm-val">${approverName || "your reporting manager"}</strong> for further guidance.
        For any questions or further support, please reach out to <strong>Sunil Vishnoi</strong> at
        <a href="mailto:sunil.vishnoi@indrae.in" style="color:#1d4ed8;font-weight:700;text-decoration:underline;">sunil.vishnoi@indrae.in</a>.
      </div>
    </div>

    <p style="margin:20px 0 0 0;font-size:14px;color:#1e293b;line-height:1.6;">
      Regards,<br/>
      <strong>Cyrix Field Connect — Operations Team</strong><br/>
      <span style="font-size:12px;color:#64748b;">Cyrix HealthCare Pvt. Ltd. | Expense Management System</span>
    </p>
  `;

  const textLegs = legs.length > 0
    ? legs.map((leg, i) => {
        const from   = leg.from_district || leg.from_location || "—";
        const to     = leg.to_district   || leg.to_location   || "—";
        const purp   = leg.visit_purpose || leg.activity_details || "—";
        const mode   = leg.travel_mode   || "—";
        const km     = leg.distance_km   || leg.sub_km || "—";
        const travel = parseFloat(leg.travel_amount || 0) + parseFloat(leg.sub_amount || 0);
        const da     = parseFloat(leg.da_amount     || 0);
        const hotel  = parseFloat(leg.hotel_amount  || 0);
        const total  = travel + da + hotel + parseFloat(leg.other_amount || 0);
        return `  ${i+1}. ${from} → ${to} | ${purp} | ${mode} | ${km} km | Travel: ₹${travel.toFixed(2)} | DA: ₹${da.toFixed(2)} | Hotel: ₹${hotel.toFixed(2)} | Total: ₹${total.toFixed(2)}`;
      }).join("\n")
    : "  No leg details available.";

  const textPlain = `Dear ${employeeName},

Your expense claim ${expenseCode} has been REJECTED by ${approverName || "your reporting manager"}${approverDesig ? ` (${approverDesig})` : ""}.

CLAIM SUMMARY
  Expense ID    : ${expenseCode}
  Period        : ${expenseMonth || "—"}
  Employee      : ${employeeName}${employeeId ? ` (${employeeId})` : ""}
  Total Claimed : ₹${parseFloat(claimedAmount || 0).toFixed(2)}
  Rejected On   : ${rejectedAt || "—"}

TRAVEL DETAILS (LEG-WISE)
${textLegs}

REJECTION DETAILS
  Rejected By   : ${approverName || "—"}${approverDesig ? ` (${approverDesig})` : ""}
  Reason        : ${rejectionReason || "No specific reason provided. Please contact your manager."}

Please review the above, make the necessary corrections, and resubmit through the Field Connect portal at https://indrae.in

Regards,
Cyrix Field Connect — Operations Team
Cyrix HealthCare Pvt. Ltd.`;

  return {
    subject: `Expense Claim Rejected: ${expenseCode} - Action Taken`,
    html: emailWrapper(content, `Your expense ${expenseCode} has been rejected`),
    text: textPlain,
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
