import { runRead, runWrite } from "../utils/db.js";
import { jsonResponse } from "../utils/http.js";

// Helper: Parse timestamp format "21-Jan-2025 16:30:47" or standard ISO dates into Date
export function parsePenaltyDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const str = dateStr.trim();
  if (!str) return null;

  // Custom format: "21-Jan-2025 16:30:47" or "21-Jan-2025"
  const customRegex = /^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
  const match = str.match(customRegex);
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
      return new Date(year, monthMap[monthStr], day, hrs, mins, secs);
    }
  }

  // Standard Date parse fallback
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: Format Date object into "DD-MMM-YYYY HH:mm:ss"
export function formatPenaltyDate(date) {
  if (!date || isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, '0');
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hrs = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');

  return `${day}-${month}-${year} ${hrs}:${mins}:${secs}`;
}

// Determine Penalty Slab based on Equipment Asset Value
export function getPenaltySlabAmount(assetValue) {
  const val = parseFloat(assetValue) || 0;
  if (val <= 10000) return 500;
  if (val <= 100000) return 1000;
  if (val <= 10000000) return 2000;
  return 3000;
}

// CA SLA & Penalty Calculation Engine (BEMMP Rajasthan Contract Specs)
export function calculateCAPenalty(params) {
  const raiseDate = parsePenaltyDate(params.complaint_raise_date);
  const attendDate = parsePenaltyDate(params.attend_date);
  const closeDate = parsePenaltyDate(params.final_close_date || params.close_date);
  const condemnationDate = parsePenaltyDate(params.condemnation_date);

  const assetValue = parseFloat(params.asset_value) || 0;
  const hospitalType = (params.hospital_type || "CHC").trim();
  const equipmentType = (params.equipment_type || "Non-Critical").trim();
  const isCritical = Boolean(params.is_critical || equipmentType.toLowerCase() === "critical");

  // 1. SLA Thresholds & Calculation Periods by Institution Type
  let attendSlaHours = 24;
  let resolveSlaHours = 48;
  let periodHours = 24; // 24-hour period for DH / CHC / PHC

  const hTypeLower = hospitalType.toLowerCase();
  if (hTypeLower.includes("medical college") || hTypeLower.includes("mc")) {
    attendSlaHours = 1;
    resolveSlaHours = 6;
    periodHours = 12; // 12-hour calculation period for Medical Colleges
  } else if (hTypeLower.includes("chc") || hTypeLower.includes("phc")) {
    attendSlaHours = 24;
    resolveSlaHours = 72;
    periodHours = 24;
  } else {
    // DH / SDH / SH
    attendSlaHours = 24;
    resolveSlaHours = 48;
    periodHours = 24;
  }

  // Quick Response override for Critical equipment
  if (isCritical) {
    resolveSlaHours = Math.min(resolveSlaHours, 24);
  }

  // 2. Attendance SLA Audit
  let attendDelayHours = 0;
  let attendPenaltyAmount = 0;
  let attendSlaMissed = false;

  if (raiseDate && attendDate) {
    const diffMs = attendDate.getTime() - raiseDate.getTime();
    attendDelayHours = Math.max(0, diffMs / (1000 * 3600));
    if (attendDelayHours > attendSlaHours) {
      attendSlaMissed = true;
      const missedDays = Math.ceil((attendDelayHours - attendSlaHours) / 24);
      attendPenaltyAmount = missedDays * 500; // ₹500/day missed attend penalty
    }
  }

  // 3. Downtime Period & Condemnation Stoppage
  let effectiveCloseDate = closeDate;
  if (condemnationDate && (!effectiveCloseDate || condemnationDate < effectiveCloseDate)) {
    effectiveCloseDate = condemnationDate;
  }

  let totalDowntimeHours = 0;
  if (raiseDate && effectiveCloseDate) {
    const diffMs = effectiveCloseDate.getTime() - raiseDate.getTime();
    totalDowntimeHours = Math.max(0, diffMs / (1000 * 3600));
  }

  const totalDowntimeDays = Math.ceil(totalDowntimeHours / 24);

  // 4. Exemptions (Part Missing calculated starting from Attend Date)
  const isPartMissing = Boolean(params.is_part_missing || params.part_missing);
  let partMissingDays = 0;

  if (isPartMissing) {
    const partStartDate = parsePenaltyDate(params.part_missing_start_date) || attendDate || raiseDate;
    const partEndDate = parsePenaltyDate(params.part_missing_end_date || params.part_received_date);

    if (partStartDate && partEndDate) {
      const diffMs = partEndDate.getTime() - partStartDate.getTime();
      partMissingDays = Math.max(0, Math.ceil(diffMs / (1000 * 86400)));
    } else {
      partMissingDays = parseFloat(params.part_missing_days) || 0;
    }
  }

  const isStandbyProvided = Boolean(params.is_standby_provided || params.standby);
  let standbyExemptDays = 0;
  if (isStandbyProvided) {
    // First 90 Days Exempt
    standbyExemptDays = Math.min(totalDowntimeDays, 90);
  }

  const totalExemptDays = partMissingDays + standbyExemptDays;
  const netChargeableDowntimeDays = Math.max(0, totalDowntimeDays - totalExemptDays);

  // 5. Penalty Slab & Calculation Periods
  const penaltySlab = getPenaltySlabAmount(assetValue);
  const periodsPerDay = 24 / periodHours;
  const totalPeriods = netChargeableDowntimeDays * periodsPerDay;
  
  let baseDowntimePenalty = totalPeriods * penaltySlab;

  // 6. Critical Equipment 110% Surcharge (1.10 multiplier if SLA missed)
  let criticalSurchargeApplied = false;
  let downtimePenaltyAmount = baseDowntimePenalty;

  if (isCritical && totalDowntimeHours > resolveSlaHours) {
    criticalSurchargeApplied = true;
    downtimePenaltyAmount = baseDowntimePenalty * 1.10;
  }

  const grossPenalty = attendPenaltyAmount + downtimePenaltyAmount;

  // 7. Asset Value Cap Rule (10% max cap)
  const maxPenaltyCap = assetValue > 0 ? assetValue * 0.10 : Infinity;
  let penaltyCapApplied = false;
  let finalAuditedPenalty = grossPenalty;

  if (assetValue > 0 && grossPenalty > maxPenaltyCap) {
    penaltyCapApplied = true;
    finalAuditedPenalty = maxPenaltyCap;
  }

  return {
    hospitalType,
    periodHours,
    attendSlaHours,
    resolveSlaHours,
    attendDelayHours: parseFloat(attendDelayHours.toFixed(2)),
    attendSlaMissed,
    attendPenaltyAmount: parseFloat(attendPenaltyAmount.toFixed(2)),
    totalDowntimeHours: parseFloat(totalDowntimeHours.toFixed(2)),
    totalDowntimeDays: totalDowntimeDays,
    partMissingDays: parseFloat(partMissingDays.toFixed(2)),
    standbyExemptDays: parseFloat(standbyExemptDays.toFixed(2)),
    totalExemptDays: parseFloat(totalExemptDays.toFixed(2)),
    netChargeableDowntimeDays: parseFloat(netChargeableDowntimeDays.toFixed(2)),
    penaltySlab,
    isCritical,
    criticalSurchargeApplied,
    baseDowntimePenalty: parseFloat(baseDowntimePenalty.toFixed(2)),
    downtimePenaltyAmount: parseFloat(downtimePenaltyAmount.toFixed(2)),
    grossPenalty: parseFloat(grossPenalty.toFixed(2)),
    maxPenaltyCap: maxPenaltyCap === Infinity ? 0 : parseFloat(maxPenaltyCap.toFixed(2)),
    penaltyCapApplied,
    finalAuditedPenalty: parseFloat(finalAuditedPenalty.toFixed(2))
  };
}

