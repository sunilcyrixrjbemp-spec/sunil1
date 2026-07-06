import { verifyPassword, signJwt, verifyJwt, getPasswordHash } from "../utils/security.js";
import { DESIGNATIONS, ZONE_DISTRICTS, ROLES } from "../utils/constants.js";
import { getExpenseInitData } from "./expense.js";
import { fetchPendingApprovals } from "./approval.js";
import { runWrite } from "../utils/db.js";

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
 */
async function logLogin(db, userId, ipAddress, userAgent, status) {
  try {
    const timestamp = new Date().toISOString();
    await db.prepare(`
      INSERT INTO login_logs (user_id, ip_address, user_agent, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, ipAddress, userAgent, status, timestamp).run();
  } catch (e) {
    console.error("Failed to log login:", e);
  }
}

/**
 * Resolves manager, zonal_manager, and coordinator e_codes/user_ids to actual User Names.
 */
async function resolveUserHierarchyNames(env, user) {
  const fields = ["manager", "zonal_manager", "coordinator"];
  for (const field of fields) {
    const val = user[field];
    if (!val || !val.trim()) continue;
    const valLower = val.trim().toLowerCase();
    
    const resolved = await env.DB.prepare(`
      SELECT name FROM users 
      WHERE LOWER(user_id) = ? OR LOWER(e_code) = ? OR LOWER(name) = ?
      LIMIT 1
    `).bind(valLower, valLower, valLower).first();
    
    if (resolved && resolved.name) {
      user[field] = resolved.name;
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
  
  // Check direct reports
  const hasDirectReportsResult = await env.DB.prepare(`
    SELECT id FROM users
    WHERE LOWER(manager) = ? OR LOWER(manager) = ?
       OR LOWER(coordinator) = ? OR LOWER(coordinator) = ?
       OR LOWER(zonal_manager) = ? OR LOWER(zonal_manager) = ?
    LIMIT 1
  `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).first();
  const hasDirectReports = !!hasDirectReportsResult;

  // Check hierarchy approver
  const isHierarchyApproverResult = await env.DB.prepare(`
    SELECT id FROM hierarchy_approvers WHERE approver_id = ? LIMIT 1
  `).bind(user.id).first();
  const isHierarchyApprover = !!isHierarchyApproverResult;

  const isTeamLead = user.role === "Admin" || allowedWindows.includes("approval") || hasDirectReports || isHierarchyApprover;

  // 1. Dropdown lists setup
  const gradesRows = await env.DB.prepare("SELECT DISTINCT grade FROM allowance_master").all();
  const grades = (gradesRows.results || []).map(r => r.grade).filter(Boolean).sort();
  const dropdowns = {
    designations: DESIGNATIONS,
    zones: ZONE_DISTRICTS,
    roles: ROLES,
    grades: grades.length ? grades : ["A", "B", "C", "D"]
  };

  // 2. Fetch expense init data
  const monthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const expenseInit = await getExpenseInitData(env, user, monthStr);

  // 3. Fetch my expenses
  const myExpensesResult = await env.DB.prepare("SELECT * FROM expenses WHERE user_id = ? ORDER BY id DESC").bind(user.id).all();
  const myExpenses = myExpensesResult.results || [];

  // 4. Fetch team expenses and pending approvals
  let teamExpenses = [];
  let pendingApprovals = [];
  if (isTeamLead) {
    if (user.role === "Admin") {
      const teamRes = await env.DB.prepare("SELECT e.*, u.name as employee_name FROM expenses e JOIN users u ON e.user_id = u.id ORDER BY e.id DESC").all();
      teamExpenses = teamRes.results || [];
    } else {
      const teamRes = await env.DB.prepare(`
        SELECT DISTINCT e.*, u.name as employee_name 
        FROM expenses e
        JOIN approvals a ON e.id = a.expense_id
        JOIN users u ON e.user_id = u.id
        WHERE a.approver_id = ?
        ORDER BY e.id DESC
      `).bind(user.id).all();
      teamExpenses = teamRes.results || [];
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
    await logLogin(env.DB, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Invalid User ID or Password" }, 401);
  }

  // 2. Check user status
  if (user.user_status === "disabled") {
    await logLogin(env.DB, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Your account is disabled. Please contact the administrator." }, 403);
  }

  if (user.user_status === "locked") {
    await logLogin(env.DB, user_id, ipAddress, userAgent, "locked");
    return jsonResponse({ error: "Your account is locked. Please use the Unlock Account option." }, 403);
  }

  // 3. Verify password
  const passwordCorrect = await verifyPassword(password, user.hashed_password);
  if (!passwordCorrect) {
    const failedAttempts = (user.failed_attempt || 0) + 1;
    
    if (failedAttempts >= 5) {
      await env.DB.prepare("UPDATE users SET failed_attempt = ?, user_status = 'locked' WHERE user_id = ?")
        .bind(failedAttempts, user_id).run();
      await logLogin(env.DB, user_id, ipAddress, userAgent, "locked");
      return jsonResponse({ error: "Your account has been locked due to 5 failed login attempts." }, 403);
    } else {
      await env.DB.prepare("UPDATE users SET failed_attempt = ? WHERE user_id = ?")
        .bind(failedAttempts, user_id).run();
      await logLogin(env.DB, user_id, ipAddress, userAgent, "failed");
      const attemptsLeft = 5 - failedAttempts;
      return jsonResponse({ error: `Invalid User ID or Password. ${attemptsLeft} attempts remaining.` }, 401);
    }
  }

  // 4. Single session validation
  if (user.active_session_id && !force) {
    return jsonResponse({ error: "ALREADY_LOGGED_IN" }, 409);
  }

  // 5. Success - generate new active session ID
  const sessionId = crypto.randomUUID();
  await env.DB.prepare("UPDATE users SET active_session_id = ?, failed_attempt = 0 WHERE user_id = ?")
    .bind(sessionId, user_id).run();
  
  await logLogin(env.DB, user_id, ipAddress, userAgent, "success");

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
  await env.DB.prepare("UPDATE users SET active_session_id = ? WHERE user_id = ?")
    .bind(sessionId, user.user_id).run();

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
      await env.DB.prepare("UPDATE users SET active_session_id = NULL WHERE user_id = ?")
        .bind(user.user_id).run();
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
 * POST /api/auth/forgot-password
 * Verifies user_id + DOB then sends OTP via notification (stores in DB)
 */
export async function handleForgotPassword(request, env, params, query) {
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
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Store OTP in DB
  await env.DB.prepare(`
    INSERT OR REPLACE INTO otp_tokens (user_id, otp, otp_type, expires_at, created_at)
    VALUES (?, ?, 'forgot_password', ?, ?)
  `).bind(user_id, otp, expiresAt, timestamp).run().catch(async () => {
    // If table doesn't exist or no 'OR REPLACE', try delete + insert
    await env.DB.prepare("DELETE FROM otp_tokens WHERE user_id = ? AND otp_type = 'forgot_password'").bind(user_id).run().catch(() => {});
    await env.DB.prepare(`
      INSERT INTO otp_tokens (user_id, otp, otp_type, expires_at, created_at)
      VALUES (?, ?, 'forgot_password', ?, ?)
    `).bind(user_id, otp, expiresAt, timestamp).run();
  });

  // Send OTP via notification (mobile number stored in user record)
  await env.DB.prepare(`
    INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
    VALUES (?, ?, ?, 'info', 0, '/login', ?)
  `).bind(user_id, "Password Reset OTP", `Your OTP for password reset is: ${otp}. Valid for 10 minutes.`, timestamp).run().catch(() => {});

  return jsonResponse({
    success: true,
    message: "OTP sent successfully",
    otp_sent: true,
    mobile_masked: user.mobile_number ? `XXXXXX${String(user.mobile_number).slice(-4)}` : null
  });
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

  const record = await env.DB.prepare(`
    SELECT * FROM otp_tokens WHERE user_id = ? AND otp_type = ?
    ORDER BY created_at DESC LIMIT 1
  `).bind(user_id, otp_type).first().catch(() => null);

  if (!record) {
    return jsonResponse({ error: "No OTP found. Please request a new one." }, 400);
  }

  if (record.otp !== String(otp).trim()) {
    return jsonResponse({ error: "Invalid OTP. Please check and try again." }, 400);
  }

  const now = new Date();
  const expires = new Date(record.expires_at);
  if (now > expires) {
    return jsonResponse({ error: "OTP has expired. Please request a new one." }, 400);
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

  // Verify OTP
  const record = await env.DB.prepare(`
    SELECT * FROM otp_tokens WHERE user_id = ? AND otp_type = 'forgot_password'
    ORDER BY created_at DESC LIMIT 1
  `).bind(user_id).first().catch(() => null);

  if (!record || record.otp !== String(otp).trim()) {
    return jsonResponse({ error: "Invalid or expired OTP" }, 400);
  }

  const now = new Date();
  const expires = new Date(record.expires_at);
  if (now > expires) {
    return jsonResponse({ error: "OTP has expired. Please request a new one." }, 400);
  }

  // Hash and update password
  const newHash = await getPasswordHash(new_password);
  const timestamp = new Date().toISOString();

  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
  if (!user) return jsonResponse({ error: "User not found" }, 404);

  await env.DB.prepare("UPDATE users SET hashed_password = ?, active_session_id = NULL, failed_attempt = 0 WHERE user_id = ?")
    .bind(newHash, user_id).run();
  
  // Add to password history
  await env.DB.prepare("INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)").
    bind(user.id, newHash, timestamp).run().catch(() => {});

  // Invalidate OTP
  await env.DB.prepare("DELETE FROM otp_tokens WHERE user_id = ? AND otp_type = 'forgot_password'").bind(user_id).run().catch(() => {});

  return jsonResponse({ success: true, message: "Password has been reset successfully. Please login with your new password." });
}

/**
 * POST /api/auth/unlock-account
 * Verifies user_id + DOJ + DOB then sends OTP
 */
export async function handleUnlockAccount(request, env, params, query) {
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
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await env.DB.prepare("DELETE FROM otp_tokens WHERE user_id = ? AND otp_type = 'unlock_account'").bind(user_id).run().catch(() => {});
  await env.DB.prepare(`
    INSERT INTO otp_tokens (user_id, otp, otp_type, expires_at, created_at)
    VALUES (?, ?, 'unlock_account', ?, ?)
  `).bind(user_id, otp, expiresAt, timestamp).run();

  await env.DB.prepare(`
    INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
    VALUES (?, ?, ?, 'info', 0, '/login', ?)
  `).bind(user_id, "Account Unlock OTP", `Your OTP to unlock account: ${otp}. Valid for 10 minutes.`, timestamp).run().catch(() => {});

  return jsonResponse({
    success: true,
    message: "OTP sent. Please check your registered mobile number.",
    otp_sent: true,
    mobile_masked: user.mobile_number ? `XXXXXX${String(user.mobile_number).slice(-4)}` : null
  });
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

  const record = await env.DB.prepare(`
    SELECT * FROM otp_tokens WHERE user_id = ? AND otp_type = 'unlock_account'
    ORDER BY created_at DESC LIMIT 1
  `).bind(user_id).first().catch(() => null);

  if (!record || record.otp !== String(otp).trim()) {
    return jsonResponse({ error: "Invalid OTP. Please try again." }, 400);
  }

  const now = new Date();
  const expires = new Date(record.expires_at);
  if (now > expires) {
    return jsonResponse({ error: "OTP has expired. Please request a new one." }, 400);
  }

  // Unlock account
  const timestamp = new Date().toISOString();
  await env.DB.prepare("UPDATE users SET user_status = 'active', failed_attempt = 0, active_session_id = NULL WHERE user_id = ?")
    .bind(user_id).run();
  
  await env.DB.prepare("DELETE FROM otp_tokens WHERE user_id = ? AND otp_type = 'unlock_account'").bind(user_id).run().catch(() => {});

  await env.DB.prepare(`
    INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
    VALUES (?, 'Account Unlocked', 'Your account has been successfully unlocked. You can now log in.', 'success', 0, '/login', ?)
  `).bind(user_id, timestamp).run().catch(() => {});

  return jsonResponse({ success: true, message: "Account unlocked successfully. You can now login." });
}
