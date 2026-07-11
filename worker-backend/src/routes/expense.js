import { runWrite, runBatchWrite, runRead } from "../utils/db.js";
import { getLegacyExpenseHashId } from "./approval.js";
import { uploadFileWithFallback } from "./upload.js";
import { MONTH_NAMES } from "../utils/constants.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function queryInChunks(db, queryTemplate, ids, chunkSize = 50) {
  let allResults = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const sql = queryTemplate.replace("?", placeholders);
    const res = await db.prepare(sql).bind(...chunk).all();
    if (res.results) {
      allResults = allResults.concat(res.results);
    }
  }
  return allResults;
}

export async function serializeExpenses(env, expenses, submittersMap) {
  if (!expenses || expenses.length === 0) return [];

  const expenseCodes = expenses.map(e => e.expense_code).filter(Boolean);
  
  // Batch fetch itineraries for all these expenses
  let allLegs = [];
  if (expenseCodes.length > 0) {
    allLegs = await queryInChunks(env.DB, "SELECT * FROM expense_itineraries WHERE exp_id IN (?)", expenseCodes);
  }

  // Group legs by exp_id
  const legsByCode = {};
  for (const l of allLegs) {
    if (!legsByCode[l.exp_id]) legsByCode[l.exp_id] = [];
    legsByCode[l.exp_id].push(l);
  }

  const result = [];
  for (const exp of expenses) {
    const submitter = submittersMap[exp.user_id] || null;
    const legs = legsByCode[exp.expense_code] || [];

    const totCallsAssigned = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.calls_assigned) || 0), 0)
      : (parseInt(exp.calls_assigned) || 0);

    const totCallsCompleted = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.calls_completed) || 0), 0)
      : (parseInt(exp.calls_completed) || 0);

    const totPmsCount = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.pms_count) || 0), 0)
      : (parseInt(exp.pms_count) || 0);

    const totAssetTagging = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.asset_tagging) || 0), 0)
      : (parseInt(exp.asset_tagging) || 0);

    const totCalibrationCount = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.calibration_count) || 0), 0)
      : (parseInt(exp.calibration_count) || 0);

    const totMobiliseCount = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.mobilise_count) || 0), 0)
      : (parseInt(exp.mobilise_count) || 0);

    const totKm = legs
      .filter(l => ["bike", "car"].includes((l.travel_mode || "").trim().toLowerCase()))
      .reduce((sum, l) => sum + (parseFloat(l.distance_km) || 0.0), 0.0);

    const totAuto = legs
      .filter(l => (l.travel_mode || "").trim().toLowerCase() === "auto")
      .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0) +
      legs
      .filter(l => (l.sub_mode || "").trim().toLowerCase() === "auto")
      .reduce((sum, l) => sum + (parseFloat(l.sub_amount) || 0.0), 0.0);

    const bikeAmount = legs
      .filter(l => (l.travel_mode || "").trim().toLowerCase() === "bike")
      .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0);

    const carAmount = legs
      .filter(l => (l.travel_mode || "").trim().toLowerCase() === "car")
      .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0);

    result.push({
      id: exp.id,
      expense_code: exp.expense_code,
      user_id: exp.user_id,
      month: exp.month,
      year: exp.year,
      amount: parseFloat(exp.amount || 0),
      status: exp.status,
      travel_mode: exp.travel_mode,
      itinerary: exp.itinerary,
      description: exp.description || "",
      attachments: exp.attachments || "",
      da_amount: parseFloat(exp.da_amount || 0.0),
      hotel_amount: parseFloat(exp.hotel_amount || 0.0),
      other_expense_amount: parseFloat(exp.other_expense_amount || 0.0),
      local_purchase_amount: parseFloat(exp.local_purchase_amount || 0.0),
      calls_assigned: totCallsAssigned,
      calls_completed: totCallsCompleted,
      pms_count: totPmsCount,
      asset_tagging: totAssetTagging,
      calibration_count: totCalibrationCount,
      mobilise_count: totMobiliseCount,
      created_at: exp.created_at,
      updated_at: exp.updated_at,
      total_km: totKm,
      total_auto: totAuto,
      bike_amount: bikeAmount,
      car_amount: carAmount,
      auto_amount: totAuto,
      district: submitter?.district || "Ganganar",
      zone: submitter?.zone || "Bikaner",
      legs: legs.map(l => ({
        leg: l.leg_number,
        from_district: l.from_district,
        to_district: l.to_district,
        from: l.from_location || "",
        to: l.to_location || "",
        mode: l.travel_mode,
        km: parseFloat(l.distance_km || 0),
        amount: parseFloat(l.travel_amount || 0),
        sub_mode: l.sub_mode,
        sub_amount: parseFloat(l.sub_amount || 0),
        da: parseFloat(l.da_amount || 0),
        hotel: parseFloat(l.hotel_amount || 0),
        local_purchase: parseFloat(l.local_purchase || 0),
        other_desc: l.other_desc || "",
        other_amount: parseFloat(l.other_amount || 0),
        visit_purpose: l.visit_purpose || "",
        activity_details: l.activity_details || ""
      }))
    });
  }

  return result;
}

/**
 * GET /api/expense/
 */
export async function handleListExpenses(request, env, params, query, user) {
  const month = query.get("month");

  if (!month) {
    // Default to current month & year to minimize reads
    const now = new Date();
    const currentMonthName = MONTH_NAMES[now.getMonth()];
    const currentYear = now.getFullYear();

    const expensesRows = await env.DB.prepare(`
      SELECT * FROM expenses WHERE user_id = ? AND year = ? AND month = ? ORDER BY created_at DESC
    `).bind(user.id, currentYear, currentMonthName).all();

    const submittersMap = { [user.id]: user };
    const serialized = await serializeExpenses(env, expensesRows.results || [], submittersMap);
    return jsonResponse(serialized);
  }

  let querySql = "SELECT * FROM expenses WHERE user_id = ?";
  const binds = [user.id];

  if (month.includes("-") && month.length === 7) {
    const parts = month.split("-");
    const yr = parseInt(parts[0], 10);
    const monNum = parseInt(parts[1], 10);
    const monName = MONTH_NAMES[monNum - 1];

    querySql += " AND year = ? AND month = ?";
    binds.push(yr, monName);
  } else {
    querySql += " AND LOWER(month) LIKE ?";
    binds.push(`%${month.toLowerCase()}%`);
  }

  querySql += " ORDER BY created_at DESC";

  const expensesRows = await env.DB.prepare(querySql).bind(...binds).all();
  const submittersMap = { [user.id]: user };
  const serialized = await serializeExpenses(env, expensesRows.results || [], submittersMap);
  return jsonResponse(serialized);
}

/**
 * GET /api/expense/init
 */
export async function getExpenseInitData(env, targetUser, monthStr) {
  const parts = monthStr.split("-");
  const yearVal = parseInt(parts[0], 10);
  const monthInt = parseInt(parts[1], 10);
  const monthName = MONTH_NAMES[monthInt - 1];

  const gradeToLookup = (targetUser.designation || "").toLowerCase().includes("specialist") ? "O1" : targetUser.grade;

  // Run all 8 independent DB queries in PARALLEL — reduces 8 round trips to 1
  const [
    facilitiesRows,
    submittedRows,
    limits,
    limitReqs,
    allowance,
    defaultBike,
    defaultCar,
    statsRes
  ] = await Promise.all([
    env.DB.prepare(`SELECT DISTINCT district_name, facility_name FROM facility_details`).all(),
    env.DB.prepare(`SELECT itinerary FROM expenses WHERE user_id = ? AND month = ? AND year = ?`
    ).bind(targetUser.id, monthName, yearVal).all(),
    env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN request_type = 'KM' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_km,
        SUM(CASE WHEN request_type = 'AUTO' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_auto
      FROM limit_approval_requests
      WHERE user_id = ? AND LOWER(status) = 'approved' AND for_month = ?
    `).bind(targetUser.user_id, monthStr).first(),
    env.DB.prepare(`SELECT * FROM limit_approval_requests WHERE user_id = ? AND for_month = ?`
    ).bind(targetUser.user_id, monthStr).all(),
    env.DB.prepare(`SELECT * FROM allowance_master WHERE grade = ?`).bind(gradeToLookup).first(),
    env.DB.prepare(`SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1`).first(),
    env.DB.prepare(`SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1`).first(),
    env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) IN ('bike', 'car') THEN COALESCE(i.distance_km, 0.0) ELSE 0.0 END) as total_km,
        SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) = 'auto' THEN COALESCE(i.travel_amount, 0.0) ELSE 0.0 END) +
        SUM(CASE WHEN LOWER(TRIM(i.sub_mode)) = 'auto' THEN COALESCE(i.sub_amount, 0.0) ELSE 0.0 END) as total_auto
      FROM expense_itineraries i
      JOIN expenses e ON i.exp_id = e.expense_code
      WHERE e.user_id = ? AND e.month = ? AND e.year = ? AND e.status NOT IN ('rejected', 'returned_to_draft')
    `).bind(targetUser.id, monthName, yearVal).first()
  ]);

  // Build facilities map
  const facilities = {};
  for (const f of (facilitiesRows.results || [])) {
    if (!facilities[f.district_name]) facilities[f.district_name] = [];
    facilities[f.district_name].push(f.facility_name);
  }

  const submittedDates = (submittedRows.results || []).map(r => r.itinerary).filter(Boolean);

  const approvedKm = limits?.approved_km || 0.0;
  const approvedAuto = limits?.approved_auto || 0.0;

  const kmReqs = (limitReqs.results || []).filter(r => r.request_type === "KM").sort((a, b) => b.id - a.id);
  const autoReqs = (limitReqs.results || []).filter(r => r.request_type === "AUTO").sort((a, b) => b.id - a.id);
  const existingKmReq = kmReqs.length > 0 ? { status: kmReqs[0].status, requested_value: kmReqs[0].requested_value } : null;
  const existingAutoReq = autoReqs.length > 0 ? { status: autoReqs[0].status, requested_value: autoReqs[0].requested_value } : null;

  const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
  const fallbackCarRate = defaultCar?.rate_per_km || 9.0;

  let allowanceDict = {
    daily_in_district: allowance?.daily_in_district ?? 150,
    daily_out_district: allowance?.daily_out_district ?? 200,
    daily_hotel: allowance?.daily_hotel ?? 300,
    daily_out_state: allowance?.daily_out_state ?? 400,
    hotel_in_state_s: allowance?.hotel_in_state_s ?? 1000,
    hotel_out_state_s: allowance?.hotel_out_state_s ?? 2000,
    max_km_per_month: allowance?.max_km_per_month ?? 2000,
    rate_bike: allowance?.vehicle_type === "Bike" ? allowance?.rate_per_km : fallbackBikeRate,
    rate_car: allowance?.vehicle_type === "Car" ? allowance?.rate_per_km : fallbackCarRate,
    vehicle_type: allowance?.vehicle_type ?? "Bike"
  };

  allowanceDict.current_month_km = statsRes?.total_km || 0.0;
  allowanceDict.current_month_auto = statsRes?.total_auto || 0.0;
  allowanceDict.max_auto_per_month = 1000;

  const mm = String(monthInt).padStart(2, "0");
  const yy = String(yearVal).substring(2);

  return {
    success: true,
    user: {
      full_name: targetUser.name,
      e_code: targetUser.user_id,
      grade: targetUser.grade,
      home_district: targetUser.district || "Jodhpur",
      level_first_approver: targetUser.manager || "Admin",
      level_second_approver: targetUser.zonal_manager || "Admin"
    },
    allowance: allowanceDict,
    facilities,
    submitted_dates: submittedDates,
    approved_km: approvedKm,
    approved_auto: approvedAuto,
    existing_km_req: existingKmReq,
    existing_auto_req: existingAutoReq,
    next_exp_id: `RJ-${mm}/${yy}-PENDING`
  };
}

/**
 * GET /api/expense/init
 */
export async function handleExpenseInit(request, env, params, query, user) {
  const targetUserId = query.get("user_id") || user.user_id;
  const monthStr = query.get("month"); // Format: YYYY-MM
  if (!monthStr) return jsonResponse({ error: "month parameter is required" }, 400);

  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(targetUserId).first();
  if (!targetUser) return jsonResponse({ error: "User not found" }, 404);

  const data = await getExpenseInitData(env, targetUser, monthStr);
  return jsonResponse(data);
}

/**
 * POST /api/expense/limit-request
 */
export async function handleCreateLimitRequest(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, type, amount, month } = body;
  if (!user_id || !type || !amount || !month) {
    return jsonResponse({ error: "Missing required parameters: user_id, type, amount, month" }, 400);
  }

  const timestamp = new Date().toISOString();
  
  // Find manager from user profile
  const requester = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
  if (!requester) return jsonResponse({ error: "Requester not found" }, 404);

  // We find their coordinator or zonal manager to assign
  const managerName = requester.manager || requester.zonal_manager || requester.coordinator;
  let managerId = "Admin"; // Default fallback

  if (managerName && managerName !== "None") {
    // Look up manager's user_id by name
    const mgrUser = await env.DB.prepare("SELECT user_id FROM users WHERE LOWER(TRIM(name)) = ?").bind(managerName.trim().toLowerCase()).first();
    if (mgrUser) {
      managerId = mgrUser.user_id;
    }
  }

  await runWrite(env, `
    INSERT INTO limit_approval_requests (user_id, request_type, requested_value, status, for_month, manager_id, created_at, updated_at)
    VALUES (?, ?, ?, 'Pending', ?, ?, ?, ?)
  `, [user_id, type, amount, month, managerId, timestamp, timestamp]);

  // Notify manager
  await runWrite(env, `
    INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
    VALUES (?, '📥 New Limit Request', ?, 'warning', 0, '/approval-center', ?)
  `, [
    managerId,
    `${requester.name} has requested extra ${amount} ${type} limit for ${month}.`,
    timestamp
  ]);

  return jsonResponse({ status: "success", message: "Limit request raised successfully." });
}

/**
 * GET /api/expense/team
 */
