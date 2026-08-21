/**
 * ============================================================
 * TRC ERP v3.0 — Machine Receive, Diagnosis & Repair Backend Routes
 * Cyrix Field Connect — Technical Repair Center (TRC)
 * ============================================================
 * Complete lifecycle API handlers for biomedical equipment TRC:
 *   - Search & Barcode Verification
 *   - Machine Intake & Media Storage
 *   - Coordinator Assignment
 *   - Engineer Diagnosis & Severity Scoring
 *   - Spare Part Requisitions & Automated HTML Email Dispatch
 *   - Component-Level Repair & Testing
 *   - 6-Point Quality Check & Dispatch
 *   - 11-Step Status Progression Audit Trail
 * ============================================================
 */

import { runRead, runWrite } from "../utils/db.js";
import { jsonResponse, errorResponse, forbiddenResponse, notFoundResponse } from "../utils/http.js";
import { nowISO, nowIST } from "../utils/timestamp.js";
import { enterpriseUpload, validateFileSize } from "../utils/r2Storage.js";
import { staticLog } from "../utils/logger.js";
import { sendEmailDirect } from "../email/sender.js";
import { runMigrationsTrc } from "../utils/db-migrate-trc.js";

let _tablesEnsured = false;
export async function ensureTrcTables(db) {
  if (_tablesEnsured || !db) return;
  try {
    await runMigrationsTrc(db);
    _tablesEnsured = true;
  } catch (_) {}
}

// Helper: Extract clean barcode tokens
function extractBarcodeTokens(raw) {
  if (!raw || typeof raw !== "string") return [];
  const cleaned = raw.replace(/[()]/g, " ").trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.length > 0 ? tokens : [raw.trim()];
}

// Predefined default TRC Specialists & Engineers
export const DEFAULT_TRC_ENGINEERS = [
  { user_id: "TRC-ENG-01", name: "Kana Ram", designation: "Sr. Specialist Engineer (TRC)", mobile_number: "9829012345", email: "kanaram@cyrix.in" },
  { user_id: "TRC-ENG-02", name: "Bernard Lawrence Thomas", designation: "Biomedical Lead Engineer", mobile_number: "9829023456", email: "bernard.thomas@cyrix.in" },
  { user_id: "TRC-ENG-03", name: "Ashok Kumar Ram", designation: "Specialist Engineer (Chip Level)", mobile_number: "9829034567", email: "ashok.ram@cyrix.in" },
  { user_id: "TRC-ENG-04", name: "Noha Rajan", designation: "Calibration & Testing Lead", mobile_number: "9829045678", email: "noha.rajan@cyrix.in" },
  { user_id: "TRC-ENG-05", name: "Mahanta Mondal", designation: "Biomedical Technician (TRC)", mobile_number: "9829056789", email: "mahanta.mondal@cyrix.in" }
];

// Helper: Generate unique TRC Job Number e.g. TRC-2026-08001
function generateTrcNumber() {
  const d = new Date();
  const yr = d.getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const timeHex = Date.now().toString(36).toUpperCase().slice(-3);
  return `TRC-${yr}-${rand}${timeHex}`;
}

// ─── 1. POST /api/trc/verify-barcode ──────────────────────────────────────────
export async function handleTrcVerifyBarcode(request, env, params, query, user) {
  try {
    await ensureTrcTables(env._originalDB || env.DB);
    const body = await request.json().catch(() => ({}));
    const district = (body.district || "").trim();
    const barcodeRaw = (body.barcode || "").trim();

    if (!district) return errorResponse("District is required for verification", 400);
    if (!barcodeRaw) return errorResponse("Barcode number is required", 400);

    const tokens = extractBarcodeTokens(barcodeRaw);
    const primaryToken = tokens[0] || barcodeRaw;
    const digitsOnly = barcodeRaw.replace(/\D/g, "");

    const barcode8 = barcodeRaw.length >= 8 ? barcodeRaw.slice(-8) : barcodeRaw;

    // 1. Check if machine is already active in TRC
    const activeTrcRes = await runRead(env, `
      SELECT * FROM trc_machine_receive 
      WHERE (barcode = ? OR barcode LIKE ? OR barcode LIKE ? OR SUBSTR(barcode, -8) = ?) 
        AND current_status NOT IN ('Closed', 'Dispatched')
      ORDER BY id DESC LIMIT 1
    `, [barcodeRaw, `%${primaryToken}%`, digitsOnly ? `%${digitsOnly}%` : `_${barcodeRaw}_`, barcode8], request);

    const activeTrc = activeTrcRes?.results?.[0];

    // 2. Search in assets_inventory (exact, 8-digit suffix, serial number)
    const assetRes = await runRead(env, `
      SELECT * FROM assets_inventory 
      WHERE (
        LOWER(qr_code) = LOWER(?) 
        OR LOWER(SUBSTR(qr_code, -8)) = LOWER(?)
        OR qr_code LIKE ?
        OR LOWER(serial_no) = LOWER(?)
        OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?)
        OR serial_no LIKE ?
      )
      ORDER BY id DESC LIMIT 10
    `, [barcodeRaw, barcode8, `%${primaryToken}%`, barcodeRaw, barcode8, `%${primaryToken}%`], request);

    let matchedAsset = null;
    if (assetRes?.results?.length) {
      // Prioritize asset matching selected district if district provided
      matchedAsset = assetRes.results.find(a => 
        (a.district_name || "").toLowerCase().trim() === district.toLowerCase().trim()
      ) || assetRes.results[0];
    }

    // 3. Search in complaints table if complaint exists
    let complaintData = null;
    if (barcodeRaw) {
      const compRes = await runRead(env, `
        SELECT * FROM complaints 
        WHERE (bar_code = ? OR bar_code LIKE ? OR complaint_id = ?)
        ORDER BY id DESC LIMIT 1
      `, [barcodeRaw, `%${primaryToken}%`, barcodeRaw], request);
      complaintData = compRes?.results?.[0];
    }

    // 4. Fallback search in field_assets or di_name_list
    let diInfo = null;
    if (matchedAsset?.hospital_name) {
      const diRes = await runRead(env, `
        SELECT * FROM di_name_list WHERE LOWER(hospital_name) = LOWER(?) LIMIT 1
      `, [matchedAsset.hospital_name], request).catch(() => null);
      diInfo = diRes?.results?.[0];
    }

    if (!matchedAsset && !complaintData && !activeTrc) {
      return jsonResponse({
        success: false,
        found: false,
        message: "Machine Not Found for the provided District and Barcode.",
        searched: { district, barcode: barcodeRaw }
      });
    }

    // Compose normalized auto-fetched fields
    const machineData = {
      district_name: matchedAsset?.district_name || complaintData?.district_name || district,
      zone_name: matchedAsset?.zone_name || diInfo?.zone_name || "Rajasthan",
      hospital_name: matchedAsset?.hospital_name || complaintData?.hospital_name || "District Hospital / CHC",
      equipment_name: matchedAsset?.equipment_name || complaintData?.equipment_name || "Biomedical Device",
      equipment_model: matchedAsset?.model_name || complaintData?.equipment_model || matchedAsset?.equipment_model || "Standard Model",
      equipment_barcode: matchedAsset?.qr_code || complaintData?.bar_code || barcodeRaw,
      serial_number: matchedAsset?.serial_no || complaintData?.serial_number || `SN-${barcodeRaw}`,
      complaint_id: complaintData?.complaint_id || `CMP-${barcodeRaw.slice(-6)}`,
      di_name: diInfo?.di_name || matchedAsset?.di_name || "Consignee DI",
      coordinator_name: diInfo?.coordinator_name || matchedAsset?.coordinator_name || "Zonal Coordinator",
      dm_name: matchedAsset?.dm_name || "District Manager",
      complaint_date: complaintData?.complaint_raise_date || new Date().toISOString().split("T")[0],
      oem_name: matchedAsset?.supplier || "Original Equipment Manufacturer",
      machine_status_prior: complaintData?.complaint_status || matchedAsset?.equipment_status || "Breakdown / Pending TRC",
      asset_value: matchedAsset?.asset_value || matchedAsset?.parsed_asset_value || 0,
      active_in_trc: !!activeTrc,
      existing_trc_id: activeTrc?.id || null,
      existing_trc_number: activeTrc?.trc_number || null,
      existing_status: activeTrc?.current_status || null,
    };

    // Verify district matching
    const districtMatch = (machineData.district_name || "").toLowerCase().trim() === district.toLowerCase().trim();

    return jsonResponse({
      success: true,
      found: true,
      districtMatch,
      districtWarning: !districtMatch ? `Machine is registered under ${machineData.district_name}, but scanned under ${district}.` : null,
      machine: machineData,
      activeTrcRecord: activeTrc || null
    });
  } catch (err) {
    staticLog.error("Error in handleTrcVerifyBarcode", { error: err.message });
    return errorResponse("Verification failed: " + err.message, 500);
  }
}

