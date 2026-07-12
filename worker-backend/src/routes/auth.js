import { verifyPassword, signJwt, verifyJwt, getPasswordHash } from "../utils/security.js";
import { DESIGNATIONS, ZONE_DISTRICTS, ROLES, MONTH_NAMES } from "../utils/constants.js";
import { getExpenseInitData } from "./expense.js";
import { fetchPendingApprovals } from "./approval.js";
import { runWrite, runBatchWrite } from "../utils/db.js";

/**
 * Helper to build JSON responses in routes
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Helper to log login attempts to db
 * Uses runWrite() to ensure replication to Primary DB
 */
async function logLogin(env, userId, ipAddress, userAgent, status) {
  try {
    const timestamp = new Date().toISOString();
    await runWrite(env, `
      INSERT INTO login_logs (user_id, ip_address, user_agent, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, ipAddress, userAgent, status, timestamp]);
  } catch (e) {
    console.error("Failed to log login:", e);
  }
}

/**
 * Resolves manager, zonal_manager, and coordinator e_codes/user_ids to actual User Names.
 * OPTIMIZED: Uses a single query instead of 3 sequential queries.
 */
async function resolveUserHierarchyNames(env, user) {
  const fields = ["manager", "zonal_manager", "coordinator"];
  const values = fields
    .map(f => (user[f] || "").trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) return;

  // Fetch all in one query
  const placeholders = values.map(() => "?").join(",");
  const allResolved = await env.DB.prepare(`
    SELECT name, user_id, e_code FROM users 
    WHERE LOWER(TRIM(user_id)) IN (${placeholders}) 
       OR LOWER(TRIM(e_code)) IN (${placeholders}) 
       OR LOWER(TRIM(name)) IN (${placeholders})
  `).bind(...values, ...values, ...values).all();

  const resolvedMap = {};
  for (const r of (allResolved.results || [])) {
    if (r.user_id) resolvedMap[r.user_id.toLowerCase()] = r.name;
    if (r.e_code) resolvedMap[r.e_code.toLowerCase()] = r.name;
    if (r.name) resolvedMap[r.name.toLowerCase()] = r.name;
  }

  for (const field of fields) {
    const val = (user[field] || "").trim().toLowerCase();
    if (val && resolvedMap[val]) {
      user[field] = resolvedMap[val];
    }
  }
}

/**
 * Pre-fetches bootstrap dashboard parameters concurrently
 */
export async function getBootstrapDataHelper(env, user) {
  const allowedWindows = user.allowed_windows ? user.allowed_windows.split(",").map(w => w.trim().toLowerCase()) : [];
  
  const nameClean = (user.name || "").trim();
  const uidClean = (user.user_id || "").trim();

  // Check direct reports + hierarchy approver in PARALLEL
  const [hasDirectReportsResult, isHierarchyApproverResult] = await Promise.all([
    env.DB.prepare(`
      SELECT id FROM users
      WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
         OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
      LIMIT 1
    `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).first(),
    env.DB.prepare(`
      SELECT id FROM hierarchy_approvers WHERE approver_id = ? LIMIT 1
    `).bind(user.id).first()
  ]);

  const hasDirectReports = !!hasDirectReportsResult;
  const isHierarchyApprover = !!isHierarchyApproverResult;

  const isTeamLead = user.role === "Admin" || allowedWindows.includes("approval") || hasDirectReports || isHierarchyApprover;

  // Run all independent bootstrap queries in PARALLEL
  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentYear = now.getFullYear();
  const monthStr = now.toISOString().slice(0, 7); // YYYY-MM

  // Limit my_expenses to last 3 months to avoid loading entire history
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();

  const [gradesRows, myExpensesResult, expenseInit] = await Promise.all([
    env.DB.prepare("SELECT DISTINCT grade FROM allowance_master").all(),
    env.DB.prepare(
      "SELECT * FROM expenses WHERE user_id = ? AND created_at >= ? ORDER BY id DESC LIMIT 50"
    ).bind(user.id, threeMonthsAgo).all(),
    getExpenseInitData(env, user, monthStr)
  ]);

  const grades = (gradesRows.results || []).map(r => r.grade).filter(Boolean).sort();
  const dropdowns = {
    designations: DESIGNATIONS,
    zones: ZONE_DISTRICTS,
    roles: ROLES,
    grades: grades.length ? grades : ["A", "B", "C", "D"]
  };

  const myExpenses = myExpensesResult.results || [];

  // 4. Fetch team expenses and pending approvals
  let teamExpenses = [];
  let pendingApprovals = [];
  if (isTeamLead) {
    if (user.role === "Admin") {
      // Admin: only load current month to avoid massive full-table scan
      const teamRes = await env.DB.prepare(
        "SELECT e.*, u.name as employee_name FROM expenses e JOIN users u ON e.user_id = u.id WHERE e.year = ? AND e.month = ? ORDER BY e.id DESC LIMIT 500"
      ).bind(currentYear, currentMonthName).all();
      teamExpenses = teamRes.results || [];
    } else {
      // Find team user IDs exactly like handleGetTeamExpenses does
      const [directReportsRes, hierarchyApprovals] = await Promise.all([
        env.DB.prepare(`
          SELECT id FROM users
          WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
             OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
             OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
        `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all(),
        env.DB.prepare(`
          SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
        `).bind(user.id).all()
      ]);

      const directReportsIds = (directReportsRes.results || []).map(r => r.id);
      
      let hierarchyReportsIds = [];
      if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
        const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
        const placeholders = hIds.map(() => "?").join(",");
        const reqsRes = await env.DB.prepare(`
          SELECT hr.user_id FROM hierarchy_requesters hr
          WHERE hr.hierarchy_id IN (${placeholders})
        `).bind(...hIds).all();
        hierarchyReportsIds = (reqsRes.results || []).map(r => r.user_id);
      }

      const teamUserIdsSet = new Set([...directReportsIds, ...hierarchyReportsIds]);
      teamUserIdsSet.delete(user.id);
      const teamUserIds = Array.from(teamUserIdsSet);

      if (teamUserIds.length > 0) {
        const placeholders = teamUserIds.map(() => "?").join(",");
        const teamRes = await env.DB.prepare(`
          SELECT e.*, u.name as employee_name 
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          WHERE e.user_id IN (${placeholders})
            AND e.year = ? AND e.month = ?
          ORDER BY e.id DESC LIMIT 300
        `).bind(...teamUserIds, currentYear, currentMonthName).all();
        teamExpenses = teamRes.results || [];
      } else {
        teamExpenses = [];
      }
    }
    pendingApprovals = await fetchPendingApprovals(env, user);
  }

  // 5. Compile allowance stats
  let allowanceStats = null;
  if (expenseInit && expenseInit.allowance) {
    const allowance = expenseInit.allowance;
    allowanceStats = {
      currentKm: allowance.current_month_km || 0.0,
      maxKm: (allowance.max_km_per_month || 2000.0) + (expenseInit.approved_km || 0.0),
      currentAuto: allowance.current_month_auto || 0.0,
      maxAuto: (allowance.max_auto_per_month || 1000.0) + (expenseInit.approved_auto || 0.0),
      vehicleType: allowance.vehicle_type || "Bike",
      rateBike: allowance.rate_bike || 4.5,
      rateCar: allowance.rate_car || 9.0
    };
  }

  return {
    dropdowns,
    expense_init: expenseInit,
    my_expenses: myExpenses,
    allowance_stats: allowanceStats,
    team_expenses: teamExpenses,
    pending_approvals: pendingApprovals,
    pending_approvals_count: pendingApprovals.length
  };
}

/**
 * POST /api/auth/login
 */
export async function handleLogin(request, env, params, query) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, password, force } = body;
  const ipAddress = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const userAgent = request.headers.get("User-Agent") || "";

  if (!user_id || !password) {
    return jsonResponse({ error: "User ID and Password are required" }, 400);
  }

  // 1. Fetch user from DB
  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
  if (!user) {
    await logLogin(env, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Invalid User ID or Password", detail: "Invalid User ID or Password" }, 401);
  }

  // 2. Check user status
  if (user.user_status === "disabled") {
    await logLogin(env, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Your account is disabled. Please contact the administrator.", detail: "Your account is disabled. Please contact the administrator." }, 403);
  }

  if (user.user_status === "locked") {
    await logLogin(env, user_id, ipAddress, userAgent, "locked");
    return jsonResponse({ error: "Your account is locked. Please use the Unlock Account option.", detail: "Your account is locked. Please use the Unlock Account option." }, 403);
  }

  // 3. Verify password
  const passwordCorrect = await verifyPassword(password, user.hashed_password);
  if (!passwordCorrect) {
    const failedAttempts = (user.failed_attempt || 0) + 1;
    
    if (failedAttempts >= 5) {
      await runWrite(env, "UPDATE users SET failed_attempt = ?, user_status = 'locked' WHERE user_id = ?", [failedAttempts, user_id]);
      await logLogin(env, user_id, ipAddress, userAgent, "locked");
      return jsonResponse({ error: "Your account has been locked due to 5 failed login attempts.", detail: "Your account has been locked due to 5 failed login attempts." }, 403);
    } else {
      await runWrite(env, "UPDATE users SET failed_attempt = ? WHERE user_id = ?", [failedAttempts, user_id]);
      await logLogin(env, user_id, ipAddress, userAgent, "failed");
      const attemptsLeft = 5 - failedAttempts;
      return jsonResponse({ error: `Invalid User ID or Password. ${attemptsLeft} attempts remaining.`, detail: `Invalid User ID or Password. ${attemptsLeft} attempts remaining.` }, 401);
    }
  }

  // 4. Single session validation
  if (user.active_session_id && !force) {
    return jsonResponse({ error: "ALREADY_LOGGED_IN" }, 409);
  }

  // 5. Success - generate new active session ID
  const sessionId = crypto.randomUUID();
  await runWrite(env, "UPDATE users SET active_session_id = ?, failed_attempt = 0 WHERE user_id = ?", [sessionId, user_id]);
  
  await logLogin(env, user_id, ipAddress, userAgent, "success");

  // Create access and refresh tokens
  const secretKey = env.API_SECRET;
  const accessExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 Days
  const refreshExp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 365 Days

  const accessToken = await signJwt({ sub: user.user_id, sid: sessionId, exp: accessExp, type: "access" }, secretKey);
  const refreshToken = await signJwt({ sub: user.user_id, sid: sessionId, exp: refreshExp, type: "refresh" }, secretKey);

  // Fetch role
  const roleRow = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(user_id).first();
  user.role = roleRow?.role || "user";

  // Resolve manager/zonal_manager/coordinator names if they contain e_codes
  await resolveUserHierarchyNames(env, user);

  // Prefetch bootstrap data for instant frontend load
  const bootstrapData = await getBootstrapDataHelper(env, user);

  const profile = { ...user };
  delete profile.hashed_password;

  return jsonResponse({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    user: profile,
    bootstrap_data: bootstrapData
  });
}

/**
 * POST /api/auth/refresh
 */
export async function handleRefresh(request, env, params, query) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { refresh_token } = body;
  if (!refresh_token) {
    return jsonResponse({ error: "refresh_token required" }, 400);
  }

  const payload = await verifyJwt(refresh_token, env.API_SECRET);
  if (!payload || payload.type !== "refresh") {
    return jsonResponse({ error: "Invalid or expired refresh token" }, 401);
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(payload.sub).first();
  if (!user || user.active_session_id !== payload.sid) {
    return jsonResponse({ error: "Session expired or invalid" }, 401);
  }

  const sessionId = crypto.randomUUID();
  await runWrite(env, "UPDATE users SET active_session_id = ? WHERE user_id = ?", [sessionId, user.user_id]);

  const accessExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const refreshExp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  const accessToken = await signJwt({ sub: user.user_id, sid: sessionId, exp: accessExp, type: "access" }, env.API_SECRET);
  const newRefreshToken = await signJwt({ sub: user.user_id, sid: sessionId, exp: refreshExp, type: "refresh" }, env.API_SECRET);

  return jsonResponse({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: "bearer"
  });
}

/**
 * GET /api/auth/bootstrap
 */
export async function handleBootstrap(request, env, params, query, user) {
  const bootstrapData = await getBootstrapDataHelper(env, user);
  return jsonResponse(bootstrapData);
}

/**
 * POST /api/auth/logout
 */
export async function handleLogout(request, env, params, query, user) {
  try {
    // Clear active session ID for the user
    if (user && user.user_id) {
      await runWrite(env, "UPDATE users SET active_session_id = NULL WHERE user_id = ?", [user.user_id]);
    }
  } catch (e) {
    console.warn("Logout DB error:", e);
  }
  return jsonResponse({ success: true, message: "Logged out successfully" });
}

/**
 * GET /api/auth/dropdowns
 * Returns designations, zones, roles, grades for frontend dropdowns
 */
export async function handleGetDropdowns(request, env, params, query) {
  const gradesRows = await env.DB.prepare("SELECT DISTINCT grade FROM allowance_master").all();
  const grades = (gradesRows.results || []).map(r => r.grade).filter(Boolean).sort();
  return jsonResponse({
    designations: DESIGNATIONS,
    zones: ZONE_DISTRICTS,
    roles: ROLES,
    grades: grades.length ? grades : ["A", "B", "C", "D"]
  });
}

/**
 * Helper to send email via Google Apps Script Web App
 */
async function sendEmail(to, subject, body, env) {
  const gasUrl = (env && env.GAS_WEB_APP_URL) || "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec";
  
  const plainText = body.replace(/<[^>]*>/g, ""); // strip HTML tags for plain text fallback
  const purpose = subject.toLowerCase().includes("unlock") ? "account_unlock" : "password_reset";
  
  // Extract OTP code from body (usually a 6-digit number)
  const otpMatch = body.match(/\b\d{6}\b/);
  const otp = otpMatch ? otpMatch[0] : "";

  const payload = {
    to: to,
    name: "User",
    otp: otp,
    purpose: purpose,
    subject: subject,
    body: plainText,
    htmlBody: body
  };

  const res = await fetch(gasUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Google Apps Script email error:", errText);
    throw new Error("Email dispatch failed: " + errText);
  }

  const result = await res.json();
  if (!result.success) {
    throw new Error("Email dispatch failed: " + (result.error || "Unknown error"));
  }
}

/**
 * POST /api/auth/forgot-password
 * Verifies user_id + DOB then sends OTP via email and notification (stores in KV)
 */
export async function handleForgotPassword(request, env, params, query) {
  try {
    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON" }, 400); }

    const { user_id, date_of_birth } = body;
    if (!user_id || !date_of_birth) {
      return jsonResponse({ error: "user_id and date_of_birth are required" }, 400);
    }

    const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
    if (!user) {
      return jsonResponse({ error: "No user found with that User ID" }, 404);
    }

    // Verify DOB
    const dobInput = String(date_of_birth).trim().replace(/\//g, "-");
    const dobStored = user.date_of_birth ? String(user.date_of_birth).trim() : "";
    const dobMatch = dobInput === dobStored || dobInput.split("-").reverse().join("-") === dobStored;
    if (!dobMatch) {
      return jsonResponse({ error: "Date of birth does not match our records" }, 400);
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const timestamp = new Date().toISOString();

    // Store OTP in Cloudflare KV: otp:${user_id}:forgot_password
    const kvKey = `otp:${user_id}:forgot_password`;
    if (env.OTPS_KV) {
      await env.OTPS_KV.put(kvKey, otp, { expirationTtl: 600 });
    } else {
      console.warn("env.OTPS_KV is not bound! Falling back to console logging.");
    }

    // Also insert a notification record in D1 DB for compatibility, masking the sensitive OTP code
    await runWrite(env, `
      INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
      VALUES (?, ?, ?, 'info', 0, '/login', ?)
    `, [user_id, "Password Reset OTP", "A verification OTP has been sent to your registered email.", timestamp]).catch(() => {});

    // Send OTP via Google Apps Script email
    const email = user.mail_id || "";
    if (email) {
      const emailTemplate = `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 550px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            <div style="background-color: #1e3a8a; padding: 25px; text-align: center;"><h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Cyrix Healthcare</h1></div>
            <div style="padding: 40px; background-color: #ffffff;">
                <p style="font-size: 16px; color: #1e293b;">Dear <b>${user.name}</b>,</p>
                <p style="font-size: 15px; color: #475569; line-height: 1.6;">To proceed with your <b>Password Reset</b> request, please use the following verification code:</p>
                <div style="text-align: center; margin: 35px 0;">
                    <div style="display: inline-block; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 18px 35px; border-radius: 10px;">
                        <span style="font-size: 34px; font-weight: 700; color: #2563eb; letter-spacing: 8px;">${otp}</span>
                    </div>
                    <p style="font-size: 13px; color: #94a3b8; margin-top: 15px;">Valid for 10 minutes only.</p>
                </div>
                <p style="font-size: 14px; color: #64748b;">If you did not request this code, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
                <div style="text-align: center; font-size: 11px; color: #94a3b8;">&copy; 2026 Cyrix Healthcare Pvt. Ltd. | Secure Access</div>
            </div>
        </div>`;
      
      try {
        await sendEmail(email, "Security Verification - Account Recovery", emailTemplate, env);
      } catch (emailErr) {
        console.error("Failed to send OTP email:", emailErr);
        let userMessage = emailErr.message;
        try {
          const cleanMsg = emailErr.message.replace("Email dispatch failed: ", "");
          const parsed = JSON.parse(cleanMsg);
          if (parsed.message) {
            userMessage = parsed.message;
          }
        } catch (e) {}
        return jsonResponse({ error: `Email delivery failed: ${userMessage}. Please verify Google Apps Script configuration.` }, 400);
      }
    }

    const [namePart, domainPart] = email.split("@");
    const maskedEmail = namePart ? `${namePart.slice(0, 3)}***@${domainPart}` : null;

    return jsonResponse({
      success: true,
      message: "OTP sent successfully",
      otp_sent: true,
      masked_email: maskedEmail,
      mobile_masked: user.mobile_number ? `XXXXXX${String(user.mobile_number).slice(-4)}` : null
    });
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${err.message}` }, 500);
  }
}