export async function handleGetTeamExpenses(request, env, params, query, user) {
  const month = query.get("month");
  console.log("DEBUG: handleGetTeamExpenses user =", JSON.stringify(user));

  const allowedWindows = user.allowed_windows ? user.allowed_windows.split(",").map(w => w.trim().toLowerCase()) : [];
  
  // 1. Fetch team users
  let teamUsers = [];
  const userRoleClean = (user.role || "").trim().toLowerCase();
  const isAdminOrReportViewer = ["admin", "mis", "vp", "accountant"].includes(userRoleClean);

  if (isAdminOrReportViewer) {
    const res = await env.DB.prepare("SELECT * FROM users").all();
    teamUsers = res.results || [];
    console.log("DEBUG: fetched all users, count =", teamUsers.length);
  } else {
    const nameClean = (user.name || "").trim();
    const uidClean = (user.user_id || "").trim();

    // Query direct reports
    const directReportsRes = await env.DB.prepare(`
      SELECT * FROM users
      WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
         OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
    `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all();
    const directReports = directReportsRes.results || [];

    // Query hierarchy reports
    const hierarchyApprovals = await env.DB.prepare(`
      SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
    `).bind(user.id).all();
    
    let hierarchyReports = [];
    if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
      const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
      const placeholders = hIds.map(() => "?").join(",");
      const reqsRes = await env.DB.prepare(`
        SELECT u.* FROM users u
        JOIN hierarchy_requesters hr ON u.id = hr.user_id
        WHERE hr.hierarchy_id IN (${placeholders})
      `).bind(...hIds).all();
      hierarchyReports = reqsRes.results || [];
    }

    // Merge and de-duplicate team users
    const reportsMap = {};
    for (const u of [...directReports, ...hierarchyReports]) {
      reportsMap[u.id] = u;
    }
    teamUsers = Object.values(reportsMap);
  }

  if (teamUsers.length === 0) return jsonResponse([]);

  const teamUserIds = isAdminOrReportViewer
    ? teamUsers.map(u => u.id)
    : teamUsers.map(u => u.id).filter(id => id !== user.id);
  console.log("DEBUG: teamUserIds =", JSON.stringify(teamUserIds));
  if (teamUserIds.length === 0) return jsonResponse([]);

  const submittersById = {};
  for (const u of teamUsers) {
    submittersById[u.id] = u;
  }

  // 2. Fetch expenses of team members
  let querySql = "";
  let binds = [];

  if (isAdminOrReportViewer) {
    querySql = "SELECT * FROM expenses WHERE 1=1";
    // Default to current month to avoid loading entire expense history
    if (!month) {
      const now = new Date();
      querySql += " AND year = ? AND month = ?";
      binds.push(now.getFullYear(), MONTH_NAMES[now.getMonth()]);
    }
  } else {
    const placeholders = teamUserIds.map(() => "?").join(",");
    querySql = `SELECT * FROM expenses WHERE user_id IN (${placeholders})`;
    binds = [...teamUserIds];
  }

  if (month) {
    if (month.includes("-") && month.length === 7) {
      const parts = month.split("-");
      const yr = parseInt(parts[0], 10);
      const monNum = parseInt(parts[1], 10);
      const monName = MONTH_NAMES[monNum - 1];

      querySql += " AND year = ? AND month = ?";
      binds.push(yr, monName);
    } else {
      querySql += " AND LOWER(month) LIKE ?";
      binds.push(`%${month.toLowerCase()}%`);
    }
  } else if (!isAdminOrReportViewer) {
    // Non-admin without month param: default to current month
    const now = new Date();
    querySql += " AND year = ? AND month = ?";
    binds.push(now.getFullYear(), MONTH_NAMES[now.getMonth()]);
  }

  querySql += " ORDER BY created_at DESC";
  console.log("DEBUG: querySql =", querySql, "binds =", JSON.stringify(binds));

  const expensesRows = await env.DB.prepare(querySql).bind(...binds).all();
  const expenses = expensesRows.results || [];
  console.log("DEBUG: fetched expenses count =", expenses.length);

  // Fetch legs & serialize team expenses
  const result = [];
  if (expenses.length > 0) {
    const expenseCodes = expenses.map(e => e.expense_code).filter(Boolean);
    let allLegs = [];
    if (expenseCodes.length > 0) {
      allLegs = await queryInChunks(env.DB, "SELECT * FROM expense_itineraries WHERE exp_id IN (?)", expenseCodes);
    }

    const legsByCode = {};
    for (const l of allLegs) {
      if (!legsByCode[l.exp_id]) legsByCode[l.exp_id] = [];
      legsByCode[l.exp_id].push(l);
    }

    for (const exp of expenses) {
      const submitter = submittersById[exp.user_id] || null;
      const legs = legsByCode[exp.expense_code] || [];

      const totKm = legs
        .filter(l => ["bike", "car"].includes((l.travel_mode || "").trim().toLowerCase()))
        .reduce((sum, l) => sum + (parseFloat(l.distance_km) || 0.0), 0.0);

      const totAuto = legs
        .filter(l => (l.travel_mode || "").trim().toLowerCase() === "auto")
        .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0) +
        legs
        .filter(l => (l.sub_mode || "").trim().toLowerCase() === "auto")
        .reduce((sum, l) => sum + (parseFloat(l.sub_amount) || 0.0), 0.0);

      const bikeAmount = legs
        .filter(l => (l.travel_mode || "").trim().toLowerCase() === "bike")
        .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0);

      const carAmount = legs
        .filter(l => (l.travel_mode || "").trim().toLowerCase() === "car")
        .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0);

      const totCallsAssigned = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.calls_assigned) || 0), 0)
        : (parseInt(exp.calls_assigned) || 0);

      const totCallsCompleted = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.calls_completed) || 0), 0)
        : (parseInt(exp.calls_completed) || 0);

      const totPmsCount = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.pms_count) || 0), 0)
        : (parseInt(exp.pms_count) || 0);

      const totAssetTagging = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.asset_tagging) || 0), 0)
        : (parseInt(exp.asset_tagging) || 0);

      const totCalibrationCount = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.calibration_count) || 0), 0)
        : (parseInt(exp.calibration_count) || 0);

      const totMobiliseCount = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.mobilise_count) || 0), 0)
        : (parseInt(exp.mobilise_count) || 0);

      result.push({
        id: exp.id,
        expense_code: exp.expense_code,
        submitter_name: submitter?.name || "Unknown",
        submitter_code: submitter?.user_id || "N/A",
        submitter_designation: submitter?.designation || "Engineer",
        month: exp.month,
        year: exp.year,
        amount: parseFloat(exp.amount || 0),
        status: exp.status,
        category: exp.travel_mode,
        date: exp.itinerary,
        purpose: exp.description || "",
        created_at: exp.created_at,
        total_km: totKm,
        total_auto: totAuto,
        bike_amount: bikeAmount,
        car_amount: carAmount,
        auto_amount: totAuto,
        da_amount: parseFloat(exp.da_amount || 0.0),
        hotel_amount: parseFloat(exp.hotel_amount || 0.0),
        other_expense_amount: parseFloat(exp.other_expense_amount || 0.0),
        local_purchase_amount: parseFloat(exp.local_purchase_amount || 0.0),
        district: submitter?.district || "Ganganar",
        zone: submitter?.zone || "Bikaner",
        calls_assigned: totCallsAssigned,
        calls_completed: totCallsCompleted,
        pms_count: totPmsCount,
        asset_tagging: totAssetTagging,
        calibration_count: totCalibrationCount,
        mobilise_count: totMobiliseCount
      });
    }
  }

  // 3. Fetch team members' limit requests
  const teamUserCodes = isAdminOrReportViewer
    ? teamUsers.map(u => u.user_id)
    : teamUsers.map(u => u.user_id).filter(uc => uc !== user.user_id);
  if (teamUserCodes.length > 0) {
    const codePlaceholders = teamUserCodes.map(() => "?").join(",");
    const limitReqsRes = await env.DB.prepare(`
      SELECT * FROM limit_approval_requests WHERE user_id IN (${codePlaceholders})
    `).bind(...teamUserCodes).all();

    for (const pl of (limitReqsRes.results || [])) {
      const submitter = teamUsers.find(u => u.user_id === pl.user_id);
      if (!submitter) continue;

      let monthName = "N/A";
      let yearVal = new Date().getFullYear();
      if (pl.for_month && pl.for_month.includes("-")) {
        try {
          const parts = pl.for_month.split("-");
          yearVal = parseInt(parts[0], 10);
          const monNum = parseInt(parts[1], 10);
          monthName = MONTH_NAMES[monNum - 1];
        } catch (e) {}
      }

      const reqDate = pl.created_at ? pl.created_at.substring(0, 10) : pl.for_month;

      result.push({
        id: -pl.id,
        expense_code: `LIMIT-${pl.request_type}-${pl.id}`,
        submitter_name: submitter.name,
        submitter_code: pl.user_id,
        submitter_designation: submitter.designation || "Engineer",
        month: monthName,
        year: yearVal,
        amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value || 0) : 0.0,
        status: pl.status.toLowerCase(),
        category: "Limit Request",
        travel_mode: pl.request_type,
        date: reqDate,
        purpose: `Limit Extension Request: +${parseFloat(pl.requested_value || 0).toFixed(1)} ${pl.request_type}`,
        created_at: pl.created_at,
        total_km: pl.request_type === "KM" ? parseFloat(pl.requested_value || 0) : 0.0,
        total_auto: pl.request_type === "AUTO" ? parseFloat(pl.requested_value || 0) : 0.0,
        bike_amount: 0.0,
        car_amount: 0.0,
        auto_amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value || 0) : 0.0,
        da_amount: 0.0,
        hotel_amount: 0.0,
        other_expense_amount: 0.0,
        local_purchase_amount: 0.0,
        district: submitter.district || "Ganganar",
        zone: submitter.zone || "Bikaner"
      });
    }
  }

  // Sort result by created_at desc
  result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return jsonResponse(result);
}

export async function handleVerifyBarcode(request, env, params, query, user) {
  const barcode = query.get("barcode");
  if (!barcode) return jsonResponse({ error: "barcode parameter is required" }, 400);

  const hospital = query.get("hospital");
  const barcode8 = barcode.length >= 8 ? barcode.slice(-8) : barcode;

  if (hospital) {
    const queryResult = await runRead(env, `
      SELECT * FROM assets_inventory 
      WHERE (LOWER(SUBSTR(qr_code, -8)) = LOWER(?) 
         OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?) 
         OR LOWER(qr_code) = LOWER(?) 
         OR LOWER(serial_no) = LOWER(?))
         AND LOWER(TRIM(hospital_name)) = LOWER(TRIM(?))
      LIMIT 1
    `, [barcode8, barcode8, barcode, barcode, hospital], request);

    const asset = queryResult && queryResult.results && queryResult.results[0] ? queryResult.results[0] : null;

    if (asset) {
      return jsonResponse({
        success: true,
        valid: true,
        asset_name: asset.equipment_name,
        hospital_name: asset.hospital_name,
        district_name: asset.district_name,
        serial_no: asset.serial_no,
        data: {
          district_name: asset.district_name,
          hospital_name: asset.hospital_name,
          equipment_name: asset.equipment_name,
          model_name: asset.model_name || "",
          qr_code: asset.qr_code,
          inventory_status: asset.inventory_status || "Active"
        }
      });
    }

    // Check if barcode exists anywhere in database
    const queryAnyResult = await runRead(env, `
      SELECT hospital_name FROM assets_inventory 
      WHERE LOWER(SUBSTR(qr_code, -8)) = LOWER(?) 
         OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?) 
         OR LOWER(qr_code) = LOWER(?) 
         OR LOWER(serial_no) = LOWER(?) 
      LIMIT 1
    `, [barcode8, barcode8, barcode, barcode], request);

    const anyAsset = queryAnyResult && queryAnyResult.results && queryAnyResult.results[0] ? queryAnyResult.results[0] : null;

    if (anyAsset) {
      return jsonResponse({ success: false, valid: false, message: "This barcode was not fetched for this hospital." });
    } else {
      return jsonResponse({ success: false, valid: false, message: "Asset QR/Serial number not found in master database." });
    }
  } else {
    const queryResult = await runRead(env, `
      SELECT * FROM assets_inventory 
      WHERE LOWER(SUBSTR(qr_code, -8)) = LOWER(?) 
         OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?) 
         OR LOWER(qr_code) = LOWER(?) 
         OR LOWER(serial_no) = LOWER(?) 
      LIMIT 1
    `, [barcode8, barcode8, barcode, barcode], request);

    const asset = queryResult && queryResult.results && queryResult.results[0] ? queryResult.results[0] : null;

    if (!asset) {
      return jsonResponse({ success: false, valid: false, message: "Asset QR/Serial number not found in master database." });
    }

    return jsonResponse({
      success: true,
      valid: true,
      asset_name: asset.equipment_name,
      hospital_name: asset.hospital_name,
      district_name: asset.district_name,
      serial_no: asset.serial_no,
      data: {
        district_name: asset.district_name,
        hospital_name: asset.hospital_name,
        equipment_name: asset.equipment_name,
        model_name: asset.model_name || "",
        qr_code: asset.qr_code,
        inventory_status: asset.inventory_status || "Active"
      }
    });
  }
}

/**
 * GET /api/expense/asset-value-master
 */
export async function handleGetAssetValueMaster(request, env, params, query, user) {
  try {
    // Try querying the dedicated asset_value_master table first
    const result = await env.DB.prepare(`
      SELECT DISTINCT equipment_name, CAST(rmsc_tender_cost AS REAL) as asset_value 
      FROM asset_value_master 
      ORDER BY equipment_name ASC
    `).all();
    if (result.results && result.results.length > 0) {
      return jsonResponse(result.results);
    }
  } catch (e) {
    console.warn("Failed to query asset_value_master table, falling back to assets_inventory:", e.message);
  }

  // Fallback 1: Query assets_inventory using parsed_asset_value
  try {
    const result = await env.DB.prepare(`
      SELECT DISTINCT equipment_name, CAST(parsed_asset_value AS REAL) as asset_value 
      FROM assets_inventory 
      WHERE parsed_asset_value IS NOT NULL AND parsed_asset_value > 0
      ORDER BY equipment_name ASC
    `).all();
    return jsonResponse(result.results || []);
  } catch (e) {
    console.warn("Failed to query parsed_asset_value, falling back to asset_value replacement casting:", e.message);
    
    // Fallback 2: Query assets_inventory using asset_value
    try {
      const result = await env.DB.prepare(`
        SELECT DISTINCT equipment_name, CAST(REPLACE(REPLACE(asset_value, ',', ''), '₹', '') AS REAL) as asset_value 
        FROM assets_inventory 
        WHERE asset_value IS NOT NULL AND asset_value != '' AND asset_value != '0'
        ORDER BY equipment_name ASC
      `).all();
      return jsonResponse(result.results || []);
    } catch (err) {
      console.error("All asset master queries failed:", err.message);
      return jsonResponse([]);
    }
  }
}

/**
 * GET /api/expense/:id
 */