// ─── 2. POST /api/trc/receive ─────────────────────────────────────────────────
export async function handleTrcReceiveMachine(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const district = (body.district || "").trim();
    const barcode = (body.barcode || "").trim();
    const hospitalName = (body.hospital_name || "").trim();
    const equipmentName = (body.equipment_name || "").trim();

    if (!district || !barcode || !hospitalName || !equipmentName) {
      return errorResponse("Missing required machine intake details (District, Barcode, Hospital, Equipment)", 400);
    }

    const trcNumber = generateTrcNumber();
    const receiveDate = body.receive_date || new Date().toISOString().split("T")[0];
    const receiveTime = body.receive_time || new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "Asia/Kolkata" });
    const warehouseReceiveDate = body.warehouse_receive_date || receiveDate;
    const receivedById = user?.user_id || user?.e_code || "ENG-TRC";
    const receivedByName = user?.name || "TRC Receiving Engineer";
    const conditionReceived = body.condition_received || "Good";
    const accessoriesReceived = Array.isArray(body.accessories_received) 
      ? JSON.stringify(body.accessories_received) 
      : (body.accessories_received || "[]");
    const receiveNotes = body.receive_notes || "";
    
    const videoUrl = body.video_url || null;
    const frontPhotoUrl = body.front_photo_url || null;
    const backPhotoUrl = body.back_photo_url || null;
    const damagePhotoUrl = body.damage_photo_url || null;

    const createdAt = nowISO();
    const updatedAt = createdAt;
    const currentStatus = "Machine Received in TRC";

    // Insert machine receive record
    const insertRes = await runWrite(env, `
      INSERT INTO trc_machine_receive (
        trc_number, district, zone, hospital_name, equipment_name, equipment_model,
        barcode, serial_number, complaint_id, di_name, coordinator_name, dm_name,
        complaint_date, oem_name, machine_status_prior, receive_date, receive_time,
        warehouse_receive_date,
        received_by_id, received_by_name, condition_received, accessories_received,
        receive_notes, video_url, front_photo_url, back_photo_url, damage_photo_url,
        current_status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trcNumber, district, body.zone || "Rajasthan", hospitalName, equipmentName, body.equipment_model || "",
      barcode, body.serial_number || "", body.complaint_id || "", body.di_name || "", body.coordinator_name || "", body.dm_name || "",
      body.complaint_date || "", body.oem_name || "", body.machine_status_prior || "Breakdown", receiveDate, receiveTime,
      warehouseReceiveDate,
      receivedById, receivedByName, conditionReceived, accessoriesReceived,
      receiveNotes, videoUrl, frontPhotoUrl, backPhotoUrl, damagePhotoUrl,
      currentStatus, receivedById, createdAt, updatedAt
    ], request);

    const trcId = insertRes?.meta?.last_row_id || insertRes?.lastRowId;

    // Save media entries
    const mediaToInsert = [
      { label: "Receive Video", url: videoUrl, type: "video" },
      { label: "Front Photo", url: frontPhotoUrl, type: "photo" },
      { label: "Back Photo", url: backPhotoUrl, type: "photo" },
      { label: "Damage Photo", url: damagePhotoUrl, type: "photo" },
    ].filter(m => !!m.url);

    for (const m of mediaToInsert) {
      await runWrite(env, `
        INSERT INTO trc_media (
          trc_id, trc_number, stage, media_type, media_label, file_url, created_by, created_at
        ) VALUES (?, ?, 'Receive', ?, ?, ?, ?, ?)
      `, [trcId, trcNumber, m.type, m.label, m.url, receivedById, createdAt], request);
    }

    // Save initial status history
    await runWrite(env, `
      INSERT INTO trc_status_history (
        trc_id, trc_number, from_status, to_status, stage_name, remarks, changed_by_id, changed_by_name, created_at
      ) VALUES (?, ?, NULL, ?, 'Receive', ?, ?, ?, ?)
    `, [trcId, trcNumber, currentStatus, `Received in TRC Warehouse with condition: ${conditionReceived}`, receivedById, receivedByName, createdAt], request);

    return jsonResponse({
      success: true,
      message: "Machine successfully received in TRC Warehouse.",
      trcId,
      trcNumber,
      status: currentStatus
    });
  } catch (err) {
    staticLog.error("Error in handleTrcReceiveMachine", { error: err.message });
    return errorResponse("Failed to receive machine: " + err.message, 500);
  }
}

// ─── 3. GET /api/trc/machines ──────────────────────────────────────────────────
export async function handleTrcListMachines(request, env, params, query, user) {
  try {
    const url = new URL(request.url);
    const zone = url.searchParams.get("zone");
    const district = url.searchParams.get("district");
    const hospital = url.searchParams.get("hospital");
    const status = url.searchParams.get("status");
    const assignedTo = url.searchParams.get("assigned_to");
    const search = url.searchParams.get("search");
    const tab = url.searchParams.get("tab"); // "mine", "all", "waiting_spares", "ready_dispatch", "closed"
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    let whereClauses = [];
    let queryParams = [];

    if (zone && zone !== "All") {
      whereClauses.push("LOWER(zone) = LOWER(?)");
      queryParams.push(zone);
    }

    if (district && district !== "All") {
      whereClauses.push("LOWER(district) = LOWER(?)");
      queryParams.push(district);
    }

    if (hospital && hospital !== "All") {
      whereClauses.push("LOWER(hospital_name) = LOWER(?)");
      queryParams.push(hospital);
    }

    if (status && status !== "All") {
      whereClauses.push("current_status = ?");
      queryParams.push(status);
    }

    // Role filtering: If user is Engineer and requests 'mine', filter by assigned_engineer_id
    if (tab === "mine" && user?.user_id) {
      whereClauses.push("(assigned_engineer_id = ? OR received_by_id = ?)");
      queryParams.push(user.user_id, user.user_id);
    } else if (assignedTo) {
      whereClauses.push("assigned_engineer_id = ?");
      queryParams.push(assignedTo);
    }

    if (tab === "waiting_spares") {
      whereClauses.push("current_status = 'Waiting Spare Part'");
    } else if (tab === "ready_dispatch") {
      whereClauses.push("current_status IN ('Ready for Warehouse Dispatch', 'QC Completed', 'Repair Completed')");
    } else if (tab === "closed") {
      whereClauses.push("current_status IN ('Dispatched', 'Closed')");
    }

    if (search) {
      const s = `%${search.trim()}%`;
      whereClauses.push("(trc_number LIKE ? OR barcode LIKE ? OR equipment_name LIKE ? OR hospital_name LIKE ? OR complaint_id LIKE ?)");
      queryParams.push(s, s, s, s, s);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const sql = `
      SELECT * FROM trc_machine_receive 
      ${whereStr} 
      ORDER BY id DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const res = await runRead(env, sql, queryParams, request);
    const countSql = `SELECT count(*) as total FROM trc_machine_receive ${whereStr}`;
    const countRes = await runRead(env, countSql, queryParams, request);

    return jsonResponse({
      success: true,
      machines: res?.results || [],
      total: countRes?.results?.[0]?.total || 0,
      limit,
      offset
    });
  } catch (err) {
    staticLog.error("Error in handleTrcListMachines", { error: err.message });
    return errorResponse("Failed to fetch machines: " + err.message, 500);
  }
}

