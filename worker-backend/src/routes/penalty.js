import { jsonResponse, runRead, runWrite } from "../utils/db.js";

// Helper: Parse timestamp format "21-Jan-2025 16:30:47" or standard ISO dates
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

// CA SLA & Penalty Calculation Engine
export function calculateCAPenalty(params) {
  const raiseDate = parsePenaltyDate(params.complaint_raise_date);
  const attendDate = parsePenaltyDate(params.attend_date);
  const closeDate = parsePenaltyDate(params.final_close_date || params.close_date);

  const dailyPenaltyRate = parseFloat(params.daily_penalty_rate) || 500;
  const assetValue = parseFloat(params.asset_value) || 0;

  let attendDelayHours = 0;
  let attendPenaltyAmount = 0;
  if (raiseDate && attendDate) {
    const diffMs = attendDate.getTime() - raiseDate.getTime();
    attendDelayHours = Math.max(0, diffMs / (1000 * 3600));
    const chargeableAttendHrs = Math.max(0, attendDelayHours - 24); // 24h SLA
    attendPenaltyAmount = chargeableAttendHrs * 50; // ₹50/hr
  }

  let totalDowntimeDays = 0;
  if (raiseDate && closeDate) {
    const diffMs = closeDate.getTime() - raiseDate.getTime();
    totalDowntimeDays = Math.max(0, diffMs / (1000 * 86400));
  }

  const isPartMissing = Boolean(params.is_part_missing || params.part_missing);
  const partMissingDays = isPartMissing ? (parseFloat(params.part_missing_days) || 0) : 0;

  const isStandbyProvided = Boolean(params.is_standby_provided || params.standby);
  let standbyExemptDays = 0;
  if (isStandbyProvided) {
    // First 90 Days Exempt
    standbyExemptDays = Math.min(totalDowntimeDays, 90);
  }

  const totalExemptDays = partMissingDays + standbyExemptDays;
  const netChargeableDowntimeDays = Math.max(0, totalDowntimeDays - totalExemptDays);
  const downtimePenaltyAmount = netChargeableDowntimeDays * dailyPenaltyRate;

  const grossPenalty = attendPenaltyAmount + downtimePenaltyAmount;

  // Asset Value Cap Rule (10% max cap)
  let maxPenaltyCap = assetValue > 0 ? assetValue * 0.10 : Infinity;
  const finalAuditedPenalty = Math.min(grossPenalty, maxPenaltyCap);

  return {
    attendDelayHours: parseFloat(attendDelayHours.toFixed(2)),
    attendPenaltyAmount: parseFloat(attendPenaltyAmount.toFixed(2)),
    totalDowntimeDays: parseFloat(totalDowntimeDays.toFixed(2)),
    partMissingDays: parseFloat(partMissingDays.toFixed(2)),
    standbyExemptDays: parseFloat(standbyExemptDays.toFixed(2)),
    netChargeableDowntimeDays: parseFloat(netChargeableDowntimeDays.toFixed(2)),
    downtimePenaltyAmount: parseFloat(downtimePenaltyAmount.toFixed(2)),
    grossPenalty: parseFloat(grossPenalty.toFixed(2)),
    maxPenaltyCap: maxPenaltyCap === Infinity ? 0 : parseFloat(maxPenaltyCap.toFixed(2)),
    finalAuditedPenalty: parseFloat(finalAuditedPenalty.toFixed(2))
  };
}