export async function getUserMonthlyStatsHelper(env, userDbId, month, year, excludeDate = null) {
  let monthStr = String(month).trim();
  let yearVal = year ? parseInt(year, 10) : null;

  if (monthStr.includes("-")) {
    const parts = monthStr.split("-");
    if (parts.length >= 2) {
      try {
        const y = parseInt(parts[0], 10);
        const mNum = parseInt(parts[1], 10);
        monthStr = MONTH_NAMES[mNum - 1];
        yearVal = y;
      } catch (e) {}
    }
  } else if (/^\d+$/.test(monthStr)) {
    try {
      const mNum = parseInt(monthStr, 10);
      monthStr = MONTH_NAMES[mNum - 1];
    } catch (e) {}
  } else {
    monthStr = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).toLowerCase();
  }

  let querySql = `
    SELECT * FROM expenses 
    WHERE user_id = ? AND month = ? AND year = ? AND LOWER(status) NOT IN ('draft', 'rejected', 'returned_to_draft')
  `;
  const binds = [userDbId, monthStr, yearVal];

  if (excludeDate) {
    querySql += " AND itinerary < ?";
    binds.push(excludeDate);
  }

  const res = await env.DB.prepare(querySql).bind(...binds).all();
  const expenses = res.results || [];

  const approvedExpCodes = expenses
    .filter(e => e.expense_code && e.status && ["approved", "partially_approved"].includes(e.status.trim().toLowerCase()))
    .map(e => e.expense_code);

  const allExpCodes = expenses
    .filter(e => e.expense_code)
    .map(e => e.expense_code);

  let approvedLegs = [];
  if (approvedExpCodes.length > 0) {
    const placeholders = approvedExpCodes.map(() => "?").join(",");
    const legsRes = await env.DB.prepare(`
      SELECT * FROM expense_itineraries WHERE exp_id IN (${placeholders})
    `).bind(...approvedExpCodes).all();
    approvedLegs = legsRes.results || [];
  }

  let allLegs = [];
  if (allExpCodes.length > 0) {
    const placeholders = allExpCodes.map(() => "?").join(",");
    const legsRes = await env.DB.prepare(`
      SELECT * FROM expense_itineraries WHERE exp_id IN (${placeholders})
    `).bind(...allExpCodes).all();
    allLegs = legsRes.results || [];
  }

  function getLegStats(leg) {
    let legCalls = leg.calls_completed || 0;
    let legPms = leg.pms_count || 0;
    let legAsset = leg.asset_tagging || 0;
    let legMobilise = leg.mobilise_count || 0;
    let legCalibration = leg.calibration_count || 0;

    if (leg.activity_details) {
      try {
        const act = JSON.parse(leg.activity_details);
        if (act && typeof act === "object") {
          const selectedActs = act.selected_activities || [];
          if (selectedActs.includes("Calls")) {
            const list = act.calls_list || [];
            legCalls = list.filter(c => c && typeof c === "object" && c.barcode).length;
          }
          if (selectedActs.includes("PMS")) {
            const list = act.pms_list || [];
            legPms = list.filter(p => p && typeof p === "object" && p.barcode).length;
          }
          if (selectedActs.includes("Asset Tagging")) {
            const list = act.assets_list || [];
            let sumQty = 0;
            for (const item of list) {
              if (item && typeof item === "object") {
                sumQty += parseInt(item.quantity || 0, 10) || 0;
              }
            }
            legAsset = sumQty;
          }
          if (act.mobilise_asset_count !== undefined) {
            legMobilise = parseInt(act.mobilise_asset_count, 10) || 0;
          }
          if (act.calibration_count !== undefined) {
            legCalibration = parseInt(act.calibration_count, 10) || 0;
          }
        }
      } catch (e) {}
    }
    return [legCalls, legPms, legAsset, legMobilise, legCalibration];
  }

  // 1. Approved stats
  let approvedDa = 0.0;
  let approvedBikeKm = 0.0;
  let approvedAuto = 0.0;
  let approvedBus = 0.0;
  let approvedTrain = 0.0;
  let approvedHotel = 0.0;
  let approvedLocalPurchase = 0.0;
  let approvedKmUsed = 0.0;

  let approvedCalls = 0;
  let approvedPms = 0;
  let approvedAsset = 0;
  let approvedMobilise = 0;
  let approvedCalibration = 0;

  for (const leg of approvedLegs) {
    approvedDa += parseFloat(leg.da_amount || 0.0);
    approvedHotel += parseFloat(leg.hotel_amount || 0.0);
    approvedLocalPurchase += parseFloat(leg.local_purchase || 0.0);

    const mode = (leg.travel_mode || "").trim().toLowerCase();
    if (mode === "bike") {
      approvedBikeKm += parseFloat(leg.distance_km || 0.0);
      approvedKmUsed += parseFloat(leg.distance_km || 0.0);
    } else if (mode === "car") {
      approvedKmUsed += parseFloat(leg.distance_km || 0.0);
    } else if (mode === "auto") {
      approvedAuto += parseFloat(leg.travel_amount || 0.0);
    } else if (mode === "bus") {
      approvedBus += parseFloat(leg.travel_amount || 0.0);
    } else if (mode === "train") {
      approvedTrain += parseFloat(leg.travel_amount || 0.0);
    }

    const subMode = (leg.sub_mode || "").trim().toLowerCase();
    if (subMode === "auto") {
      approvedAuto += parseFloat(leg.sub_amount || 0.0);
    } else if (subMode === "bus") {
      approvedBus += parseFloat(leg.sub_amount || 0.0);
    } else if (subMode === "train") {
      approvedTrain += parseFloat(leg.sub_amount || 0.0);
    }

    const [legCalls, legPms, legAsset, legMobilise, legCalibration] = getLegStats(leg);
    approvedCalls += legCalls;
    approvedPms += legPms;
    approvedAsset += legAsset;
    approvedMobilise += legMobilise;
    approvedCalibration += legCalibration;
  }

  // 2. Claimed stats
  let claimedDa = 0.0;
  let claimedBikeKm = 0.0;
  let claimedAuto = 0.0;
  let claimedBus = 0.0;
  let claimedTrain = 0.0;
  let claimedHotel = 0.0;
  let claimedLocalPurchase = 0.0;
  let claimedKmUsed = 0.0;

  let claimedCalls = 0;
  let claimedPms = 0;
  let claimedAsset = 0;
  let claimedMobilise = 0;
  let claimedCalibration = 0;

  for (const leg of allLegs) {
    const origDa = (leg.original_da_amount !== null && leg.original_da_amount > 0) ? parseFloat(leg.original_da_amount) : parseFloat(leg.da_amount || 0.0);
    const origHotel = (leg.original_hotel_amount !== null && leg.original_hotel_amount > 0) ? parseFloat(leg.original_hotel_amount) : parseFloat(leg.hotel_amount || 0.0);
    const origLp = (leg.original_local_purchase !== null && leg.original_local_purchase > 0) ? parseFloat(leg.original_local_purchase) : parseFloat(leg.local_purchase || 0.0);

    claimedDa += origDa;
    claimedHotel += origHotel;
    claimedLocalPurchase += origLp;

    const mode = (leg.travel_mode || "").trim().toLowerCase();
    const origKm = (leg.original_distance_km !== null && leg.original_distance_km > 0) ? parseFloat(leg.original_distance_km) : parseFloat(leg.distance_km || 0.0);
    const origTravelAmt = (leg.original_travel_amount !== null && leg.original_travel_amount > 0) ? parseFloat(leg.original_travel_amount) : parseFloat(leg.travel_amount || 0.0);

    if (mode === "bike") {
      claimedBikeKm += origKm;
      claimedKmUsed += origKm;
    } else if (mode === "car") {
      claimedKmUsed += origKm;
    } else if (mode === "auto") {
      claimedAuto += origTravelAmt;
    } else if (mode === "bus") {
      claimedBus += origTravelAmt;
    } else if (mode === "train") {
      claimedTrain += origTravelAmt;
    }

    const origSubAmt = (leg.original_sub_amount !== null && leg.original_sub_amount > 0) ? parseFloat(leg.original_sub_amount) : parseFloat(leg.sub_amount || 0.0);
    const subMode = (leg.sub_mode || "").trim().toLowerCase();
    if (subMode === "auto") {
      claimedAuto += origSubAmt;
    } else if (subMode === "bus") {
      claimedBus += origSubAmt;
    } else if (subMode === "train") {
      claimedTrain += origSubAmt;
    }

    const [legCalls, legPms, legAsset, legMobilise, legCalibration] = getLegStats(leg);
    claimedCalls += legCalls;
    claimedPms += legPms;
    claimedAsset += legAsset;
    claimedMobilise += legMobilise;
    claimedCalibration += legCalibration;
  }

  return {
    km_used_so_far_approved: approvedKmUsed,
    km_used_so_far_claimed: claimedKmUsed,
    total_da_approved: approvedDa,
    total_da_claimed: claimedDa,
    total_bike_km_approved: approvedBikeKm,
    total_bike_km_claimed: claimedBikeKm,
    total_auto_approved: approvedAuto,
    total_auto_claimed: claimedAuto,
    total_bus_approved: approvedBus,
    total_bus_claimed: claimedBus,
    total_train_approved: approvedTrain,
    total_train_claimed: claimedTrain,
    total_hotel_approved: approvedHotel,
    total_hotel_claimed: claimedHotel,
    total_local_purchase_approved: approvedLocalPurchase,
    total_local_purchase_claimed: claimedLocalPurchase,
    calls_completed_approved: approvedCalls,
    calls_completed_claimed: claimedCalls,
    pms_count_approved: approvedPms,
    pms_count_claimed: claimedPms,
    asset_tagging_approved: approvedAsset,
    asset_tagging_claimed: claimedAsset,
    mobilise_count_approved: approvedMobilise,
    mobilise_count_claimed: claimedMobilise,
    calibration_count_approved: approvedCalibration,
    calibration_count_claimed: claimedCalibration,
    
    // Legacy backward-compatible keys
    km_used_so_far: claimedKmUsed,
    total_da: approvedDa,
    total_bike_km: approvedBikeKm,
    total_auto: approvedAuto,
    total_bus: approvedBus,
    total_train: approvedTrain,
    total_hotel: approvedHotel,
    total_local_purchase: approvedLocalPurchase,
    calls_completed: approvedCalls,
    pms_count: approvedPms,
    asset_tagging: approvedAsset,
    mobilise_count: approvedMobilise,
    calibration_count: approvedCalibration
  };
}

/**
 * GET /api/expense/:id
 */