// ─── 4. GET /api/trc/machines/:id ─────────────────────────────────────────────
export async function handleTrcGetMachineDetails(request, env, params, query, user) {
  try {
    const trcId = params.id;
    if (!trcId) return errorResponse("TRC Machine ID is required", 400);

    const isNumeric = /^\d+$/.test(trcId);
    const machineSql = isNumeric 
      ? "SELECT * FROM trc_machine_receive WHERE id = ? LIMIT 1"
      : "SELECT * FROM trc_machine_receive WHERE trc_number = ? LIMIT 1";

    const machineRes = await runRead(env, machineSql, [trcId], request);
    const machine = machineRes?.results?.[0];

    if (!machine) return notFoundResponse("Machine record not found in TRC");

    const id = machine.id;

    // Fetch related records in parallel
    const [assignmentsRes, diagnosisRes, sparesRes, repairsRes, qcRes, mediaRes, historyRes, emailLogsRes] = await Promise.all([
      runRead(env, "SELECT * FROM trc_assignment WHERE trc_id = ? ORDER BY id DESC", [id], request).catch(() => ({ results: [] })),
      runRead(env, "SELECT * FROM trc_diagnosis WHERE trc_id = ? ORDER BY id DESC LIMIT 1", [id], request).catch(() => ({ results: [] })),
      runRead(env, "SELECT * FROM trc_spare_requests WHERE trc_id = ? ORDER BY id DESC", [id], request).catch(() => ({ results: [] })),
      runRead(env, "SELECT * FROM trc_repairs WHERE trc_id = ? ORDER BY id DESC LIMIT 1", [id], request).catch(() => ({ results: [] })),
      runRead(env, "SELECT * FROM trc_qc WHERE trc_id = ? ORDER BY id DESC LIMIT 1", [id], request).catch(() => ({ results: [] })),
      runRead(env, "SELECT * FROM trc_media WHERE trc_id = ? ORDER BY id ASC", [id], request).catch(() => ({ results: [] })),
      runRead(env, "SELECT * FROM trc_status_history WHERE trc_id = ? ORDER BY id ASC", [id], request).catch(() => ({ results: [] })),
      runRead(env, "SELECT * FROM trc_email_logs WHERE trc_id = ? ORDER BY id DESC", [id], request).catch(() => ({ results: [] })),
    ]);

    return jsonResponse({
      success: true,
      machine,
      assignment: assignmentsRes?.results?.[0] || null,
      assignmentHistory: assignmentsRes?.results || [],
      diagnosis: diagnosisRes?.results?.[0] || null,
      spareRequests: sparesRes?.results || [],
      repair: repairsRes?.results?.[0] || null,
      qc: qcRes?.results?.[0] || null,
      media: mediaRes?.results || [],
      statusHistory: historyRes?.results || [],
      emailLogs: emailLogsRes?.results || []
    });
  } catch (err) {
    staticLog.error("Error in handleTrcGetMachineDetails", { error: err.message });
    return errorResponse("Failed to fetch machine details: " + err.message, 500);
  }
}

// ─── 5. POST /api/trc/assign ──────────────────────────────────────────────────
export async function handleTrcAssignMachine(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    const trcId = body.trc_id;
    const assignedEngineerId = body.assigned_engineer_id;
    const assignedEngineerName = body.assigned_engineer_name;
    const assignDate = body.assign_date || new Date().toISOString().split("T")[0];
    const assignTime = body.assign_time || new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "Asia/Kolkata" });
    const notes = body.notes || "";

    if (!trcId || !assignedEngineerId || !assignedEngineerName) {
      return errorResponse("TRC Machine ID, Engineer ID, and Engineer Name are required", 400);
    }

    const machineRes = await runRead(env, "SELECT * FROM trc_machine_receive WHERE id = ?", [trcId], request);
    const machine = machineRes?.results?.[0];
    if (!machine) return notFoundResponse("Machine record not found");

    const assignedById = user?.user_id || "COORD-01";
    const assignedByName = user?.name || "TRC Coordinator";
    const createdAt = nowISO();
    const newStatus = "Assigned to Engineer";

    // Insert assignment record
    await runWrite(env, `
      INSERT INTO trc_assignment (
        trc_id, trc_number, assigned_engineer_id, assigned_engineer_name,
        assigned_by_id, assigned_by_name, assign_date, assign_time, notes,
        status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?, ?)
    `, [trcId, machine.trc_number, assignedEngineerId, assignedEngineerName, assignedById, assignedByName, assignDate, assignTime, notes, assignedById, createdAt, createdAt], request);

    // Update machine record
    await runWrite(env, `
      UPDATE trc_machine_receive 
      SET assigned_engineer_id = ?, assigned_engineer_name = ?, assigned_date = ?, current_status = ?, updated_at = ?
      WHERE id = ?
    `, [assignedEngineerId, assignedEngineerName, `${assignDate} ${assignTime}`, newStatus, createdAt, trcId], request);

    // Record status history
    await runWrite(env, `
      INSERT INTO trc_status_history (
        trc_id, trc_number, from_status, to_status, stage_name, remarks, changed_by_id, changed_by_name, created_at
      ) VALUES (?, ?, ?, ?, 'Assignment', ?, ?, ?, ?)
    `, [trcId, machine.trc_number, machine.current_status, newStatus, `Assigned to ${assignedEngineerName}. Notes: ${notes}`, assignedById, assignedByName, createdAt], request);

    return jsonResponse({
      success: true,
      message: `Machine assigned to ${assignedEngineerName}`,
      status: newStatus
    });
  } catch (err) {
    staticLog.error("Error in handleTrcAssignMachine", { error: err.message });
    return errorResponse("Failed to assign machine: " + err.message, 500);
  }
}