/**
 * POST /api/auth/verify-otp
 */
export async function handleVerifyOtp(request, env, params, query) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { user_id, otp, otp_type } = body;
  if (!user_id || !otp || !otp_type) {
    return jsonResponse({ error: "user_id, otp, and otp_type are required" }, 400);
  }

  // Normalize otp_type for compatibility
  let normalizedType = otp_type;
  if (normalizedType === "reset_password") {
    normalizedType = "forgot_password";
  }

  const kvKey = `otp:${user_id}:${normalizedType}`;
  const strikeKey = `otp_strikes:${user_id}:${normalizedType}`;
  
  let storedOtp = null;
  if (env.OTPS_KV) {
    storedOtp = await env.OTPS_KV.get(kvKey);
  } else {
    return jsonResponse({ error: "KV store not configured. Cannot verify OTP." }, 500);
  }

  if (!storedOtp) {
    return jsonResponse({ error: "Invalid or expired OTP. Please request a new one." }, 400);
  }

  // Check strike limits
  let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
  if (strikes >= 5) {
    await env.OTPS_KV.delete(kvKey); // invalidate the OTP completely
    await env.OTPS_KV.delete(strikeKey);
    return jsonResponse({ error: "OTP blocked due to too many failed attempts. Please request a new code." }, 400);
  }

  if (storedOtp.trim() !== String(otp).trim()) {
    const remaining = 5 - strikes - 1;
    await env.OTPS_KV.put(strikeKey, String(strikes + 1), { expirationTtl: 600 });
    if (remaining <= 0) {
      await env.OTPS_KV.delete(kvKey);
      await env.OTPS_KV.delete(strikeKey);
      return jsonResponse({ error: "Invalid OTP. Too many failed attempts. OTP has been invalidated." }, 400);
    }
    return jsonResponse({ error: `Invalid OTP. ${remaining} attempts remaining.` }, 400);
  }

  // Successful verification - clear strikes
  if (env.OTPS_KV) {
    await env.OTPS_KV.delete(strikeKey);
  }

  return jsonResponse({ success: true, message: "OTP verified successfully." });
}