// 1. Verify Barcode in Asset Inventory
export async function handleVerifyBarcode(request, env) {
  try {
    const body = await request.json();
    const barcode = (body.barcode || "").trim();
    if (!barcode) {
      return jsonResponse({ success: false, message: "Barcode is required" }, 400);
    }

    const barcode8 = barcode.length >= 8 ? barcode.slice(-8) : barcode;

    const res = await runRead(env, `
      SELECT id, barcode, equipment_name, equipment_model, hospital_name, district, serial_number, status
      FROM field_assets_inventory
      WHERE barcode = ? OR barcode LIKE ?
      LIMIT 1
    `, [barcode, `%${barcode8}`], request);

    const asset = (res?.results || [])[0];

    if (!asset) {
      return jsonResponse({
        success: false,
        exists: false,
        message: `❌ Error: Barcode #${barcode} not found in database Asset Inventory!`
      });
    }

    return jsonResponse({
      success: true,
      exists: true,
      asset: asset,
      message: `✓ Barcode #${barcode} verified successfully.`
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// 2. Process & Save Penalty Entry (Single or Bulk)
export async function handleSavePenalty(request, env, params, query, user) {
  try {
    const body = await request.json();
    const entries = Array.isArray(body.entries) ? body.entries : [body];

    const results = [];
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const complaintId = (entry.complaint_id || entry.complaintId || "").trim();
      const barcode = (entry.barcode || entry.barCode || "").trim();

      if (!complaintId) {
        errors.push(`Row #${i + 1}: Complaint ID is required.`);
        continue;
      }
      if (!barcode) {
        errors.push(`Row #${i + 1}: Barcode is required.`);
        continue;
      }

      // Verify Barcode Exists in Inventory
      const barcode8 = barcode.length >= 8 ? barcode.slice(-8) : barcode;
      const assetRes = await runRead(env, `
        SELECT barcode, equipment_name, equipment_model, hospital_name, district
        FROM field_assets_inventory
        WHERE barcode = ? OR barcode LIKE ?
        LIMIT 1
      `, [barcode, `%${barcode8}`], request);

      const asset = (assetRes?.results || [])[0];

      if (!asset) {
        errors.push(`Row #${i + 1} (Complaint #${complaintId}): Barcode #${barcode} not found in Asset Inventory!`);
        continue;
      }

      const equipmentName = asset.equipment_name || entry.equipment_name || entry.equipmentName || "Medical Device";
      const hospitalName = asset.hospital_name || entry.hospital_name || entry.hospitalName || "Hospital";
      const district = asset.district || entry.district || entry.districtName || "Rajasthan";

      // Perform CA Penalty Calculations
      const calc = calculateCAPenalty({
        complaint_raise_date: entry.complaint_raise_date || entry.complaintRaiseDate,
        attend_date: entry.attend_date || entry.attendDate,
        close_date: entry.close_date || entry.complaintCloseDate,
        final_close_date: entry.final_close_date || entry.finalCloseDate,
        daily_penalty_rate: entry.daily_penalty_rate || 500,
        asset_value: entry.asset_value || entry.assetValue || 0,
        is_part_missing: entry.is_part_missing || entry.part_missing,
        part_missing_days: entry.part_missing_days || 0,
        is_standby_provided: entry.is_standby_provided || entry.standby
      });

      // Save into rj_penalties table
      await runWrite(env, `
        INSERT INTO rj_penalties (
          complaint_id, district_name, hospital_name, bar_code, equipment_name,
          equipment_model, complaint_raise_date, attend_date, complaint_close_date,
          final_close_date, attended_engineer_name, close_engineer_id, total_downtime,
          total_penalty, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(complaint_id) DO UPDATE SET
          district_name=excluded.district_name,
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
          status=excluded.status
      `, [
        complaintId,
        district,
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
        entry.status || "Assessed"
      ], request);

      // Save Per-Day Breakdown Entries into daily_penalty_records table
      const totalDays = Math.ceil(calc.totalDowntimeDays) || 1;
      const isStandby = Boolean(entry.is_standby_provided || entry.standby);
      const isPartMiss = Boolean(entry.is_part_missing || entry.part_missing);

      for (let d = 1; d <= totalDays; d++) {
        let isExempted = false;
        let exemptionReason = "None";

        if (isPartMiss) {
          isExempted = true;
          exemptionReason = "Part Missing Exemption";
        } else if (isStandby && d <= 90) {
          isExempted = true;
          exemptionReason = `Standby Provided Exemption (Day ${d} of 90)`;
        }

        const dailyAmt = isExempted ? 0 : (calc.finalAuditedPenalty / (calc.netChargeableDowntimeDays || 1));

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
          isPartMiss ? "Part Missing" : (isStandby ? "Standby Provided" : "Open"),
          isPartMiss ? 1 : 0,
          isStandby ? 1 : 0,
          isExempted ? 1 : 0,
          exemptionReason,
          dailyAmt,
          user?.user_name || "Engineer"
        ], request);
      }

      results.push({
        complaint_id: complaintId,
        barcode: barcode,
        total_downtime_days: calc.totalDowntimeDays,
        net_chargeable_days: calc.netChargeableDowntimeDays,
        total_penalty: calc.finalAuditedPenalty
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
      SELECT id, complaint_id, district_name, hospital_name, bar_code, equipment_name,
             equipment_model, complaint_raise_date, attend_date, complaint_close_date,
             final_close_date, attended_engineer_name, close_engineer_id, total_downtime,
             total_penalty, status, created_at
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