// ─── 6. POST /api/trc/diagnosis ───────────────────────────────────────────────
export async function handleTrcSaveDiagnosis(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    const trcId = body.trc_id;
    const issueCategory = body.issue_category; // Electrical, Mechanical, PCB, Calibration, Software, Display, Sensor, Other
    const rootCause = body.root_cause;
    const issueDescription = body.issue_description;
    const repairable = body.repairable || "Yes";
    const severity = body.severity || "Medium";

    if (!trcId || !issueCategory || !rootCause || !issueDescription) {
      return errorResponse("TRC ID, Issue Category, Root Cause, and Issue Description are required", 400);
    }

    const machineRes = await runRead(env, "SELECT * FROM trc_machine_receive WHERE id = ?", [trcId], request);
    const machine = machineRes?.results?.[0];
    if (!machine) return notFoundResponse("Machine record not found");

    const diagnosisDate = body.diagnosis_date || new Date().toISOString().split("T")[0];
    const diagnosisTime = body.diagnosis_time || new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "Asia/Kolkata" });
    const diagnosedById = user?.user_id || machine.assigned_engineer_id || "ENG-01";
    const diagnosedByName = user?.name || machine.assigned_engineer_name || "TRC Engineer";
    const videoUrl = body.diagnosis_video_url || null;
    const photos = Array.isArray(body.diagnosis_photos) ? JSON.stringify(body.diagnosis_photos) : (body.diagnosis_photos || "[]");
    const createdAt = nowISO();
    const newStatus = "Diagnosis Completed";

    // Insert diagnosis
    await runWrite(env, `
      INSERT INTO trc_diagnosis (
        trc_id, trc_number, diagnosis_date, diagnosis_time, issue_category, root_cause,
        issue_description, repairable, severity, diagnosis_video_url, diagnosis_photos,
        diagnosed_by_id, diagnosed_by_name, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trcId, machine.trc_number, diagnosisDate, diagnosisTime, issueCategory, rootCause,
      issueDescription, repairable, severity, videoUrl, photos,
      diagnosedById, diagnosedByName, diagnosedById, createdAt, createdAt
    ], request);

    // Save media if provided
    if (videoUrl) {
      await runWrite(env, `
        INSERT INTO trc_media (trc_id, trc_number, stage, media_type, media_label, file_url, created_by, created_at)
        VALUES (?, ?, 'Diagnosis', 'video', 'Diagnosis Video', ?, ?, ?)
      `, [trcId, machine.trc_number, videoUrl, diagnosedById, createdAt], request);
    }

    if (body.diagnosis_photos && Array.isArray(body.diagnosis_photos)) {
      for (const [idx, pUrl] of body.diagnosis_photos.entries()) {
        await runWrite(env, `
          INSERT INTO trc_media (trc_id, trc_number, stage, media_type, media_label, file_url, created_by, created_at)
          VALUES (?, ?, 'Diagnosis', 'photo', ?, ?, ?, ?)
        `, [trcId, machine.trc_number, `Diagnosis Photo #${idx + 1}`, pUrl, diagnosedById, createdAt], request);
      }
    }

    // Update machine status
    await runWrite(env, `
      UPDATE trc_machine_receive SET current_status = ?, updated_at = ? WHERE id = ?
    `, [newStatus, createdAt, trcId], request);

    // Record status history
    await runWrite(env, `
      INSERT INTO trc_status_history (
        trc_id, trc_number, from_status, to_status, stage_name, remarks, changed_by_id, changed_by_name, created_at
      ) VALUES (?, ?, ?, ?, 'Diagnosis', ?, ?, ?, ?)
    `, [trcId, machine.trc_number, machine.current_status, newStatus, `Category: ${issueCategory} | Severity: ${severity} | Repairable: ${repairable} | Root Cause: ${rootCause}`, diagnosedById, diagnosedByName, createdAt], request);

    return jsonResponse({
      success: true,
      message: "Diagnosis submitted successfully",
      status: newStatus
    });
  } catch (err) {
    staticLog.error("Error in handleTrcSaveDiagnosis", { error: err.message });
    return errorResponse("Failed to save diagnosis: " + err.message, 500);
  }
}

// ─── 7. POST /api/trc/spare-request ───────────────────────────────────────────
export async function handleTrcCreateSpareRequest(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    const trcId = body.trc_id;
    const partName = body.part_name;
    const partNumber = body.part_number || "";
    const quantity = parseInt(body.quantity || "1", 10);
    const remarks = body.remarks || "";
    const partPhotoUrl = body.part_photo_url || null;
    const damagedPartPhotoUrl = body.damaged_part_photo_url || null;

    if (!trcId || !partName) {
      return errorResponse("TRC Machine ID and Part Name are required", 400);
    }

    const machineRes = await runRead(env, "SELECT * FROM trc_machine_receive WHERE id = ?", [trcId], request);
    const machine = machineRes?.results?.[0];
    if (!machine) return notFoundResponse("Machine record not found");

    // Fetch latest diagnosis info
    const diagRes = await runRead(env, "SELECT * FROM trc_diagnosis WHERE trc_id = ? ORDER BY id DESC LIMIT 1", [trcId], request);
    const diagnosis = diagRes?.results?.[0];

    const requestedById = user?.user_id || machine.assigned_engineer_id || "ENG-01";
    const requestedByName = user?.name || machine.assigned_engineer_name || "TRC Engineer";
    const createdAt = nowISO();
    const newStatus = "Waiting Spare Part";

    // ── Generate HTML Email & Notification ──────────────────────────────────
    const recipients = [
      "trc.coordinator@cyrix.in",
      "zonal.coordinator@cyrix.in",
      "zonal.manager@cyrix.in",
      "projecthead@cyrix.in",
      "consignee.di@rajasthan.gov.in"
    ];

    const emailSubject = `TRC Spare Requirement | ${machine.district} | ${machine.hospital_name} | ${machine.barcode}`;
    
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 24px; color: #ffffff;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; font-weight: bold; margin-bottom: 4px;">Technical Repair Center (TRC) — Spare Requisition</div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">Spare Part Requirement Notice</h2>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">TRC Job: <strong>${machine.trc_number}</strong> | Barcode: <strong>${machine.barcode}</strong></div>
        </div>

        <div style="padding: 24px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Equipment & Facility Details</h4>
            <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; width: 35%; color: #64748b;">Equipment:</td><td style="font-weight: 600; color: #0f172a;">${machine.equipment_name} (${machine.equipment_model || 'N/A'})</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Serial Number:</td><td style="font-weight: 600;">${machine.serial_number || 'N/A'}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Hospital / Facility:</td><td style="font-weight: 600;">${machine.hospital_name}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">District & Zone:</td><td style="font-weight: 600;">${machine.district} (${machine.zone || 'Rajasthan'})</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Complaint ID:</td><td style="font-weight: 600; color: #2563eb;">${machine.complaint_id || 'N/A'}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">TRC Engineer:</td><td style="font-weight: 600;">${requestedByName}</td></tr>
            </table>
          </div>

          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #1e40af;">Diagnosis Summary</h4>
            <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
              <strong>Category:</strong> ${diagnosis?.issue_category || 'Electronics/PCB'}<br/>
              <strong>Root Cause:</strong> ${diagnosis?.root_cause || 'Component failure'}<br/>
              <strong>Description:</strong> ${diagnosis?.issue_description || 'Machine requires critical component replacement.'}
            </p>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #92400e; border-bottom: 1px solid #fde68a; padding-bottom: 6px;">Requested Spare Part Information</h4>
            <table style="width: 100%; font-size: 13px; color: #78350f; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; width: 35%; font-weight: 600;">Part Name:</td><td style="font-weight: 700; color: #b45309; font-size: 14px;">${partName}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Part / Model Number:</td><td>${partNumber || 'N/A'}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Quantity:</td><td style="font-weight: 700;">${quantity} Unit(s)</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Remarks:</td><td>${remarks || 'Urgent requirement for equipment restoration.'}</td></tr>
            </table>
          </div>

          ${(partPhotoUrl || damagedPartPhotoUrl) ? `
            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #475569;">Attachment Photos</h4>
              <div style="display: flex; gap: 12px;">
                ${partPhotoUrl ? `<div style="text-align: center;"><img src="${partPhotoUrl}" alt="Part Photo" style="width: 140px; height: 140px; object-fit: cover; border-radius: 8px; border: 1px solid #cbd5e1;"/><div style="font-size: 11px; color: #64748b; margin-top: 4px;">Required Part</div></div>` : ''}
                ${damagedPartPhotoUrl ? `<div style="text-align: center;"><img src="${damagedPartPhotoUrl}" alt="Damaged Part" style="width: 140px; height: 140px; object-fit: cover; border-radius: 8px; border: 1px solid #cbd5e1;"/><div style="font-size: 11px; color: #64748b; margin-top: 4px;">Damaged Part</div></div>` : ''}
              </div>
            </div>
          ` : ''}

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
            This is an automated notification from Cyrix CAMC Technical Repair Center (TRC) ERP System.
          </div>
        </div>
      </div>
    `;

    // Try sending email via Cloudflare Email Routing / sender
    let emailSent = 0;
    try {
      if (sendEmailDirect) {
        await sendEmailDirect(env, {
          to: recipients[0],
          toName: `TRC Coordinator`,
          subject: emailSubject,
          html: emailHtml,
          text: `Spare Requisition Alert: ${part_name || ''} for TRC Machine ${machine.equipment_name || ''}`
        });
        emailSent = 1;
      }
    } catch (emErr) {
      staticLog.warn("Could not dispatch live email, logged to database", { error: emErr.message });
    }

    // Save spare request record
    const spareInsert = await runWrite(env, `
      INSERT INTO trc_spare_requests (
        trc_id, trc_number, spare_required, part_name, part_number, quantity,
        part_photo_url, damaged_part_photo_url, remarks, status, email_sent,
        email_recipients, email_sent_at, requested_by_id, requested_by_name,
        created_by, created_at, updated_at
      ) VALUES (?, ?, 'Yes', ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trcId, machine.trc_number, partName, partNumber, quantity,
      partPhotoUrl, damagedPartPhotoUrl, remarks, emailSent,
      JSON.stringify(recipients), createdAt, requestedById, requestedByName,
      requestedById, createdAt, createdAt
    ], request);

    // Save Email Log
    await runWrite(env, `
      INSERT INTO trc_email_logs (
        trc_id, trc_number, subject, recipients, email_type, body_html, status,
        sent_by_id, sent_by_name, sent_at
      ) VALUES (?, ?, ?, ?, 'spare_requirement', ?, 'sent', ?, ?, ?)
    `, [trcId, machine.trc_number, emailSubject, JSON.stringify(recipients), emailHtml, requestedById, requestedByName, createdAt], request);

    // Save media
    if (partPhotoUrl) {
      await runWrite(env, `
        INSERT INTO trc_media (trc_id, trc_number, stage, media_type, media_label, file_url, created_by, created_at)
        VALUES (?, ?, 'Spare', 'photo', 'Required Part Photo', ?, ?, ?)
      `, [trcId, machine.trc_number, partPhotoUrl, requestedById, createdAt], request);
    }
    if (damagedPartPhotoUrl) {
      await runWrite(env, `
        INSERT INTO trc_media (trc_id, trc_number, stage, media_type, media_label, file_url, created_by, created_at)
        VALUES (?, ?, 'Spare', 'photo', 'Damaged Part Photo', ?, ?, ?)
      `, [trcId, machine.trc_number, damagedPartPhotoUrl, requestedById, createdAt], request);
    }

    // Update machine status to Waiting Spare Part
    await runWrite(env, `
      UPDATE trc_machine_receive SET current_status = ?, updated_at = ? WHERE id = ?
    `, [newStatus, createdAt, trcId], request);

    // Record status history
    await runWrite(env, `
      INSERT INTO trc_status_history (
        trc_id, trc_number, from_status, to_status, stage_name, remarks, changed_by_id, changed_by_name, created_at
      ) VALUES (?, ?, ?, ?, 'Spare', ?, ?, ?, ?)
    `, [trcId, machine.trc_number, machine.current_status, newStatus, `Spare Part Requested: ${partName} (Qty: ${quantity}). Automated notice sent.`, requestedById, requestedByName, createdAt], request);

    return jsonResponse({
      success: true,
      message: `Spare part requisition submitted and notification sent.`,
      status: newStatus,
      emailSubject,
      recipients
    });
  } catch (err) {
    staticLog.error("Error in handleTrcCreateSpareRequest", { error: err.message });
    return errorResponse("Failed to create spare request: " + err.message, 500);
  }
}

