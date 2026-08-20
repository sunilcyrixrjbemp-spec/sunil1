/**
 * 🔒 BEMMP Rajasthan Contract Live Penalty Engine (RMSCL NIB-825 Specs)
 * Real-time dynamic computation with zero static database bloat
 */

import { jsonResponse, errorResponse } from "../utils/http.js";

// Helper: Parse date strings flexibly
export function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const s = String(val).trim();
  if (!s || s === "--") return null;

  // Custom format: "26-Jul-2025 10:30:29" or "26-Jul-2025"
  const customRegex = /^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
  const match = s.match(customRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const year = parseInt(match[3], 10);
    const hrs = match[4] ? parseInt(match[4], 10) : 0;
    const mins = match[5] ? parseInt(match[5], 10) : 0;
    const secs = match[6] ? parseInt(match[6], 10) : 0;

    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    if (monthMap[monthStr] !== undefined) {
      return new Date(Date.UTC(year, monthMap[monthStr], day, hrs, mins, secs));
    }
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// In-memory isolate cache for masters (re-fetched every 10 minutes or on demand)
let cachedMasters = null;
let lastMasterFetch = 0;
const CACHE_TTL = 10 * 60 * 1000;

export async function getPenaltyMasters(env, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedMasters && (now - lastMasterFetch < CACHE_TTL)) {
    return cachedMasters;
  }

  const [critRows, hospRows, assetRows, standbyRows, diRows] = await Promise.all([
    env.DB.prepare(`SELECT equipment_name FROM penalty_critical_equipments`).all(),
    env.DB.prepare(`SELECT facility_name, facility_type FROM penalty_main_hospitals`).all(),
    env.DB.prepare(`SELECT equipment_name, tender_cost FROM penalty_asset_values`).all(),
    env.DB.prepare(`SELECT complaint_id FROM penalty_standby_data`).all(),
    env.DB.prepare(`SELECT district_name, hospital_name, di_name, coordinator_name, zone_name FROM penalty_di_coordinators`).all()
  ]);

  const criticalSet = new Set((critRows.results || []).map(r => String(r.equipment_name || '').toLowerCase().trim()));
  
  const mchMap = new Map();
  for (const r of (hospRows.results || [])) {
    mchMap.set(String(r.facility_name || '').toLowerCase().trim(), String(r.facility_type || 'MCH').trim());
  }

  const assetMap = new Map();
  for (const r of (assetRows.results || [])) {
    assetMap.set(String(r.equipment_name || '').toLowerCase().trim(), parseFloat(r.tender_cost) || 0);
  }

  const standbySet = new Set((standbyRows.results || []).map(r => String(r.complaint_id || '').trim()));

  const diList = diRows.results || [];
  const diMapByHosp = new Map();
  const diMapByDist = new Map();
  for (const r of diList) {
    if (r.hospital_name) {
      diMapByHosp.set(String(r.hospital_name).toLowerCase().trim(), r);
    }
    if (r.district_name && !diMapByDist.has(String(r.district_name).toLowerCase().trim())) {
      diMapByDist.set(String(r.district_name).toLowerCase().trim(), r);
    }
  }

  cachedMasters = {
    criticalSet,
    mchMap,
    assetMap,
    standbySet,
    diMapByHosp,
    diMapByDist
  };
  lastMasterFetch = now;

  return cachedMasters;
}

/**
 * 🔒 Pure Computation Engine for a single Complaint record
 */
