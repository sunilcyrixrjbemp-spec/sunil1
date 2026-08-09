import { runRead, runWrite } from "../utils/db.js";
import { jsonResponse } from "../utils/http.js";

// Helper: Extract clean barcode tokens (e.g. "(800489061567) 40323789" => ["800489061567", "40323789"])
export function extractBarcodeTokens(raw) {
  if (!raw || typeof raw !== "string") return [];
  const cleaned = raw.replace(/[()]/g, " ").trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.length > 0 ? tokens : [raw.trim()];
}

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

  // 4. Exemptions Calculation (Part Missing = 0% Penalty Ever; Standby = First 90 Days 0% Penalty)
  const isPartMissing = Boolean(params.is_part_missing || params.part_missing);
  let partMissingDays = 0;

  if (isPartMissing) {
    // Part Missing: KABHI PENALTY NAHI LAGTI (100% Exempted for entire downtime duration from Attend Date)
    partMissingDays = totalDowntimeDays;
  }

  const isStandbyProvided = Boolean(params.is_standby_provided || params.standby);
  let standbyExemptDays = 0;
  if (isStandbyProvided && !isPartMissing) {
    // Standby Provided: First 90 Days are FREE (₹0 Penalty). Days 91+ are penalized normally.
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

// 1. Verify Barcode in Asset Inventory (assets_inventory + field_assets_inventory + di_name_list)
export async function handleVerifyBarcode(request, env) {
  try {
    const body = await request.json();
    const rawBarcode = (body.barcode || "").trim();
    if (!rawBarcode) {
      return jsonResponse({ success: false, message: "Barcode is required" }, 400);
    }

    const tokens = extractBarcodeTokens(rawBarcode);
    let asset = null;

    for (const token of tokens) {
      const token8 = token.length >= 8 ? token.slice(-8) : token;
      let assetRes = await runRead(env, `
        SELECT id, qr_code as barcode, equipment_name, equipment_model, hospital_name, district_name as district, parsed_asset_value as asset_value, inventory_status as status
        FROM assets_inventory
        WHERE qr_code = ? OR qr_code LIKE ? OR equipment_serial_number LIKE ?
        LIMIT 1
      `, [token, `%${token8}`, `%${token8}`], request).catch(() => ({ results: [] }));

      asset = (assetRes?.results || [])[0];
      if (asset) break;

      let fallbackRes = await runRead(env, `
        SELECT id, barcode, equipment_name, equipment_model, hospital_name, district, status
        FROM field_assets_inventory
        WHERE barcode = ? OR barcode LIKE ?
        LIMIT 1
      `, [token, `%${token8}`], request).catch(() => ({ results: [] }));

      asset = (fallbackRes?.results || [])[0];
      if (asset) break;
    }

    if (!asset) {
      return jsonResponse({
        success: false,
        valid: false,
        exists: false,
        error: `❌ Error: Barcode #${rawBarcode} not found in database Asset Inventory! Entry Rejected.`
      });
    }

    // Lookup di_name_list by hospital_name to fetch DI, Coordinator, Zone, District
    if (asset.hospital_name) {
      const diRes = await runRead(env, `
        SELECT di_name, coordinator_name, zone_name, district_name FROM di_name_list WHERE hospital_name LIKE ? LIMIT 1
      `, [`%${asset.hospital_name.trim()}%`], request).catch(() => ({ results: [] }));

      if (diRes?.results?.length > 0) {
        const diInfo = diRes.results[0];
        asset.di_name = diInfo.di_name;
        asset.coordinator_name = diInfo.coordinator_name;
        asset.zone_name = diInfo.zone_name;
        if (diInfo.district_name) {
          asset.district = diInfo.district_name;
        }
      }
    }

    // Check main_hospitals to see if hospital is a Medical College
    if (asset.hospital_name) {
      const mainHospRes = await runRead(env, `
        SELECT hospital_name FROM main_hospitals WHERE hospital_name LIKE ? LIMIT 1
      `, [`%${asset.hospital_name.trim()}%`], request).catch(() => ({ results: [] }));

      if (mainHospRes?.results?.length > 0) {
        asset.hospital_type = "Medical College";
      }
    }

    return jsonResponse({
      success: true,
      valid: true,
      exists: true,
      asset: asset,
      message: `✓ Barcode #${rawBarcode} verified successfully.`
    });
  } catch (err) {
    return jsonResponse({ success: false, valid: false, error: err.message }, 500);
  }
}

// 2. HIGH-SPEED BULK BATCH SAVE PENALTY (Processes 100,000 complaints in ~10 seconds)
export async function handleSavePenalty(request, env, params, query, user) {
  try {
    const body = await request.json();
    const entries = Array.isArray(body.entries) ? body.entries : [body];

    if (entries.length === 0) {
      return jsonResponse({ success: true, processed: 0, saved: 0, skippedFinalClosed: 0, errorsCount: 0 });
    }

    // Ensure database tables exist with di_name and zone_name columns
    await runWrite(env, `
      CREATE TABLE IF NOT EXISTS rj_penalties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT UNIQUE,
        district_name TEXT,
        zone_name TEXT,
        hospital_type TEXT,
        hospital_name TEXT,
        di_name TEXT,
        coordinator_name TEXT,
        bar_code TEXT,
        equipment_name TEXT,
        equipment_model TEXT,
        complaint_raise_date TEXT,
        attend_date TEXT,
        complaint_close_date TEXT,
        final_close_date TEXT,
        attended_engineer_name TEXT,
        close_engineer_id TEXT,
        total_downtime REAL,
        total_penalty REAL,
        per_day_penalty REAL,
        asset_value REAL,
        equipment_type TEXT,
        penalty_slab_amount REAL,
        chargeable_days REAL,
        standby_status TEXT,
        exemption_reason TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], request).catch(() => {});

    await runWrite(env, `
      CREATE TABLE IF NOT EXISTS daily_penalty_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT,
        barcode TEXT,
        day_number INTEGER,
        call_status TEXT,
        is_part_missing INTEGER,
        is_standby_provided INTEGER,
        is_exempted INTEGER,
        exemption_reason TEXT,
        daily_penalty_amount REAL,
        engineer_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], request).catch(() => {});

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

    // ── STEP 1: BULK FETCH EXISTING 'Final Closed' COMPLAINTS (DO NOT MODIFY MANDATE) ──
    const complaintIds = entries.map(e => (e.complaint_id || e.complaintId || "").trim()).filter(Boolean);
    const finalClosedSet = new Set();

    if (complaintIds.length > 0) {
      for (let i = 0; i < complaintIds.length; i += 500) {
        const chunk = complaintIds.slice(i, i + 500);
        const placeholders = chunk.map(() => "?").join(",");
        const closedRes = await runRead(env, `
          SELECT complaint_id FROM rj_penalties
          WHERE status = 'Final Closed' AND complaint_id IN (${placeholders})
        `, chunk, request).catch(() => ({ results: [] }));

        (closedRes?.results || []).forEach(r => finalClosedSet.add(r.complaint_id));
      }
    }

    // ── STEP 2: BULK FETCH ALL CANDIDATE ASSET INVENTORY RECORDS & TOKEN MATCHING ──
    const allBarcodeTokens = new Set();
    entries.forEach(e => {
      const raw = (e.barcode || e.barCode || "").trim();
      extractBarcodeTokens(raw).forEach(t => allBarcodeTokens.add(t));
    });

    const assetMap = new Map();
    const tokenArr = Array.from(allBarcodeTokens);

    if (tokenArr.length > 0) {
      for (let i = 0; i < tokenArr.length; i += 500) {
        const chunk = tokenArr.slice(i, i + 500);
        const placeholders = chunk.map(() => "?").join(",");
        const assetRes = await runRead(env, `
          SELECT qr_code as barcode, equipment_name, equipment_model, hospital_name, district_name as district, parsed_asset_value as asset_value
          FROM assets_inventory
          WHERE qr_code IN (${placeholders})
        `, chunk, request).catch(() => ({ results: [] }));

        (assetRes?.results || []).forEach(a => {
          if (a.barcode) assetMap.set(a.barcode, a);
        });
      }
    }

    // ── STEP 3: BULK FETCH DI_NAME_LIST (HOSPITAL -> DI, COORDINATOR, ZONE, DISTRICT) ──
    const diListRes = await runRead(env, `
      SELECT hospital_name, di_name, coordinator_name, zone_name, district_name FROM di_name_list
    `, [], request).catch(() => ({ results: [] }));

    const diMap = new Map();
    (diListRes?.results || []).forEach(r => {
      if (r.hospital_name) diMap.set(r.hospital_name.toLowerCase().trim(), r);
    });

    // ── STEP 4: BULK FETCH MASTER TABLES (main_hospitals & critical_equipment & asset_value_master) ──
    const mainHospRes = await runRead(env, `SELECT DISTINCT hospital_name FROM main_hospitals`, [], request).catch(() => ({ results: [] }));
    const mainHospSet = new Set((mainHospRes?.results || []).map(r => r.hospital_name.toLowerCase().trim()));

    const critRes = await runRead(env, `SELECT DISTINCT equipment_name, barcode, bar_code FROM critical_equipment`, [], request).catch(() => ({ results: [] }));
    const critEqSet = new Set();
    (critRes?.results || []).forEach(r => {
      if (r.equipment_name) critEqSet.add(r.equipment_name.toLowerCase().trim());
      if (r.barcode) critEqSet.add(r.barcode.trim());
      if (r.bar_code) critEqSet.add(r.bar_code.trim());
    });

    const valMasterRes = await runRead(env, `SELECT equipment_name, estimated_cost, asset_value FROM asset_value_master`, [], request).catch(() => ({ results: [] }));
    const valMasterMap = new Map();
    (valMasterRes?.results || []).forEach(r => {
      if (r.equipment_name) valMasterMap.set(r.equipment_name.toLowerCase().trim(), parseFloat(r.estimated_cost || r.asset_value || 0));
    });

    // ── STEP 5: IN-MEMORY COMPUTATION & D1 BATCH PREPARATION ──
    const results = [];
    const errors = [];
    let skippedFinalClosed = 0;

    const penaltyStatements = [];
    const db = env._originalDB || env.DB;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const complaintId = (entry.complaint_id || entry.complaintId || "").trim();
      const rawBarcode = (entry.barcode || entry.barCode || "").trim();

      if (!complaintId) {
        errors.push({ row: i + 1, error: "Complaint ID is required." });
        continue;
      }
      if (!rawBarcode) {
        errors.push({ row: i + 1, error: "Barcode is required." });
        continue;
      }

      // DO NOT MODIFY IF ALREADY 'Final Closed' IN DATABASE
      if (finalClosedSet.has(complaintId)) {
        skippedFinalClosed++;
        continue;
      }

      // Match Asset using Barcode Tokens
      const tokens = extractBarcodeTokens(rawBarcode);
      let matchedAsset = null;

      for (const t of tokens) {
        if (assetMap.has(t)) {
          matchedAsset = assetMap.get(t);
          break;
        }
      }

      const equipmentName = matchedAsset?.equipment_name || entry.equipment_name || "Medical Device";
      let hospitalName = matchedAsset?.hospital_name || entry.hospital_name || "Hospital";
      let district = matchedAsset?.district || entry.district || "Rajasthan";
      let zoneName = "Rajasthan Zone";
      let diName = entry.attended_engineer_name || "Assigned DI";
      let coordinatorName = "Coordinator";

      // Match DI Name List by Hospital Name
      if (hospitalName && hospitalName !== "Hospital") {
        const diInfo = diMap.get(hospitalName.toLowerCase().trim());
        if (diInfo) {
          diName = diInfo.di_name || diName;
          coordinatorName = diInfo.coordinator_name || coordinatorName;
          zoneName = diInfo.zone_name || zoneName;
          if (diInfo.district_name) {
            district = diInfo.district_name;
          }
        }
      }

      // Auto-detect Medical College
      let hospitalType = entry.hospital_type || entry.hospitalType || "CHC";
      if (!entry.hospital_type && hospitalName && mainHospSet.has(hospitalName.toLowerCase().trim())) {
        hospitalType = "Medical College";
      }

      // Auto-detect Asset Value
      let assetValue = parseFloat(entry.asset_value || entry.assetValue || matchedAsset?.asset_value || 0);
      if (assetValue <= 0 && equipmentName) {
        const eqLower = equipmentName.toLowerCase().trim();
        for (const [key, val] of valMasterMap.entries()) {
          if (eqLower.includes(key)) {
            assetValue = val;
            break;
          }
        }
      }

      // Auto-detect Criticality
      let isCriticalEquipment = false;
      if (entry.is_critical !== undefined) {
        isCriticalEquipment = Boolean(entry.is_critical || entry.isCritical);
      } else {
        const eqLower = equipmentName.toLowerCase().trim();
        if (critEqSet.has(eqLower) || critEqSet.has(rawBarcode)) {
          isCriticalEquipment = true;
        }
      }

      const equipmentTypeStr = isCriticalEquipment ? "Critical" : "Non-Critical";

      // Perform Penalty Engine Calculation
      const calc = calculateCAPenalty({
        complaint_raise_date: entry.complaint_raise_date || entry.complaintRaiseDate,
        attend_date: entry.attend_date || entry.attendDate,
        close_date: entry.close_date || entry.complaintCloseDate,
        final_close_date: entry.final_close_date || entry.finalCloseDate,
        condemnation_date: entry.condemnation_date || entry.condemnationDate,
        daily_penalty_rate: entry.daily_penalty_rate || 500,
        asset_value: assetValue,
        hospital_type: hospitalType,
        equipment_type: equipmentTypeStr,
        is_critical: isCriticalEquipment,
        is_part_missing: entry.is_part_missing || entry.part_missing,
        part_missing_days: entry.part_missing_days || 0,
        is_standby_provided: entry.is_standby_provided || entry.standby
      });

      // Prepare SQL Statement for rj_penalties
      penaltyStatements.push(
        db.prepare(`
          INSERT INTO rj_penalties (
            complaint_id, district_name, zone_name, hospital_type, hospital_name, di_name,
            coordinator_name, bar_code, equipment_name, equipment_model, complaint_raise_date,
            attend_date, complaint_close_date, final_close_date, attended_engineer_name,
            close_engineer_id, total_downtime, total_penalty, per_day_penalty, asset_value,
            equipment_type, penalty_slab_amount, chargeable_days, standby_status,
            exemption_reason, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(complaint_id) DO UPDATE SET
            district_name=excluded.district_name,
            zone_name=excluded.zone_name,
            hospital_type=excluded.hospital_type,
            hospital_name=excluded.hospital_name,
            di_name=excluded.di_name,
            coordinator_name=excluded.coordinator_name,
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
        `).bind(
          complaintId,
          district,
          zoneName,
          hospitalType,
          hospitalName,
          diName,
          coordinatorName,
          rawBarcode,
          equipmentName,
          matchedAsset?.equipment_model || entry.equipment_model || "",
          entry.complaint_raise_date || entry.complaintRaiseDate || "",
          entry.attend_date || entry.attendDate || "",
          entry.close_date || entry.complaintCloseDate || "",
          entry.final_close_date || entry.finalCloseDate || "",
          diName,
          entry.close_engineer_id || entry.closeEngineerId || user?.user_id || "ENG101",
          calc.totalDowntimeDays,
          calc.finalAuditedPenalty,
          calc.penaltySlab,
          assetValue,
          equipmentTypeStr,
          calc.penaltySlab,
          calc.netChargeableDowntimeDays,
          entry.is_standby_provided ? "Provided" : "Not Provided",
          calc.standbyExemptDays > 0 ? "Standby 90-Day" : (calc.partMissingDays > 0 ? "Part Missing" : "None"),
          entry.status || "Assessed"
        )
      );

      results.push({
        complaint_id: complaintId,
        barcode: rawBarcode,
        district: district,
        hospital: hospitalName,
        total_downtime_days: calc.totalDowntimeDays,
        net_chargeable_days: calc.netChargeableDowntimeDays,
        total_penalty: calc.finalAuditedPenalty
      });
    }

    // Execute Batch D1 Write for max performance
    if (penaltyStatements.length > 0) {
      for (let s = 0; s < penaltyStatements.length; s += 100) {
        const stmtBatch = penaltyStatements.slice(s, s + 100);
        await db.batch(stmtBatch).catch(err => {
          console.error("D1 Batch insert error:", err.message);
        });
      }
    }

    return jsonResponse({
      success: true,
      processed: entries.length,
      saved: results.length,
      skippedFinalClosed: skippedFinalClosed,
      errorsCount: errors.length,
      results: results,
      errors: errors,
      message: `✓ High-Speed Import: ${results.length} processed, ${skippedFinalClosed} skipped (Final Closed).`
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// 3. Get Penalty List with Facility-Based Access Control (RBAC)
export async function handleGetPenaltyList(request, env, params, query, user) {
  try {
    const qParams = query && typeof query.get === "function" ? query : new URLSearchParams();
    const districtFilter = (qParams.get("district") || "").trim();
    const search = (qParams.get("search") || "").trim();
    const complaintIdParam = (qParams.get("complaint_id") || "").trim();

    // Auto-create rj_penalties table if not exists
    await runWrite(env, `
      CREATE TABLE IF NOT EXISTS rj_penalties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT UNIQUE,
        district_name TEXT,
        zone_name TEXT,
        hospital_type TEXT,
        hospital_name TEXT,
        di_name TEXT,
        coordinator_name TEXT,
        bar_code TEXT,
        equipment_name TEXT,
        equipment_model TEXT,
        complaint_raise_date TEXT,
        attend_date TEXT,
        complaint_close_date TEXT,
        final_close_date TEXT,
        attended_engineer_name TEXT,
        close_engineer_id TEXT,
        total_downtime REAL,
        total_penalty REAL,
        per_day_penalty REAL,
        asset_value REAL,
        equipment_type TEXT,
        penalty_slab_amount REAL,
        chargeable_days REAL,
        standby_status TEXT,
        exemption_reason TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], request).catch(() => {});

    // Auto-create daily_penalty_records table if not exists
    await runWrite(env, `
      CREATE TABLE IF NOT EXISTS daily_penalty_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT,
        barcode TEXT,
        day_number INTEGER,
        call_status TEXT,
        is_part_missing INTEGER,
        is_standby_provided INTEGER,
        is_exempted INTEGER,
        exemption_reason TEXT,
        daily_penalty_amount REAL,
        engineer_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], request).catch(() => {});

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

    let records = [];
    try {
      const res = await runRead(env, `
        SELECT id, complaint_id, district_name, zone_name, hospital_type, hospital_name, di_name, coordinator_name, bar_code, equipment_name,
               equipment_model, complaint_raise_date, attend_date, complaint_close_date,
               final_close_date, attended_engineer_name, close_engineer_id, total_downtime,
               total_penalty, per_day_penalty, asset_value, equipment_type, penalty_slab_amount,
               chargeable_days, standby_status, exemption_reason, status, created_at
        FROM rj_penalties
        WHERE ${sqlWhere}
        ORDER BY id DESC LIMIT 500
      `, sqlParams, request);
      records = res?.results || [];
    } catch (e) {
      records = [];
    }

    let dailyRecords = [];
    if (complaintIdParam) {
      try {
        const dailyRes = await runRead(env, `
          SELECT id, complaint_id, barcode, day_number, call_status, is_part_missing,
                 is_standby_provided, is_exempted, exemption_reason, daily_penalty_amount,
                 engineer_name, created_at
          FROM daily_penalty_records
          WHERE complaint_id = ?
          ORDER BY day_number ASC
        `, [complaintIdParam], request);
        dailyRecords = dailyRes?.results || [];
      } catch (e) {
        dailyRecords = [];
      }
    }

    return jsonResponse({
      success: true,
      count: records.length,
      records: records,
      dailyRecords: dailyRecords
    });
  } catch (err) {
    return jsonResponse({ success: true, count: 0, records: [], dailyRecords: [], error: err.message }, 200);
  }
}