export async function handleGetExpenseDetails(request, env, params, query, user) {
  const expenseId = params.id;

  if (expenseId.startsWith("-")) {
    const val = parseInt(expenseId, 10);
    if (val <= -200000) {
      // Legacy expense_master claim!
      try {
        const allRows = await env.DB.prepare("SELECT exp_id FROM expense_master").all();
        let matchingExpId = null;
        for (const row of (allRows.results || [])) {
          const hashId = await getLegacyExpenseHashId(row.exp_id);
          if (hashId === val) {
            matchingExpId = row.exp_id;
            break;
          }
        }

        if (!matchingExpId) return jsonResponse({ error: "Legacy claim not found" }, 404);

        const masterRow = await env.DB.prepare(`
          SELECT * FROM expense_master WHERE exp_id = ?
        `).bind(matchingExpId).first();
        if (!masterRow) return jsonResponse({ error: "Legacy claim details not found" }, 404);

        const submitter = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(masterRow.user_id).first();
        
        let rateBike = 4.5;
        let rateCar = 9.0;
        if (submitter) {
          const gradeToLookup = (submitter.designation || "").toLowerCase().includes("specialist") ? "O1" : (submitter.grade || "O1");
          const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
          const defaultBike = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1").first();
          const defaultCar = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1").first();
          const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
          const fallbackCarRate = defaultCar?.rate_per_km || 9.0;

          if (allowance) {
            rateBike = allowance.vehicle_type === "Bike" ? allowance.rate_per_km : fallbackBikeRate;
            rateCar = allowance.vehicle_type === "Car" ? allowance.rate_per_km : fallbackCarRate;
          } else {
            rateBike = fallbackBikeRate;
            rateCar = fallbackCarRate;
          }
        }

        const itiRows = await env.DB.prepare(`
          SELECT * FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number
        `).bind(matchingExpId).all();

        const itinerariesList = (itiRows.results || []).map(r => ({
          leg: r.leg_number,
          from_district: r.from_district,
          to_district: r.to_district,
          from: r.from_location || "",
          to: r.to_location || "",
          mode: r.travel_mode,
          km: parseFloat(r.distance_km || 0.0),
          amount: parseFloat(r.travel_amount || 0.0),
          sub_mode: r.sub_mode || "",
          sub_amount: parseFloat(r.sub_amount || 0.0),
          da: parseFloat(r.da_amount || 0.0),
          hotel: parseFloat(r.hotel_amount || 0.0),
          local_purchase: 0.0,
          oth_desc: r.other_desc || "",
          oth_amount: parseFloat(r.other_amount || 0.0),
          ws_assigned: r.calls_assigned || 0,
          calls_assigned: r.calls_assigned || 0,
          ws_closed: r.calls_completed || 0,
          calls_completed: r.calls_completed || 0,
          ws_pms: r.pms_count || 0,
          pms_count: r.pms_count || 0,
          ws_asset: r.asset_tagging || 0,
          asset_tagging: r.asset_tagging || 0,
          calibration_count: 0,
          mobilise_count: 0,
          mobilise_asset_count: 0,
          visit_purpose: r.visit_purpose || "",
          activity_details: "",
          original_km: parseFloat(r.distance_km || 0.0),
          original_amount: parseFloat(r.travel_amount || 0.0),
          original_sub_amount: parseFloat(r.sub_amount || 0.0),
          original_da: parseFloat(r.da_amount || 0.0),
          original_hotel: parseFloat(r.hotel_amount || 0.0),
          original_oth_amount: parseFloat(r.other_amount || 0.0),
          original_local_purchase: 0.0
        }));

        const attRows = await env.DB.prepare(`
          SELECT file_url, itinerary_id, bill_type FROM expense_attachments WHERE exp_id = ?
        `).bind(matchingExpId).all();
        const attachmentsList = (attRows.results || []).map(r => r.file_url);
        const attachmentsDetailed = (attRows.results || []).map(r => ({
          file_url: r.file_url,
          itinerary_id: r.itinerary_id,
          bill_type: r.bill_type
        }));

        // Mock approvals list
        const approvalsList = [];
        const l1App = masterRow.level_first_approver;
        const l2App = masterRow.level_second_approver;
        const statusVal = masterRow.status;
        const approvedBy = masterRow.approved_by;

        const l1User = l1App ? await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(l1App).first() : null;
        const l2User = l2App ? await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(l2App).first() : null;

        const l1Status = ["Pending L2", "Approved"].includes(statusVal) ? "approved" : ((statusVal === "Rejected" && approvedBy === "L1") ? "rejected" : "pending");
        approvalsList.push({
          id: val,
          level_number: 1,
          approver_name: l1User?.name || l1App || "N/A",
          approver_code: l1App || "",
          approver_role: l1User?.role || "Manager",
          status: l1Status,
          comments: (statusVal === "Rejected" && approvedBy === "L1") ? (masterRow.reject_reason || "") : "",
          updated_at: masterRow.created_at
        });

        if (l2App) {
          const l2Status = statusVal === "Approved" ? "approved" : ((statusVal === "Rejected" && approvedBy === "L2") ? "rejected" : (statusVal === "Pending L2" ? "pending" : "waiting"));
          approvalsList.push({
            id: val - 1,
            level_number: 2,
            approver_name: l2User?.name || l2App || "N/A",
            approver_code: l2App || "",
            approver_role: l2User?.role || "HOD",
            status: l2Status,
            comments: (statusVal === "Rejected" && approvedBy === "L2") ? (masterRow.reject_reason || "") : "",
            updated_at: masterRow.created_at
          });
        }

        const dateStr = masterRow.expense_date;
        let monthName = "January";
        let yearVal = new Date().getFullYear();
        if (dateStr) {
          try {
            const parts = dateStr.split("-");
            yearVal = parseInt(parts[0], 10);
            const monNum = parseInt(parts[1], 10);
            monthName = MONTH_NAMES[monNum - 1];
          } catch (e) {}
        }

        const monthlyStats = await getUserMonthlyStatsHelper(env, submitter?.id || 0, monthName, yearVal, dateStr);

        return jsonResponse({
          id: val,
          expense_code: matchingExpId,
          user_id: submitter?.id || 0,
          submitter_name: submitter?.name || masterRow.user_id,
          submitter_code: masterRow.user_id,
          month: monthName,
          year: yearVal,
          amount: parseFloat(masterRow.total_amount || 0.0),
          status: statusVal === "Approved" ? "approved" : (statusVal === "Rejected" ? "rejected" : "submitted"),
          category: itinerariesList[0]?.mode || "Travel",
          date: dateStr,
          purpose: masterRow.visit_purpose || "",
          original_amount: parseFloat(masterRow.original_amount || masterRow.total_amount || 0.0),
          original_da_amount: parseFloat(masterRow.da_amount || 0.0),
          original_hotel_amount: parseFloat(masterRow.hotel_amount || 0.0),
          original_other_expense_amount: parseFloat(masterRow.other_expense_amount || 0.0),
          original_local_purchase_amount: parseFloat(masterRow.local_purchase_amount || 0.0),
          attachments: attachmentsList,
          attachments_detailed: attachmentsDetailed,
          itineraries: itinerariesList,
          created_at: masterRow.created_at,
          updated_at: masterRow.created_at,
          approvals: approvalsList,
          edit_history: [],
          user_monthly_stats: monthlyStats,
          rate_bike: rateBike,
          rate_car: rateCar
        });
      } catch (e) {
        return jsonResponse({ error: "Legacy table query failed: " + e.message }, 500);
      }
    }

    // Limit approval request
    const limitId = -val;
    const pl = await env.DB.prepare("SELECT * FROM limit_approval_requests WHERE id = ?").bind(limitId).first();
    if (!pl) return jsonResponse({ error: "Limit request not found" }, 404);

    const submitter = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(pl.user_id).first();
    
    let limitYear = new Date().getFullYear();
    if (pl.for_month && pl.for_month.includes("-")) {
      limitYear = parseInt(pl.for_month.split("-")[0], 10);
    }

    let rateBike = 4.5;
    let rateCar = 9.0;
    if (submitter) {
      const gradeToLookup = (submitter.designation || "").toLowerCase().includes("specialist") ? "O1" : (submitter.grade || "O1");
      const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
      const defaultBike = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1").first();
      const defaultCar = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1").first();
      const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
      const fallbackCarRate = defaultCar?.rate_per_km || 9.0;

      if (allowance) {
        rateBike = allowance.vehicle_type === "Bike" ? allowance.rate_per_km : fallbackBikeRate;
        rateCar = allowance.vehicle_type === "Car" ? allowance.rate_per_km : fallbackCarRate;
      } else {
        rateBike = fallbackBikeRate;
        rateCar = fallbackCarRate;
      }
    }

    const monthlyStats = submitter ? await getUserMonthlyStatsHelper(env, submitter.id, pl.for_month, limitYear) : null;
    const managerUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(pl.manager_id).first();

    return jsonResponse({
      id: -pl.id,
      expense_code: `LIMIT-${pl.request_type}-${pl.id}`,
      user_id: submitter?.id || 0,
      submitter_name: submitter?.name || `Employee ${pl.user_id}`,
      submitter_code: pl.user_id,
      month: pl.for_month,
      year: limitYear,
      amount: pl.status === "Approved" ? (pl.approved_value !== null ? parseFloat(pl.approved_value) : (pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0.0)) : (pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0.0),
      requested_value: parseFloat(pl.requested_value),
      approved_value: pl.approved_value !== null ? parseFloat(pl.approved_value) : null,
      status: pl.status,
      category: "Limit Request",
      date: pl.for_month,
      purpose: `Request additional ${parseFloat(pl.requested_value).toFixed(1)} ${pl.request_type} limit extension for month ${pl.for_month}.`,
      original_amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0.0,
      original_da_amount: 0.0,
      original_hotel_amount: 0.0,
      original_other_expense_amount: 0.0,
      original_local_purchase_amount: 0.0,
      attachments: [],
      attachments_detailed: [],
      user_monthly_stats: monthlyStats,
      rate_bike: rateBike,
      rate_car: rateCar,
      itineraries: [
        {
          leg: 1,
          from_district: submitter?.district || "N/A",
          to_district: "N/A",
          from: "N/A",
          to: "N/A",
          mode: pl.request_type,
          km: pl.request_type === "KM" ? parseFloat(pl.requested_value) : 0.0,
          amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0.0,
          approved_km: (pl.status === "Approved" && pl.request_type === "KM") ? (pl.approved_value !== null ? parseFloat(pl.approved_value) : parseFloat(pl.requested_value)) : 0.0,
          approved_amount: (pl.status === "Approved" && pl.request_type === "AUTO") ? (pl.approved_value !== null ? parseFloat(pl.approved_value) : parseFloat(pl.requested_value)) : 0.0,
          sub_mode: "",
          sub_amount: 0.0,
          da: 0.0,
          hotel: 0.0,
          local_purchase: 0.0,
          oth_desc: "",
          oth_amount: 0.0,
          ws_assigned: 0,
          calls_assigned: 0,
          ws_closed: 0,
          calls_completed: 0,
          ws_pms: 0,
          pms_count: 0,
          ws_asset: 0,
          asset_tagging: 0,
          calibration_count: 0,
          mobilise_count: 0,
          mobilise_asset_count: 0,
          visit_purpose: `Request additional ${parseFloat(pl.requested_value).toFixed(1)} ${pl.request_type} limit extension for month ${pl.for_month}.`,
          activity_details: "",
          original_km: pl.request_type === "KM" ? parseFloat(pl.requested_value) : 0.0,
          original_amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0.0,
          original_sub_amount: 0.0,
          original_da: 0.0,
          original_hotel: 0.0,
          original_oth_amount: 0.0,
          original_local_purchase: 0.0
        }
      ],
      created_at: pl.created_at,
      updated_at: pl.updated_at,
      approvals: [
        {
          id: -pl.id,
          level_number: 1,
          approver_name: managerUser?.name || pl.manager_id,
          approver_code: pl.manager_id,
          approver_role: managerUser?.role || "Manager",
          status: pl.status.toLowerCase(),
          comments: "",
          updated_at: pl.updated_at
        }
      ],
      edit_history: []
    });
  }

  // Normal expense
  let expense = null;
  if (/^\d+$/.test(expenseId)) {
    expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ? OR expense_code = ?").bind(parseInt(expenseId, 10), expenseId).first();
  } else {
    expense = await env.DB.prepare("SELECT * FROM expenses WHERE expense_code = ?").bind(expenseId).first();
  }

  if (!expense) return jsonResponse({ error: "Expense claim not found" }, 404);

  const approvals = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? ORDER BY level_number").bind(expense.id).all();
  const approverIds = Array.from(new Set((approvals.results || []).map(a => a.approver_id)));
  
  let approverUsers = {};
  if (approverIds.length > 0) {
    const placeholders = approverIds.map(() => "?").join(",");
    const usersRes = await env.DB.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`).bind(...approverIds).all();
    for (const u of (usersRes.results || [])) {
      approverUsers[u.id] = u;
    }
  }

  const approvalsList = (approvals.results || []).map(a => {
    const approverUser = approverUsers[a.approver_id] || null;
    return {
      id: a.id,
      level_number: a.level_number,
      approver_name: approverUser?.name || `Approver ID ${a.approver_id}`,
      approver_code: approverUser?.user_id || "",
      approver_role: approverUser?.role || "",
      status: a.status,
      comments: a.comments || "",
      updated_at: a.updated_at
    };
  });

  const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
  
  let rateBike = 4.5;
  let rateCar = 9.0;
  if (submitter) {
    const gradeToLookup = (submitter.designation || "").toLowerCase().includes("specialist") ? "O1" : (submitter.grade || "O1");
    const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
    const defaultBike = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1").first();
    const defaultCar = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1").first();
    const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
    const fallbackCarRate = defaultCar?.rate_per_km || 9.0;

    if (allowance) {
      rateBike = allowance.vehicle_type === "Bike" ? allowance.rate_per_km : fallbackBikeRate;
      rateCar = allowance.vehicle_type === "Car" ? allowance.rate_per_km : fallbackCarRate;
    } else {
      rateBike = fallbackBikeRate;
      rateCar = fallbackCarRate;
    }
  }

  const itineraries = await env.DB.prepare("SELECT * FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC").bind(expense.expense_code).all();
  const attachments = await env.DB.prepare("SELECT * FROM expense_attachments WHERE exp_id = ?").bind(expense.expense_code).all();
  const editLogs = await env.DB.prepare("SELECT * FROM expense_edit_logs WHERE expense_id = ? ORDER BY created_at DESC").bind(expense.id).all();

  const editHistoryList = (editLogs.results || []).map(el => ({
    id: el.id,
    editor_name: el.editor_name,
    editor_role: el.editor_role,
    leg_number: el.leg_number,
    field_name: el.field_name,
    old_value: el.old_value,
    new_value: el.new_value,
    comment: el.comment || "",
    created_at: el.created_at
  }));

  const monthlyStats = await getUserMonthlyStatsHelper(env, expense.user_id, expense.month, expense.year, expense.itinerary);

  return jsonResponse({
    id: expense.id,
    expense_code: expense.expense_code,
    user_id: expense.user_id,
    submitter_name: submitter?.name || "",
    submitter_code: submitter?.user_id || "",
    month: expense.month,
    year: expense.year,
    amount: parseFloat(expense.amount || 0.0),
    status: expense.status,
    category: expense.travel_mode,
    date: expense.itinerary,
    purpose: expense.description || "",
    ai_analysis: expense.ai_analysis || null,
    is_anomaly: expense.is_anomaly || 0,
    original_amount: parseFloat(expense.original_amount || expense.amount || 0.0),
    original_da_amount: parseFloat(expense.original_da_amount || expense.da_amount || 0.0),
    original_hotel_amount: parseFloat(expense.original_hotel_amount || expense.hotel_amount || 0.0),
    original_other_expense_amount: parseFloat(expense.original_other_expense_amount || expense.other_expense_amount || 0.0),
    original_local_purchase_amount: parseFloat(expense.original_local_purchase_amount || expense.local_purchase_amount || 0.0),
    attachments: (attachments.results || []).map(a => a.file_url),
    attachments_detailed: (attachments.results || []).map(a => ({
      file_url: a.file_url,
      itinerary_id: a.itinerary_id,
      bill_type: a.bill_type
    })),
    itineraries: (itineraries.results || []).map(i => ({
      leg: i.leg_number,
      from_district: i.from_district,
      to_district: i.to_district,
      from: i.from_location || "",
      to: i.to_location || "",
      mode: i.travel_mode,
      km: parseFloat(i.distance_km || 0.0),
      amount: parseFloat(i.travel_amount || 0.0),
      sub_mode: i.sub_mode || "",
      sub_amount: parseFloat(i.sub_amount || 0.0),
      da: parseFloat(i.da_amount || 0.0),
      hotel: parseFloat(i.hotel_amount || 0.0),
      local_purchase: parseFloat(i.local_purchase || 0.0),
      oth_desc: i.other_desc || "",
      oth_amount: parseFloat(i.other_amount || 0.0),
      ws_assigned: i.calls_assigned || 0,
      calls_assigned: i.calls_assigned || 0,
      ws_closed: i.calls_completed || 0,
      calls_completed: i.calls_completed || 0,
      ws_pms: i.pms_count || 0,
      pms_count: i.pms_count || 0,
      ws_asset: i.asset_tagging || 0,
      asset_tagging: i.asset_tagging || 0,
      calibration_count: i.calibration_count || 0,
      mobilise_count: i.mobilise_count || 0,
      mobilise_asset_count: i.mobilise_count || 0,
      visit_purpose: i.visit_purpose || "",
      activity_details: i.activity_details || "",
      original_km: parseFloat(i.original_distance_km || i.distance_km || 0.0),
      original_amount: parseFloat(i.original_travel_amount || i.travel_amount || 0.0),
      original_sub_amount: parseFloat(i.original_sub_amount || i.sub_amount || 0.0),
      original_da: parseFloat(i.original_da_amount || i.da_amount || 0.0),
      original_hotel: parseFloat(i.original_hotel_amount || i.hotel_amount || 0.0),
      original_oth_amount: parseFloat(i.original_other_amount || i.other_amount || 0.0),
      original_local_purchase: parseFloat(i.original_local_purchase || i.local_purchase || 0.0)
    })),
    created_at: expense.created_at,
    updated_at: expense.updated_at,
    approvals: approvalsList,
    edit_history: editHistoryList,
    user_monthly_stats: monthlyStats,
    rate_bike: rateBike,
    rate_car: rateCar
  });
}

/**
 * DELETE /api/expense/:id
 */
export async function handleDeleteExpense(request, env, params, query, user) {
  const expenseId = parseInt(params.id, 10);
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) return jsonResponse({ error: "Expense claim not found" }, 404);

  if (expense.user_id !== user.id && (user.role || "").trim().toLowerCase() !== "admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const itis = await env.DB.prepare("SELECT itinerary_id FROM expense_itineraries WHERE exp_id = ?").bind(expense.expense_code).all();
  const itineraryIds = (itis.results || []).map(r => r.itinerary_id);

  const statements = [];
  for (const id of itineraryIds) {
    statements.push({ sql: "DELETE FROM expense_breakdown_calls WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_pms_calls WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_asset_taggings WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_asset_mobilises WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_calibrations WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_other_activities WHERE itinerary_id = ?", params: [id] });
  }

  statements.push({ sql: "DELETE FROM approvals WHERE expense_id = ?", params: [expenseId] });
  statements.push({ sql: "DELETE FROM expense_edit_logs WHERE expense_id = ?", params: [expenseId] });
  statements.push({ sql: "DELETE FROM expense_attachments WHERE exp_id = ?", params: [expense.expense_code] });
  statements.push({ sql: "DELETE FROM expense_itineraries WHERE exp_id = ?", params: [expense.expense_code] });
  statements.push({ sql: "DELETE FROM expenses WHERE id = ?", params: [expenseId] });

  await runBatchWrite(env, statements);

  return jsonResponse({ status: "success", message: "Expense claim deleted successfully." });
}



/**
 * POST /api/expense/
 * Submit itinerary expense claim
 */
export async function handleSubmitExpense(request, env, params, query, user) {
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse({ error: "Invalid multipart form data" }, 400);
  }

  const payloadStr = formData.get("payload");
  let date, amount, itineraries, claim_month, claim_year, description = "";
  let editExpenseId = formData.get("edit_expense_id") || null;
  
  if (payloadStr) {
    let payload;
    try {
      payload = JSON.parse(payloadStr);
    } catch (e) {
      return jsonResponse({ error: "Invalid payload JSON" }, 400);
    }
    date = payload.date;
    amount = payload.amount;
    itineraries = payload.itinerary_legs || payload.itineraries || [];
    claim_month = payload.claim_month;
    claim_year = payload.claim_year;
    description = payload.description || "";
    if (payload.edit_expense_id) editExpenseId = payload.edit_expense_id;
  } else {
    // Read from individual form fields sent by frontend
    date = formData.get("exp_date");
    amount = parseFloat(formData.get("total_amount") || "0.0");
    const itinerariesStr = formData.get("itineraries");
    if (!date || !itinerariesStr) {
      return jsonResponse({ error: "exp_date and itineraries are required" }, 400);
    }
    try {
      itineraries = JSON.parse(itinerariesStr);
    } catch (e) {
      return jsonResponse({ error: "Invalid itineraries JSON" }, 400);
    }
    
    // Parse claim month and year from exp_date (format YYYY-MM-DD)
    const dt = new Date(date);
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    claim_month = months[dt.getMonth()];
    claim_year = dt.getFullYear();
    description = formData.get("description") || "";
  }

  const timestamp = new Date().toISOString();

  // Duplicate Date Check (prevent submitting twice for the same date unless rejected)
  let dupQuery = "SELECT id FROM expenses WHERE user_id = ? AND itinerary = ? AND status NOT IN ('rejected', 'returned_to_draft')";
  let dupParams = [user.id, date];
  if (editExpenseId) {
    dupQuery += " AND id != ?";
    dupParams.push(editExpenseId);
  }
  const dupResult = await runRead(env, dupQuery, dupParams, request);
  const existingDup = dupResult && dupResult.results && dupResult.results[0] ? dupResult.results[0] : null;
  if (existingDup) {
    return jsonResponse({ error: `An expense claim for ${date} has already been submitted.` }, 400);
  }

  let existingExpense = null;
  let expenseCode = null;
  let newExpId = null;

  if (editExpenseId) {
    existingExpense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ? AND user_id = ?").bind(editExpenseId, user.id).first();
    if (!existingExpense) {
      return jsonResponse({ error: "Expense claim to edit not found." }, 404);
    }
    expenseCode = existingExpense.expense_code;
    newExpId = existingExpense.id;

    // Delete old sub-entries
    const oldItis = await env.DB.prepare("SELECT itinerary_id FROM expense_itineraries WHERE exp_id = ?").bind(expenseCode).all();
    if (oldItis.results && oldItis.results.length > 0) {
      for (const r of oldItis.results) {
        const id = r.itinerary_id;
        await runWrite(env, "DELETE FROM expense_breakdown_calls WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_pms_calls WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_asset_taggings WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_asset_mobilises WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_calibrations WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_other_activities WHERE itinerary_id = ?", [id]);
      }
    }
    await runWrite(env, "DELETE FROM expense_attachments WHERE exp_id = ?", [expenseCode]);
    await runWrite(env, "DELETE FROM expense_itineraries WHERE exp_id = ?", [expenseCode]);
    await runWrite(env, "DELETE FROM approvals WHERE expense_id = ?", [newExpId]);
  } else {
    // Generate expense code RJ-MM/YY-XXXXXX
    const dt = new Date(date);
    const padTwo = (n) => String(n).padStart(2, "0");
    const monthPrefix = `${padTwo(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(-2)}`;
    
    const seqRows = await env.DB.prepare("SELECT expense_code FROM expenses WHERE expense_code LIKE ?")
      .bind(`RJ-${monthPrefix}-%`).all();
    
    let maxSeq = 0;
    if (seqRows.results && seqRows.results.length > 0) {
      for (const r of seqRows.results) {
        const parts = r.expense_code.split("-");
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
    const nextSeq = maxSeq + 1;
    expenseCode = `RJ-${monthPrefix}-${String(nextSeq).padStart(6, "0")}`;
  }

  // Defensive self-healing cleanup: delete any existing orphan entries matching expenseCode
  const oldItis = await env.DB.prepare("SELECT itinerary_id FROM expense_itineraries WHERE exp_id = ?").bind(expenseCode).all();
  if (oldItis.results && oldItis.results.length > 0) {
    for (const r of oldItis.results) {
      const id = r.itinerary_id;
      await runWrite(env, "DELETE FROM expense_breakdown_calls WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_pms_calls WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_asset_taggings WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_asset_mobilises WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_calibrations WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_other_activities WHERE itinerary_id = ?", [id]);
    }
  }
  await runWrite(env, "DELETE FROM expense_attachments WHERE exp_id = ?", [expenseCode]);
  await runWrite(env, "DELETE FROM expense_itineraries WHERE exp_id = ?", [expenseCode]);

  // Calculate totals and activity metrics
  let totalDa = 0.0;
  let totalHotel = 0.0;
  let totalOther = 0.0;
  let totalLocalPurchase = 0.0;
  let totalAssigned = 0;
  let totalCompleted = 0;
  let totalPms = 0;
  let totalAsset = 0;
  let totalCalibration = 0;
  let totalMobilise = 0;

  let newKm = 0.0;
  let newAuto = 0.0;
  let calculatedTotal = 0.0;

  for (const iti of itineraries) {
    const travelAmt = parseFloat(iti.amount || "0.0");
    const subAmt = parseFloat(iti.sub_amount || "0.0");
    const daAmt = parseFloat(iti.da || "0.0");
    const hotelAmt = parseFloat(iti.hotel || "0.0");
    const otherAmt = parseFloat(iti.oth_amount || "0.0");
    const lpAmt = parseFloat(iti.local_purchase || "0.0");

    totalDa += daAmt;
    totalHotel += hotelAmt;
    totalOther += otherAmt;
    totalLocalPurchase += lpAmt;

    calculatedTotal += travelAmt + subAmt + daAmt + hotelAmt + otherAmt + lpAmt;

    const mode = (iti.mode || "").trim().toLowerCase();
    if (["bike", "car"].includes(mode)) {
      newKm += parseFloat(iti.km || "0.0");
    } else if (mode === "auto") {
      newAuto += travelAmt;
    }

    const subMode = (iti.sub_mode || "").trim().toLowerCase();
    if (subMode === "auto") {
      newAuto += subAmt;
    }

    let actDetails = null;
    if (iti.activity_details) {
      try {
        actDetails = typeof iti.activity_details === "string" ? JSON.parse(iti.activity_details) : iti.activity_details;
      } catch (e) {}
    }

    let itiAssigned = parseInt(iti.ws_assigned || "0", 10);
    let itiCompleted = parseInt(iti.ws_closed || "0", 10);
    let itiPms = parseInt(iti.ws_pms || "0", 10);
    let itiAsset = parseInt(iti.ws_asset || "0", 10);
    let itiCalibration = parseInt(iti.calibration_count || "0", 10);
    let itiMobilise = parseInt(iti.mobilise_asset_count || "0", 10);

    if (actDetails) {
      const selectedActs = actDetails.selected_activities || [];
      if (selectedActs.includes("Calls")) {
        const callsList = actDetails.calls_list || [];
        itiAssigned = callsList.length;
        itiCompleted = callsList.filter(c => c.barcode).length;
      } else {
        itiAssigned = 0;
        itiCompleted = 0;
      }

      if (selectedActs.includes("PMS")) {
        const pmsList = actDetails.pms_list || [];
        itiPms = pmsList.filter(p => p.barcode).length;
      } else {
        itiPms = 0;
      }

      if (selectedActs.includes("Asset Tagging")) {
        const assetsList = actDetails.assets_list || [];
        itiAsset = assetsList.reduce((sum, item) => sum + (parseInt(item.quantity || "0", 10) || 0), 0);
      } else {
        itiAsset = 0;
      }
    }

    totalAssigned += itiAssigned;
    totalCompleted += itiCompleted;
    totalPms += itiPms;
    totalAsset += itiAsset;
    totalCalibration += itiCalibration;
    totalMobilise += itiMobilise;
  }

  if (calculatedTotal <= 0) {
    return jsonResponse({ error: "Total claim amount must be greater than zero." }, 400);
  }
  amount = calculatedTotal;

  // Backend Limit Validation
  const gradeToLookup = (user.designation || "").toLowerCase().includes("specialist") ? "O1" : user.grade;
  const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
  const maxKmPerMonth = allowance?.max_km_per_month ?? 2000;
  const maxAutoPerMonth = 1000;

  // Format month string YYYY-MM
  const mIdx = MONTH_NAMES.indexOf(claim_month);
  const mmNum = String(mIdx !== -1 ? mIdx + 1 : 1).padStart(2, "0");
  const monthStr = `${claim_year}-${mmNum}`;

  const limits = await env.DB.prepare(`
    SELECT 
      SUM(CASE WHEN request_type = 'KM' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_km,
      SUM(CASE WHEN request_type = 'AUTO' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_auto
    FROM limit_approval_requests
    WHERE user_id = ? AND LOWER(status) = 'approved' AND for_month = ?
  `).bind(user.user_id, monthStr).first();

  const approvedKm = limits?.approved_km || 0.0;
  const approvedAuto = limits?.approved_auto || 0.0;

  let statsQuery = `
    SELECT 
      SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) IN ('bike', 'car') THEN COALESCE(i.distance_km, 0.0) ELSE 0.0 END) as total_km,
      SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) = 'auto' THEN COALESCE(i.travel_amount, 0.0) ELSE 0.0 END) +
      SUM(CASE WHEN LOWER(TRIM(i.sub_mode)) = 'auto' THEN COALESCE(i.sub_amount, 0.0) ELSE 0.0 END) as total_auto
    FROM expense_itineraries i
    JOIN expenses e ON i.exp_id = e.expense_code
    WHERE e.user_id = ? AND e.month = ? AND e.year = ? AND e.status NOT IN ('rejected', 'returned_to_draft')
  `;
  const statsBinds = [user.id, claim_month, claim_year];
  if (editExpenseId) {
    statsQuery += " AND e.id != ?";
    statsBinds.push(editExpenseId);
  }
  const statsRes = await env.DB.prepare(statsQuery).bind(...statsBinds).first();

  const accumulatedKm = statsRes?.total_km || 0.0;
  const accumulatedAuto = statsRes?.total_auto || 0.0;

  if ((accumulatedKm + newKm) > (maxKmPerMonth + approvedKm)) {
    return jsonResponse({
      error: `KM Limit Exceeded! Monthly allowance is ${maxKmPerMonth} KM. Approved extension: ${approvedKm} KM. Already claimed: ${accumulatedKm.toFixed(1)} KM. Attempted: +${newKm.toFixed(1)} KM. Total: ${(accumulatedKm + newKm).toFixed(1)} KM. Please request a limit extension first.`
    }, 400);
  }

  if ((accumulatedAuto + newAuto) > (maxAutoPerMonth + approvedAuto)) {
    return jsonResponse({
      error: `Auto Expense Limit Exceeded! Monthly allowance is ₹${maxAutoPerMonth}. Approved extension: ₹${approvedAuto}. Already claimed: ₹${accumulatedAuto.toFixed(1)}. Attempted: +₹${newAuto.toFixed(1)}. Total: ₹${(accumulatedAuto + newAuto).toFixed(1)}. Please request a limit extension first.`
    }, 400);
  }

  const majorMode = itineraries[0]?.mode || "Other";
  const firstPurpose = itineraries[0]?.visit_purpose || "Field visit";

  // Create approvals level sequence
  const approvalChain = await env.DB.prepare(`
    SELECT a.* 
    FROM hierarchy_approvers a
    JOIN hierarchy_requesters hr ON a.hierarchy_id = hr.hierarchy_id
    WHERE hr.user_id = ?
    ORDER BY a.level_number ASC
  `).bind(user.id).all();

  let status = "approved";
  let approvalsToInsert = [];

  if (approvalChain.results && approvalChain.results.length > 0) {
    status = "submitted";
    for (const step of approvalChain.results) {
      approvalsToInsert.push({
        approver_id: step.approver_id,
        level_number: step.level_number,
        status: step.level_number === 1 ? "pending" : "waiting"
      });
    }
  } else {
    if ((user.role || "").trim().toLowerCase() !== "admin") {
      return jsonResponse({ error: "You are not assigned to any approval hierarchy team. Please contact the administrator." }, 400);
    }
  }

  if (existingExpense) {
    await runWrite(env, `
      UPDATE expenses 
      SET month = ?, year = ?, amount = ?, status = ?, travel_mode = ?, itinerary = ?, description = ?,
          da_amount = ?, hotel_amount = ?, other_expense_amount = ?, calls_assigned = ?, calls_completed = ?, 
          pms_count = ?, asset_tagging = ?, local_purchase_amount = ?, original_amount = ?, original_da_amount = ?, 
          original_hotel_amount = ?, original_other_expense_amount = ?, original_local_purchase_amount = ?, 
          calibration_count = ?, mobilise_count = ?, updated_at = ?
      WHERE id = ?
    `, [
      claim_month, claim_year, amount, status, majorMode, date, firstPurpose,
      totalDa, totalHotel, totalOther, totalAssigned, totalCompleted, totalPms,
      totalAsset, totalLocalPurchase, amount, totalDa, totalHotel, 
      totalOther, totalLocalPurchase, totalCalibration, totalMobilise,
      timestamp, newExpId
    ]);
  } else {
    const expRes = await runWrite(env, `
      INSERT INTO expenses (
        user_id, month, year, amount, status, travel_mode, itinerary, description, expense_code, 
        da_amount, hotel_amount, other_expense_amount, calls_assigned, calls_completed, pms_count, 
        asset_tagging, local_purchase_amount, original_amount, original_da_amount, original_hotel_amount, 
        original_other_expense_amount, original_local_purchase_amount, calibration_count, mobilise_count, 
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user.id, claim_month, claim_year, amount, status, majorMode, date, firstPurpose, expenseCode,
      totalDa, totalHotel, totalOther, totalAssigned, totalCompleted, totalPms,
      totalAsset, totalLocalPurchase, amount, totalDa, totalHotel, 
      totalOther, totalLocalPurchase, totalCalibration, totalMobilise,
      timestamp, timestamp
    ]);
    newExpId = expRes.meta?.last_row_id;
  }

  if (!newExpId) return jsonResponse({ error: "Failed to save expense claim" }, 500);

  // Helper for attachments upload with fallback
  const handleAttachment = async (fileKey, billType, legNum) => {
    const file = formData.get(fileKey);
    if (file && typeof file === "object" && file.name) {
      const ext = file.name.split(".").pop().toLowerCase() || "jpg";
      const filename = `${expenseCode}_leg${legNum}_${billType}_${Date.now()}.${ext}`;
      
      const now = new Date();
      const monthName = now.toLocaleString("en-US", { month: "long" });
      const yearVal = now.getFullYear();
      const folderName = `${monthName}_${yearVal}`;
      
      let fileUrl = "";
      try {
        fileUrl = await uploadFileWithFallback(env, file, folderName, filename);
      } catch (err) {
        console.error(`Failed to upload ${fileKey} with fallback:`, err);
        return;
      }
      
      await runWrite(env, `
        INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url)
        VALUES (?, ?, ?, ?)
      `, [expenseCode, `${expenseCode}-${legNum}`, billType, fileUrl]);
    }
  };

  // Insert itinerary legs and process details
  for (let idx = 0; idx < itineraries.length; idx++) {
    const iti = itineraries[idx];
    const legNum = parseInt(iti.leg || (idx + 1), 10);
    const itiId = `${expenseCode}-${legNum}`;
    const fromDist = iti.district_from || user.district || "Jodhpur";
    const toDist = iti.district || "Jodhpur";
    
    await runWrite(env, `
      INSERT INTO expense_itineraries (
        itinerary_id, exp_id, leg_number, from_district, to_district, from_location, to_location, 
        travel_mode, distance_km, travel_amount, sub_mode, sub_km, sub_amount, da_amount, hotel_amount, 
        local_purchase, other_desc, other_amount, calls_assigned, calls_completed, pms_count, asset_tagging, visit_purpose, 
        activity_details, original_distance_km, original_travel_amount, original_sub_amount, original_da_amount, 
        original_hotel_amount, original_other_amount, original_local_purchase, calibration_count, mobilise_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      itiId, expenseCode, legNum, fromDist, toDist, iti.from || "", iti.to || "",
      iti.mode || "Bike", parseFloat(iti.km || "0.0"), parseFloat(iti.amount || "0.0"),
      iti.sub_mode || null, parseFloat(iti.sub_amount || "0.0"), parseFloat(iti.da || "0.0"),
      parseFloat(iti.hotel || "0.0"), parseFloat(iti.local_purchase || "0.0"), iti.oth_desc || null, parseFloat(iti.oth_amount || "0.0"),
      parseInt(iti.ws_assigned || "0", 10), parseInt(iti.ws_closed || "0", 10),
      parseInt(iti.ws_pms || "0", 10), parseInt(iti.ws_asset || "0", 10),
      iti.visit_purpose || "Field visit", 
      typeof iti.activity_details === "string" ? iti.activity_details : JSON.stringify(iti.activity_details || {}),
      parseFloat(iti.km || "0.0"), parseFloat(iti.amount || "0.0"), parseFloat(iti.sub_amount || "0.0"),
      parseFloat(iti.da || "0.0"), parseFloat(iti.hotel || "0.0"), parseFloat(iti.oth_amount || "0.0"),
      parseFloat(iti.local_purchase || "0.0"), parseInt(iti.calibration_count || "0", 10),
      parseInt(iti.mobilise_asset_count || "0", 10)
    ]);

    let actDetails = null;
    if (iti.activity_details) {
      try {
        actDetails = typeof iti.activity_details === "string" ? JSON.parse(iti.activity_details) : iti.activity_details;
      } catch (e) {}
    }
    if (actDetails) {
      const selectedActs = actDetails.selected_activities || [];
      
      if (selectedActs.includes("Calls")) {
        for (const call of actDetails.calls_list || []) {
          const asset = call.asset_details || {};
          await runWrite(env, `
            INSERT INTO expense_breakdown_calls (
              itinerary_id, barcode, call_type, call_status, district_name, hospital_name, 
              equipment_name, model_name, inventory_status, photo_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            itiId, call.barcode, call.type, call.status, asset.district_name, asset.hospital_name,
            asset.equipment_name, asset.model_name, asset.inventory_status, call.photo_url || ""
          ]);
        }
      }

      if (selectedActs.includes("PMS")) {
        for (const pms of actDetails.pms_list || []) {
          const asset = pms.asset_details || {};
          await runWrite(env, `
            INSERT INTO expense_pms_calls (
              itinerary_id, barcode, pms_frequency, district_name, hospital_name, 
              equipment_name, model_name, inventory_status, photo_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            itiId, pms.barcode, pms.frequency, asset.district_name, asset.hospital_name,
            asset.equipment_name, asset.model_name, asset.inventory_status, pms.photo_url || ""
          ]);
        }
      }

      if (selectedActs.includes("Asset Tagging")) {
        for (const asset of actDetails.assets_list || []) {
          await runWrite(env, `
            INSERT INTO expense_asset_taggings (itinerary_id, equipment_name, quantity)
            VALUES (?, ?, ?)
          `, [itiId, asset.equipment_name, parseInt(asset.quantity || "0", 10)]);
        }
      }

      if (selectedActs.includes("Mobilise Asset Update")) {
        const qty = parseInt(actDetails.mobilise_asset_count || "0", 10);
        if (qty > 0) {
          await runWrite(env, `
            INSERT INTO expense_asset_mobilises (itinerary_id, quantity)
            VALUES (?, ?)
          `, [itiId, qty]);
        }
      }

      if (selectedActs.includes("Calibration")) {
        const qty = parseInt(actDetails.calibration_count || "0", 10);
        if (qty > 0) {
          await runWrite(env, `
            INSERT INTO expense_calibrations (itinerary_id, quantity)
            VALUES (?, ?)
          `, [itiId, qty]);
        }
      }

      if (selectedActs.includes("Other")) {
        const otherDesc = actDetails.activity_other_desc || "";
        if (otherDesc && otherDesc.trim()) {
          await runWrite(env, `
            INSERT INTO expense_other_activities (itinerary_id, description)
            VALUES (?, ?)
          `, [itiId, otherDesc.trim()]);
        }
      }
    }

    // Process file attachments
    await handleAttachment(`main_bill_${legNum}`, iti.mode || "Bill", legNum);
    if (iti.sub_mode) {
      await handleAttachment(`sub_bill_${legNum}`, iti.sub_mode, legNum);
    }
    await handleAttachment(`comm_mail_${legNum}`, "Communication_Mail", legNum);
    await handleAttachment(`oth_bill_${legNum}`, "Other", legNum);
    await handleAttachment(`hotel_bill_${legNum}`, "Hotel", legNum);
    await handleAttachment(`local_purchase_bill_${legNum}`, "Local_Purchase", legNum);
  }

  // Create approvals level sequence records
  for (const step of approvalsToInsert) {
    await runWrite(env, `
      INSERT INTO approvals (expense_id, approver_id, level_number, status, comments, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', ?, ?)
    `, [newExpId, step.approver_id, step.level_number, step.status, timestamp, timestamp]);

    if (step.status === "pending") {
      const approverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(step.approver_id).first();
      if (approverUser) {
        await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 New Claim for Approval', ?, 'warning', 0, '/approval-center', ?)", [
          approverUser.user_id, `${user.name} submitted a new claim ${expenseCode} (₹${amount}) for your review.`, timestamp
        ]);
      }
    }
  }

  return jsonResponse({
    status: "success",
    message: "Expense claim submitted successfully.",
    expense_id: newExpId,
    expense_code: expenseCode
  });
}

/**
 * GET /api/expense/month-summary
 * Returns per-engineer summary for a given month (Managers/Admins see team; Engineers see self)
 */
export async function handleGetMonthSummary(request, env, params, query, user) {
  const month = query.get("month");    // e.g. "January"
  const year = parseInt(query.get("year") || "0", 10) || new Date().getFullYear();
  const district = query.get("district");
  const engineer = query.get("engineer");

  // Build filters for new expenses table
  const whereClauses = ["1=1"];
  const bindings = [];

  if (month) {
    whereClauses.push("UPPER(e.month) = UPPER(?)");
    bindings.push(month);
  }
  if (year) {
    whereClauses.push("e.year = ?");
    bindings.push(year);
  }

  // Row-level access control
  const role = (user.role || "").trim().toLowerCase();
  if (role === "engineer") {
    whereClauses.push("u.user_id = ?");
    bindings.push(user.user_id);
  } else if (district) {
    whereClauses.push("LOWER(u.district) = LOWER(?)");
    bindings.push(district);
  }
  if (engineer) {
    whereClauses.push("(LOWER(u.name) LIKE ? OR LOWER(u.user_id) = LOWER(?))");
    bindings.push(`%${engineer.toLowerCase()}%`, engineer.toLowerCase());
  }

  const whereStr = whereClauses.join(" AND ");

  // Fetch new-style expense summaries
  const result = await env.DB.prepare(`
    SELECT 
      u.user_id, u.name, u.district, u.zone, u.designation, u.grade,
      e.month as month, e.year,
      COUNT(e.id) as total_claims,
      SUM(e.amount) as total_amount,
      SUM(e.amount) as approved_amount,
      0 as pending_amount,
      0 as rejected_count,
      COUNT(e.id) as approved_count
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE ${whereStr} AND LOWER(e.status) = 'approved'
    GROUP BY u.user_id, u.name, e.month, e.year
    ORDER BY u.name ASC
  `).bind(...bindings).all();

  // Also fetch from legacy expense_master if it exists
  let legacyRows = [];
  try {
    const legacyWhereClauses = ["1=1"];
    const legacyBindings = [];

    if (month) {
      // Legacy has expense_date; match by month name
      legacyWhereClauses.push("strftime('%m', expense_date) = ?");
      const monthNum = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(month.toLowerCase()) + 1;
      legacyBindings.push(String(monthNum).padStart(2, "0"));
    }
    if (year) {
      legacyWhereClauses.push("strftime('%Y', expense_date) = ?");
      legacyBindings.push(String(year));
    }
    if (role === "Engineer") {
      legacyWhereClauses.push("LOWER(m.user_id) = LOWER(?)");
      legacyBindings.push(user.user_id);
    }

    const legacyRes = await env.DB.prepare(`
      SELECT 
        m.user_id, u.name, u.district, u.zone, u.designation, u.grade,
        COUNT(*) as total_claims,
        SUM(m.total_amount) as total_amount,
        SUM(m.total_amount) as approved_amount,
        0 as pending_amount,
        0 as rejected_count,
        COUNT(*) as approved_count
      FROM expense_master m
      JOIN users u ON LOWER(m.user_id) = LOWER(u.user_id)
      WHERE ${legacyWhereClauses.join(" AND ")} AND LOWER(m.status) = 'approved'
      GROUP BY m.user_id, u.name, u.district, u.zone
      ORDER BY u.name ASC
    `).bind(...legacyBindings).all();
    legacyRows = legacyRes.results || [];
  } catch (e) {
    // Legacy table may not exist
  }

  const summaryMap = {};
  for (const row of (result.results || [])) {
    summaryMap[row.user_id] = row;
  }
  // Merge legacy (de-duplicate by user_id)
  for (const row of legacyRows) {
    if (!summaryMap[row.user_id]) {
      summaryMap[row.user_id] = { ...row, month: month || "", year };
    } else {
      summaryMap[row.user_id].total_claims += row.total_claims || 0;
      summaryMap[row.user_id].total_amount = (parseFloat(summaryMap[row.user_id].total_amount) || 0) + (parseFloat(row.total_amount) || 0);
      summaryMap[row.user_id].approved_amount = (parseFloat(summaryMap[row.user_id].approved_amount) || 0) + (parseFloat(row.approved_amount) || 0);
      summaryMap[row.user_id].pending_amount = (parseFloat(summaryMap[row.user_id].pending_amount) || 0) + (parseFloat(row.pending_amount) || 0);
    }
  }

  return jsonResponse(Object.values(summaryMap));
}

/**
 * GET /api/expense/engineer-month-claims
 * Returns all detailed claims (with legs) for a specific engineer in a given month/year
 */
export async function handleGetEngineerMonthClaims(request, env, params, query, user) {
  const userCode = query.get("user_code");
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || new Date().getFullYear();

  if (!userCode || !month) {
    return jsonResponse({ error: "user_code and month are required" }, 400);
  }

  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ? OR e_code = ?").bind(userCode, userCode).first();
  if (!targetUser) {
    return jsonResponse({ error: "Engineer not found" }, 404);
  }

  const claims = [];

  // Fetch asset value master into a dictionary: equipment_name -> tender_cost
  const assetCosts = {};
  try {
    const assetCostsRes = await env.DB.prepare("SELECT equipment_name, rmsc_tender_cost FROM asset_value_master").all();
    for (const r of (assetCostsRes.results || [])) {
      if (r.equipment_name) {
        assetCosts[r.equipment_name.trim().toLowerCase()] = parseFloat(r.rmsc_tender_cost || 0.0);
      }
    }
  } catch (e) {
    console.warn("Failed to load asset costs:", e.message);
  }

  // Fetch from new expenses table
  let expenses = [];
  try {
    const expensesRes = await env.DB.prepare(`
      SELECT * FROM expenses 
      WHERE user_id = ? AND UPPER(month) = UPPER(?) AND year = ? AND LOWER(status) = 'approved'
      ORDER BY itinerary ASC
    `).bind(targetUser.id, month, year).all();
    expenses = expensesRes.results || [];

    for (const exp of expenses) {
      let legs = [];
      try {
        const legsRes = await env.DB.prepare("SELECT * FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC").bind(exp.expense_code).all();
        legs = legsRes.results || [];
      } catch (e) {
        console.warn("Legs fetch failed:", e.message);
      }

      const legData = [];
      for (const leg of legs) {
        let barcodes = [];
        if (leg.activity_details) {
          try {
            const act = typeof leg.activity_details === 'string' ? JSON.parse(leg.activity_details) : leg.activity_details;
            if (act && typeof act === 'object') {
              for (const item of (act.calls_list || [])) {
                if (item.barcode) barcodes.push(item.barcode);
              }
              for (const item of (act.pms_list || [])) {
                if (item.barcode && !barcodes.includes(item.barcode)) {
                  barcodes.push(item.barcode);
                }
              }
            }
          } catch (err) {}
        }

        // Calculate total asset tagging qty and value
        let totalTagQty = 0;
        let totalTagVal = 0;
        try {
          const tagRes = await env.DB.prepare("SELECT * FROM expense_asset_taggings WHERE itinerary_id = ?").bind(leg.itinerary_id).all();
          for (const t of (tagRes.results || [])) {
            const qty = t.quantity || 0;
            totalTagQty += qty;
            const eqName = (t.equipment_name || "").trim().toLowerCase();
            const cost = assetCosts[eqName] || 0.0;
            totalTagVal += qty * cost;
          }
        } catch (e) {
          console.warn("Taggings fetch failed for leg:", leg.itinerary_id, e.message);
        }

        let tagInfo = "";
        if (totalTagQty > 0) {
          tagInfo = `Qty: ${totalTagQty} | ₹${totalTagVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        }

        let barcodeTicketStr = barcodes.join(", ");
        if (tagInfo) {
          barcodeTicketStr = barcodeTicketStr ? `${barcodeTicketStr} | ${tagInfo}` : tagInfo;
        }

        const mode = (leg.travel_mode || "").trim().toLowerCase();
        const subMode = (leg.sub_mode || "").trim().toLowerCase();

        const autoAmt = (mode === "auto" ? parseFloat(leg.travel_amount || 0) : 0) +
                        (subMode === "auto" ? parseFloat(leg.sub_amount || 0) : 0);

        legData.push({
          leg_number: leg.leg_number,
          from_location: leg.from_location || leg.from_district || "—",
          to_location: leg.to_location || leg.to_district || "—",
          travel_mode: leg.travel_mode || "—",
          distance_km: parseFloat(leg.distance_km || 0.0),
          bike_km: mode === "bike" ? parseFloat(leg.distance_km || 0.0) : 0.0,
          car_km: mode === "car" ? parseFloat(leg.distance_km || 0.0) : 0.0,
          bike_amount: mode === "bike" ? parseFloat(leg.travel_amount || 0.0) : 0.0,
          car_amount: mode === "car" ? parseFloat(leg.travel_amount || 0.0) : 0.0,
          auto_amount: autoAmt,
          da_amount: parseFloat(leg.da_amount || 0.0),
          hotel_amount: parseFloat(leg.hotel_amount || 0.0),
          local_purchase: parseFloat(leg.local_purchase || 0.0),
          other_amount: parseFloat(leg.other_amount || 0.0),
          other_desc: leg.other_desc || "",
          visit_purpose: leg.visit_purpose || "",
          calls_assigned: leg.calls_assigned || 0,
          ws_assigned: leg.calls_assigned || 0,
          calls_completed: leg.calls_completed || 0,
          ws_closed: leg.calls_completed || 0,
          pms_count: leg.pms_count || 0,
          ws_pms: leg.pms_count || 0,
          ws_asset: leg.asset_tagging || 0,
          asset_tagging: leg.asset_tagging || 0,
          calibration_count: leg.calibration_count || 0,
          mobilise_count: leg.mobilise_count || 0,
          mobilise_asset_count: leg.mobilise_count || 0,
          worked_district: leg.to_district || leg.from_district || "",
          ta_amount: ["train", "bus"].includes(mode) ? parseFloat(leg.travel_amount || 0.0) : 0.0,
          sub_mode: leg.sub_mode || "",
          sub_amount: parseFloat(leg.sub_amount || 0.0),
          barcode_ticket: barcodeTicketStr,
          asset_tagging_qty: totalTagQty,
          asset_tagging_val: totalTagVal,
          activity_details: leg.activity_details || "",
        });
      }

      claims.push({
        expense_code: exp.expense_code,
        date: exp.itinerary,
        amount: parseFloat(exp.amount || 0.0),
        da_amount: parseFloat(exp.da_amount || 0.0),
        hotel_amount: parseFloat(exp.hotel_amount || 0.0),
        other_amount: parseFloat(exp.other_expense_amount || 0.0),
        local_purchase_amount: parseFloat(exp.local_purchase_amount || 0.0),
        legs: legData,
      });
    }
  } catch (e) {
    console.warn("New expenses fetch failed:", e.message);
  }

  // Fetch from legacy expense_master
  let legacyExpenses = [];
  try {
    const legacyRes = await env.DB.prepare(`
      SELECT * FROM expense_master
      WHERE LOWER(user_id) = LOWER(?)
        AND strftime('%m', expense_date) = ?
        AND strftime('%Y', expense_date) = ?
        AND LOWER(status) = 'approved'
      ORDER BY expense_date ASC
    `).bind(userCode,
      String(["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(month.toLowerCase()) + 1).padStart(2, "0"),
      String(year)
    ).all();
    legacyExpenses = legacyRes.results || [];

    for (const exp of legacyExpenses) {
      let legs = [];
      try {
        const legsRes = await env.DB.prepare("SELECT * FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC").bind(exp.exp_id).all();
        legs = legsRes.results || [];
      } catch (e) {
        console.warn("Legacy legs fetch failed:", e.message);
      }

      const legData = [];
      for (const leg of legs) {
        legData.push({
          leg_number: leg.leg_number,
          from_location: leg.from_location || "—",
          to_location: leg.to_location || "—",
          travel_mode: leg.travel_mode || "—",
          distance_km: parseFloat(leg.distance_km || 0.0),
          bike_km: leg.travel_mode === "Bike" ? parseFloat(leg.distance_km || 0.0) : 0.0,
          car_km: leg.travel_mode === "Car" ? parseFloat(leg.distance_km || 0.0) : 0.0,
          bike_amount: parseFloat(leg.bike_amount || 0.0),
          car_amount: parseFloat(leg.car_amount || 0.0),
          auto_amount: parseFloat(leg.auto_amount || 0.0),
          da_amount: parseFloat(leg.da_amount || 0.0),
          hotel_amount: parseFloat(leg.hotel_amount || 0.0),
          local_purchase: parseFloat(leg.local_purchase || 0.0),
          other_amount: parseFloat(leg.other_amount || 0.0),
          other_desc: leg.other_desc || "",
          visit_purpose: leg.visit_purpose || "",
          calls_assigned: leg.calls_assigned || 0,
          ws_assigned: leg.calls_assigned || 0,
          calls_completed: leg.calls_completed || 0,
          ws_closed: leg.calls_completed || 0,
          pms_count: leg.pms_count || 0,
          ws_pms: leg.pms_count || 0,
          ws_asset: leg.asset_tagging || 0,
          asset_tagging: leg.asset_tagging || 0,
          calibration_count: leg.calibration_count || 0,
          mobilise_count: leg.mobilise_count || 0,
          mobilise_asset_count: leg.mobilise_count || 0,
          worked_district: leg.worked_district || "",
          ta_amount: parseFloat(leg.ta_amount || 0.0),
          sub_mode: leg.sub_mode || "",
          sub_amount: parseFloat(leg.sub_amount || 0.0),
          barcode_ticket: leg.barcode_ticket || "",
          asset_tagging_qty: leg.asset_tagging_qty || 0,
          asset_tagging_val: leg.asset_tagging_val || 0.0,
          activity_details: leg.activity_details || "",
        });
      }

      claims.push({
        expense_code: exp.exp_id,
        date: exp.expense_date,
        amount: parseFloat(exp.total_amount || 0.0),
        da_amount: parseFloat(exp.da_amount || 0.0),
        hotel_amount: parseFloat(exp.hotel_amount || 0.0),
        other_amount: parseFloat(exp.other_amount || 0.0),
        local_purchase_amount: parseFloat(exp.local_purchase || 0.0),
        legs: legData,
      });
    }
  } catch (e) {
    console.warn("Legacy expense_master fetch failed:", e.message);
  }

  const defaultUserObj = {
    name: targetUser.name,
    user_id: targetUser.user_id,
    e_code: targetUser.e_code || targetUser.user_id,
    grade: targetUser.grade || "",
    designation: targetUser.designation || "Engineer",
    district: targetUser.district || "",
    zone: targetUser.zone || "",
    manager: targetUser.manager || "",
    coordinator: targetUser.coordinator || "",
    mobile: targetUser.mobile_number || "",
    type: targetUser.type || (targetUser.zone || ""),
    month: month,
    year: year
  };

  // Query all attachments for these expenses
  const expenseCodes = claims.map(c => c.expense_code);
  const validAttachments = [];
  if (expenseCodes.length > 0) {
    try {
      const placeholders = expenseCodes.map(() => "?").join(",");
      const attachRes = await env.DB.prepare(`
        SELECT * FROM expense_attachments 
        WHERE exp_id IN (${placeholders})
      `).bind(...expenseCodes).all();

      const expenseDateMap = {};
      for (const c of claims) {
        expenseDateMap[c.expense_code] = c.date;
      }

      for (const a of (attachRes.results || [])) {
        const billType = (a.bill_type || "").toLowerCase();
        if (a.file_url && !billType.includes("pms") && !billType.includes("call")) {
          validAttachments.push({
            file_url: a.file_url,
            date: expenseDateMap[a.exp_id] || ""
          });
        }
      }
    } catch (e) {
      console.warn("Attachments fetch failed:", e.message);
    }
  }

  return jsonResponse({
    success: true,
    user: defaultUserObj,
    claims: claims,
    attachments: validAttachments
  });
}

/**
 * GET /api/expense/engineer-advance
 * Returns the advance amount for an engineer for a specific month/year
 */
export async function handleGetEngineerAdvance(request, env, params, query, user) {
  const userCode = query.get("user_code");
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || new Date().getFullYear();

  if (!userCode || !month) {
    return jsonResponse({ error: "user_code and month are required" }, 400);
  }

  const record = await env.DB.prepare(`
    SELECT * FROM engineer_advances
    WHERE LOWER(user_code) = LOWER(?) AND LOWER(month) = LOWER(?) AND year = ?
    LIMIT 1
  `).bind(userCode, month, year).first().catch(() => null);

  return jsonResponse({
    user_code: userCode,
    month,
    year,
    advance_amount: parseFloat(record?.advance_amount || 0)
  });
}

/**
 * POST /api/expense/engineer-advance
 * Save/update the advance amount for an engineer for a specific month/year
 */
export async function handleSaveEngineerAdvance(request, env, params, query, user) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  const { user_code, month, year, advance_amount } = body;
  if (!user_code || !month || !year) {
    return jsonResponse({ error: "user_code, month, and year are required" }, 400);
  }

  const timestamp = new Date().toISOString();
  const amount = parseFloat(advance_amount || 0);

  // Upsert the advance record
  const existing = await env.DB.prepare(`
    SELECT id FROM engineer_advances
    WHERE LOWER(user_code) = LOWER(?) AND LOWER(month) = LOWER(?) AND year = ?
  `).bind(user_code, month, year).first().catch(() => null);

  if (existing) {
    await runWrite(env, "UPDATE engineer_advances SET advance_amount = ?, updated_at = ? WHERE id = ?", [amount, timestamp, existing.id]);
  } else {
    await runWrite(env, `
      INSERT INTO engineer_advances (user_code, month, year, advance_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user_code, month, year, amount, timestamp, timestamp]).catch(async () => {
      // Table may not have updated_at column, try simpler version
      await runWrite(env, `
        INSERT INTO engineer_advances (user_code, month, year, advance_amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [user_code, month, year, amount, timestamp]);
    });
  }

  return jsonResponse({ status: "success", message: "Advance saved successfully", advance_amount: amount });
}