export function computeComplaintPenalty(complaint, masters, nowMs = Date.now()) {
  const { criticalSet, mchMap, assetMap, standbySet, diMapByHosp, diMapByDist } = masters;
  
  const eqName = (complaint.equipment_name || "").trim();
  const hospName = (complaint.hospital_name || "").trim();
  const hospType = (complaint.hospital_type || "").trim();
  const distName = (complaint.district_name || "").trim();
  const complaintId = String(complaint.complaint_id || "").trim();
  const isWarranty = (complaint.is_under_warranty || "").trim().toLowerCase() === "yes";
  const isStandby = standbySet.has(complaintId) || (complaint.is_under_warranty || "").trim().toLowerCase() === "yes";

  // 1. Determine Hospital Category (MCH vs Others)
  let isMch = false;
  const hospNameLower = hospName.toLowerCase();
  const hospTypeLower = hospType.toLowerCase();

  if (mchMap.has(hospNameLower)) {
    isMch = true;
  } else if (hospTypeLower.includes("medical college") || hospTypeLower.includes("mch")) {
    isMch = true;
  }

  // 2. Critical Equipment (+10% surcharge)
  const isCritical = criticalSet.has(eqName.toLowerCase());

  // 3. Asset Value
  let assetValue = parseFloat(complaint.estimated_cost) || 0;
  if (assetValue <= 0 && assetMap.has(eqName.toLowerCase())) {
    assetValue = assetMap.get(eqName.toLowerCase()) || 0;
  }

  // 4. Penalty Slab per unit interval
  let slab = 500;
  if (assetValue > 10000 && assetValue <= 100000) slab = 1000;
  else if (assetValue > 100000 && assetValue <= 1000000) slab = 2000;
  else if (assetValue > 1000000) slab = 3000;

  // 5. Dates
  const raiseDate = parseDate(complaint.complaint_raise_date);
  const attendDate = parseDate(complaint.attend_date);
  const closeDate = parseDate(complaint.complaint_close_date || complaint.complaint_final_close);
  const status = (complaint.complaint_status || "").trim();
  const statusLower = status.toLowerCase();
  const isOpen = !closeDate || ["open", "attended", "pending", "re-open"].includes(statusLower);

  const raiseMs = raiseDate ? raiseDate.getTime() : null;
  const attendMs = attendDate ? attendDate.getTime() : null;
  const closeMs = closeDate ? closeDate.getTime() : (isOpen ? nowMs : null);

  // 6. Attend Penalty Calculation (MCH SLA = 1 Hr, Others SLA = 24 Hrs)
  let attendPenalty = 0;
  let attendHourDiff = 0;
  let attendPerDay = 0;

  if (raiseMs) {
    const effectiveAttendMs = attendMs || nowMs;
    attendHourDiff = Math.max((effectiveAttendMs - raiseMs) / (1000 * 60 * 60), 0);

    if (!isWarranty && !isStandby) {
      if (isMch) {
        if (attendHourDiff > 1) {
          const daysOver = Math.floor(attendHourDiff / 24);
          let base = 500 + 500 * daysOver;
          if (isCritical) base *= 1.1;
          attendPenalty = base;
        }
      } else {
        if (attendHourDiff > 24) {
          const daysOver = Math.floor(attendHourDiff / 24);
          let base = 500 * daysOver;
          if (isCritical) base *= 1.1;
          attendPenalty = base;
        }
      }
    }

    if (isOpen && !attendDate) {
      attendPerDay = isCritical ? 550 : 500;
    }
  }

  // 7. Delay / Downtime Penalty Calculation
  let graceHours = 48;
  if (isMch) {
    graceHours = 6;
  } else if (
    hospTypeLower.includes("chc") ||
    hospTypeLower.includes("phc") ||
    hospTypeLower.includes("uchc") ||
    hospTypeLower.includes("uphc") ||
    hospTypeLower.includes("dispensary") ||
    hospTypeLower.includes("ddw")
  ) {
    graceHours = 72;
  }

  let delayPenalty = 0;
  let penaltyDownDays = 0;
  let perDayDelayPenalty = 0;

  if (raiseMs && closeMs) {
    const penaltyStartMs = raiseMs + (graceHours * 60 * 60 * 1000);
    const downDurationMs = closeMs - penaltyStartMs;

    if (downDurationMs > 0) {
      penaltyDownDays = Math.ceil(downDurationMs / (1000 * 60 * 60 * 24));

      if (!isStandby && !isWarranty) {
        let base = isMch ? (slab * penaltyDownDays * 2) : (slab * penaltyDownDays * 1);
        if (isCritical) base *= 1.1;
        delayPenalty = base;
      }
    }

    if (isOpen && !isStandby && !isWarranty) {
      let baseDaily = isMch ? (slab * 2) : slab;
      if (isCritical) baseDaily *= 1.1;
      perDayDelayPenalty = baseDaily;
    }
  }

  const totalPenalty = attendPenalty + delayPenalty;
  const totalPerDay = perDayDelayPenalty + attendPerDay;

  // DI & Coordinator mapping
  const diInfo = diMapByHosp.get(hospNameLower) || diMapByDist.get(distName.toLowerCase()) || {};

  return {
    complaint_id: complaint.complaint_id,
    district_name: complaint.district_name || diInfo.district_name || "",
    hospital_name: complaint.hospital_name || "",
    hospital_type: isMch ? "MCH" : "Others",
    equipment_name: complaint.equipment_name || "",
    equipment_model: complaint.equipment_model || "",
    is_critical: isCritical,
    asset_value: assetValue,
    penalty_slab: slab,
    status: isOpen ? "Open" : "Closed",
    complaint_status: complaint.complaint_status || (isOpen ? "Open" : "Closed"),
    is_under_warranty: isWarranty ? "Yes" : "No",
    standby: isStandby ? "Yes" : "No",
    attend_hour_diff: Number(attendHourDiff.toFixed(2)),
    attend_penalty: Math.round(attendPenalty),
    attend_per_day: Math.round(attendPerDay),
    penalty_down_days: penaltyDownDays,
    delay_penalty: Math.round(delayPenalty),
    per_day_delay_penalty: Math.round(perDayDelayPenalty),
    total_penalty: Math.round(totalPenalty),
    total_per_day: Math.round(totalPerDay),
    di_name: diInfo.di_name || "",
    coordinator_name: diInfo.coordinator_name || "",
    zone_name: diInfo.zone_name || "",
    complaint_raise_date: complaint.complaint_raise_date || "",
    complaint_close_date: complaint.complaint_close_date || "",
    attend_date: complaint.attend_date || "",
    bar_code: complaint.bar_code || ""
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/complaints/live-penalty/summary
 * Real-time overall KPI metrics and District/Coordinator breakdowns
 */
export async function handleLivePenaltySummary(request, env, params, query, user) {
  try {
    const masters = await getPenaltyMasters(env);
    const nowMs = Date.now();

    // Query all complaints (or active/open by default if requested)
    const { results } = await env.DB.prepare(`
      SELECT 
        complaint_id, district_name, hospital_type, hospital_name, bar_code,
        equipment_name, equipment_model, complaint_raise_date, complaint_close_date,
        complaint_status, total_downtime, estimated_cost, penalty_days,
        complaint_final_close, attend_date, is_under_warranty
      FROM complaints
    `).all();

    let totalPenalty = 0;
    let totalPerDay = 0;
    let openTickets = 0;
    let closedTickets = 0;
    let openPenaltyTickets = 0;
    let criticalOpenCount = 0;
    let mchOpenCount = 0;
    let othersOpenCount = 0;
    let mchPerDay = 0;
    let othersPerDay = 0;
    let totalAttendPenalty = 0;
    let totalDelayPenalty = 0;

    const districtMap = new Map();
    const coordinatorMap = new Map();
    const zoneMap = new Map();

    for (const c of (results || [])) {
      const calc = computeComplaintPenalty(c, masters, nowMs);

      totalPenalty += calc.total_penalty;
      totalAttendPenalty += calc.attend_penalty;
      totalDelayPenalty += calc.delay_penalty;

      if (calc.status === "Open") {
        openTickets++;
        totalPerDay += calc.total_per_day;
        if (calc.total_penalty > 0 || calc.total_per_day > 0) {
          openPenaltyTickets++;
        }
        if (calc.is_critical) criticalOpenCount++;
        if (calc.hospital_type === "MCH") {
          mchOpenCount++;
          mchPerDay += calc.total_per_day;
        } else {
          othersOpenCount++;
          othersPerDay += calc.total_per_day;
        }
      } else {
        closedTickets++;
      }

      // District Aggregation
      const dist = calc.district_name || "Unknown";
      if (!districtMap.has(dist)) {
        districtMap.set(dist, {
          district: dist,
          di_name: calc.di_name,
          coordinator: calc.coordinator_name,
          zone: calc.zone_name,
          open_tickets: 0,
          open_penalty_tickets: 0,
          total_penalty: 0,
          per_day_penalty: 0,
          mch_per_day: 0,
          others_per_day: 0,
          unattended_count: 0
        });
      }
      const dStat = districtMap.get(dist);
      dStat.total_penalty += calc.total_penalty;
      if (calc.status === "Open") {
        dStat.open_tickets++;
        dStat.per_day_penalty += calc.total_per_day;
        if (calc.total_penalty > 0 || calc.total_per_day > 0) dStat.open_penalty_tickets++;
        if (calc.hospital_type === "MCH") dStat.mch_per_day += calc.total_per_day;
        else dStat.others_per_day += calc.total_per_day;
        if (!calc.attend_date) dStat.unattended_count++;
      }

      // Coordinator Aggregation
      const coord = calc.coordinator_name || "Unassigned";
      if (!coordinatorMap.has(coord)) {
        coordinatorMap.set(coord, {
          coordinator: coord,
          total_penalty: 0,
          per_day_penalty: 0,
          open_tickets: 0,
          open_penalty_tickets: 0
        });
      }
      const cStat = coordinatorMap.get(coord);
      cStat.total_penalty += calc.total_penalty;
      if (calc.status === "Open") {
        cStat.open_tickets++;
        cStat.per_day_penalty += calc.total_per_day;
        if (calc.total_penalty > 0 || calc.total_per_day > 0) cStat.open_penalty_tickets++;
      }

      // Zone Aggregation
      const zone = calc.zone_name || "Unassigned";
      if (!zoneMap.has(zone)) {
        zoneMap.set(zone, {
          zone: zone,
          total_penalty: 0,
          per_day_penalty: 0,
          open_tickets: 0
        });
      }
      const zStat = zoneMap.get(zone);
      zStat.total_penalty += calc.total_penalty;
      if (calc.status === "Open") {
        zStat.open_tickets++;
        zStat.per_day_penalty += calc.total_per_day;
      }
    }

    const districtList = Array.from(districtMap.values()).sort((a, b) => b.total_penalty - a.total_penalty);
    const coordinatorList = Array.from(coordinatorMap.values()).sort((a, b) => b.total_penalty - a.total_penalty);
    const zoneList = Array.from(zoneMap.values()).sort((a, b) => b.total_penalty - a.total_penalty);

    return jsonResponse({
      status: "success",
      live_timestamp: new Date(nowMs).toISOString(),
      kpis: {
        total_complaints: (results || []).length,
        total_accumulated_penalty: totalPenalty,
        total_attend_penalty: totalAttendPenalty,
        total_delay_penalty: totalDelayPenalty,
        total_per_day_penalty: totalPerDay,
        open_tickets: openTickets,
        closed_tickets: closedTickets,
        open_penalty_tickets: openPenaltyTickets,
        critical_open_count: criticalOpenCount,
        mch_open_count: mchOpenCount,
        others_open_count: othersOpenCount,
        mch_per_day_penalty: mchPerDay,
        others_per_day_penalty: othersPerDay
      },
      districts: districtList,
      coordinators: coordinatorList,
      zones: zoneList
    });
  } catch (err) {
    console.error("handleLivePenaltySummary error:", err);
    return errorResponse(err.message || "Failed to calculate live penalty summary", 500);
  }
}

/**
 * GET /api/complaints/live-penalty/records
 * Paginated and filterable complaint calculation details
 */
export async function handleLivePenaltyRecords(request, env, params, query, user) {
  try {
    const masters = await getPenaltyMasters(env);
    const nowMs = Date.now();

    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 10), 500);
    const offset = (page - 1) * limit;

    const districtFilter = (query.district || "").trim().toLowerCase();
    const statusFilter = (query.status || "").trim().toLowerCase(); // "open", "closed", "all"
    const criticalFilter = (query.critical || "").trim().toLowerCase(); // "yes", "no"
    const search = (query.search || "").trim().toLowerCase();
    const onlyPenalty = query.only_penalty === "true" || query.only_penalty === "1";

    let sql = `
      SELECT 
        complaint_id, district_name, hospital_type, hospital_name, bar_code,
        equipment_name, equipment_model, complaint_raise_date, complaint_close_date,
        complaint_status, total_downtime, estimated_cost, penalty_days,
        complaint_final_close, attend_date, is_under_warranty
      FROM complaints
    `;
    const whereClauses = [];
    const binds = [];

    if (districtFilter) {
      whereClauses.push("LOWER(district_name) = ?");
      binds.push(districtFilter);
    }

    if (statusFilter === "open") {
      whereClauses.push("complaint_status IN ('Open', 'Attended', 'Pending', 'Re-Open')");
    } else if (statusFilter === "closed") {
      whereClauses.push("complaint_status IN ('Closed', 'Final Closed', 'Engineer Closed')");
    }

    if (search) {
      whereClauses.push("(LOWER(complaint_id) LIKE ? OR LOWER(equipment_name) LIKE ? OR LOWER(hospital_name) LIKE ? OR LOWER(bar_code) LIKE ?)");
      const term = `%${search}%`;
      binds.push(term, term, term, term);
    }

    if (whereClauses.length > 0) {
      sql += " WHERE " + whereClauses.join(" AND ");
    }

    sql += " ORDER BY created_at DESC";

    const { results } = await env.DB.prepare(sql).bind(...binds).all();

    // Compute live calculations
    let calculated = (results || []).map(c => computeComplaintPenalty(c, masters, nowMs));

    if (onlyPenalty) {
      calculated = calculated.filter(c => c.total_penalty > 0 || c.total_per_day > 0);
    }

    if (criticalFilter === "yes") {
      calculated = calculated.filter(c => c.is_critical);
    } else if (criticalFilter === "no") {
      calculated = calculated.filter(c => !c.is_critical);
    }

    const totalRecords = calculated.length;
    const paginatedRecords = calculated.slice(offset, offset + limit);

    return jsonResponse({
      status: "success",
      page,
      limit,
      total_records: totalRecords,
      total_pages: Math.ceil(totalRecords / limit),
      records: paginatedRecords
    });
  } catch (err) {
    console.error("handleLivePenaltyRecords error:", err);
    return errorResponse(err.message || "Failed to fetch live penalty records", 500);
  }
}