/**
 * POST /api/auth/reset-password
 */
export async function handleResetPassword(request, env, params, query) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { user_id, otp, new_password, confirm_password } = body;
  if (!user_id || !otp || !new_password || !confirm_password) {
    return jsonResponse({ error: "All fields are required" }, 400);
  }

  if (new_password !== confirm_password) {
    return jsonResponse({ error: "Passwords do not match" }, 400);
  }

  if (new_password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  }

  // Verify OTP from KV
  const kvKey = `otp:${user_id}:forgot_password`;
  const strikeKey = `otp_strikes:${user_id}:forgot_password`;
  let storedOtp = null;
  if (env.OTPS_KV) {
    storedOtp = await env.OTPS_KV.get(kvKey);
  } else {
    return jsonResponse({ error: "KV store not configured." }, 500);
  }

  if (!storedOtp) {
    return jsonResponse({ error: "Invalid or expired OTP" }, 400);
  }

  // Check strike limits
  let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
  if (strikes >= 5) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
    return jsonResponse({ error: "OTP blocked due to too many failed attempts. Please request a new code." }, 400);
  }

  if (storedOtp.trim() !== String(otp).trim()) {
    const remaining = 5 - strikes - 1;
    await env.OTPS_KV.put(strikeKey, String(strikes + 1), { expirationTtl: 600 });
    if (remaining <= 0) {
      await env.OTPS_KV.delete(kvKey);
      await env.OTPS_KV.delete(strikeKey);
      return jsonResponse({ error: "Invalid OTP. Too many failed attempts. OTP has been invalidated." }, 400);
    }
    return jsonResponse({ error: `Invalid OTP. ${remaining} attempts remaining.` }, 400);
  }

  // Hash and update password
  const newHash = await getPasswordHash(new_password);
  const timestamp = new Date().toISOString();

  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
  if (!user) return jsonResponse({ error: "User not found" }, 404);

  const statements = [
    {
      sql: "UPDATE users SET hashed_password = ?, active_session_id = NULL, failed_attempt = 0, user_status = 'active' WHERE user_id = ?",
      params: [newHash, user_id]
    },
    {
      sql: "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)",
      params: [user.id, newHash, timestamp]
    }
  ];
  await runBatchWrite(env, statements).catch(() => {});

  // Invalidate OTP in KV
  if (env.OTPS_KV) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
  }

  return jsonResponse({ success: true, message: "Password has been reset successfully. Please login with your new password." });
}

