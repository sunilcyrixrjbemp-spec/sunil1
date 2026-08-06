/**
 * Auth Routes — Cloudflare D1 (direct) + CF MailChannels email
 * v2.1.0 — Removed: Drizzle ORM, Google Apps Script, GAS email
 * All queries use env.DB directly. Emails via sendOTPEmail (CF MailChannels).
 */

import { verifyPassword, signJwt, verifyJwt, getPasswordHash } from "../utils/security.js";
import { jsonResponse } from "../utils/http.js";
import { DESIGNATIONS, ZONE_DISTRICTS, ROLES, MONTH_NAMES } from "../utils/constants.js";
import { getExpenseInitData, getActualZone } from "./expense.js";
import { fetchPendingApprovals } from "./approval.js";
import { sendOTPEmail } from "../email/sender.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logLogin(env, userCode, ipAddress, userAgent, status) {
  const timestamp = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO login_logs (user_id, ip_address, user_agent, status, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(userCode, ipAddress, userAgent, status, timestamp).run();
  } catch (e) {
    console.error("[logLogin] failed:", e.message);
  }
}

async function resolveUserHierarchyNames(env, user) {
  const fields = ["manager", "zonal_manager", "coordinator"];
  const values = fields
    .map(f => (user[f] || "").trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) return;

  const placeholders = values.map(() => "?").join(",");
  const result = await env.DB.prepare(
    `SELECT name, user_id, e_code FROM users
     WHERE lower(trim(user_id)) IN (${placeholders})
        OR lower(trim(e_code))  IN (${placeholders})
        OR lower(trim(name))    IN (${placeholders})`
  ).bind(...values, ...values, ...values).all();

  const resolvedMap = {};
  for (const r of (result?.results || [])) {
    if (r.user_id) resolvedMap[r.user_id.toLowerCase()] = r.name;
    if (r.e_code)  resolvedMap[r.e_code.toLowerCase()]  = r.name;
    if (r.name)    resolvedMap[r.name.toLowerCase()]    = r.name;
  }

  for (const field of fields) {
    const val = (user[field] || "").trim().toLowerCase();
    if (val && resolvedMap[val]) user[field] = resolvedMap[val];
  }
}

// ─── Bootstrap helper ─────────────────────────────────────────────────────────