/**
 * GET /api/expense/consolidated-report
 * Returns a consolidated summary for all engineers in a month/year
 */
export async function handleGetConsolidatedReport(request, env, params, query, user) {
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || new Date().getFullYear();

  if (!month) {
    return jsonResponse({ error: "month is required" }, 400);
  }

  // 1. Fetch all users (including manager column)
  const usersRes = await env.DB.prepare(`
    SELECT id, user_id, name, district, zone, grade, designation, date_of_joining, e_code, manager FROM users
  `).all().catch(() => ({ results: [] }));
  const users = usersRes.results || [];
  
  // Build name resolution map for managers
  const nameLookupMap = {};
  for (const u of users) {
    if (u.user_id) nameLookupMap[u.user_id.toLowerCase().trim()] = u.name;
    if (u.e_code) nameLookupMap[u.e_code.toLowerCase().trim()] = u.name;
    if (u.name) nameLookupMap[u.name.toLowerCase().trim()] = u.name;
  }

  const userMap = {};
  const userByCode = {};
  for (const u of users) {
    userMap[u.id] = u;
    userByCode[u.user_id] = u;
  }

  // 2. Fetch all approved expenses (with itinerary and created_at for date/deduction tracking)
  const expensesRes = await env.DB.prepare(`
    SELECT id, user_id, expense_code, amount, original_amount, status, itinerary, created_at FROM expenses
    WHERE UPPER(month) = UPPER(?) AND year = ? AND LOWER(status) = 'approved'
  `).bind(month, year).all().catch(() => ({ results: [] }));
  const expenses = expensesRes.results || [];

  if (expenses.length === 0) {
    return jsonResponse({ success: true, data: [] });
  }

  // 3. Fetch all itineraries for these expenses using queryInChunks (to avoid D1 parameter limit)
  const expenseCodes = expenses.map(e => e.expense_code).filter(Boolean);
  let legs = [];
  if (expenseCodes.length > 0) {
    try {
      legs = await queryInChunks(
        env.DB,
        "SELECT exp_id, travel_mode, sub_mode, distance_km, travel_amount, sub_amount, da_amount, local_purchase, hotel_amount, other_desc, other_amount, original_distance_km, original_travel_amount, original_sub_amount, original_da_amount, original_local_purchase, original_hotel_amount, original_other_amount FROM expense_itineraries WHERE exp_id IN (?)",
        expenseCodes
      );
    } catch (e) {
      console.error("Consolidated report itineraries query failed:", e.message);
    }
  }

  // Group legs by exp_id (case-insensitive key normalization)
  const legsByCode = {};
  for (const leg of legs) {
    const key = (leg.exp_id || "").trim().toUpperCase();
    if (!legsByCode[key]) legsByCode[key] = [];
    legsByCode[key].push(leg);
  }

  // 4. Fetch advances
  const advancesRes = await env.DB.prepare(`
    SELECT user_code, advance_amount FROM engineer_advances
    WHERE LOWER(month) = LOWER(?) AND year = ?
  `).bind(month, year).all().catch(() => ({ results: [] }));
  const advances = advancesRes.results || [];
  const advancesMap = {};
  for (const adv of advances) {
    advancesMap[(adv.user_code || "").toLowerCase()] = parseFloat(adv.advance_amount || 0);
  }

  // 5. Fetch edit logs for comments using queryInChunks
  const expenseIds = expenses.map(e => e.id);
  let editLogs = [];
  if (expenseIds.length > 0) {
    try {
      editLogs = await queryInChunks(
        env.DB,
        "SELECT expense_id, comment FROM expense_edit_logs WHERE expense_id IN (?)",
        expenseIds
      );
    } catch (e) {
      console.error("Consolidated report edit logs query failed:", e.message);
    }
  }

  const commentsByExpense = {};
  for (const log of editLogs) {
    if (log.comment && log.comment.trim()) {
      if (!commentsByExpense[log.expense_id]) commentsByExpense[log.expense_id] = [];
      commentsByExpense[log.expense_id].push(log.comment.trim());
    }
  }

  // 6. Group expenses by user
  const expensesByUser = {};
  for (const exp of expenses) {
    const usr = userMap[exp.user_id];
    if (!usr) continue;
    if (!expensesByUser[usr.user_id]) expensesByUser[usr.user_id] = [];
    expensesByUser[usr.user_id].push(exp);
  }

  // 7. Compile report rows
  const reportRows = [];
  for (const [user_code, userExps] of Object.entries(expensesByUser)) {
    const usr = userByCode[user_code];
    if (!usr) continue;

    let travel_expense = 0;
    let bike_km = 0;
    let car_km = 0;
    let auto_amount = 0;
    let train_bus_amount = 0;
    let da_allowance = 0;
    let spare_purchase = 0;
    let courier_charges = 0;
    let boarding_lodging = 0;
    let printing_stationery = 0;
    let claimed_amount = 0;
    const allComments = [];

    const claimDates = [];
    const kmDeductions = {};
    const autoDeductions = {};
    const daDeductions = {};
    const hotelDeductions = {};
    const spareDeductions = {};
    const otherDeductions = {};

    for (const exp of userExps) {
      claimed_amount += parseFloat(exp.original_amount || exp.amount || 0);
      
      // Save claim date
      if (exp.itinerary) {
        // Format to DD-MM-YYYY
        const parts = exp.itinerary.split("-");
        if (parts.length === 3) {
          claimDates.push(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          claimDates.push(exp.itinerary);
        }
      } else if (exp.created_at) {
        // Fallback to created_at date
        const datePart = exp.created_at.split(" ")[0];
        const parts = datePart.split("-");
        if (parts.length === 3) {
          claimDates.push(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          claimDates.push(datePart);
        }
      }

      const expComments = commentsByExpense[exp.id] || [];
      allComments.push(...expComments);

      const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];
      for (const leg of expLegs) {
        // Get day of month for deduction tracking
        let day = 0;
        if (exp.itinerary) {
          day = parseInt(exp.itinerary.split("-")[2], 10) || 0;
        } else if (exp.created_at) {
          const datePart = exp.created_at.split(" ")[0];
          day = parseInt(datePart.split("-")[2], 10) || 0;
        }

        const mode = (leg.travel_mode || "").trim().toLowerCase();
        const sub_mode = (leg.sub_mode || "").trim().toLowerCase();

        let km_part = 0;
        if (mode === "bike") {
          km_part = parseFloat(leg.distance_km || 0) * 4.5;
          bike_km += parseFloat(leg.distance_km || 0);
        } else if (mode === "car") {
          km_part = parseFloat(leg.distance_km || 0) * 9.0;
          car_km += parseFloat(leg.distance_km || 0);
        }

        let auto_part = 0;
        if (mode === "auto") {
          auto_part += parseFloat(leg.travel_amount || 0);
          auto_amount += parseFloat(leg.travel_amount || 0);
        }
        if (sub_mode === "auto") {
          auto_part += parseFloat(leg.sub_amount || 0);
          auto_amount += parseFloat(leg.sub_amount || 0);
        }

        let ta_part = 0;
        if (mode === "train" || mode === "bus") {
          ta_part += parseFloat(leg.travel_amount || 0);
          train_bus_amount += parseFloat(leg.travel_amount || 0);
        }

        travel_expense += (km_part + auto_part + ta_part);
        da_allowance += parseFloat(leg.da_amount || 0);
        spare_purchase += parseFloat(leg.local_purchase || 0);
        boarding_lodging += parseFloat(leg.hotel_amount || 0);

        const oth_desc = (leg.other_desc || "").trim().toLowerCase();
        const oth_amt = parseFloat(leg.other_amount || 0);
        if (oth_amt > 0) {
          if (oth_desc.includes("courier") || oth_desc.includes("courrier")) {
            courier_charges += oth_amt;
          } else {
            printing_stationery += oth_amt;
          }
        }

        // Deductions calculation per leg (claimed vs approved)
        const kmDiff = parseFloat(leg.original_distance_km || 0) - parseFloat(leg.distance_km || 0);
        const autoDiff = (
          ((leg.travel_mode || "").trim().toLowerCase() === "auto" ? (parseFloat(leg.original_travel_amount || 0) - parseFloat(leg.travel_amount || 0)) : 0) +
          ((leg.sub_mode || "").trim().toLowerCase() === "auto" ? (parseFloat(leg.original_sub_amount || 0) - parseFloat(leg.sub_amount || 0)) : 0)
        );
        const daDiff = parseFloat(leg.original_da_amount || 0) - parseFloat(leg.da_amount || 0);
        const hotelDiff = parseFloat(leg.original_hotel_amount || 0) - parseFloat(leg.hotel_amount || 0);
        const spareDiff = parseFloat(leg.original_local_purchase || 0) - parseFloat(leg.local_purchase || 0);
        const otherDiff = parseFloat(leg.original_other_amount || 0) - parseFloat(leg.other_amount || 0);

        if (day > 0) {
          if (kmDiff > 0) kmDeductions[day] = (kmDeductions[day] || 0) + kmDiff;
          if (autoDiff > 0) autoDeductions[day] = (autoDeductions[day] || 0) + autoDiff;
          if (daDiff > 0) daDeductions[day] = (daDeductions[day] || 0) + daDiff;
          if (hotelDiff > 0) hotelDeductions[day] = (hotelDeductions[day] || 0) + hotelDiff;
          if (spareDiff > 0) spareDeductions[day] = (spareDeductions[day] || 0) + spareDiff;
          if (otherDiff > 0) otherDeductions[day] = (otherDeductions[day] || 0) + otherDiff;
        }
      }
    }

    // Build automated deduction strings with dates (concise format)
    const categoryTexts = [];
    
    // KM
    const kmDays = Object.keys(kmDeductions).map(Number).sort((a,b)=>a-b);
    if (kmDays.length > 0) {
      const totalKm = kmDays.reduce((sum, d) => sum + kmDeductions[d], 0);
      categoryTexts.push(`KM: ${totalKm}km (${kmDays.length} days: ${kmDays.join(",")})`);
    }

    // Auto
    const autoDays = Object.keys(autoDeductions).map(Number).sort((a,b)=>a-b);
    if (autoDays.length > 0) {
      const totalAuto = autoDays.reduce((sum, d) => sum + autoDeductions[d], 0);
      categoryTexts.push(`Auto: ${totalAuto} (${autoDays.length} days: ${autoDays.join(",")})`);
    }

    // DA
    const daDays = Object.keys(daDeductions).map(Number).sort((a,b)=>a-b);
    if (daDays.length > 0) {
      const totalDa = daDays.reduce((sum, d) => sum + daDeductions[d], 0);
      categoryTexts.push(`DA: ${totalDa} (${daDays.length} days: ${daDays.join(",")})`);
    }

    // Hotel
    const hotelDays = Object.keys(hotelDeductions).map(Number).sort((a,b)=>a-b);
    if (hotelDays.length > 0) {
      const totalHotel = hotelDays.reduce((sum, d) => sum + hotelDeductions[d], 0);
      categoryTexts.push(`Hotel: ${totalHotel} (${hotelDays.length} days: ${hotelDays.join(",")})`);
    }

    // Spare
    const spareDays = Object.keys(spareDeductions).map(Number).sort((a,b)=>a-b);
    if (spareDays.length > 0) {
      const totalSpare = spareDays.reduce((sum, d) => sum + spareDeductions[d], 0);
      categoryTexts.push(`Spare: ${totalSpare} (${spareDays.length} days: ${spareDays.join(",")})`);
    }

    // Other
    const otherDays = Object.keys(otherDeductions).map(Number).sort((a,b)=>a-b);
    if (otherDays.length > 0) {
      const totalOther = otherDays.reduce((sum, d) => sum + otherDeductions[d], 0);
      categoryTexts.push(`Other: ${totalOther} (${otherDays.length} days: ${otherDays.join(",")})`);
    }

    const user_advance = advancesMap[(usr.user_id || "").toLowerCase()] || 0;
    const row_total = travel_expense + da_allowance + spare_purchase + courier_charges + boarding_lodging + printing_stationery;
    const net_payable = row_total - user_advance;

    // Next Month logic (e.g. July expense -> submitted date 5 August)
    const nextMonthMap = {
      january: "February",
      february: "March",
      march: "April",
      april: "May",
      may: "June",
      june: "July",
      july: "August",
      august: "September",
      september: "October",
      october: "November",
      november: "December",
      december: "January"
    };
    const mClean = month.trim().toLowerCase();
    let nextMonthName = "August";
    for (const [curr, next] of Object.entries(nextMonthMap)) {
      if (curr.startsWith(mClean) || mClean.startsWith(curr)) {
        nextMonthName = next;
        break;
      }
    }
    const submitted_date_val = `5 ${nextMonthName}`;

    // Case-insensitively deduplicate deduction reasons and comments
    const seenReasons = new Set();
    const uniqueReasons = [];
    for (const r of [...categoryTexts, ...allComments]) {
      if (!r) continue;
      const normalized = r.trim().toLowerCase().replace(/\s+/g, " ");
      if (!seenReasons.has(normalized)) {
        seenReasons.add(normalized);
        uniqueReasons.push(r.trim());
      }
    }
    const deduction_reason = uniqueReasons.join("; ");

    // Format Month as Month-Year (e.g. July-2026)
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
    const month_val = `${capitalizedMonth}-${year}`;

    // Resolve Manager Name
    const rawManager = (usr.manager || "").trim();
    const resolvedManager = rawManager && rawManager.toLowerCase() !== "none"
      ? (nameLookupMap[rawManager.toLowerCase()] || rawManager)
      : "";

    reportRows.push({
      zone: usr.zone || "",
      ee_code: usr.e_code || usr.user_id,
      grade: usr.grade || "",
      cc: usr.district || "",
      ee_name: usr.name,
      doj: usr.date_of_joining || "",
      submitted_date: submitted_date_val,
      mail_hard_copy: "Soft Copy",
      designation: usr.designation || "",
      travel_expense: Math.round(travel_expense * 100) / 100,
      bike_km: Math.round(bike_km * 100) / 100,
      car_km: Math.round(car_km * 100) / 100,
      auto_amount: Math.round(auto_amount * 100) / 100,
      train_bus_amount: Math.round(train_bus_amount * 100) / 100,
      da_allowance: Math.round(da_allowance * 100) / 100,
      spare_purchase: Math.round(spare_purchase * 100) / 100,
      courier_charges: Math.round(courier_charges * 100) / 100,
      boarding_lodging: Math.round(boarding_lodging * 100) / 100,
      printing_stationery: Math.round(printing_stationery * 100) / 100,
      misc_expenses: 0.0,
      fuel_expenses: 0.0,
      total: Math.round(row_total * 100) / 100,
      advance: Math.round(user_advance * 100) / 100,
      net_payable: Math.round(net_payable * 100) / 100,
      gst_bills: "",
      status: "Approved",
      deduction_reason: deduction_reason,
      month: month_val,
      hold_reason: "No",
      remarks: "",
      manager: resolvedManager,
      state: "Rajasthan",
      claimed_amount: Math.round(claimed_amount * 100) / 100
    });
  }

  return jsonResponse({ success: true, data: reportRows });
}

export async function handleServeExpenseAttachment(request, env, params, query, user) {
  const filename = params.filename;
  if (!filename) {
    return new Response("Filename is required", { status: 400 });
  }

  const key = `expense_attachments/${filename}`;

  // 1. If Cloudflare R2 bucket binding is available on env.BUCKET
  if (env.BUCKET) {
    try {
      const object = await env.BUCKET.get(key);
      if (object === null) {
        return new Response("File not found in R2 bucket", { status: 404 });
      }
      
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000");
      
      return new Response(object.body, {
        headers
      });
    } catch (e) {
      console.error("Error reading from env.BUCKET:", e);
    }
  }

  // 2. Fallback: If BUCKET is not bound directly but PRIMARY_CLOUDFLARE_ACCOUNT_ID is available (REST API)
  if (env.PRIMARY_CLOUDFLARE_ACCOUNT_ID) {
    const accountId = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
    const bucketName = "fieldops-uploads";
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;

    try {
      const token = env.PRIMARY_CLOUDFLARE_API_TOKEN;
      const email = env.PRIMARY_CLOUDFLARE_EMAIL;
      const headers = {};

      if (token && token.startsWith("cfk_")) {
        headers["X-Auth-Key"] = token;
        headers["X-Auth-Email"] = email || "Sunil.cyrixrjbemp@gmail.com";
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        method: "GET",
        headers: headers
      });

      if (res.status === 200) {
        const contentType = res.headers.get("Content-Type") || "application/octet-stream";
        return new Response(res.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000"
          }
        });
      } else {
        return new Response("File not found in fallback R2", { status: 404 });
      }
    } catch (e) {
      console.error("Error serving R2 object via fallback:", e);
    }
  }

  return new Response("Storage not configured", { status: 500 });
}