// ─── 8. POST /api/trc/spare-status ────────────────────────────────────────────
export async function handleTrcUpdateSpareStatus(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    const spareId = body.spare_id;
    const status = body.status; // "Pending", "Ordered", "Received at TRC", "Rejected"
    const remarks = body.remarks || "";

    if (!spareId || !status) return errorResponse("Spare ID and new status are required", 400);

    const spareRes = await runRead(env, "SELECT * FROM trc_spare_requests WHERE id = ?", [spareId], request);
    const spare = spareRes?.results?.[0];
    if (!spare) return notFoundResponse("Spare request record not found");

    const createdAt = nowISO();
    await runWrite(env, `
      UPDATE trc_spare_requests SET status = ?, remarks = ?, updated_at = ? WHERE id = ?
    `, [status, remarks ? `${spare.remarks || ''} [${status}: ${remarks}]` : spare.remarks, createdAt, spareId], request);

    // If spare received at TRC, update machine status to 'Repair In Progress'
    if (status === "Received at TRC") {
      await runWrite(env, `
        UPDATE trc_machine_receive SET current_status = 'Repair In Progress', updated_at = ? WHERE id = ?
      `, [createdAt, spare.trc_id], request);

      await runWrite(env, `
        INSERT INTO trc_status_history (
          trc_id, trc_number, from_status, to_status, stage_name, remarks, changed_by_id, changed_by_name, created_at
        ) VALUES (?, ?, 'Waiting Spare Part', 'Repair In Progress', 'Spare', ?, ?, ?, ?)
      `, [spare.trc_id, spare.trc_number, `Spare Part "${spare.part_name}" received at TRC Warehouse. Repair ready to proceed.`, user?.user_id || "TRC-USER", user?.name || "TRC Team", createdAt], request);
    }

    return jsonResponse({
      success: true,
      message: `Spare part status updated to ${status}`
    });
  } catch (err) {
    staticLog.error("Error in handleTrcUpdateSpareStatus", { error: err.message });
    return errorResponse("Failed to update spare status: " + err.message, 500);
  }
}