export async function getBootstrapDataHelper(env, user) {
  const allowedWindows = user.allowed_windows
    ? user.allowed_windows.split(",").map(w => w.trim().toLowerCase())
    : [];

  const nameClean = (user.name || "").trim().toLowerCase();
  const uidClean  = (user.user_id || "").trim().toLowerCase();

  // Check direct reports + hierarchy approver in PARALLEL
  const [hasDirectReportsResult, isHierarchyApproverResult] = await Promise.all([
    env.DB.prepare(
      `SELECT id FROM users WHERE
       lower(trim(manager))       = ? OR lower(trim(manager))       = ? OR
       lower(trim(coordinator))   = ? OR lower(trim(coordinator))   = ? OR
       lower(trim(zonal_manager)) = ? OR lower(trim(zonal_manager)) = ?
       LIMIT 1`
    ).bind(nameClean, uidClean, nameClean, uidClean, nameClean, uidClean).first(),
    env.DB.prepare(
      `SELECT id FROM hierarchy_approvers WHERE approver_id = ? LIMIT 1`
    ).bind(user.id).first()
  ]);

  const hasDirectReports  = !!hasDirectReportsResult;
  const isHierarchyApprover = !!isHierarchyApproverResult;

  const userRoleLower = (user.role || "").trim().toLowerCase();
  const SPECIAL_VIEW_ROLES = ["admin","project head","mis","travel desk","travel tesk","vp","accountant","hr"];
  const isSpecialViewRole = SPECIAL_VIEW_ROLES.includes(userRoleLower);
  const isTeamLead = user.role === "Admin" || allowedWindows.includes("approval") ||
                     hasDirectReports || isHierarchyApprover || isSpecialViewRole;

  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentYear  = now.getFullYear();
  const monthStr     = now.toISOString().slice(0, 7);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();

  const [gradesResult, myExpensesResult, expenseInit] = await Promise.all([
    env.DB.prepare(`SELECT DISTINCT grade FROM allowance_master WHERE grade IS NOT NULL`).all(),
    env.DB.prepare(
      `SELECT * FROM expenses WHERE user_id = ? AND created_at >= ? ORDER BY id DESC LIMIT 50`
    ).bind(user.id, threeMonthsAgo).all(),
    getExpenseInitData(env, user, monthStr)
  ]);

  const grades = (gradesResult?.results || []).map(r => r.grade).filter(Boolean).sort();
  const dropdowns = { designations: DESIGNATIONS, zones: ZONE_DISTRICTS, roles: ROLES,
                      grades: grades.length ? grades : ["A","B","C","D"] };

  const mapExpense = e => ({
    ...e,
    travel_mode: e.travel_mode, expense_code: e.expense_code,
    da_amount: e.da_amount, hotel_amount: e.hotel_amount,
    other_expense_amount: e.other_expense_amount,
    calls_assigned: e.calls_assigned, calls_completed: e.calls_completed,
    pms_count: e.pms_count, asset_tagging: e.asset_tagging,
    local_purchase_amount: e.local_purchase_amount,
    original_amount: e.original_amount, original_da_amount: e.original_da_amount,
    original_hotel_amount: e.original_hotel_amount,
    original_other_expense_amount: e.original_other_expense_amount,
    original_local_purchase_amount: e.original_local_purchase_amount,
    calibration_count: e.calibration_count, mobilise_count: e.mobilise_count,
    created_at: e.created_at, updated_at: e.updated_at
  });

  const myExpenses = (myExpensesResult?.results || []).map(mapExpense);

  let teamExpenses = [];
  let pendingApprovals = [];

  if (isTeamLead) {
    if (isSpecialViewRole || userRoleLower === "admin") {
      const teamRes = await env.DB.prepare(
        `SELECT e.*, u.name as submitter_name, u.user_id as submitter_code,
                u.designation as submitter_designation, u.zone, u.district
         FROM expenses e
         INNER JOIN users u ON e.user_id = u.id
         WHERE e.year = ? AND e.month = ?
         ORDER BY e.id DESC LIMIT 10000`
      ).bind(currentYear, currentMonthName).all();
      teamExpenses = (teamRes?.results || []).map(e => ({
        ...mapExpense(e),
        submitter_name: e.submitter_name, submitter_code: e.submitter_code,
        submitter_designation: e.submitter_designation || "Engineer",
        zone: getActualZone(e.zone, e.district || "Ganganar"),
        district: e.district || "Ganganar"
      }));
    } else {
      const [directRes, hierRes] = await Promise.all([
        env.DB.prepare(
          `SELECT id FROM users WHERE
           lower(trim(manager))       = ? OR lower(trim(manager))       = ? OR
           lower(trim(coordinator))   = ? OR lower(trim(coordinator))   = ? OR
           lower(trim(zonal_manager)) = ? OR lower(trim(zonal_manager)) = ?`
        ).bind(nameClean, uidClean, nameClean, uidClean, nameClean, uidClean).all(),
        env.DB.prepare(
          `SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?`
        ).bind(user.id).all()
      ]);

      const directIds = (directRes?.results || []).map(r => r.id);
      let hierReqIds = [];
      if (hierRes?.results?.length > 0) {
        const hIds = hierRes.results.map(h => h.hierarchy_id);
        const ph = hIds.map(() => "?").join(",");
        const reqRes = await env.DB.prepare(
          `SELECT user_id FROM hierarchy_requesters WHERE hierarchy_id IN (${ph})`
        ).bind(...hIds).all();
        hierReqIds = (reqRes?.results || []).map(r => r.user_id);
      }

      const teamIds = [...new Set([...directIds, ...hierReqIds])].filter(id => id !== user.id);
      if (teamIds.length > 0) {
        const ph = teamIds.map(() => "?").join(",");
        const teamRes = await env.DB.prepare(
          `SELECT e.*, u.name as submitter_name, u.user_id as submitter_code,
                  u.designation as submitter_designation, u.zone, u.district
           FROM expenses e
           INNER JOIN users u ON e.user_id = u.id
           WHERE e.user_id IN (${ph}) AND e.year = ? AND e.month = ?
           ORDER BY e.id DESC LIMIT 5000`
        ).bind(...teamIds, currentYear, currentMonthName).all();
        teamExpenses = (teamRes?.results || []).map(e => ({
          ...mapExpense(e),
          submitter_name: e.submitter_name, submitter_code: e.submitter_code,
          submitter_designation: e.submitter_designation || "Engineer",
          zone: getActualZone(e.zone, e.district || "Ganganar"),
          district: e.district || "Ganganar"
        }));
      }
    }
    pendingApprovals = await fetchPendingApprovals(env, user);
  }

  let allowanceStats = null;
  if (expenseInit?.allowance) {
    const al = expenseInit.allowance;
    allowanceStats = {
      currentKm:   al.current_month_km   || 0,
      maxKm:       (al.max_km_per_month  || 2000) + (expenseInit.approved_km   || 0),
      currentAuto: al.current_month_auto  || 0,
      maxAuto:     (al.max_auto_per_month || 1000) + (expenseInit.approved_auto || 0),
      vehicleType: al.vehicle_type || "Bike",
      rateBike:    al.rate_bike    || 4.5,
      rateCar:     al.rate_car     || 9.0
    };
  }

  return {
    dropdowns, expense_init: expenseInit, my_expenses: myExpenses,
    allowance_stats: allowanceStats, team_expenses: teamExpenses,
    pending_approvals: pendingApprovals,
    pending_approvals_count: pendingApprovals.length
  };
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

export async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  const { user_id, password, force } = body;
  const ipAddress = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const userAgent = request.headers.get("User-Agent") || "";

  if (!user_id || !password)
    return jsonResponse({ error: "User ID and Password are required" }, 400);

  // 1. Fetch user
  const user = await env.DB.prepare(
    `SELECT u.*, COALESCE(r.role, u.role) as role FROM users u
     LEFT JOIN user_roles r ON u.user_id = r.user_id
     WHERE u.user_id = ? LIMIT 1`
  ).bind(user_id).first();

  if (!user) {
    await logLogin(env, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Invalid User ID or Password", detail: "Invalid User ID or Password" }, 401);
  }

  // 2. Status checks
  if (user.user_status === "disabled") {
    await logLogin(env, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Your account is disabled. Please contact the administrator." }, 403);
  }
  if (user.user_status === "locked") {
    await logLogin(env, user_id, ipAddress, userAgent, "locked");
    return jsonResponse({ error: "Your account is locked. Please use the Unlock Account option." }, 403);
  }

  // 3. Verify password
  const passwordCorrect = await verifyPassword(password, user.hashed_password);
  if (!passwordCorrect) {
    const failedAttempts = (user.failed_attempt || 0) + 1;
    if (failedAttempts >= 5) {
      await env.DB.prepare(`UPDATE users SET failed_attempt = ?, user_status = 'locked' WHERE user_id = ?`)
        .bind(failedAttempts, user_id).run();
      await logLogin(env, user_id, ipAddress, userAgent, "locked");
      return jsonResponse({ error: "Your account has been locked due to 5 failed login attempts." }, 403);
    }
    await env.DB.prepare(`UPDATE users SET failed_attempt = ? WHERE user_id = ?`)
      .bind(failedAttempts, user_id).run();
    await logLogin(env, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: `Invalid User ID or Password. ${5 - failedAttempts} attempts remaining.` }, 401);
  }

  // 4. Single session check
  if (user.active_session_id && !force)
    return jsonResponse({ error: "ALREADY_LOGGED_IN" }, 409);

  // 5. Success
  const sessionId = crypto.randomUUID();
  await env.DB.prepare(`UPDATE users SET active_session_id = ?, failed_attempt = 0 WHERE user_id = ?`)
    .bind(sessionId, user_id).run();
  await logLogin(env, user_id, ipAddress, userAgent, "success");

  const secretKey = env.API_SECRET;
  const now = Math.floor(Date.now() / 1000);
  const accessToken  = await signJwt({ sub: user.user_id, sid: sessionId, exp: now + 30*24*3600,  type: "access"  }, secretKey);
  const refreshToken = await signJwt({ sub: user.user_id, sid: sessionId, exp: now + 365*24*3600, type: "refresh" }, secretKey);

  const profile = { ...user };
  delete profile.hashed_password;
  profile.profile_photo   = user.profile_pic_url;
  profile.profile_pic_url = user.profile_pic_url;

  await resolveUserHierarchyNames(env, profile);
  const bootstrapData = await getBootstrapDataHelper(env, profile);

  return jsonResponse({ access_token: accessToken, refresh_token: refreshToken, token_type: "bearer", user: profile, bootstrap_data: bootstrapData });
}

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

export async function handleRefresh(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  const { refresh_token } = body;
  if (!refresh_token) return jsonResponse({ error: "refresh_token required" }, 400);

  const payload = await verifyJwt(refresh_token, env.API_SECRET);
  if (!payload || payload.type !== "refresh")
    return jsonResponse({ error: "Invalid or expired refresh token" }, 401);

  const user = await env.DB.prepare(
    `SELECT user_id, active_session_id FROM users WHERE user_id = ? LIMIT 1`
  ).bind(payload.sub).first();

  if (!user || user.active_session_id !== payload.sid)
    return jsonResponse({ error: "Session expired or invalid" }, 401);

  const sessionId = crypto.randomUUID();
  await env.DB.prepare(`UPDATE users SET active_session_id = ? WHERE user_id = ?`)
    .bind(sessionId, payload.sub).run();

  const now = Math.floor(Date.now() / 1000);
  const accessToken      = await signJwt({ sub: user.user_id, sid: sessionId, exp: now + 30*24*3600,  type: "access"  }, env.API_SECRET);
  const newRefreshToken  = await signJwt({ sub: user.user_id, sid: sessionId, exp: now + 365*24*3600, type: "refresh" }, env.API_SECRET);

  return jsonResponse({ access_token: accessToken, refresh_token: newRefreshToken, token_type: "bearer" });
}

// ─── GET /api/auth/bootstrap ──────────────────────────────────────────────────

export async function handleBootstrap(request, env, params, query, user) {
  const bootstrapData = await getBootstrapDataHelper(env, user);
  return jsonResponse(bootstrapData);
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

export async function handleLogout(request, env, params, query, user) {
  try {
    if (user?.user_id) {
      await env.DB.prepare(`UPDATE users SET active_session_id = NULL WHERE user_id = ?`)
        .bind(user.user_id).run();
    }
  } catch (e) { console.warn("Logout DB error:", e.message); }
  return jsonResponse({ success: true, message: "Logged out successfully" });
}

function normalizeDateStr(dStr) {
  if (!dStr) return "";
  const clean = String(dStr).trim().split("T")[0].replace(/[\/.]/g, "-");
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    if (p1.length === 4) {
      return `${p1}-${p2.padStart(2, "0")}-${p3.padStart(2, "0")}`;
    } else if (p3.length === 4) {
      return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
    }
  }
  return clean;
}

// ─── GET /api/auth/dropdowns ──────────────────────────────────────────────────
// KV cache key — TTL 1h (3600s). Force-refresh with ?bust=1.
const DROPDOWNS_KV_KEY = "cache:auth:dropdowns:v1";
const DROPDOWNS_TTL_SECONDS = 3600; // 1 hour

export async function handleGetDropdowns(request, env) {
  const urlObj = new URL(request.url);
  const bustCache = urlObj.searchParams.get("bust") === "1";

  // Try KV cache first (skip if bust=1 or KV not available)
  if (env.OTPS_KV && !bustCache) {
    try {
      const cached = await env.OTPS_KV.get(DROPDOWNS_KV_KEY, "json");
      if (cached) {
        return jsonResponse({ ...cached, _cache: "hit" });
      }
    } catch (_) {
      // KV error — fall through to DB
    }
  }

  // Cache miss — query D1
  const [gradesResult, hospitalsResult] = await Promise.all([
    env.DB.prepare(`SELECT DISTINCT grade FROM allowance_master WHERE grade IS NOT NULL`).all(),
    env.DB.prepare(`SELECT district_name, hospital_name FROM no_ta_da_hospitals`).all()
  ]);

  const grades = (gradesResult?.results || []).map(r => r.grade).filter(Boolean).sort();
  const facilities = {};
  for (const h of (hospitalsResult?.results || [])) {
    if (!facilities[h.district_name]) facilities[h.district_name] = [];
    facilities[h.district_name].push(h.hospital_name);
  }

  const payload = {
    designations: DESIGNATIONS, zones: ZONE_DISTRICTS, roles: ROLES,
    grades: grades.length ? grades : ["A","B","C","D"], facilities
  };

  // Write to KV cache (fire-and-forget, do not block response)
  if (env.OTPS_KV) {
    env.OTPS_KV.put(DROPDOWNS_KV_KEY, JSON.stringify(payload), {
      expirationTtl: DROPDOWNS_TTL_SECONDS
    }).catch(() => {/* silently ignore KV write errors */});
  }

  return jsonResponse({ ...payload, _cache: "miss" });
}

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

export async function handleForgotPassword(request, env) {
  try {
    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

    const { user_id, date_of_birth } = body;
    if (!user_id || !date_of_birth)
      return jsonResponse({ error: "user_id and date_of_birth are required" }, 400);

    const user = await env.DB.prepare(
      `SELECT user_id, name, mail_id, date_of_birth FROM users WHERE user_id = ? LIMIT 1`
    ).bind(user_id).first();

    if (!user) return jsonResponse({ error: "No user found with that User ID" }, 404);

    const dobNormInput  = normalizeDateStr(date_of_birth);
    const dobNormStored = normalizeDateStr(user.date_of_birth);
    const dobMatch      = dobNormInput === dobNormStored || dobNormInput.split("-").reverse().join("-") === dobNormStored;
    if (!dobMatch)
      return jsonResponse({ error: "Date of birth does not match our records" }, 400);

    const email = (user.mail_id || "").trim();
    if (!email) {
      return jsonResponse({ error: "No registered email address found for this user. Please contact admin." }, 400);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    if (env.OTPS_KV) {
      await env.OTPS_KV.put(`otp:${user_id}:forgot_password`, otp, { expirationTtl: 600 });
    }

    const emailPromise = sendOTPEmail(env, {
      to: email, name: user.name, otp, userId: user_id, purpose: "Password Reset Request"
    }).catch(emailErr => console.error("[ForgotPassword] Email dispatch error:", emailErr.message));

    if (env.ctx && typeof env.ctx.waitUntil === "function") {
      env.ctx.waitUntil(emailPromise);
    }

    const [namePart, domainPart] = email.split("@");
    const maskedEmail = namePart ? `${namePart.slice(0, 3)}***@${domainPart}` : null;

    return jsonResponse({ success: true, message: "OTP sent successfully", otp_sent: true, masked_email: maskedEmail });
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${err.message}` }, 500);
  }
}

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────

export async function handleVerifyOtp(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { user_id, otp, otp_type } = body;
  if (!user_id || !otp || !otp_type)
    return jsonResponse({ error: "user_id, otp, and otp_type are required" }, 400);

  const normalizedType = otp_type === "reset_password" ? "forgot_password" : otp_type;
  const kvKey    = `otp:${user_id}:${normalizedType}`;
  const strikeKey = `otp_strikes:${user_id}:${normalizedType}`;

  if (env.OTPS_KV) {
    const storedOtp = await env.OTPS_KV.get(kvKey);
    if (!storedOtp)
      return jsonResponse({ error: "OTP expired or invalid. Please request a new one." }, 400);

    let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
    if (strikes >= 5) {
      await Promise.all([env.OTPS_KV.delete(kvKey), env.OTPS_KV.delete(strikeKey)]);
      return jsonResponse({ error: "Too many failed attempts. Please request a new OTP." }, 400);
    }

    if (storedOtp.trim() !== String(otp).trim()) {
      const remaining = 5 - strikes - 1;
      await env.OTPS_KV.put(strikeKey, String(strikes + 1), { expirationTtl: 600 });
      if (remaining <= 0) {
        await Promise.all([env.OTPS_KV.delete(kvKey), env.OTPS_KV.delete(strikeKey)]);
        return jsonResponse({ error: "Invalid OTP. Too many failed attempts. OTP has been invalidated." }, 400);
      }
      return jsonResponse({ error: `Invalid OTP. ${remaining} attempts remaining.` }, 400);
    }

    await Promise.all([env.OTPS_KV.delete(kvKey), env.OTPS_KV.delete(strikeKey)]);
  }

  return jsonResponse({ success: true, message: "OTP verified successfully." });
}

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

export async function handleResetPassword(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  const { user_id, otp, new_password, confirm_password } = body;
  if (!user_id || !otp || !new_password || !confirm_password)
    return jsonResponse({ error: "All fields are required" }, 400);

  if (new_password !== confirm_password)
    return jsonResponse({ error: "Passwords do not match" }, 400);

  if (new_password.length < 8)
    return jsonResponse({ error: "Password must be at least 8 characters" }, 400);

  const kvKey    = `otp:${user_id}:forgot_password`;
  const strikeKey = `otp_strikes:${user_id}:forgot_password`;

  if (!env.OTPS_KV) return jsonResponse({ error: "KV store not configured." }, 500);

  const storedOtp = await env.OTPS_KV.get(kvKey);
  if (!storedOtp) return jsonResponse({ error: "Invalid or expired OTP" }, 400);

  let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
  if (strikes >= 5) {
    await Promise.all([env.OTPS_KV.delete(kvKey), env.OTPS_KV.delete(strikeKey)]);
    return jsonResponse({ error: "OTP blocked. Please request a new code." }, 400);
  }

  if (storedOtp.trim() !== String(otp).trim()) {
    const remaining = 5 - strikes - 1;
    await env.OTPS_KV.put(strikeKey, String(strikes + 1), { expirationTtl: 600 });
    if (remaining <= 0) {
      await Promise.all([env.OTPS_KV.delete(kvKey), env.OTPS_KV.delete(strikeKey)]);
      return jsonResponse({ error: "Invalid OTP. Too many failed attempts." }, 400);
    }
    return jsonResponse({ error: `Invalid OTP. ${remaining} attempts remaining.` }, 400);
  }

  const user = await env.DB.prepare(`SELECT id FROM users WHERE user_id = ? LIMIT 1`).bind(user_id).first();
  if (!user) return jsonResponse({ error: "User not found" }, 404);

  const newHash = await getPasswordHash(new_password);
  const now     = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users SET hashed_password = ?, active_session_id = NULL, failed_attempt = 0, user_status = 'active' WHERE user_id = ?`
    ).bind(newHash, user_id),
    env.DB.prepare(
      `INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)`
    ).bind(user.id, newHash, now)
  ]);

  await Promise.all([env.OTPS_KV.delete(kvKey), env.OTPS_KV.delete(strikeKey)]);
  return jsonResponse({ success: true, message: "Password has been reset successfully. Please login with your new password." });
}

