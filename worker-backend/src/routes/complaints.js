/**
 * ============================================================
 * Standalone Complaint Management Data Ingestion System
 * Cyrix Field Connect — Cloudflare Worker Backend
 * ============================================================
 * 
 * 🔒 CRITICAL BUSINESS RULE DIRECTIVE:
 * If a complaint_id already exists in the complaints table AND its current
 * complaint_status in the DB is 'Final Closed', that row MUST be completely skipped.
 * No fields touched, no updated_at bumped.
 * All other cases (new complaint_id or existing with non-Final Closed status)
 * are upserted with latest values.
 * ============================================================
 */

import { jsonResponse, errorResponse, forbiddenResponse, notFoundResponse } from "../utils/http.js";

// Helper: Check if user has complaint upload permission
export async function checkComplaintUploadAccess(env, user) {
  if (!user) return false;
  const role = (user.role || user.designation || "").trim().toLowerCase();
  if (role === "admin") return true;

  const userCode = String(user.user_id || user.e_code || user.id || "").trim();
  const perm = await env.DB.prepare(`
    SELECT is_active FROM complaint_upload_permissions 
    WHERE (LOWER(user_id) = LOWER(?) OR LOWER(user_id) = LOWER(?)) AND is_active = 1
  `).bind(userCode, String(user.id)).first();

  return !!perm;
}

// Helper: Normalize dates to ISO 'YYYY-MM-DD'
export function normalizeDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (!str || str === "-" || str === "N/A" || str === "null" || str === "undefined") return null;

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  // If DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // If DD-MMM-YYYY (e.g. 05-Aug-2026 or 5-Aug-26)
  const dMmmYMatch = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})/);
  if (dMmmYMatch) {
    const months = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const day = dMmmYMatch[1].padStart(2, "0");
    const monStr = dMmmYMatch[2].toLowerCase();
    const month = months[monStr] || "01";
    let year = dMmmYMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // Fallback try Date.parse
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().substring(0, 10);
    }
  } catch (_) {}

  return str.substring(0, 50);
}

// Helper: Normalize numeric values
export function normalizeFloat(val) {
  if (val === null || val === undefined || val === "") return 0.0;
  const clean = String(val).replace(/[^0-9.-]+/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0.0 : num;
}

export function normalizeInt(val) {
  if (val === null || val === undefined || val === "") return 0;
  const clean = String(val).replace(/[^0-9-]+/g, "");
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
}

// Helper: Clean string field
export function cleanStr(val, maxLen = 255) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length > maxLen ? s.substring(0, maxLen) : s;
}

/**
 * 🔒 LOCKED: Core Upsert Statement Generator for Complaints
 * Enforces: Do not touch/overwrite rows where current DB complaint_status == 'Final Closed'
 */
export const LOCKED_COMPLAINT_UPSERT_SQL = `
  INSERT INTO complaints (
    complaint_id, district_name, hospital_type, hospital_name, bar_code,
    equipment_name, equipment_model, complaint_raise_date, complaint_close_date,
    complaint_status, total_downtime, estimated_cost, penalty_days,
    complaint_final_close, attend_date, attend_penalty, delay_penalty,
    total_penalty, is_under_warranty, service_provider_name,
    attended_service_engg_id, closing_service_engg_id, uploaded_by, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(complaint_id) DO UPDATE SET
    district_name = excluded.district_name,
    hospital_type = excluded.hospital_type,
    hospital_name = excluded.hospital_name,
    bar_code = excluded.bar_code,
    equipment_name = excluded.equipment_name,
    equipment_model = excluded.equipment_model,
    complaint_raise_date = excluded.complaint_raise_date,
    complaint_close_date = excluded.complaint_close_date,
    complaint_status = excluded.complaint_status,
    total_downtime = excluded.total_downtime,
    estimated_cost = excluded.estimated_cost,
    penalty_days = excluded.penalty_days,
    complaint_final_close = excluded.complaint_final_close,
    attend_date = excluded.attend_date,
    attend_penalty = excluded.attend_penalty,
    delay_penalty = excluded.delay_penalty,
    total_penalty = excluded.total_penalty,
    is_under_warranty = excluded.is_under_warranty,
    service_provider_name = excluded.service_provider_name,
    attended_service_engg_id = excluded.attended_service_engg_id,
    closing_service_engg_id = excluded.closing_service_engg_id,
    uploaded_by = excluded.uploaded_by,
    updated_at = datetime('now')
  WHERE complaints.complaint_status != 'Final Closed'
`;

/**
 * Maps raw incoming row object or array to normalized complaint params
 */
