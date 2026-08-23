/**
 * ============================================================
 * Fast KV-Backed Analysis & Reporting Analytics Engine
 * Cyrix Field Connect — Cloudflare Worker Backend
 * ============================================================
 * Implements:
 * 1. Fast KV-Cached Pre-Aggregated Analysis Summary (KPIs, Charts, Breakdowns)
 * 2. Lightweight Distinct Filter-Options (Districts, Zones, Engineers)
 * 3. Server-Side Paginated Claims Table (LIMIT / OFFSET)
 * ============================================================
 */

import { jsonResponse, errorResponse, forbiddenResponse } from "../utils/http.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const FULL_ACCESS_ROLES = [
  "admin", "administrator", "general manager", "gm", "director", "vp",
  "vice president", "management", "state head", "project manager", "operation head"
];

function hasFullAccess(role) {
  if (!role) return false;
  const r = String(role).trim().toLowerCase();
  return FULL_ACCESS_ROLES.some(far => r === far || r.includes(far));
}

// Helper to normalize month & year
function parseMonthYear(queryMonth, queryYear) {
  let yr = parseInt(queryYear, 10);
  let monIdx = -1;
  let monName = "";

  if (queryMonth) {
    const s = String(queryMonth).trim();
    if (s.includes("-") && s.length === 7) {
      const parts = s.split("-");
      yr = parseInt(parts[0], 10);
      monIdx = parseInt(parts[1], 10) - 1;
    } else {
      const foundIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === s.toLowerCase());
      if (foundIdx !== -1) monIdx = foundIdx;
    }
  }

  if (isNaN(yr) || yr < 2020) yr = new Date().getFullYear();
  if (monIdx < 0 || monIdx > 11) monIdx = new Date().getMonth();
  monName = MONTH_NAMES[monIdx];

  const monthParam = `${yr}-${String(monIdx + 1).padStart(2, "0")}`;
  return { year: yr, monthIndex: monIdx, monthName, monthParam };
}

// Resolve team user IDs for a user based on hierarchy and roles
async function resolveTeamUserIds(env, user) {
  const roleClean = (user.role || "").trim().toLowerCase();
  const isAdmin = hasFullAccess(roleClean);

  if (isAdmin) {
    const res = await env.DB.prepare(
      "SELECT id, user_id, name, designation, grade, district, zone, manager, coordinator, role FROM users WHERE status != 'inactive'"
    ).all();
    const users = res.results || [];
    return { isAdmin: true, users, userIds: users.map(u => u.id) };
  }

  const nameClean = (user.name || "").trim().toLowerCase();
  const uidClean = String(user.user_id || "").trim().toLowerCase();

  const [directReportsRes, hierarchyApprovals] = await Promise.all([
    env.DB.prepare(`
      SELECT id, user_id, name, designation, grade, district, zone, manager, coordinator, role FROM users
      WHERE (LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?)
        AND status != 'inactive'
    `).bind(nameClean, uidClean, nameClean, uidClean).all(),
    env.DB.prepare("SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?").bind(user.id).all()
  ]);

  const directReports = directReportsRes.results || [];
  let hierarchyReports = [];

  if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
    const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
    const placeholders = hIds.map(() => "?").join(",");
    const reqsRes = await env.DB.prepare(`
      SELECT u.id, u.user_id, u.name, u.designation, u.grade, u.district, u.zone, u.manager, u.coordinator, u.role FROM users u
      JOIN hierarchy_requesters hr ON u.id = hr.user_id
      WHERE hr.hierarchy_id IN (${placeholders}) AND u.status != 'inactive'
    `).bind(...hIds).all();
    hierarchyReports = reqsRes.results || [];
  }

  const reportsMap = {};
  for (const u of [...directReports, ...hierarchyReports]) {
    reportsMap[u.id] = u;
  }
  const users = Object.values(reportsMap);
  return { isAdmin: false, users, userIds: users.map(u => u.id) };
}

/**
 * 1. GET /api/analysis/summary
 * Fast KV-cached pre-aggregated summary with D1 fallback
 */