/**
 * GET /api/expense/team-users
 * Returns list of team members for whom the current user is a manager, coordinator, or zonal manager.
 */
export async function handleGetTeamUsers(request, env, params, query, user) {
  let teamUsers = [];
  const userRoleClean = (user.role || "").trim().toLowerCase();
  const isAdminOrReportViewer = ["admin", "mis", "vp", "accountant"].includes(userRoleClean);

  if (isAdminOrReportViewer) {
    const res = await env.DB.prepare("SELECT id, user_id, name, role, zone, district, designation, manager FROM users ORDER BY name ASC").all();
    teamUsers = res.results || [];
  } else {
    const nameClean = (user.name || "").trim();
    const uidClean = (user.user_id || "").trim();

    // Query direct reports
    const directReportsRes = await env.DB.prepare(`
      SELECT id, user_id, name, role, zone, district, designation, manager FROM users
      WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
         OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
      ORDER BY name ASC
    `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all();
    const directReports = directReportsRes.results || [];

    // Query hierarchy reports
    const hierarchyApprovals = await env.DB.prepare(`
      SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
    `).bind(user.id).all();
    
    let hierarchyReports = [];
    if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
      const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
      const placeholders = hIds.map(() => "?").join(",");
      const reqsRes = await env.DB.prepare(`
        SELECT u.id, u.user_id, u.name, u.role, u.zone, u.district, u.designation, u.manager FROM users u
        JOIN hierarchy_requesters hr ON u.id = hr.user_id
        WHERE hr.hierarchy_id IN (${placeholders})
        ORDER BY u.name ASC
      `).bind(...hIds).all();
      hierarchyReports = reqsRes.results || [];
    }

    // Merge and de-duplicate team users
    const reportsMap = {};
    for (const u of [...directReports, ...hierarchyReports]) {
      reportsMap[u.id] = u;
    }
    teamUsers = Object.values(reportsMap);
  }

  return jsonResponse(teamUsers);
}