// 1. Verify Barcode in Asset Inventory (assets_inventory + field_assets_inventory)
export async function handleVerifyBarcode(request, env) {
  try {
    const body = await request.json();
    const barcode = (body.barcode || "").trim();
    if (!barcode) {
      return jsonResponse({ success: false, message: "Barcode is required" }, 400);
    }

    const barcode8 = barcode.length >= 8 ? barcode.slice(-8) : barcode;

    // Search assets_inventory table
    let assetRes = await runRead(env, `
      SELECT id, qr_code as barcode, equipment_name, equipment_model, hospital_name, district_name as district, parsed_asset_value as asset_value, inventory_status as status
      FROM assets_inventory
      WHERE qr_code = ? OR qr_code LIKE ?
      LIMIT 1
    `, [barcode, `%${barcode8}`], request).catch(() => ({ results: [] }));

    let asset = (assetRes?.results || [])[0];

    // Fallback: field_assets_inventory table
    if (!asset) {
      const fallbackRes = await runRead(env, `
        SELECT id, barcode, equipment_name, equipment_model, hospital_name, district, status
        FROM field_assets_inventory
        WHERE barcode = ? OR barcode LIKE ?
        LIMIT 1
      `, [barcode, `%${barcode8}`], request).catch(() => ({ results: [] }));

      asset = (fallbackRes?.results || [])[0];
    }

    if (!asset) {
      return jsonResponse({
        success: false,
        valid: false,
        exists: false,
        error: `❌ Error: Barcode #${barcode} not found in database Asset Inventory! Entry Rejected.`
      });
    }

    // Check main_hospitals to see if hospital is a Medical College
    if (asset.hospital_name) {
      const mainHospRes = await runRead(env, `
        SELECT hospital_name FROM main_hospitals WHERE hospital_name = ? LIMIT 1
      `, [asset.hospital_name], request).catch(() => ({ results: [] }));

      if (mainHospRes?.results?.length > 0) {
        asset.hospital_type = "Medical College";
      }
    }

    // Check di_name_list for DI / Coordinator mapping
    if (asset.hospital_name) {
      const diRes = await runRead(env, `
        SELECT di_name, coordinator_name, zone_name, district_name FROM di_name_list WHERE hospital_name = ? LIMIT 1
      `, [asset.hospital_name], request).catch(() => ({ results: [] }));

      if (diRes?.results?.length > 0) {
        asset.di_name = diRes.results[0].di_name;
        asset.coordinator_name = diRes.results[0].coordinator_name;
        asset.zone_name = diRes.results[0].zone_name;
      }
    }

    return jsonResponse({
      success: true,
      valid: true,
      exists: true,
      asset: asset,
      message: `✓ Barcode #${barcode} verified successfully.`
    });
  } catch (err) {
    return jsonResponse({ success: false, valid: false, error: err.message }, 500);
  }
}