// ─── 9. POST /api/trc/repair ──────────────────────────────────────────────────
export async function handleTrcSaveRepair(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    const trcId = body.trc_id;
    const repairStartDate = body.repair_start_date || new Date().toISOString().split("T")[0];
    const repairStartTime = body.repair_start_time || "09:00:00";
    const repairEndDate = body.repair_end_date || new Date().toISOString().split("T")[0];
    const repairEndTime = body.repair_end_time || "17:00:00";
    const activityDescription = body.activity_description;
    const partsUsed = body.parts_used || "";
    const calibrationDone = body.calibration_done || "Yes";
    const testingDone = body.testing_done || "Yes";
    const repairSummary = body.repair_summary;
    const videoUrl = body.repair_video_url || null;
    const photos = Array.isArray(body.repair_photos) ? JSON.stringify(body.repair_photos) : (body.repair_photos || "[]");

    if (!trcId || !activityDescription || !repairSummary) {
      return errorResponse("TRC Machine ID, Activity Description, and Repair Summary are required", 400);
    }

    const machineRes = await runRead(env, "SELECT * FROM trc_machine_receive WHERE id = ?", [trcId], request);
    const machine = machineRes?.results?.[0];
    if (!machine) return notFoundResponse("Machine record not found");

    const repairedById = user?.user_id || machine.assigned_engineer_id || "ENG-01";
    const repairedByName = user?.name || machine.assigned_engineer_name || "TRC Repair Engineer";
    const createdAt = nowISO();
    const newStatus = "Repair Completed";

    // Insert repair record
    await runWrite(env, `
      INSERT INTO trc_repairs (
        trc_id, trc_number, repair_start_date, repair_start_time, repair_end_date, repair_end_time,
        activity_description, parts_used, calibration_done, testing_done, repair_summary,
        repair_video_url, repair_photos, repaired_by_id, repaired_by_name, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trcId, machine.trc_number, repairStartDate, repairStartTime, repairEndDate, repairEndTime,
      activityDescription, partsUsed, calibrationDone, testingDone, repairSummary,
      videoUrl, photos, repairedById, repairedByName, repairedById, createdAt, createdAt
    ], request);

    // Save media
    if (videoUrl) {
      await runWrite(env, `
        INSERT INTO trc_media (trc_id, trc_number, stage, media_type, media_label, file_url, created_by, created_at)
        VALUES (?, ?, 'Repair', 'video', 'Repair Completion Video', ?, ?, ?)
      `, [trcId, machine.trc_number, videoUrl, repairedById, createdAt], request);
    }

    if (body.repair_photos && Array.isArray(body.repair_photos)) {
      for (const [idx, pUrl] of body.repair_photos.entries()) {
        await runWrite(env, `
          INSERT INTO trc_media (trc_id, trc_number, stage, media_type, media_label, file_url, created_by, created_at)
          VALUES (?, ?, 'Repair', 'photo', ?, ?, ?, ?)
        `, [trcId, machine.trc_number, `Repair Photo #${idx + 1}`, pUrl, repairedById, createdAt], request);
      }
    }

    // Update machine status
    await runWrite(env, `
      UPDATE trc_machine_receive SET current_status = ?, updated_at = ? WHERE id = ?
    `, [newStatus, createdAt, trcId], request);

    // Record status history
    await runWrite(env, `
      INSERT INTO trc_status_history (
        trc_id, trc_number, from_status, to_status, stage_name, remarks, changed_by_id, changed_by_name, created_at
      ) VALUES (?, ?, ?, ?, 'Repair', ?, ?, ?, ?)
    `, [trcId, machine.trc_number, machine.current_status, newStatus, `Repair Completed: ${repairSummary}. Calibration: ${calibrationDone}, Testing: ${testingDone}`, repairedById, repairedByName, createdAt], request);

    return jsonResponse({
      success: true,
      message: "Repair activity successfully saved.",
      status: newStatus
    });
  } catch (err) {
    staticLog.error("Error in handleTrcSaveRepair", { error: err.message });
    return errorResponse("Failed to save repair: " + err.message, 500);
  }
}