/**
 * GET /api/expense/kpi-appraisal
 * Query parameter user_id, month, year.
 */
export async function handleGetKpiAppraisal(request, env, params, query, user) {
  const targetUserId = query.user_id;
  const month = query.month;
  const yearStr = query.year;
  
  if (!targetUserId || !month || !yearStr) {
    return jsonResponse({ error: "Missing required parameters: user_id, month, year" }, 400);
  }
  const year = parseInt(yearStr);

  // Authorization check: User can read their own. Managers can read their reports.
  if (targetUserId !== "self" && targetUserId !== user.user_id) {
    const isAllowed = await isManagerOfUser(user, targetUserId, env);
    if (!isAllowed) {
      return jsonResponse({ error: "Access denied" }, 403);
    }
  }

  const eCode = targetUserId === "self" ? user.user_id : targetUserId;

  const appraisal = await env.DB.prepare(`
    SELECT * FROM kpi_appraisals WHERE user_id = ? AND month = ? AND year = ?
  `).bind(eCode, month, year).first();

  if (!appraisal) {
    return jsonResponse({
      user_id: eCode,
      month,
      year,
      self_achieved_values: "{}",
      manager_achieved_values: "{}",
      core_ratings: "{}",
      submitted_by_self: 0,
      submitted_by_manager: 0
    });
  }

  return jsonResponse(appraisal);
}