// 2. Save Penalty Entry (Single or Bulk Upload)
export async function handleSavePenalty(request, env, params, query, user) {
  try {
    const body = await request.json();
    const entries = Array.isArray(body.entries) ? body.entries : [body];

    const results = [];
    const errors = [];

    // Ensure penalty_daily_snapshots table exists
    await runWrite(env, `
      CREATE TABLE IF NOT EXISTS penalty_daily_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT,
        barcode TEXT,
        snapshot_date TEXT,
        day_number INTEGER,
        daily_penalty REAL,
        status TEXT,
        exemption_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], request).catch(() => {});

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const complaintId = (entry.complaint_id || entry.complaintId || "").trim();
      const barcode = (entry.barcode || entry.barCode || "").trim();

      if (!complaintId) {
        errors.push({ row: i + 1, error: "Complaint ID is required." });
        continue;
      }
      if (!barcode) {
        errors.push({ row: i + 1, error: "Barcode is required." });
        continue;
      }

      // Verify Barcode Exists in Inventory
      const barcode8 = barcode.length >= 8 ? barcode.slice(-8) : barcode;
      let assetRes = await runRead(env, `
        SELECT qr_code as barcode, equipment_name, equipment_model, hospital_name, district_name as district, parsed_asset_value as asset_value
        FROM assets_inventory
        WHERE qr_code = ? OR qr_code LIKE ?
        LIMIT 1
      `, [barcode, `%${barcode8}`], request).catch(() => ({ results: [] }));

      let asset = (assetRes?.results || [])[0];

      if (!asset) {
        const fallbackRes = await runRead(env, `
          SELECT barcode, equipment_name, equipment_model, hospital_name, district
          FROM field_assets_inventory
          WHERE barcode = ? OR barcode LIKE ?
          LIMIT 1
        `, [barcode, `%${barcode8}`], request).catch(() => ({ results: [] }));
        asset = (fallbackRes?.results || [])[0];
      }

      if (!asset) {
        errors.push({ row: i + 1, error: `❌ Error: Barcode #${barcode} not found in Asset Inventory! Entry Rejected.` });
        continue;
      }

      const equipmentName = asset.equipment_name || entry.equipment_name || entry.equipmentName || "Medical Device";
      const hospitalName = asset.hospital_name || entry.hospital_name || entry.hospitalName || "Hospital";
      const district = asset.district || entry.district || entry.districtName || "Rajasthan";
      
      // Auto-detect Medical College hospital type from main_hospitals table if not provided
      let hospitalType = entry.hospital_type || entry.hospitalType || "CHC";
      if (!entry.hospital_type && hospitalName) {
        const mainHospRes = await runRead(env, `
          SELECT hospital_name FROM main_hospitals WHERE hospital_name = ? LIMIT 1
        `, [hospitalName], request).catch(() => ({ results: [] }));
        if (mainHospRes?.results?.length > 0) {
          hospitalType = "Medical College";
        }
      }

      // Auto-lookup asset value from asset_value_master if 0 or unprovided
      let assetValue = parseFloat(entry.asset_value || entry.assetValue || asset.asset_value || 0);
      if (assetValue <= 0 && equipmentName) {
        const valMasterRes = await runRead(env, `
          SELECT estimated_cost, asset_value FROM asset_value_master WHERE equipment_name LIKE ? LIMIT 1
        `, [`%${equipmentName}%`], request).catch(() => ({ results: [] }));
        if (valMasterRes?.results?.length > 0) {
          assetValue = parseFloat(valMasterRes.results[0].estimated_cost || valMasterRes.results[0].asset_value || 0);
        }
      }

      // Perform CA Penalty Calculations
      const calc = calculateCAPenalty({
        complaint_raise_date: entry.complaint_raise_date || entry.complaintRaiseDate,
        attend_date: entry.attend_date || entry.attendDate,
        close_date: entry.close_date || entry.complaintCloseDate,
        final_close_date: entry.final_close_date || entry.finalCloseDate,
        condemnation_date: entry.condemnation_date || entry.condemnationDate,
        daily_penalty_rate: entry.daily_penalty_rate || 500,
        asset_value: assetValue,
        hospital_type: hospitalType,
        equipment_type: entry.equipment_type || entry.equipmentType || "Non-Critical",
        is_critical: entry.is_critical || entry.isCritical,
        is_part_missing: entry.is_part_missing || entry.part_missing,
        part_missing_days: entry.part_missing_days || 0,
        is_standby_provided: entry.is_standby_provided || entry.standby
      });

      // Save into rj_penalties table
      await runWrite(env, `
        INSERT INTO rj_penalties (
          complaint_id, district_name, hospital_type, hospital_name, bar_code, equipment_name,
          equipment_model, complaint_raise_date, attend_date, complaint_close_date,
          final_close_date, attended_engineer_name, close_engineer_id, total_downtime,
          total_penalty, per_day_penalty, asset_value, equipment_type, penalty_slab_amount,
          chargeable_days, standby_status, exemption_reason, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(complaint_id) DO UPDATE SET
          district_name=excluded.district_name,
          hospital_type=excluded.hospital_type,
          hospital_name=excluded.hospital_name,
          bar_code=excluded.bar_code,
          equipment_name=excluded.equipment_name,
          equipment_model=excluded.equipment_model,
          complaint_raise_date=excluded.complaint_raise_date,
          attend_date=excluded.attend_date,
          complaint_close_date=excluded.complaint_close_date,
          final_close_date=excluded.final_close_date,
          attended_engineer_name=excluded.attended_engineer_name,
          close_engineer_id=excluded.close_engineer_id,
          total_downtime=excluded.total_downtime,
          total_penalty=excluded.total_penalty,
          per_day_penalty=excluded.per_day_penalty,
          asset_value=excluded.asset_value,
          equipment_type=excluded.equipment_type,
          penalty_slab_amount=excluded.penalty_slab_amount,
          chargeable_days=excluded.chargeable_days,
          standby_status=excluded.standby_status,
          exemption_reason=excluded.exemption_reason,
          status=excluded.status
      `, [
        complaintId,
        district,
        hospitalType,
        hospitalName,
        barcode,
        equipmentName,
        asset.equipment_model || entry.equipment_model || "",
        entry.complaint_raise_date || entry.complaintRaiseDate || "",
        entry.attend_date || entry.attendDate || "",
        entry.close_date || entry.complaintCloseDate || "",
        entry.final_close_date || entry.finalCloseDate || "",
        entry.attended_engineer_name || entry.attendedEngineerName || user?.user_name || "Engineer",
        entry.close_engineer_id || entry.closeEngineerId || user?.user_id || "ENG101",
        calc.totalDowntimeDays,
        calc.finalAuditedPenalty,
        calc.penaltySlab,
        assetValue,
        entry.equipment_type || entry.equipmentType || "Non-Critical",
        calc.penaltySlab,
        calc.netChargeableDowntimeDays,
        entry.is_standby_provided ? "Provided" : "Not Provided",
        calc.standbyExemptDays > 0 ? "Standby 90-Day" : (calc.partMissingDays > 0 ? "Part Missing" : "None"),
        entry.status || "Assessed"
      ], request);

      // Save Per-Day Breakdown Entries into daily_penalty_records & penalty_daily_snapshots tables
      const totalDays = Math.max(1, calc.totalDowntimeDays);
      const isStandby = Boolean(entry.is_standby_provided || entry.standby);
      const isPartMiss = Boolean(entry.is_part_missing || entry.part_missing);

      for (let d = 1; d <= totalDays; d++) {
        let isExempted = false;
        let exemptionReason = "None";

        if (isPartMiss) {
          isExempted = true;
          exemptionReason = "Part Missing";
        } else if (isStandby && d <= 90) {
          isExempted = true;
          exemptionReason = `Standby 90-Day (Day ${d} of 90)`;
        }

        const dailyAmt = isExempted ? 0 : (calc.finalAuditedPenalty / (calc.netChargeableDowntimeDays || 1));
        const callStatusStr = isPartMiss ? "Part Missing" : (isStandby ? "Standby Provided" : "Active Downtime");

        await runWrite(env, `
          INSERT INTO daily_penalty_records (
            complaint_id, barcode, day_number, call_status, is_part_missing,
            is_standby_provided, is_exempted, exemption_reason, daily_penalty_amount,
            engineer_name, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          complaintId,
          barcode,
          d,
          callStatusStr,
          isPartMiss ? 1 : 0,
          isStandby ? 1 : 0,
          isExempted ? 1 : 0,
          exemptionReason,
          dailyAmt,
          user?.user_name || "Engineer"
        ], request);

        // Also save per-day snapshot in penalty_daily_snapshots
        await runWrite(env, `
          INSERT INTO penalty_daily_snapshots (
            complaint_id, barcode, snapshot_date, day_number, daily_penalty, status, exemption_reason, created_at
          ) VALUES (?, ?, date('now', '+' || (? - 1) || ' days'), ?, ?, ?, ?, datetime('now'))
        `, [
          complaintId,
          barcode,
          d - 1,
          d,
          dailyAmt,
          callStatusStr,
          exemptionReason
        ], request).catch(() => {});
      }

      results.push({
        complaint_id: complaintId,
        barcode: barcode,
        total_downtime_days: calc.totalDowntimeDays,
        net_chargeable_days: calc.netChargeableDowntimeDays,
        total_penalty: calc.finalAuditedPenalty,
        penalty_cap_applied: calc.penaltyCapApplied
      });
    }

    return jsonResponse({
      success: errors.length === 0,
      processed: results.length,
      errorsCount: errors.length,
      results: results,
      errors: errors,
      message: errors.length === 0
        ? `✓ ${results.length} Penalty records processed and saved successfully!`
        : `⚠️ Processed ${results.length} records with ${errors.length} error(s).`
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// 3. Get Penalty List with Facility-Based Access Control (RBAC)
export async function handleGetPenaltyList(request, env, params, query, user) {
  try {
    const districtFilter = (query.get("district") || "").trim();
    const search = (query.get("search") || "").trim();

    let sqlWhere = "1=1";
    const sqlParams = [];

    // Facility / District RBAC Filtering for Managers / DIs
    const userRole = (user?.role || "").toLowerCase();
    if (userRole === "manager" || userRole === "division manager" || userRole === "di") {
      const assignedDistricts = user?.assigned_districts || user?.district || "";
      if (assignedDistricts) {
        const districtsArr = assignedDistricts.split(",").map(d => d.trim()).filter(Boolean);
        if (districtsArr.length > 0) {
          const placeholders = districtsArr.map(() => "?").join(",");
          sqlWhere += ` AND (district_name IN (${placeholders}) OR hospital_name IN (${placeholders}))`;
          sqlParams.push(...districtsArr, ...districtsArr);
        }
      }
    }

    if (districtFilter && districtFilter !== "all") {
      sqlWhere += " AND district_name = ?";
      sqlParams.push(districtFilter);
    }

    if (search) {
      sqlWhere += " AND (complaint_id LIKE ? OR bar_code LIKE ? OR hospital_name LIKE ? OR equipment_name LIKE ?)";
      sqlParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const res = await runRead(env, `
      SELECT id, complaint_id, district_name, hospital_type, hospital_name, bar_code, equipment_name,
             equipment_model, complaint_raise_date, attend_date, complaint_close_date,
             final_close_date, attended_engineer_name, close_engineer_id, total_downtime,
             total_penalty, per_day_penalty, asset_value, equipment_type, penalty_slab_amount,
             chargeable_days, standby_status, exemption_reason, status, created_at
      FROM rj_penalties
      WHERE ${sqlWhere}
      ORDER BY id DESC LIMIT 500
    `, sqlParams, request);

    const records = res?.results || [];

    // Also fetch per-day breakdown records if complaint_id requested
    const complaintIdParam = query.get("complaint_id");
    let dailyRecords = [];
    if (complaintIdParam) {
      const dailyRes = await runRead(env, `
        SELECT id, complaint_id, barcode, day_number, call_status, is_part_missing,
               is_standby_provided, is_exempted, exemption_reason, daily_penalty_amount,
               engineer_name, created_at
        FROM daily_penalty_records
        WHERE complaint_id = ?
        ORDER BY day_number ASC
      `, [complaintIdParam], request);
      dailyRecords = dailyRes?.results || [];
    }

    return jsonResponse({
      success: true,
      count: records.length,
      records: records,
      dailyRecords: dailyRecords
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