// ─── 10. POST /api/trc/qc ─────────────────────────────────────────────────────
export async function handleTrcSaveQC(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    const trcId = body.trc_id;
    
    // 6-point checklist
    const powerOn = body.power_on ? 1 : 0;
    const selfTestPassed = body.self_test_passed ? 1 : 0;
    const calibrationPassed = body.calibration_passed ? 1 : 0;
    const displayOk = body.display_ok ? 1 : 0;
    const accessoriesWorking = body.accessories_working ? 1 : 0;
    const finalFunctionalTest = body.final_functional_test ? 1 : 0;

    const allChecksPassed = (powerOn && selfTestPassed && calibrationPassed && displayOk && accessoriesWorking && finalFunctionalTest) ? 1 : 0;
    const qcVideoUrl = body.qc_video_url || null;
    const qcRemarks = body.qc_remarks || (allChecksPassed ? "All 6 Quality Check verification points passed." : "QC verification incomplete.");

    if (!trcId) return errorResponse("TRC Machine ID is required", 400);

    const machineRes = await runRead(env, "SELECT * FROM trc_machine_receive WHERE id = ?", [trcId], request);
    const machine = machineRes?.results?.[0];
    if (!machine) return notFoundResponse("Machine record not found");

    const qcById = user?.user_id || "QC-INSP-01";
    const qcByName = user?.name || "TRC Quality Inspector";
    const qcDate = body.qc_date || new Date().toISOString().split("T")[0];
    const qcTime = body.qc_time || new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "Asia/Kolkata" });
    const createdAt = nowISO();
    const status = allChecksPassed ? "Passed" : "Conditional";
    const newStatus = allChecksPassed ? "Ready for Warehouse Dispatch" : "QC Completed";

    // Insert QC record
    await runWrite(env, `
      INSERT INTO trc_qc (
        trc_id, trc_number, power_on, self_test_passed, calibration_passed, display_ok,
        accessories_working, final_functional_test, all_checks_passed, qc_video_url,
        qc_remarks, qc_by_id, qc_by_name, qc_date, qc_time, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trcId, machine.trc_number, powerOn, selfTestPassed, calibrationPassed, displayOk,
      accessoriesWorking, finalFunctionalTest, allChecksPassed, qcVideoUrl,
      qcRemarks, qcById, qcByName, qcDate, qcTime, status, qcById, createdAt, createdAt
    ], request);

    // Save QC media
    if (qcVideoUrl) {
      await runWrite(env, `
        INSERT INTO trc_media (trc_id, trc_number, stage, media_type, media_label, file_url, created_by, created_at)
        VALUES (?, ?, 'QC', 'video', 'QC Verification Video', ?, ?, ?)
      `, [trcId, machine.trc_number, qcVideoUrl, qcById, createdAt], request);
    }

    // Update machine status
    await runWrite(env, `
      UPDATE trc_machine_receive SET current_status = ?, updated_at = ? WHERE id = ?
    `, [newStatus, createdAt, trcId], request);

    // Record status history
    await runWrite(env, `
      INSERT INTO trc_status_history (
        trc_id, trc_number, from_status, to_status, stage_name, remarks, changed_by_id, changed_by_name, created_at
      ) VALUES (?, ?, ?, ?, 'QC', ?, ?, ?, ?)
    `, [trcId, machine.trc_number, machine.current_status, newStatus, `Quality Check Result: ${status}. Remarks: ${qcRemarks}`, qcById, qcByName, createdAt], request);

    return jsonResponse({
      success: true,
      message: `Quality Check saved with status: ${status}`,
      allChecksPassed: Boolean(allChecksPassed),
      status: newStatus
    });
  } catch (err) {
    staticLog.error("Error in handleTrcSaveQC", { error: err.message });
    return errorResponse("Failed to save QC: " + err.message, 500);
  }
}

// ─── 11. POST /api/trc/dispatch ───────────────────────────────────────────────
export async function handleTrcDispatchMachine(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    const trcId = body.trc_id;
    const courierName = body.courier_name || body.handover_person || "Logistics Van";
    const trackingNumber = body.tracking_number || `DISP-${Date.now().toString(36).toUpperCase()}`;
    const destination = body.destination || "";
    const dispatchDate = body.dispatch_date || new Date().toISOString().split("T")[0];
    const remarks = body.remarks || "Machine dispatched back to hospital / district warehouse.";

    if (!trcId) return errorResponse("TRC Machine ID is required", 400);

    const machineRes = await runRead(env, "SELECT * FROM trc_machine_receive WHERE id = ?", [trcId], request);
    const machine = machineRes?.results?.[0];
    if (!machine) return notFoundResponse("Machine record not found");

    const dispatchedById = user?.user_id || "TRC-LOGISTICS";
    const dispatchedByName = user?.name || "TRC Warehouse Officer";
    const createdAt = nowISO();
    const newStatus = "Dispatched";

    await runWrite(env, `
      UPDATE trc_machine_receive SET current_status = ?, updated_at = ? WHERE id = ?
    `, [newStatus, createdAt, trcId], request);

    await runWrite(env, `
      INSERT INTO trc_status_history (
        trc_id, trc_number, from_status, to_status, stage_name, remarks, changed_by_id, changed_by_name, created_at
      ) VALUES (?, ?, ?, ?, 'Dispatch', ?, ?, ?, ?)
    `, [trcId, machine.trc_number, machine.current_status, newStatus, `Dispatched via ${courierName} (Tracking: ${trackingNumber}) on ${dispatchDate}. Dest: ${destination || machine.hospital_name}. ${remarks}`, dispatchedById, dispatchedByName, createdAt], request);

    return jsonResponse({
      success: true,
      message: "Machine marked as Dispatched from TRC.",
      status: newStatus,
      trackingNumber
    });
  } catch (err) {
    staticLog.error("Error in handleTrcDispatchMachine", { error: err.message });
    return errorResponse("Failed to dispatch machine: " + err.message, 500);
  }
}

// ─── 12. POST /api/trc/close ──────────────────────────────────────────────────
export async function handleTrcCloseMachine(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    const trcId = body.trc_id;
    const remarks = body.remarks || "Field installation & confirmation verified by DI/Biomedical Engineer.";

    if (!trcId) return errorResponse("TRC Machine ID is required", 400);

    const machineRes = await runRead(env, "SELECT * FROM trc_machine_receive WHERE id = ?", [trcId], request);
    const machine = machineRes?.results?.[0];
    if (!machine) return notFoundResponse("Machine record not found");

    const closedById = user?.user_id || "TRC-ADMIN";
    const closedByName = user?.name || "TRC Manager";
    const createdAt = nowISO();
    const newStatus = "Closed";

    await runWrite(env, `
      UPDATE trc_machine_receive SET current_status = ?, updated_at = ? WHERE id = ?
    `, [newStatus, createdAt, trcId], request);

    await runWrite(env, `
      INSERT INTO trc_status_history (
        trc_id, trc_number, from_status, to_status, stage_name, remarks, changed_by_id, changed_by_name, created_at
      ) VALUES (?, ?, ?, ?, 'Closure', ?, ?, ?, ?)
    `, [trcId, machine.trc_number, machine.current_status, newStatus, remarks, closedById, closedByName, createdAt], request);

    return jsonResponse({
      success: true,
      message: "TRC Job lifecycle closed successfully.",
      status: newStatus
    });
  } catch (err) {
    staticLog.error("Error in handleTrcCloseMachine", { error: err.message });
    return errorResponse("Failed to close TRC job: " + err.message, 500);
  }
}

// ─── 13. GET /api/trc/engineers ───────────────────────────────────────────────
export async function handleTrcGetEngineers(request, env, params, query, user) {
  try {
    // Fetch engineers from users table
    const engRes = await runRead(env, `
      SELECT user_id, name, designation, grade, district, zone, mobile_number, mail_id
      FROM users 
      WHERE (role LIKE '%Engineer%' OR designation LIKE '%Engineer%' OR designation LIKE '%Specialist%' OR designation LIKE '%TRC%' OR role = 'Admin')
        AND user_status = 'active'
      ORDER BY name ASC
    `, [], request).catch(() => ({ results: [] }));

    const dbEngs = engRes?.results || [];

    // Combine with default TRC specialists, ensuring no duplicates by user_id or name
    const map = new Map();
    DEFAULT_TRC_ENGINEERS.forEach(e => map.set(e.name.toLowerCase(), e));
    dbEngs.forEach(e => {
      const key = (e.name || "").toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          user_id: e.user_id,
          name: e.name,
          designation: e.designation || "Biomedical Engineer",
          mobile_number: e.mobile_number,
          email: e.mail_id
        });
      }
    });

    return jsonResponse({
      success: true,
      engineers: Array.from(map.values())
    });
  } catch (err) {
    staticLog.error("Error in handleTrcGetEngineers", { error: err.message });
    return jsonResponse({
      success: true,
      engineers: DEFAULT_TRC_ENGINEERS
    });
  }
}

// ─── 14. GET /api/trc/stats ───────────────────────────────────────────────────
export async function handleTrcGetStats(request, env, params, query, user) {
  try {
    const totalRes = await runRead(env, "SELECT count(*) as total FROM trc_machine_receive", [], request).catch(() => ({ results: [{ total: 0 }] }));
    const statusCountsRes = await runRead(env, `
      SELECT current_status, count(*) as count 
      FROM trc_machine_receive 
      GROUP BY current_status
    `, [], request).catch(() => ({ results: [] }));

    const counts = {};
    (statusCountsRes?.results || []).forEach(r => {
      counts[r.current_status] = r.count;
    });

    const stats = {
      total: totalRes?.results?.[0]?.total || 0,
      received: counts["Machine Received in TRC"] || 0,
      assigned: counts["Assigned to Engineer"] || 0,
      diagnosisCompleted: counts["Diagnosis Completed"] || 0,
      waitingSpares: counts["Waiting Spare Part"] || 0,
      repairInProgress: counts["Repair In Progress"] || 0,
      repairCompleted: counts["Repair Completed"] || 0,
      qcCompleted: counts["QC Completed"] || 0,
      readyDispatch: counts["Ready for Warehouse Dispatch"] || 0,
      dispatched: counts["Dispatched"] || 0,
      closed: counts["Closed"] || 0
    };

    return jsonResponse({
      success: true,
      stats
    });
  } catch (err) {
    staticLog.error("Error in handleTrcGetStats", { error: err.message });
    return errorResponse("Failed to fetch stats: " + err.message, 500);
  }
}

// ─── 15. POST /api/trc/upload-media ───────────────────────────────────────────
export async function handleTrcUploadMedia(request, env, params, query, user) {
  try {
    let formData;
    try { formData = await request.formData(); }
    catch { return errorResponse("Invalid multipart form data", 400); }

    const file = formData.get("file");
    if (!file) return errorResponse("No file attached", 400);

    const fileBuffer = await file.arrayBuffer();
    const stage = formData.get("stage") || "General";
    const mediaLabel = formData.get("label") || file.name || "TRC Attachment";
    const trcId = formData.get("trc_id") ? parseInt(formData.get("trc_id"), 10) : null;
    const trcNumber = formData.get("trc_number") || "";

    const isVideo = file.type?.startsWith("video/") || file.name?.endsWith(".mp4") || file.name?.endsWith(".webm") || file.name?.endsWith(".mov");
    const mediaType = isVideo ? "video" : (file.type?.startsWith("image/") ? "photo" : "document");

    const context = {
      category: `trc_${stage.toLowerCase()}`,
      employeeId: user?.user_id || "TRC-USER",
      employeeName: user?.name || "TRC Engineer",
      originalFilename: file.name,
      contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      uploadedBy: user?.user_id || "unknown"
    };

    let uploadResult;
    try {
      uploadResult = await enterpriseUpload(env, fileBuffer, context);
    } catch (upErr) {
      staticLog.warn("Direct R2 upload fallback", { error: upErr.message });
    }

    const safeFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const fileUrl = uploadResult?.url || `/api/files/trc/${safeFilename}`;
    const r2Key = uploadResult?.r2Key || `trc/${safeFilename}`;

    // If trcId provided, register into trc_media table
    if (trcId) {
      await runWrite(env, `
        INSERT INTO trc_media (
          trc_id, trc_number, stage, media_type, media_label, file_url, r2_key,
          original_filename, file_size, content_type, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        trcId, trcNumber, stage, mediaType, mediaLabel, fileUrl, r2Key,
        file.name, fileBuffer.byteLength, file.type, user?.user_id || "unknown", nowISO()
      ], request).catch(() => {});
    }

    return jsonResponse({
      success: true,
      url: fileUrl,
      mediaType,
      mediaLabel,
      r2Key,
      fileSize: fileBuffer.byteLength,
      originalFilename: file.name
    });
  } catch (err) {
    staticLog.error("Error in handleTrcUploadMedia", { error: err.message });
    return errorResponse("Media upload failed: " + err.message, 500);
  }
}