export function mapRowToComplaintParams(row, uploaderId) {
  // Support both object with header keys and 0-indexed array
  let cId, dist, hospType, hospName, barCode, eqName, eqModel;
  let raiseDate, closeDate, status, downtime, estCost, penDays;
  let finalClose, attDate, attPen, delayPen, totPen, warranty;
  let spName, attEngId, closeEngId;

  if (Array.isArray(row)) {
    [
      dist, hospType, hospName, barCode, eqName,
      eqModel, cId, raiseDate, closeDate,
      status, downtime, estCost, penDays,
      finalClose, attDate, attPen, delayPen,
      totPen, warranty, spName,
      attEngId, closeEngId
    ] = row;
  } else if (typeof row === "object" && row !== null) {
    // Normalizing keys case-insensitively
    const getVal = (...keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) return row[k];
        const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        for (const actualKey of Object.keys(row)) {
          if (actualKey.toLowerCase().replace(/[^a-z0-9]/g, "") === lowerK) {
            return row[actualKey];
          }
        }
      }
      return null;
    };

    dist = getVal("District Name", "district_name", "district");
    hospType = getVal("Hospital Type", "hospital_type");
    hospName = getVal("Hospital Name", "hospital_name");
    barCode = getVal("Bar Code", "bar_code", "barcode");
    eqName = getVal("Equipment Name", "equipment_name");
    eqModel = getVal("Equipment Model", "equipment_model");
    cId = getVal("Complaint ID", "complaint_id", "complaintid", "id");
    raiseDate = getVal("Complaint Raise Date", "complaint_raise_date", "raise_date");
    closeDate = getVal("Complaint Close date", "Complaint Close Date", "complaint_close_date", "close_date");
    status = getVal("Complaint Status", "complaint_status", "status");
    downtime = getVal("Total Downtime", "total_downtime", "downtime");
    estCost = getVal("Estimated Cost", "estimated_cost");
    penDays = getVal("Penalty Days", "penalty_days");
    finalClose = getVal("Complaint Final Close", "complaint_final_close", "final_close_date");
    attDate = getVal("Attend Date", "attend_date");
    attPen = getVal("Attend Penalty", "attend_penalty");
    delayPen = getVal("Delay Penalty", "delay_penalty");
    totPen = getVal("Total Penalty(Attend+Delay)", "Total Penalty", "total_penalty");
    warranty = getVal("Is Under Warrenty", "Is Under Warranty", "is_under_warranty", "warranty");
    spName = getVal("Service Provider Name", "service_provider_name");
    attEngId = getVal("Attended Service Engg ID", "attended_service_engg_id", "attended_engg_id");
    closeEngId = getVal("Closing Service Engg ID", "closing_service_engg_id", "closing_engg_id");
  }

  const cleanComplaintId = cleanStr(cId, 100);
  if (!cleanComplaintId) {
    return null; // Invalid row: missing complaint_id
  }

  return [
    cleanComplaintId,
    cleanStr(dist, 100),
    cleanStr(hospType, 100),
    cleanStr(hospName, 200),
    cleanStr(barCode, 100),
    cleanStr(eqName, 200),
    cleanStr(eqModel, 200),
    normalizeDate(raiseDate),
    normalizeDate(closeDate),
    cleanStr(status, 100),
    cleanStr(downtime, 100),
    normalizeFloat(estCost),
    normalizeInt(penDays),
    normalizeDate(finalClose),
    normalizeDate(attDate),
    normalizeFloat(attPen),
    normalizeFloat(delayPen),
    normalizeFloat(totPen),
    cleanStr(warranty, 50),
    cleanStr(spName, 200),
    cleanStr(attEngId, 100),
    cleanStr(closeEngId, 100),
    cleanStr(uploaderId, 100)
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/complaints/check-permission
 * Check if the currently logged-in user can access complaint uploads
 */
export async function handleCheckPermission(request, env, params, query, user) {
  const hasAccess = await checkComplaintUploadAccess(env, user);
  const role = (user?.role || user?.designation || "").trim().toLowerCase();
  return jsonResponse({
    can_upload: hasAccess,
    is_admin: role === "admin"
  });
}

/**
 * GET /api/complaints/permissions
 * List all users and their upload permission state (Admin only)
 */
export async function handleListPermissions(request, env, params, query, user) {
  const role = (user?.role || user?.designation || "").trim().toLowerCase();
  if (role !== "admin") {
    return forbiddenResponse("Admin access required to manage complaint upload permissions");
  }

  const users = await env.DB.prepare(`
    SELECT 
      u.id, u.user_id as employee_code, u.name, u.role, u.district, u.email,
      COALESCE(p.is_active, 0) as has_permission,
      p.granted_by, p.granted_at
    FROM users u
    LEFT JOIN complaint_upload_permissions p ON LOWER(u.user_id) = LOWER(p.user_id) OR CAST(u.id AS TEXT) = p.user_id
    WHERE u.is_active = 1
    ORDER BY has_permission DESC, u.name ASC
  `).all();

  return jsonResponse({
    status: "success",
    users: users.results || []
  });
}

/**
 * POST /api/complaints/permissions/toggle
 * Toggle upload permission for a specific user (Admin only)
 */
export async function handleTogglePermission(request, env, params, query, user) {
  const role = (user?.role || user?.designation || "").trim().toLowerCase();
  if (role !== "admin") {
    return forbiddenResponse("Admin access required to manage complaint upload permissions");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON payload", 400);
  }

  const { target_user_id, is_active } = body;
  if (!target_user_id) {
    return errorResponse("target_user_id is required", 400);
  }

  const adminId = String(user.user_id || user.e_code || user.id || "admin");
  const activeVal = is_active ? 1 : 0;

  await env.DB.prepare(`
    INSERT INTO complaint_upload_permissions (user_id, granted_by, granted_at, is_active)
    VALUES (?, ?, datetime('now'), ?)
    ON CONFLICT(user_id) DO UPDATE SET
      is_active = excluded.is_active,
      granted_by = excluded.granted_by,
      granted_at = datetime('now')
  `).bind(String(target_user_id), adminId, activeVal).run();

  return jsonResponse({
    status: "success",
    message: `Permission ${activeVal ? "granted" : "revoked"} successfully for user ${target_user_id}`
  });
}

/**
 * POST /api/complaints/upload/chunk
 * Path A: Synchronous batch processing of row chunks (2,000–5,000 rows)
 */
export async function handleUploadChunk(request, env, params, query, user) {
  const hasAccess = await checkComplaintUploadAccess(env, user);
  if (!hasAccess) {
    return forbiddenResponse("You do not have permission to upload complaint data");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON payload", 400);
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return errorResponse("rows array is required and cannot be empty", 400);
  }

  const uploaderId = String(user.user_id || user.e_code || user.id || "unknown");
  
  // 1. Filter and validate incoming rows
  const validRowParams = [];
  const validComplaintIds = [];
  let skippedInvalid = 0;

  for (const r of rows) {
    const params = mapRowToComplaintParams(r, uploaderId);
    if (!params) {
      skippedInvalid++;
    } else {
      validRowParams.push(params);
      validComplaintIds.push(params[0]); // complaint_id is index 0
    }
  }

  if (validRowParams.length === 0) {
    return jsonResponse({
      status: "success",
      total_rows: rows.length,
      inserted: 0,
      updated: 0,
      skipped_final_closed: 0,
      skipped_invalid: skippedInvalid
    });
  }

  // 2. Query existing status of valid complaint IDs in DB to accurately calculate metrics
  // SQLite supports up to 999 variables per query; chunk ID lookups into slices of 500
  const existingMap = new Map();
  for (let i = 0; i < validComplaintIds.length; i += 500) {
    const idSlice = validComplaintIds.slice(i, i + 500);
    const placeholders = idSlice.map(() => "?").join(",");
    const existingRows = await env.DB.prepare(`
      SELECT complaint_id, complaint_status FROM complaints WHERE complaint_id IN (${placeholders})
    `).bind(...idSlice).all();

    for (const er of (existingRows.results || [])) {
      existingMap.set(String(er.complaint_id), String(er.complaint_status || "").trim());
    }
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedFinalClosed = 0;

  for (const params of validRowParams) {
    const cId = params[0];
    if (existingMap.has(cId)) {
      const currentDbStatus = existingMap.get(cId);
      if (currentDbStatus === "Final Closed") {
        skippedFinalClosed++;
      } else {
        updatedCount++;
      }
    } else {
      insertedCount++;
    }
  }

  // 3. Execute batched parameter upsert statements
  // Chunk into sub-batches of 500 statements for optimal D1 throughput
  const D1_BATCH_SIZE = 500;
  const stmtTemplate = env.DB.prepare(LOCKED_COMPLAINT_UPSERT_SQL);

  for (let i = 0; i < validRowParams.length; i += D1_BATCH_SIZE) {
    const batchSlice = validRowParams.slice(i, i + D1_BATCH_SIZE);
    const batchStatements = batchSlice.map(p => stmtTemplate.bind(...p));
    await env.DB.batch(batchStatements);
  }

  return jsonResponse({
    status: "success",
    total_rows: rows.length,
    inserted: insertedCount,
    updated: updatedCount,
    skipped_final_closed: skippedFinalClosed,
    skipped_invalid: skippedInvalid
  });
}

/**
 * POST /api/complaints/upload/init-large
 * Path B: Initialize large asynchronous upload session
 */
export async function handleInitLargeUpload(request, env, params, query, user) {
  const hasAccess = await checkComplaintUploadAccess(env, user);
  if (!hasAccess) {
    return forbiddenResponse("You do not have permission to upload complaint data");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  const { filename, total_rows } = body;
  const jobId = `complaint_job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const ext = (filename || "").toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
  const fileKey = `complaint-uploads/${jobId}.${ext}`;
  const uploaderId = String(user.user_id || user.e_code || user.id || "unknown");

  // Create job record in database
  await env.DB.prepare(`
    INSERT INTO complaint_upload_jobs (
      job_id, file_key, uploaded_by, total_rows, processed_rows,
      inserted_rows, updated_rows, skipped_final_closed, skipped_invalid,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 'pending', datetime('now'), datetime('now'))
  `).bind(jobId, fileKey, uploaderId, parseInt(total_rows || "0", 10)).run();

  return jsonResponse({
    status: "success",
    job_id: jobId,
    file_key: fileKey,
    upload_endpoint: `/api/complaints/upload/file/${jobId}`
  });
}

/**
 * PUT / POST /api/complaints/upload/file/:job_id
 * Path B: Direct raw file upload to R2
 */
export async function handleDirectFileUpload(request, env, params, query, user) {
  const hasAccess = await checkComplaintUploadAccess(env, user);
  if (!hasAccess) {
    return forbiddenResponse("You do not have permission to upload complaint data");
  }

  const jobId = params.job_id;
  if (!jobId) return errorResponse("job_id is required", 400);

  const job = await env.DB.prepare("SELECT * FROM complaint_upload_jobs WHERE job_id = ?").bind(jobId).first();
  if (!job) return notFoundResponse("Upload job not found");

  if (!env.R2_BUCKET) {
    return errorResponse("R2 Storage is not configured on this environment", 500);
  }

  // Stream directly into R2 bucket
  const fileKey = job.file_key;
  const contentType = request.headers.get("content-type") || "application/octet-stream";
  
  await env.R2_BUCKET.put(fileKey, request.body, {
    httpMetadata: { contentType },
    customMetadata: {
      jobId,
      uploadedBy: job.uploaded_by
    }
  });

  return jsonResponse({
    status: "success",
    message: "File successfully stored in R2",
    job_id: jobId,
    file_key: fileKey
  });
}

/**
 * POST /api/complaints/upload/enqueue
 * Path B: Enqueue background job to Cloudflare Queue after R2 upload completes
 */
export async function handleEnqueueJob(request, env, params, query, user) {
  const hasAccess = await checkComplaintUploadAccess(env, user);
  if (!hasAccess) {
    return forbiddenResponse("You do not have permission to upload complaint data");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  const jobId = body.job_id;
  if (!jobId) return errorResponse("job_id is required", 400);

  const job = await env.DB.prepare("SELECT * FROM complaint_upload_jobs WHERE job_id = ?").bind(jobId).first();
  if (!job) return notFoundResponse("Upload job not found");

  // Send message to Queue (or fallback to background task via waitUntil if Queue unavailable)
  const queueMsg = {
    type: "complaint_upload_job",
    job_id: job.job_id,
    file_key: job.file_key,
    uploaded_by: job.uploaded_by
  };

  if (env.UPLOADS_QUEUE && typeof env.UPLOADS_QUEUE.send === "function") {
    await env.UPLOADS_QUEUE.send(queueMsg);
  } else {
    // Fallback: trigger background processing directly using ctx.waitUntil
    const { processComplaintJobDirectly } = await import("../queues/complaintQueueProcessor.js");
    if (typeof processComplaintJobDirectly === "function" && env.ctx && typeof env.ctx.waitUntil === "function") {
      env.ctx.waitUntil(processComplaintJobDirectly(job.job_id, job.file_key, job.uploaded_by, env));
    }
  }

  await env.DB.prepare(`
    UPDATE complaint_upload_jobs SET status = 'processing', updated_at = datetime('now') WHERE job_id = ?
  `).bind(jobId).run();

  return jsonResponse({
    status: "success",
    message: "Complaint upload job enqueued for background processing",
    job_id: jobId
  });
}

/**
 * GET /api/complaints/upload-jobs/:job_id
 * Path B: Fetch job status and live progress
 */
export async function handleGetJobStatus(request, env, params, query, user) {
  const jobId = params.job_id;
  if (!jobId) return errorResponse("job_id is required", 400);

  const job = await env.DB.prepare(`
    SELECT * FROM complaint_upload_jobs WHERE job_id = ?
  `).bind(jobId).first();

  if (!job) return notFoundResponse("Upload job not found");

  return jsonResponse({
    status: "success",
    job: {
      job_id: job.job_id,
      status: job.status,
      total_rows: job.total_rows || 0,
      processed_rows: job.processed_rows || 0,
      inserted_rows: job.inserted_rows || 0,
      updated_rows: job.updated_rows || 0,
      skipped_final_closed: job.skipped_final_closed || 0,
      skipped_invalid: job.skipped_invalid || 0,
      error_message: job.error_message || null,
      created_at: job.created_at,
      updated_at: job.updated_at
    }
  });
}