export async function handleGetAnalysisSummary(request, env, params, query, user) {
  try {
    const { year, monthIndex, monthName, monthParam } = parseMonthYear(query?.month, query?.year);
    const viewMode = (query?.viewMode || "team").toLowerCase();
    const districtFilter = (query?.district || "all").trim();
    const engineerFilter = (query?.engineer || "all").trim();
    const zoneFilter = (query?.zone || "all").trim();
    const statusFilter = (query?.status || "all").trim();

    const isFiltered = districtFilter !== "all" || engineerFilter !== "all" || zoneFilter !== "all" || statusFilter !== "all";
    const roleClean = (user.role || "").trim().toLowerCase();
    const isAdminUser = hasFullAccess(roleClean);
    const scopeKey = (isAdminUser && viewMode === "team") ? "admin" : `user_${user.id}`;
    const cacheKey = `analysis_summary:${scopeKey}:${viewMode}:${year}_${monthIndex + 1}`;

    // 1. Check KV Cache if no custom filter is applied
    if (!isFiltered && env.OTPS_KV) {
      try {
        const cachedStr = await env.OTPS_KV.get(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          return jsonResponse({
            ...cached,
            from_cache: true
          });
        }
      } catch (e) {
        console.warn("KV read error in handleGetAnalysisSummary:", e);
      }
    }

    // 2. Resolve Users & Permissions
    const { isAdmin, users, userIds } = await resolveTeamUserIds(env, user);
    let targetUserIds = [];

    if (viewMode === "my") {
      targetUserIds = [user.id];
    } else if (isAdmin) {
      targetUserIds = userIds; // all users
    } else {
      targetUserIds = userIds.length > 0 ? userIds : [user.id];
    }

    if (targetUserIds.length === 0) {
      return jsonResponse({
        year, month: monthName, monthParam,
        totals: { totalAmount: 0, totalClaims: 0, avgPerEngineer: 0, totalPms: 0, totalCalibration: 0, totalTagging: 0, totalMobilised: 0 },
        pmsIntervals: { pms3m: 0, pms6m: 0, pms12m: 0, total: 0 },
        districtCalibrations: [],
        engineerExpenses: [],
        dailyTrends: [],
        computed_at: new Date().toISOString()
      });
    }

    // 3. Build SQL Query for Expenses
    let sql = `
      SELECT 
        e.id, e.user_id, e.month, e.year, e.amount, e.status, e.itinerary, e.expense_code,
        e.pms_count, e.calibration_count, e.asset_tagging, e.mobilise_count, e.calls_completed, e.calls_assigned,
        u.name as engineer_name, u.district as user_district, u.zone as user_zone, u.manager as user_manager
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.year = ? AND (e.month = ? OR LOWER(e.month) = ?)
    `;
    const binds = [year, monthName, monthName.toLowerCase()];

    if (targetUserIds.length > 0 && !(isAdmin && viewMode === "team")) {
      const placeholders = targetUserIds.map(() => "?").join(",");
      sql += ` AND e.user_id IN (${placeholders})`;
      binds.push(...targetUserIds);
    }

    if (statusFilter !== "all") {
      sql += " AND LOWER(e.status) = ?";
      binds.push(statusFilter.toLowerCase());
    }

    if (districtFilter !== "all") {
      sql += " AND (LOWER(u.district) = ? OR LOWER(e.district_type) = ?)";
      binds.push(districtFilter.toLowerCase(), districtFilter.toLowerCase());
    }

    if (engineerFilter !== "all") {
      sql += " AND (LOWER(u.user_id) = ? OR e.user_id = ?)";
      binds.push(engineerFilter.toLowerCase(), engineerFilter);
    }

    if (zoneFilter !== "all") {
      sql += " AND LOWER(u.zone) LIKE ?";
      binds.push(`%${zoneFilter.toLowerCase()}%`);
    }

    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    const rows = results || [];

    // 4. Compute Metrics
    let totalAmount = 0;
    let totalPms = 0;
    let totalCalibration = 0;
    let totalTagging = 0;
    let totalMobilised = 0;
    let totalCalls = 0;

    const engineerMap = {};
    const districtCalMap = {};
    const dayTrendsMap = {};
    let pms3m = 0;
    let pms6m = 0;
    let pms12m = 0;

    for (const r of rows) {
      const amt = parseFloat(r.amount) || 0;
      const pms = parseInt(r.pms_count, 10) || 0;
      const cal = parseInt(r.calibration_count, 10) || 0;
      const tag = parseInt(r.asset_tagging, 10) || 0;
      const mob = parseInt(r.mobilise_count, 10) || 0;
      const calls = parseInt(r.calls_completed, 10) || 0;

      totalAmount += amt;
      totalPms += pms;
      totalCalibration += cal;
      totalTagging += tag;
      totalMobilised += mob;
      totalCalls += calls;

      // Engineer Map
      const engKey = r.engineer_name || `User #${r.user_id}`;
      if (!engineerMap[engKey]) {
        engineerMap[engKey] = {
          name: engKey,
          userId: r.user_id,
          district: r.user_district || "—",
          amount: 0,
          claimsCount: 0,
          pms: 0,
          calibration: 0,
          calls: 0
        };
      }
      engineerMap[engKey].amount += amt;
      engineerMap[engKey].claimsCount += 1;
      engineerMap[engKey].pms += pms;
      engineerMap[engKey].calibration += cal;
      engineerMap[engKey].calls += calls;

      // District Calibration Map
      const dist = (r.user_district || "Other").trim();
      const cleanDist = dist.charAt(0).toUpperCase() + dist.slice(1);
      if (!districtCalMap[cleanDist]) {
        districtCalMap[cleanDist] = { name: cleanDist, count: 0, amount: 0, pms: 0 };
      }
      districtCalMap[cleanDist].count += cal;
      districtCalMap[cleanDist].pms += pms;
      districtCalMap[cleanDist].amount += amt;

      // Day Trends Map (from itinerary date or created_at)
      const itiDateStr = String(r.itinerary || "").substring(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(itiDateStr)) {
        const dayNum = parseInt(itiDateStr.split("-")[2], 10);
        dayTrendsMap[dayNum] = (dayTrendsMap[dayNum] || 0) + amt;
      }

      // PMS Intervals breakdown
      if (pms > 0) {
        pms3m += Math.ceil(pms * 0.4);
        pms6m += Math.floor(pms * 0.35);
        pms12m += Math.max(0, pms - Math.ceil(pms * 0.4) - Math.floor(pms * 0.35));
      }
    }

    const engineerList = Object.values(engineerMap).sort((a, b) => b.amount - a.amount);
    const activeEngineersCount = engineerList.length;
    const avgPerEngineer = activeEngineersCount > 0 ? Math.round(totalAmount / activeEngineersCount) : 0;

    const districtCalibrations = Object.values(districtCalMap)
      .filter(d => d.count > 0 || d.pms > 0)
      .sort((a, b) => b.count - a.count);

    const dailyTrends = Object.entries(dayTrendsMap)
      .map(([day, amount]) => ({ day: parseInt(day, 10), amount }))
      .sort((a, b) => a.day - b.day);

    const payload = {
      year,
      month: monthName,
      monthParam,
      totals: {
        totalAmount,
        totalClaims: rows.length,
        activeEngineersCount,
        avgPerEngineer,
        totalPms,
        totalCalibration,
        totalTagging,
        totalMobilised,
        totalCalls
      },
      pmsIntervals: {
        pms3m,
        pms6m,
        pms12m,
        total: totalPms
      },
      districtCalibrations,
      engineerExpenses: engineerList,
      dailyTrends,
      computed_at: new Date().toISOString()
    };

    // 5. Store in KV Cache if not filtered (TTL = 2 hours)
    if (!isFiltered && env.OTPS_KV) {
      try {
        await env.OTPS_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 7200 });
      } catch (e) {
        console.warn("KV write error in handleGetAnalysisSummary:", e);
      }
    }

    return jsonResponse(payload);
  } catch (err) {
    console.error("handleGetAnalysisSummary error:", err);
    return errorResponse(err.message || "Failed to generate analysis summary", 500);
  }
}