/**
 * POST /api/expense/kpi-appraisal
 */
export async function handleSaveKpiAppraisal(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, month, year: yearVal, self_achieved_values, manager_achieved_values, core_ratings, type } = body;

  if (!user_id || !month || !yearVal || !type) {
    return jsonResponse({ error: "Missing required fields: user_id, month, year, type" }, 400);
  }

  const year = parseInt(yearVal);
  const targetCode = user_id === "self" ? user.user_id : user_id;

  // Authorization check
  if (type === "self") {
    if (targetCode !== user.user_id) {
      return jsonResponse({ error: "Access denied. Cannot submit self assessment for another user." }, 403);
    }
  } else if (type === "manager") {
    const isAllowed = await isManagerOfUser(user, targetCode, env);
    if (!isAllowed) {
      return jsonResponse({ error: "Access denied. You are not a manager of this user." }, 403);
    }
  } else {
    return jsonResponse({ error: "Invalid submission type" }, 400);
  }

  // Check if appraisal record exists
  const existing = await env.DB.prepare(`
    SELECT user_id FROM kpi_appraisals WHERE user_id = ? AND month = ? AND year = ?
  `).bind(targetCode, month, year).first();

  if (existing) {
    if (type === "self") {
      await env.DB.prepare(`
        UPDATE kpi_appraisals
        SET self_achieved_values = ?, submitted_by_self = 1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND month = ? AND year = ?
      `).bind(JSON.stringify(self_achieved_values || {}), targetCode, month, year).run();
    } else {
      await env.DB.prepare(`
        UPDATE kpi_appraisals
        SET manager_achieved_values = ?, core_ratings = ?, submitted_by_manager = 1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND month = ? AND year = ?
      `).bind(JSON.stringify(manager_achieved_values || {}), JSON.stringify(core_ratings || {}), targetCode, month, year).run();
    }
  } else {
    if (type === "self") {
      await env.DB.prepare(`
        INSERT INTO kpi_appraisals (user_id, month, year, self_achieved_values, manager_achieved_values, core_ratings, submitted_by_self, submitted_by_manager)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0)
      `).bind(targetCode, month, year, JSON.stringify(self_achieved_values || {}), "{}", "{}").run();
    } else {
      await env.DB.prepare(`
        INSERT INTO kpi_appraisals (user_id, month, year, self_achieved_values, manager_achieved_values, core_ratings, submitted_by_self, submitted_by_manager)
        VALUES (?, ?, ?, ?, ?, ?, 0, 1)
      `).bind(targetCode, month, year, "{}", JSON.stringify(manager_achieved_values || {}), JSON.stringify(core_ratings || {})).run();
    }
  }

  return jsonResponse({ success: true, message: "Appraisal saved successfully." });
}

// Helper: check hierarchy
async function isManagerOfUser(managerUser, targetUserId, env) {
  const managerRoleClean = (managerUser.role || "").trim().toLowerCase();
  if (["admin", "mis", "vp", "accountant"].includes(managerRoleClean)) {
    return true;
  }
  
  const nameClean = (managerUser.name || "").trim();
  const uidClean = (managerUser.user_id || "").trim();
  
  const directReport = await env.DB.prepare(`
    SELECT id FROM users
    WHERE user_id = ? AND (
      LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
      OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
      OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
    )
  `).bind(
    targetUserId,
    nameClean.toLowerCase(), uidClean.toLowerCase(),
    nameClean.toLowerCase(), uidClean.toLowerCase(),
    nameClean.toLowerCase(), uidClean.toLowerCase()
  ).first();
  
  if (directReport) return true;

  // Check hierarchy
  const hierarchyApprovals = await env.DB.prepare(`
    SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
  `).bind(managerUser.id).all();

  if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
    const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
    const placeholders = hIds.map(() => "?").join(",");
    const req = await env.DB.prepare(`
      SELECT u.id FROM users u
      JOIN hierarchy_requesters hr ON u.id = hr.user_id
      WHERE u.user_id = ? AND hr.hierarchy_id IN (${placeholders})
    `).bind(targetUserId, ...hIds).first();
    if (req) return true;
  }

  return false;
}

export async function handleGetPolicyRules(req, env, params, query) {
  try {
    const grade = query.grade ? decodeURIComponent(query.grade).trim() : null;
    let results;
    if (grade) {
      results = await env.DB.prepare(
        "SELECT * FROM expense_policy_rules WHERE LOWER(grade) = ? ORDER BY id ASC"
      ).bind(grade.toLowerCase()).all();
    } else {
      results = await env.DB.prepare(
        "SELECT * FROM expense_policy_rules ORDER BY grade ASC, id ASC"
      ).all();
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: results.results || []
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        detail: `Failed to fetch policy rules: ${err.message}`
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}