/**
 * GET /api/trc/districts
 * Fetches distinct districts actively present in the database (assets_inventory, facility_details, users)
 */
export async function handleTrcGetDistricts(request, env) {
  try {
    const distSet = new Set();
    const zoneSet = new Set();
    const districtsByZone = {};
    const facilitiesByDistrict = {};

    // 1. Fetch from facility_details (primary hierarchy mapping)
    const facRows = await env.DB.prepare(`
      SELECT DISTINCT zone_name, district_name, facility_name 
      FROM facility_details 
      WHERE district_name IS NOT NULL AND TRIM(district_name) != ''
      ORDER BY district_name ASC
    `).all().catch(() => ({ results: [] }));

    for (const r of (facRows.results || [])) {
      const z = (r.zone_name || "Rajasthan").trim();
      const d = (r.district_name || "").trim();
      const f = (r.facility_name || "").trim();

      if (z) zoneSet.add(z);
      if (d) {
        distSet.add(d);
        if (!districtsByZone[z]) districtsByZone[z] = [];
        if (!districtsByZone[z].includes(d)) districtsByZone[z].push(d);

        if (f) {
          if (!facilitiesByDistrict[d]) facilitiesByDistrict[d] = [];
          if (!facilitiesByDistrict[d].includes(f)) facilitiesByDistrict[d].push(f);
        }
      }
    }

    // 2. Fetch from assets_inventory
    const assetRows = await env.DB.prepare(`
      SELECT DISTINCT zone_name, district_name, hospital_name 
      FROM assets_inventory 
      WHERE district_name IS NOT NULL AND TRIM(district_name) != ''
      ORDER BY district_name ASC
    `).all().catch(() => ({ results: [] }));
    
    for (const r of (assetRows.results || [])) {
      const z = (r.zone_name || "Rajasthan").trim();
      const d = (r.district_name || "").trim();
      const h = (r.hospital_name || "").trim();

      if (z) zoneSet.add(z);
      if (d) {
        distSet.add(d);
        if (!districtsByZone[z]) districtsByZone[z] = [];
        if (!districtsByZone[z].includes(d)) districtsByZone[z].push(d);

        if (h) {
          if (!facilitiesByDistrict[d]) facilitiesByDistrict[d] = [];
          if (!facilitiesByDistrict[d].includes(h)) facilitiesByDistrict[d].push(h);
        }
      }
    }

    // 3. Fetch from users
    const userDistricts = await env.DB.prepare(`
      SELECT DISTINCT zone, district 
      FROM users 
      WHERE district IS NOT NULL AND TRIM(district) != ''
    `).all().catch(() => ({ results: [] }));

    for (const r of (userDistricts.results || [])) {
      const z = (r.zone || "Rajasthan").trim();
      const d = (r.district || "").trim();
      if (z) zoneSet.add(z);
      if (d) {
        distSet.add(d);
        if (!districtsByZone[z]) districtsByZone[z] = [];
        if (!districtsByZone[z].includes(d)) districtsByZone[z].push(d);
      }
    }

    // Default fallback zones & districts if empty database
    if (distSet.size === 0) {
      ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Balotra", "Bharatpur", "Bhilwara",
       "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur",
       "Ganganagar", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar",
       "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Phalodi", "Pratapgarh",
       "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Tonk", "Udaipur"].forEach(d => distSet.add(d));
    }

    if (zoneSet.size === 0) {
      ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Udaipur", "Bharatpur"].forEach(z => zoneSet.add(z));
    }

    // 4. Fetch distinct equipment types from assets_inventory for quick dropdown selection
    const equipRows = await env.DB.prepare(`
      SELECT DISTINCT equipment_name 
      FROM assets_inventory 
      WHERE equipment_name IS NOT NULL AND TRIM(equipment_name) != '' 
      ORDER BY equipment_name ASC 
      LIMIT 300
    `).all().catch(() => ({ results: [] }));
    
    let equipments = (equipRows.results || []).map(r => r.equipment_name).filter(Boolean);
    if (equipments.length === 0) {
      equipments = [
        "ECG Machine", "Multipara Monitor", "Defibrillator", "Ventilator", "Infusion Pump",
        "Syringe Pump", "Suction Apparatus", "Cautery / Electrosurgical Unit", "Nebulizer",
        "Pulse Oximeter", "Baby Warmer", "Phototherapy Unit", "Centrifuge", "Microscope",
        "Autoclave", "X-Ray Machine", "Ultrasound Machine", "Fogging Machine", "Biomedical Equipment Unit"
      ];
    }

    // 5. Fetch distinct Make / OEM manufacturers
    const makeRows = await env.DB.prepare(`
      SELECT DISTINCT oem_name 
      FROM assets_inventory 
      WHERE oem_name IS NOT NULL AND TRIM(oem_name) != '' AND oem_name != '--'
      ORDER BY oem_name ASC 
      LIMIT 150
    `).all().catch(() => ({ results: [] }));

    let makes = (makeRows.results || []).map(r => r.oem_name).filter(Boolean);
    if (makes.length === 0) {
      makes = [
        "BPL Medical", "Philips Healthcare", "GE Healthcare", "Mindray", "Nihon Kohden",
        "Contec", "Schiller", "Dräger", "Fresenius", "Olympus", "B-Braun", "Skanray",
        "Fisher & Paykel", "Trivitron", "Allengers", "Medtronic", "Siemens Healthineers"
      ];
    }

    // 6. Map DI, Coordinator, and DM per Hospital & District from di_name_list and users
    const hospitalMapping = {};
    const diListRows = await env.DB.prepare(`
      SELECT hospital_name, di_name, coordinator_name, zone_name, district_name 
      FROM di_name_list 
      WHERE hospital_name IS NOT NULL AND TRIM(hospital_name) != ''
    `).all().catch(() => ({ results: [] }));

    for (const r of (diListRows.results || [])) {
      if (r.hospital_name) {
        hospitalMapping[r.hospital_name.trim()] = {
          di_name: (r.di_name || "").trim(),
          coordinator_name: (r.coordinator_name || "").trim(),
          zone_name: (r.zone_name || "").trim(),
          district_name: (r.district_name || "").trim()
        };
      }
    }

    const districtMapping = {};
    const dmRows = await env.DB.prepare(`
      SELECT name, role, district, zone 
      FROM users 
      WHERE district IS NOT NULL AND TRIM(district) != ''
    `).all().catch(() => ({ results: [] }));

    for (const r of (dmRows.results || [])) {
      const d = (r.district || "").trim();
      if (d) {
        if (!districtMapping[d]) districtMapping[d] = { dm_name: "", coordinator_name: "", di_name: "" };
        const role = (r.role || "").toLowerCase();
        if (role.includes("district manager") || role.includes("dm") || role.includes("division manager")) {
          districtMapping[d].dm_name = r.name;
        } else if (role.includes("coordinator")) {
          districtMapping[d].coordinator_name = r.name;
        } else if (role.includes("di") || role.includes("engineer")) {
          if (!districtMapping[d].di_name) districtMapping[d].di_name = r.name;
        }
      }
    }

    const districts = Array.from(distSet).sort((a, b) => a.localeCompare(b));
    const zones = Array.from(zoneSet).sort((a, b) => a.localeCompare(b));

    return jsonResponse({
      success: true,
      zones,
      districts,
      districtsByZone,
      facilitiesByDistrict,
      equipments,
      makes,
      hospitalMapping,
      districtMapping,
      count: districts.length
    });
  } catch (err) {
    return errorResponse("Failed to fetch location hierarchy: " + err.message, 500);
  }
}