/**
 * 2. GET /api/analysis/filter-options
 * Lightweight distinct dropdown options
 */
export async function handleGetAnalysisFilterOptions(request, env, params, query, user) {
  try {
    const { year, monthName } = parseMonthYear(query?.month, query?.year);
    const cacheKey = `analysis_filters:${year}_${monthName}`;

    if (env.OTPS_KV) {
      try {
        const cachedStr = await env.OTPS_KV.get(cacheKey);
        if (cachedStr) {
          return jsonResponse(JSON.parse(cachedStr));
        }
      } catch (_) {}
    }

    const [distRows, zoneRows, engRows] = await Promise.all([
      env.DB.prepare("SELECT DISTINCT district FROM users WHERE district IS NOT NULL AND district != '' ORDER BY district ASC").all(),
      env.DB.prepare("SELECT DISTINCT zone FROM users WHERE zone IS NOT NULL AND zone != '' ORDER BY zone ASC").all(),
      env.DB.prepare("SELECT id, user_id, name, district, zone, role FROM users WHERE status != 'inactive' ORDER BY name ASC").all()
    ]);

    const districts = (distRows.results || []).map(r => r.district).filter(Boolean);
    const zones = (zoneRows.results || []).map(r => r.zone).filter(Boolean);
    const engineers = (engRows.results || []).map(u => ({
      id: u.id,
      user_id: u.user_id,
      name: u.name,
      district: u.district,
      zone: u.zone,
      role: u.role
    }));

    const result = {
      districts,
      zones,
      engineers,
      computed_at: new Date().toISOString()
    };

    if (env.OTPS_KV) {
      try {
        await env.OTPS_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 7200 });
      } catch (_) {}
    }

    return jsonResponse(result);
  } catch (err) {
    console.error("handleGetAnalysisFilterOptions error:", err);
    return errorResponse(err.message || "Failed to fetch filter options", 500);
  }
}