/**
 * POST /api/auth/unlock-account
 * Verifies user_id + DOJ + DOB then sends OTP via email
 */
export async function handleUnlockAccount(request, env, params, query) {
  try {
    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON" }, 400); }

    const { user_id, date_of_joining, date_of_birth } = body;
    if (!user_id || !date_of_joining || !date_of_birth) {
      return jsonResponse({ error: "user_id, date_of_joining, and date_of_birth are required" }, 400);
    }

    const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
    if (!user) return jsonResponse({ error: "No user found with that User ID" }, 404);

    if (user.user_status !== "locked") {
      return jsonResponse({ error: "Account is not locked. Please contact admin if you are having issues." }, 400);
    }

    // Verify DOJ
    const dojInput = String(date_of_joining).trim().replace(/\//g, "-");
    const dojStored = user.date_of_joining ? String(user.date_of_joining).trim() : "";
    const dojMatch = dojInput === dojStored || dojInput.split("-").reverse().join("-") === dojStored;

    // Verify DOB
    const dobInput = String(date_of_birth).trim().replace(/\//g, "-");
    const dobStored = user.date_of_birth ? String(user.date_of_birth).trim() : "";
    const dobMatch = dobInput === dobStored || dobInput.split("-").reverse().join("-") === dobStored;

    if (!dojMatch || !dobMatch) {
      return jsonResponse({ error: "Date of joining or date of birth does not match our records" }, 400);
    }

    // Generate OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const timestamp = new Date().toISOString();

    // Store OTP in KV
    const kvKey = `otp:${user_id}:unlock_account`;
    if (env.OTPS_KV) {
      await env.OTPS_KV.put(kvKey, otp, { expirationTtl: 600 });
    }

    // Compatibility DB log, masking the sensitive OTP code
    await runWrite(env, `
      INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
      VALUES (?, ?, ?, 'info', 0, '/login', ?)
    `, [user_id, "Account Unlock OTP", "A verification OTP has been sent to your registered email.", timestamp]).catch(() => {});

    // Send email via Google Apps Script
    const email = user.mail_id || "";
    if (email) {
      const emailTemplate = `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 550px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            <div style="background-color: #1e3a8a; padding: 25px; text-align: center;"><h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Cyrix Healthcare</h1></div>
            <div style="padding: 40px; background-color: #ffffff;">
                <p style="font-size: 16px; color: #1e293b;">Dear <b>${user.name}</b>,</p>
                <p style="font-size: 15px; color: #475569; line-height: 1.6;">Use the following verification code to <b>Unlock</b> your account access:</p>
                <div style="text-align: center; margin: 35px 0;">
                    <div style="display: inline-block; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 18px 35px; border-radius: 10px;">
                        <span style="font-size: 34px; font-weight: 700; color: #2563eb; letter-spacing: 8px;">${otp}</span>
                    </div>
                    <p style="font-size: 13px; color: #94a3b8; margin-top: 15px;">Valid for 10 minutes only.</p>
                </div>
                <p style="font-size: 14px; color: #64748b;">If you did not request this, please contact support.</p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
                <div style="text-align: center; font-size: 11px; color: #94a3b8;">&copy; 2026 Cyrix Healthcare Pvt. Ltd. | Account Security</div>
            </div>
        </div>`;
      
      try {
        await sendEmail(email, "Action Required: Account Unlock Request", emailTemplate, env);
      } catch (emailErr) {
        console.error("Failed to send unlock email:", emailErr);
        let userMessage = emailErr.message;
        try {
          const cleanMsg = emailErr.message.replace("Email dispatch failed: ", "");
          const parsed = JSON.parse(cleanMsg);
          if (parsed.message) {
            userMessage = parsed.message;
          }
        } catch (e) {}
        return jsonResponse({ error: `Email delivery failed: ${userMessage}. Please verify Google Apps Script configuration.` }, 400);
      }
    }

    const [namePart, domainPart] = email.split("@");
    const maskedEmail = namePart ? `${namePart.slice(0, 3)}***@${domainPart}` : null;

    return jsonResponse({
      success: true,
      message: "OTP sent. Please check your registered email.",
      otp_sent: true,
      masked_email: maskedEmail,
      mobile_masked: user.mobile_number ? `XXXXXX${String(user.mobile_number).slice(-4)}` : null
    });
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${err.message}` }, 500);
  }
}

/**
 * POST /api/auth/unlock-verify-otp
 */
export async function handleUnlockVerifyOtp(request, env, params, query) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { user_id, otp } = body;
  if (!user_id || !otp) {
    return jsonResponse({ error: "user_id and otp are required" }, 400);
  }

  // Verify OTP from KV
  const kvKey = `otp:${user_id}:unlock_account`;
  const strikeKey = `otp_strikes:${user_id}:unlock_account`;
  let storedOtp = null;
  if (env.OTPS_KV) {
    storedOtp = await env.OTPS_KV.get(kvKey);
  } else {
    return jsonResponse({ error: "KV store not configured." }, 500);
  }

  if (!storedOtp) {
    return jsonResponse({ error: "Invalid or expired OTP. Please try again." }, 400);
  }

  // Check strike limits
  let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
  if (strikes >= 5) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
    return jsonResponse({ error: "OTP blocked due to too many failed attempts. Please request a new code." }, 400);
  }

  if (storedOtp.trim() !== String(otp).trim()) {
    const remaining = 5 - strikes - 1;
    await env.OTPS_KV.put(strikeKey, String(strikes + 1), { expirationTtl: 600 });
    if (remaining <= 0) {
      await env.OTPS_KV.delete(kvKey);
      await env.OTPS_KV.delete(strikeKey);
      return jsonResponse({ error: "Invalid OTP. Too many failed attempts. OTP has been invalidated." }, 400);
    }
    return jsonResponse({ error: `Invalid OTP. ${remaining} attempts remaining.` }, 400);
  }

  // Unlock account
  const timestamp = new Date().toISOString();
  const statements = [
    {
      sql: "UPDATE users SET user_status = 'active', failed_attempt = 0, active_session_id = NULL WHERE user_id = ?",
      params: [user_id]
    },
    {
      sql: "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, 'Account Unlocked', 'Your account has been successfully unlocked. You can now log in.', 'success', 0, '/login', ?)",
      params: [user_id, timestamp]
    }
  ];
  await runBatchWrite(env, statements).catch(() => {});
  
  // Invalidate OTP in KV
  if (env.OTPS_KV) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
  }

  return jsonResponse({ success: true, message: "Account unlocked successfully. You can now login." });
}