// ─── POST /api/auth/unlock-account — CF MailChannels OTP ─────────────────────

export async function handleUnlockAccount(request, env) {
  try {
    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

    const { user_id, date_of_joining, date_of_birth } = body;
    if (!user_id || !date_of_joining || !date_of_birth)
      return jsonResponse({ error: "user_id, date_of_joining, and date_of_birth are required" }, 400);

    const user = await env.DB.prepare(
      `SELECT user_id, name, mail_id, user_status, date_of_birth, date_of_joining FROM users WHERE user_id = ? LIMIT 1`
    ).bind(user_id).first();

    if (!user) return jsonResponse({ error: "No user found with that User ID" }, 404);

    if (user.user_status && user.user_status !== "locked")
      return jsonResponse({ error: "Account is active and not locked. You can log in directly.", is_already_active: true }, 400);

    // Verify DOJ + DOB with date normalization
    const dojNormInput  = normalizeDateStr(date_of_joining);
    const dojNormStored = normalizeDateStr(user.date_of_joining);
    const dojMatch      = dojNormInput === dojNormStored || dojNormInput.split("-").reverse().join("-") === dojNormStored;

    const dobNormInput  = normalizeDateStr(date_of_birth);
    const dobNormStored = normalizeDateStr(user.date_of_birth);
    const dobMatch      = dobNormInput === dobNormStored || dobNormInput.split("-").reverse().join("-") === dobNormStored;

    if (!dojMatch || !dobMatch)
      return jsonResponse({ error: "Date of joining or date of birth does not match our records" }, 400);

    const email = (user.mail_id || "").trim();
    if (!email) {
      return jsonResponse({ error: "No registered email address found for this user. Please contact admin." }, 400);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    if (env.OTPS_KV) {
      await env.OTPS_KV.put(`otp:${user_id}:unlock_account`, otp, { expirationTtl: 600 });
    }

    // Non-blocking async email dispatch (Instant HTTP Response)
    const emailPromise = sendOTPEmail(env, {
      to: email, name: user.name, otp, userId: user_id, purpose: "Account Unlock Authorization"
    }).catch(emailErr => console.error("[UnlockAccount] Email dispatch error:", emailErr.message));

    if (env.ctx && typeof env.ctx.waitUntil === "function") {
      env.ctx.waitUntil(emailPromise);
    }

    const [namePart, domainPart] = email.split("@");
    const maskedEmail = namePart ? `${namePart.slice(0, 3)}***@${domainPart}` : null;

    return jsonResponse({ success: true, message: "Unlock verification code sent successfully.", otp_sent: true, masked_email: maskedEmail });
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${err.message}` }, 500);
  }
}

// ─── POST /api/auth/unlock-verify-otp ────────────────────────────────────────

export async function handleUnlockVerifyOtp(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { user_id, otp } = body;
  if (!user_id || !otp)
    return jsonResponse({ error: "user_id and otp are required" }, 400);

  const kvKey    = `otp:${user_id}:unlock_account`;
  const strikeKey = `otp_strikes:${user_id}:unlock_account`;

  if (!env.OTPS_KV) return jsonResponse({ error: "KV store not configured." }, 500);

  const storedOtp = await env.OTPS_KV.get(kvKey);
  if (!storedOtp)
    return jsonResponse({ error: "Verification code expired. Please request a new one." }, 400);

  let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
  if (strikes >= 5) {
    await Promise.all([env.OTPS_KV.delete(kvKey), env.OTPS_KV.delete(strikeKey)]);
    return jsonResponse({ error: "Too many failed attempts. Code blocked. Please request a new one." }, 400);
  }

  if (storedOtp.trim() !== String(otp).trim()) {
    const remaining = 5 - strikes - 1;
    await env.OTPS_KV.put(strikeKey, String(strikes + 1), { expirationTtl: 600 });
    if (remaining <= 0) {
      await Promise.all([env.OTPS_KV.delete(kvKey), env.OTPS_KV.delete(strikeKey)]);
      return jsonResponse({ error: "Invalid OTP. Too many failed attempts. OTP has been invalidated." }, 400);
    }
    return jsonResponse({ error: `Invalid OTP. ${remaining} attempts remaining.` }, 400);
  }

  // Unlock
  await env.DB.prepare(
    `UPDATE users SET user_status = 'active', failed_attempt = 0, active_session_id = NULL WHERE user_id = ?`
  ).bind(user_id).run();

  await Promise.all([env.OTPS_KV.delete(kvKey), env.OTPS_KV.delete(strikeKey)]);
  return jsonResponse({ success: true, message: "Account unlocked successfully. You can now login." });
}