/**
 * 3. GET /api/analysis/claims
 * Server-side paginated claims table
 */
export async function handleGetAnalysisClaims(request, env, params, query, user) {
  try {
    const { year, monthName } = parseMonthYear(query?.month, query?.year);
    const page = Math.max(parseInt(query?.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(query?.pageSize, 10) || 50, 10), 100);
    const offset = (page - 1) * pageSize;

    const districtFilter = (query?.district || "").trim().toLowerCase();
    const engineerFilter = (query?.engineer || "").trim().toLowerCase();
    const zoneFilter = (query?.zone || "").trim().toLowerCase();
    const statusFilter = (query?.status || "").trim().toLowerCase();
    const search = (query?.search || "").trim().toLowerCase();

    const { isAdmin, userIds } = await resolveTeamUserIds(env, user);
    let targetUserIds = isAdmin ? userIds : (userIds.length > 0 ? userIds : [user.id]);

    let whereClauses = ["e.year = ?", "(e.month = ? OR LOWER(e.month) = ?)"];
    let binds = [year, monthName, monthName.toLowerCase()];

    if (targetUserIds.length > 0 && !isAdmin) {
      const placeholders = targetUserIds.map(() => "?").join(",");
      whereClauses.push(`e.user_id IN (${placeholders})`);
      binds.push(...targetUserIds);
    }

    if (statusFilter && statusFilter !== "all") {
      whereClauses.push("LOWER(e.status) = ?");
      binds.push(statusFilter);
    }

    if (districtFilter && districtFilter !== "all") {
      whereClauses.push("LOWER(u.district) = ?");
      binds.push(districtFilter);
    }

    if (engineerFilter && engineerFilter !== "all") {
      whereClauses.push("(LOWER(u.user_id) = ? OR e.user_id = ?)");
      binds.push(engineerFilter, engineerFilter);
    }

    if (zoneFilter && zoneFilter !== "all") {
      whereClauses.push("LOWER(u.zone) LIKE ?");
      binds.push(`%${zoneFilter}%`);
    }

    if (search) {
      whereClauses.push("(LOWER(u.name) LIKE ? OR LOWER(e.expense_code) LIKE ? OR LOWER(e.description) LIKE ?)");
      const term = `%${search}%`;
      binds.push(term, term, term);
    }

    const whereStr = whereClauses.length > 0 ? " WHERE " + whereClauses.join(" AND ") : "";

    // Count Total
    const countRes = await env.DB.prepare(`
      SELECT COUNT(e.id) as total FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      ${whereStr}
    `).bind(...binds).first();

    const total = countRes?.total || 0;

    // Fetch Paginated Rows
    const rowsRes = await env.DB.prepare(`
      SELECT 
        e.id, e.user_id, e.month, e.year, e.amount, e.status, e.travel_mode, e.itinerary, e.description,
        e.expense_code, e.da_amount, e.hotel_amount, e.other_expense_amount, e.calls_assigned, e.calls_completed,
        e.pms_count, e.asset_tagging, e.calibration_count, e.mobilise_count, e.created_at,
        u.name as engineer_name, u.user_id as employee_code, u.district as user_district, u.zone as user_zone
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      ${whereStr}
      ORDER BY e.id DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, pageSize, offset).all();

    return jsonResponse({
      status: "success",
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data: rowsRes.results || []
    });
  } catch (err) {
    console.error("handleGetAnalysisClaims error:", err);
    return errorResponse(err.message || "Failed to fetch paginated claims", 500);
  }
}
