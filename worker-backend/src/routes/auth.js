import { verifyPassword, signJwt, verifyJwt, getPasswordHash } from "../utils/security.js";
import { DESIGNATIONS, ZONE_DISTRICTS, ROLES, MONTH_NAMES } from "../utils/constants.js";
import { getExpenseInitData, getActualZone } from "./expense.js";
import { fetchPendingApprovals } from "./approval.js";
import { getDrizzleDb } from "../db/client.js";
import { users, userRoles, passwordHistories, allowanceMaster, expenses, loginLogs, hierarchyApprovers, hierarchyRequesters, facilityDetails } from "../db/schema.js";
import { eq, and, or, sql, desc, inArray } from "drizzle-orm";

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
 * Audit log login attempts to database
 */
async function logLogin(env, userCode, ipAddress, userAgent, status) {
  const timestamp = new Date().toISOString();
  try {
    const db = getDrizzleDb(env);
    await db.insert(loginLogs).values({
      userId: userCode,
      ipAddress,
      userAgent,
      status,
      createdAt: timestamp
    });
  } catch (e) {
    console.error("Login logging failed:", e);
  }
}

/**
 * Resolve manager/coordinator/zonal_manager codes into full names
 */
async function resolveUserHierarchyNames(env, user, request = null) {
  const db = getDrizzleDb(env, request);
  const fields = ["manager", "zonal_manager", "coordinator"];
  const values = fields
    .map(f => (user[f] || "").trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) return;

  const allResolved = await db.select({
    name: users.name,
    userId: users.userId,
    eCode: users.eCode
  })
  .from(users)
  .where(or(
    inArray(sql`lower(trim(${users.userId}))`, values),
    inArray(sql`lower(trim(${users.eCode}))`, values),
    inArray(sql`lower(trim(${users.name}))`, values)
  ));

  const resolvedMap = {};
  for (const r of allResolved) {
    if (r.userId) resolvedMap[r.userId.toLowerCase()] = r.name;
    if (r.eCode) resolvedMap[r.eCode.toLowerCase()] = r.name;
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
export async function getBootstrapDataHelper(env, user, request = null) {
  const db = getDrizzleDb(env, request);
  const allowedWindows = user.allowed_windows ? user.allowed_windows.split(",").map(w => w.trim().toLowerCase()) : [];
  
  const nameClean = (user.name || "").trim();
  const uidClean = (user.user_id || "").trim();

  // Check direct reports + hierarchy approver in PARALLEL
  const [hasDirectReportsResult, isHierarchyApproverResult] = await Promise.all([
    db.select({ id: users.id })
      .from(users)
      .where(or(
        eq(sql`lower(trim(${users.manager}))`, nameClean.toLowerCase()),
        eq(sql`lower(trim(${users.manager}))`, uidClean.toLowerCase()),
        eq(sql`lower(trim(${users.coordinator}))`, nameClean.toLowerCase()),
        eq(sql`lower(trim(${users.coordinator}))`, uidClean.toLowerCase()),
        eq(sql`lower(trim(${users.zonalManager}))`, nameClean.toLowerCase()),
        eq(sql`lower(trim(${users.zonalManager}))`, uidClean.toLowerCase())
      ))
      .limit(1),
    db.select({ id: hierarchyApprovers.id })
      .from(hierarchyApprovers)
      .where(eq(hierarchyApprovers.approverId, user.id))
      .limit(1)
  ]);

  const hasDirectReports = hasDirectReportsResult.length > 0;
  const isHierarchyApprover = isHierarchyApproverResult.length > 0;

  const isTeamLead = user.role === "Admin" || allowedWindows.includes("approval") || hasDirectReports || isHierarchyApprover;

  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentYear = now.getFullYear();
  const monthStr = now.toISOString().slice(0, 7); // YYYY-MM

  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();

  const [gradesRows, myExpensesResult, expenseInit] = await Promise.all([
    db.select({ grade: allowanceMaster.grade }).from(allowanceMaster),
    db.select().from(expenses)
      .where(and(
        eq(expenses.userId, user.id),
        sql`${expenses.createdAt} >= ${threeMonthsAgo}`
      ))
      .orderBy(desc(expenses.id))
      .limit(50),
    getExpenseInitData(env, user, monthStr)
  ]);

  const grades = Array.from(new Set(gradesRows.map(r => r.grade))).filter(Boolean).sort();
  const dropdowns = {
    designations: DESIGNATIONS,
    zones: ZONE_DISTRICTS,
    roles: ROLES,
    grades: grades.length ? grades : ["A", "B", "C", "D"]
  };

  const myExpenses = myExpensesResult.map(e => ({
    ...e,
    user_id: e.userId,
    travel_mode: e.travelMode,
    expense_code: e.expenseCode,
    da_amount: e.daAmount,
    hotel_amount: e.hotelAmount,
    other_expense_amount: e.otherExpenseAmount,
    calls_assigned: e.callsAssigned,
    calls_completed: e.callsCompleted,
    pms_count: e.pmsCount,
    asset_tagging: e.assetTagging,
    local_purchase_amount: e.localPurchaseAmount,
    original_amount: e.originalAmount,
    original_da_amount: e.originalDaAmount,
    original_hotel_amount: e.originalHotelAmount,
    original_other_expense_amount: e.originalOtherExpenseAmount,
    original_local_purchase_amount: e.originalLocalPurchaseAmount,
    calibration_count: e.calibrationCount,
    mobilise_count: e.mobiliseCount,
    created_at: e.createdAt,
    updated_at: e.updatedAt
  }));

  let teamExpenses = [];
  let pendingApprovals = [];
  if (isTeamLead) {
    if (user.role === "Admin") {
      const teamRes = await db.select({
        id: expenses.id,
        userId: expenses.userId,
        month: expenses.month,
        year: expenses.year,
        amount: expenses.amount,
        status: expenses.status,
        travelMode: expenses.travelMode,
        itinerary: expenses.itinerary,
        description: expenses.description,
        expenseCode: expenses.expenseCode,
        daAmount: expenses.daAmount,
        hotelAmount: expenses.hotelAmount,
        otherExpenseAmount: expenses.otherExpenseAmount,
        callsAssigned: expenses.callsAssigned,
        callsCompleted: expenses.callsCompleted,
        pmsCount: expenses.pmsCount,
        assetTagging: expenses.assetTagging,
        localPurchaseAmount: expenses.localPurchaseAmount,
        originalAmount: expenses.originalAmount,
        originalDaAmount: expenses.originalDaAmount,
        originalHotelAmount: expenses.originalHotelAmount,
        originalOtherExpenseAmount: expenses.originalOtherExpenseAmount,
        originalLocalPurchaseAmount: expenses.originalLocalPurchaseAmount,
        calibrationCount: expenses.calibrationCount,
        mobiliseCount: expenses.mobiliseCount,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        submitter_name: users.name,
        submitter_code: users.userId,
        submitter_designation: users.designation,
        zone: users.zone,
        district: users.district
      })
      .from(expenses)
      .innerJoin(users, eq(expenses.userId, users.id))
      .where(and(
        eq(expenses.year, currentYear),
        eq(expenses.month, currentMonthName)
      ))
      .orderBy(desc(expenses.id))
      .limit(10000);
      
      teamExpenses = teamRes.map(e => ({
        ...e,
        user_id: e.userId,
        travel_mode: e.travelMode,
        expense_code: e.expenseCode,
        da_amount: e.daAmount,
        hotel_amount: e.hotelAmount,
        other_expense_amount: e.otherExpenseAmount,
        calls_assigned: e.callsAssigned,
        calls_completed: e.callsCompleted,
        pms_count: e.pmsCount,
        asset_tagging: e.assetTagging,
        local_purchase_amount: e.localPurchaseAmount,
        original_amount: e.originalAmount,
        original_da_amount: e.originalDaAmount,
        original_hotel_amount: e.originalHotelAmount,
        original_other_expense_amount: e.originalOtherExpenseAmount,
        original_local_purchase_amount: e.originalLocalPurchaseAmount,
        calibration_count: e.calibrationCount,
        mobilise_count: e.mobiliseCount,
        created_at: e.createdAt,
        updated_at: e.updatedAt,
        submitter_name: e.submitter_name,
        submitter_code: e.submitter_code,
        submitter_designation: e.submitter_designation || "Engineer",
        zone: getActualZone(e.zone, e.district || "Ganganar"),
        district: e.district || "Ganganar"
      }));
    } else {
      const [directReportsRes, hierarchyApprovals] = await Promise.all([
        db.select({ id: users.id })
          .from(users)
          .where(or(
            eq(sql`lower(trim(${users.manager}))`, nameClean.toLowerCase()),
            eq(sql`lower(trim(${users.manager}))`, uidClean.toLowerCase()),
            eq(sql`lower(trim(${users.coordinator}))`, nameClean.toLowerCase()),
            eq(sql`lower(trim(${users.coordinator}))`, uidClean.toLowerCase()),
            eq(sql`lower(trim(${users.zonalManager}))`, nameClean.toLowerCase()),
            eq(sql`lower(trim(${users.zonalManager}))`, uidClean.toLowerCase())
          )),
        db.select({ hierarchyId: hierarchyApprovers.hierarchyId })
          .from(hierarchyApprovers)
          .where(eq(hierarchyApprovers.approverId, user.id))
      ]);

      const directReportsIds = directReportsRes.map(r => r.id);
      
      let hierarchyReportsIds = [];
      if (hierarchyApprovals.length > 0) {
        const hIds = hierarchyApprovals.map(h => h.hierarchyId);
        const reqsRes = await db.select({ userId: hierarchyRequesters.userId })
          .from(hierarchyRequesters)
          .where(inArray(hierarchyRequesters.hierarchyId, hIds));
        hierarchyReportsIds = reqsRes.map(r => r.userId);
      }

      const teamUserIdsSet = new Set([...directReportsIds, ...hierarchyReportsIds]);
      teamUserIdsSet.delete(user.id);
      const teamUserIds = Array.from(teamUserIdsSet);

      if (teamUserIds.length > 0) {
        const teamRes = await db.select({
          id: expenses.id,
          userId: expenses.userId,
          month: expenses.month,
          year: expenses.year,
          amount: expenses.amount,
          status: expenses.status,
          travelMode: expenses.travelMode,
          itinerary: expenses.itinerary,
          description: expenses.description,
          expenseCode: expenses.expenseCode,
          daAmount: expenses.daAmount,
          hotelAmount: expenses.hotelAmount,
          otherExpenseAmount: expenses.otherExpenseAmount,
          callsAssigned: expenses.callsAssigned,
          callsCompleted: expenses.callsCompleted,
          pmsCount: expenses.pmsCount,
          assetTagging: expenses.assetTagging,
          localPurchaseAmount: expenses.localPurchaseAmount,
          originalAmount: expenses.originalAmount,
          originalDaAmount: expenses.originalDaAmount,
          originalHotelAmount: expenses.originalHotelAmount,
          originalOtherExpenseAmount: expenses.originalOtherExpenseAmount,
          originalLocalPurchaseAmount: expenses.originalLocalPurchaseAmount,
          calibrationCount: expenses.calibrationCount,
          mobiliseCount: expenses.mobiliseCount,
          createdAt: expenses.createdAt,
          updatedAt: expenses.updatedAt,
          submitter_name: users.name,
          submitter_code: users.userId,
          submitter_designation: users.designation,
          zone: users.zone,
          district: users.district
        })
        .from(expenses)
        .innerJoin(users, eq(expenses.userId, users.id))
        .where(and(
          inArray(expenses.userId, teamUserIds),
          eq(expenses.year, currentYear),
          eq(expenses.month, currentMonthName)
        ))
        .orderBy(desc(expenses.id))
        .limit(5000);
        
        teamExpenses = teamRes.map(e => ({
          ...e,
          user_id: e.userId,
          travel_mode: e.travelMode,
          expense_code: e.expenseCode,
          da_amount: e.daAmount,
          hotel_amount: e.hotelAmount,
          other_expense_amount: e.otherExpenseAmount,
          calls_assigned: e.callsAssigned,
          calls_completed: e.callsCompleted,
          pms_count: e.pmsCount,
          asset_tagging: e.assetTagging,
          local_purchase_amount: e.localPurchaseAmount,
          original_amount: e.originalAmount,
          original_da_amount: e.originalDaAmount,
          original_hotel_amount: e.originalHotelAmount,
          original_other_expense_amount: e.originalOtherExpenseAmount,
          original_local_purchase_amount: e.originalLocalPurchaseAmount,
          calibration_count: e.calibrationCount,
          mobilise_count: e.mobiliseCount,
          created_at: e.createdAt,
          updated_at: e.updatedAt,
          submitter_name: e.submitter_name,
          submitter_code: e.submitter_code,
          submitter_designation: e.submitter_designation || "Engineer",
          zone: getActualZone(e.zone, e.district || "Ganganar"),
          district: e.district || "Ganganar"
        }));
      }
    }
    pendingApprovals = await fetchPendingApprovals(env, user);
  }

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
  const db = getDrizzleDb(env, request);
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
  const [user] = await db.select().from(users).where(eq(users.userId, user_id)).limit(1);
  if (!user) {
    await logLogin(env, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Invalid User ID or Password", detail: "Invalid User ID or Password" }, 401);
  }

  // Format properties for backward compatibility
  const compatibleUser = {
    ...user,
    user_id: user.userId,
    hashed_password: user.hashedPassword,
    user_status: user.userStatus,
    failed_attempt: user.failedAttempt,
    active_session_id: user.activeSessionId,
    date_of_birth: user.dateOfBirth,
    date_of_joining: user.dateOfJoining,
    mobile_number: user.mobileNumber,
    mail_id: user.mailId
  };

  // 2. Check user status
  if (compatibleUser.user_status === "disabled") {
    await logLogin(env, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Your account is disabled. Please contact the administrator.", detail: "Your account is disabled. Please contact the administrator." }, 403);
  }

  if (compatibleUser.user_status === "locked") {
    await logLogin(env, user_id, ipAddress, userAgent, "locked");
    return jsonResponse({ error: "Your account is locked. Please use the Unlock Account option.", detail: "Your account is locked. Please use the Unlock Account option." }, 403);
  }

  // 3. Verify password
  const passwordCorrect = await verifyPassword(password, compatibleUser.hashed_password);
  if (!passwordCorrect) {
    const failedAttempts = (compatibleUser.failed_attempt || 0) + 1;
    
    if (failedAttempts >= 5) {
      await db.update(users)
        .set({ failedAttempt: failedAttempts, userStatus: 'locked' })
        .where(eq(users.userId, user_id));
      await logLogin(env, user_id, ipAddress, userAgent, "locked");
      return jsonResponse({ error: "Your account has been locked due to 5 failed login attempts.", detail: "Your account has been locked due to 5 failed login attempts." }, 403);
    } else {
      await db.update(users)
        .set({ failedAttempt: failedAttempts })
        .where(eq(users.userId, user_id));
      await logLogin(env, user_id, ipAddress, userAgent, "failed");
      const attemptsLeft = 5 - failedAttempts;
      return jsonResponse({ error: `Invalid User ID or Password. ${attemptsLeft} attempts remaining.`, detail: `Invalid User ID or Password. ${attemptsLeft} attempts remaining.` }, 401);
    }
  }

  // 4. Single session validation
  if (compatibleUser.active_session_id && !force) {
    return jsonResponse({ error: "ALREADY_LOGGED_IN" }, 409);
  }

  // 5. Success - generate new active session ID
  const sessionId = crypto.randomUUID();
  await db.update(users)
    .set({ activeSessionId: sessionId, failedAttempt: 0 })
    .where(eq(users.userId, user_id));
  
  await logLogin(env, user_id, ipAddress, userAgent, "success");

  // Create access and refresh tokens
  const secretKey = env.API_SECRET;
  const accessExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 Days
  const refreshExp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 365 Days

  const accessToken = await signJwt({ sub: compatibleUser.user_id, sid: sessionId, exp: accessExp, type: "access" }, secretKey);
  const refreshToken = await signJwt({ sub: compatibleUser.user_id, sid: sessionId, exp: refreshExp, type: "refresh" }, secretKey);

  // Fetch role
  const [roleRow] = await db.select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, user_id))
    .limit(1);
  compatibleUser.role = roleRow?.role || "user";

  // Resolve manager/zonal_manager/coordinator names if they contain e_codes
  await resolveUserHierarchyNames(env, compatibleUser, request);

  // Prefetch bootstrap data for instant frontend load
  const bootstrapData = await getBootstrapDataHelper(env, compatibleUser, request);

  const profile = { ...compatibleUser };
  delete profile.hashed_password;

  const formattedProfile = {
    ...profile,
    user_id: profile.userId,
    e_code: profile.eCode,
    user_status: profile.userStatus,
    mobile_number: profile.mobileNumber,
    mail_id: profile.mailId,
    date_of_joining: profile.dateOfJoining,
    date_of_birth: profile.dateOfBirth,
    e_upkaran_id: profile.eUpkaranId,
    allowed_windows: profile.allowedWindows,
    profile_photo: profile.profilePhoto,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt
  };

  return jsonResponse({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    user: formattedProfile,
    bootstrap_data: bootstrapData
  });
}

/**
 * POST /api/auth/refresh
 */
export async function handleRefresh(request, env, params, query) {
  const db = getDrizzleDb(env, request);
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

  const [user] = await db.select().from(users).where(eq(users.userId, payload.sub)).limit(1);
  if (!user || user.activeSessionId !== payload.sid) {
    return jsonResponse({ error: "Session expired or invalid" }, 401);
  }

  const sessionId = crypto.randomUUID();
  await db.update(users).set({ activeSessionId: sessionId }).where(eq(users.userId, user.userId));

  const accessExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const refreshExp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  const accessToken = await signJwt({ sub: user.userId, sid: sessionId, exp: accessExp, type: "access" }, env.API_SECRET);
  const newRefreshToken = await signJwt({ sub: user.userId, sid: sessionId, exp: refreshExp, type: "refresh" }, env.API_SECRET);

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
  const bootstrapData = await getBootstrapDataHelper(env, user, request);
  return jsonResponse(bootstrapData);
}

/**
 * POST /api/auth/logout
 */
export async function handleLogout(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  try {
    if (user && user.user_id) {
      await db.update(users).set({ activeSessionId: null }).where(eq(users.userId, user.user_id));
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
  const db = getDrizzleDb(env, request);
  const [gradesRows, facilitiesRows] = await Promise.all([
    db.select({ grade: allowanceMaster.grade }).from(allowanceMaster),
    db.select({ districtName: facilityDetails.districtName, facilityName: facilityDetails.facilityName }).from(facilityDetails)
  ]);
  const grades = Array.from(new Set(gradesRows.map(r => r.grade))).filter(Boolean).sort();

  const facilities = {};
  for (const f of facilitiesRows) {
    if (!facilities[f.districtName]) {
      facilities[f.districtName] = [];
    }
    facilities[f.districtName].push(f.facilityName);
  }

  return jsonResponse({
    designations: DESIGNATIONS,
    zones: ZONE_DISTRICTS,
    roles: ROLES,
    grades: grades.length ? grades : ["A", "B", "C", "D"],
    facilities: facilities
  });
}

/**
 * Helper to send email via Google Apps Script Web App
 */
async function sendEmail(to, subject, body, env) {
  const gasUrl = (env && env.GAS_WEB_APP_URL) || "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec";
  
  const plainText = body.replace(/<[^>]*>/g, ""); // strip HTML tags for plain text fallback
  const purpose = subject.toLowerCase().includes("unlock") ? "account_unlock" : "password_reset";
  
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
 * Verifies user_id + DOB then sends OTP via email
 */
export async function handleForgotPassword(request, env, params, query) {
  const db = getDrizzleDb(env, request);
  try {
    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON" }, 400); }

    const { user_id, date_of_birth } = body;
    if (!user_id || !date_of_birth) {
      return jsonResponse({ error: "user_id and date_of_birth are required" }, 400);
    }

    const [user] = await db.select().from(users).where(eq(users.userId, user_id)).limit(1);
    if (!user) {
      return jsonResponse({ error: "No user found with that User ID" }, 404);
    }

    // Verify DOB
    const dobInput = String(date_of_birth).trim().replace(/\//g, "-");
    const dobStored = user.dateOfBirth ? String(user.dateOfBirth).trim() : "";
    const dobMatch = dobInput === dobStored || dobInput.split("-").reverse().join("-") === dobStored;
    if (!dobMatch) {
      return jsonResponse({ error: "Date of birth does not match our records" }, 400);
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Store OTP in Cloudflare KV
    const kvKey = `otp:${user_id}:forgot_password`;
    if (env.OTPS_KV) {
      await env.OTPS_KV.put(kvKey, otp, { expirationTtl: 600 });
    } else {
      console.warn("env.OTPS_KV is not bound! Falling back to console logging.");
    }

    // Note: We removed the notifications insert here to clean up the notification subsystem.

    // Send OTP via Google Apps Script email
    const email = user.mailId || "";
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
      mobile_masked: user.mobileNumber ? `XXXXXX${String(user.mobileNumber).slice(-4)}` : null
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

  if (env.OTPS_KV) {
    await env.OTPS_KV.delete(strikeKey);
  }

  return jsonResponse({ success: true, message: "OTP verified successfully." });
}

/**
 * POST /api/auth/reset-password
 */
export async function handleResetPassword(request, env, params, query) {
  const db = getDrizzleDb(env, request);
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

  const newHash = await getPasswordHash(new_password);
  const timestamp = new Date().toISOString();

  const [user] = await db.select().from(users).where(eq(users.userId, user_id)).limit(1);
  if (!user) return jsonResponse({ error: "User not found" }, 404);

  await db.batch([
    db.update(users).set({ hashedPassword: newHash, activeSessionId: null, failedAttempt: 0, userStatus: 'active' }).where(eq(users.userId, user_id)),
    db.insert(passwordHistories).values({ userId: user.id, hashedPassword: newHash, createdAt: timestamp })
  ]);

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
  const db = getDrizzleDb(env, request);
  try {
    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON" }, 400); }

    const { user_id, date_of_joining, date_of_birth } = body;
    if (!user_id || !date_of_joining || !date_of_birth) {
      return jsonResponse({ error: "user_id, date_of_joining, and date_of_birth are required" }, 400);
    }

    const [user] = await db.select().from(users).where(eq(users.userId, user_id)).limit(1);
    if (!user) return jsonResponse({ error: "No user found with that User ID" }, 404);

    if (user.userStatus !== "locked") {
      return jsonResponse({ error: "Account is not locked. Please contact admin if you are having issues." }, 400);
    }

    // Verify DOJ
    const dojInput = String(date_of_joining).trim().replace(/\//g, "-");
    const dojStored = user.dateOfJoining ? String(user.dateOfJoining).trim() : "";
    const dojMatch = dojInput === dojStored || dojInput.split("-").reverse().join("-") === dojStored;

    // Verify DOB
    const dobInput = String(date_of_birth).trim().replace(/\//g, "-");
    const dobStored = user.dateOfBirth ? String(user.dateOfBirth).trim() : "";
    const dobMatch = dobInput === dobStored || dobInput.split("-").reverse().join("-") === dobStored;

    if (!dojMatch || !dobMatch) {
      return jsonResponse({ error: "Date of joining or date of birth does not match our records" }, 400);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const timestamp = new Date().toISOString();

    const kvKey = `otp:${user_id}:unlock_account`;
    if (env.OTPS_KV) {
      await env.OTPS_KV.put(kvKey, otp, { expirationTtl: 600 });
    }

    // Note: We removed the notifications insert here to clean up the notification subsystem.

    // Send email via Google Apps Script
    const email = user.mailId || "";
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
                <div style="text-align: center; font-size: 11px; color: #94a3b8;">&copy; 2026 Cyrix Healthcare Pvt. Ltd. | Secure Access</div>
            </div>
        </div>`;
      
      try {
        await sendEmail(email, "Security Verification - Unlock Request", emailTemplate, env);
      } catch (emailErr) {
        console.error("Failed to send unlock email:", emailErr);
        return jsonResponse({ error: "Failed to deliver unlock verification code. Contact administrator." }, 400);
      }
    }

    const [namePart, domainPart] = email.split("@");
    const maskedEmail = namePart ? `${namePart.slice(0, 3)}***@${domainPart}` : null;

    return jsonResponse({
      success: true,
      message: "Unlock verification code sent successfully.",
      otp_sent: true,
      masked_email: maskedEmail
    });
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${err.message}` }, 500);
  }
}

/**
 * POST /api/auth/unlock-verify-otp
 */
export async function handleUnlockVerifyOtp(request, env, params, query) {
  const db = getDrizzleDb(env, request);
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { user_id, otp } = body;
  if (!user_id || !otp) {
    return jsonResponse({ error: "user_id and otp are required" }, 400);
  }

  const kvKey = `otp:${user_id}:unlock_account`;
  const strikeKey = `otp_strikes:${user_id}:unlock_account`;

  let storedOtp = null;
  if (env.OTPS_KV) {
    storedOtp = await env.OTPS_KV.get(kvKey);
  } else {
    return jsonResponse({ error: "KV store not configured." }, 500);
  }

  if (!storedOtp) {
    return jsonResponse({ error: "Verification code expired. Please request a new one." }, 400);
  }

  let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
  if (strikes >= 5) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
    return jsonResponse({ error: "Too many failed attempts. Code blocked. Please request a new one." }, 400);
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

  // Unlock account in D1
  await db.update(users)
    .set({ userStatus: 'active', failedAttempt: 0, activeSessionId: null })
    .where(eq(users.userId, user_id));
  
  // Note: We removed the notifications insert here to clean up the notification subsystem.
  
  // Invalidate OTP in KV
  if (env.OTPS_KV) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
  }

  return jsonResponse({ success: true, message: "Account unlocked successfully. You can now login." });
}
