/**
 * ============================================================
 * Enterprise Upload Route — Cloudflare R2 Only
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * REMOVED: Google Drive / GAS upload fallback (completely gone).
 * PRIMARY: Cloudflare R2 (env.R2_BUCKET direct binding).
 *
 * File pipeline:
 *   1. Magic-byte format validation (not just MIME type)
 *   2. Size check (max 10 MB)
 *   3. SHA-256 hash → duplicate detection
 *   4. Generate enterprise R2 key (folder/year/month/category/name)
 *   5. Upload to R2 via direct binding
 *   6. Store metadata in file_metadata table
 *   7. Return signed URL path (served via /api/files/:key)
 * ============================================================
 */

import {
  enterpriseUpload,
  validateFileSize,
  getR2Object,
  deleteFromR2,
  generateThumbnailKey,
} from "../utils/r2Storage.js";
import { jsonResponse, errorResponse } from "../utils/http.js";
import { uploadRateLimit } from "../utils/rateLimit.js";
import { nowISO } from "../utils/timestamp.js";
import { staticLog } from "../utils/logger.js";

// ─── POST /api/upload/image ───────────────────────────────────────────────────
export async function handleUploadImage(request, env, params, query, user) {
  if (user && env.OTPS_KV) {
    const rl = await uploadRateLimit(env, user.user_id, request.headers.get("CF-Connecting-IP"));
    if (rl) return rl;
  }

  let formData;
  try { formData = await request.formData(); }
  catch { return errorResponse("Invalid multipart form data", 400); }

  const file = formData.get("file");
  if (!file) return errorResponse("No file uploaded", 400);

  const fileBuffer = await file.arrayBuffer();
  const sizeCheck = validateFileSize(fileBuffer.byteLength);
  if (!sizeCheck.valid) return errorResponse(sizeCheck.error, 400);

  const context = {
    category: formData.get("category") || "expense_photo",
    expenseId: parseInt(formData.get("expense_id")) || null,
    expenseCode: formData.get("expense_code") || null,
    travelName: formData.get("travel_name") || null,
    employeeId: formData.get("employee_id") || user?.user_id || null,
    employeeName: formData.get("employee_name") || user?.name || null,
    hospitalName: formData.get("hospital_name") || null,
    tripDate: formData.get("trip_date") || null,
    uploadedBy: user?.user_id || "unknown",
    originalFilename: file.name || "upload.jpg",
    contentType: file.type || "image/jpeg",
    itineraryId: formData.get("itinerary_id") || null,
  };

  const result = await enterpriseUpload(env, fileBuffer, context);
  if (!result.success) return errorResponse(result.error, 400);

  return jsonResponse({
    success: true,
    filename: context.originalFilename,
    safeFilename: result.safeFilename,
    url: result.url,
    fileId: result.fileId,
    r2Key: result.r2Key,
    isDuplicate: result.isDuplicate || false,
    fileHash: result.fileHash,
    fileSize: fileBuffer.byteLength,
    source: "r2",
  });
}

// ─── POST /api/upload/document ────────────────────────────────────────────────
export async function handleUploadDocument(request, env, params, query, user) {
  if (user && env.OTPS_KV) {
    const rl = await uploadRateLimit(env, user.user_id, request.headers.get("CF-Connecting-IP"));
    if (rl) return rl;
  }

  let formData;
  try { formData = await request.formData(); }
  catch { return errorResponse("Invalid multipart form data", 400); }

  const file = formData.get("file");
  if (!file) return errorResponse("No file uploaded", 400);

  const fileBuffer = await file.arrayBuffer();
  const sizeCheck = validateFileSize(fileBuffer.byteLength);
  if (!sizeCheck.valid) return errorResponse(sizeCheck.error, 400);

  const context = {
    category: "service_report",
    expenseId: parseInt(formData.get("expense_id")) || null,
    expenseCode: formData.get("expense_code") || null,
    employeeId: formData.get("employee_id") || user?.user_id || null,
    employeeName: formData.get("employee_name") || user?.name || null,
    hospitalName: formData.get("hospital_name") || null,
    tripDate: formData.get("trip_date") || null,
    uploadedBy: user?.user_id || "unknown",
    originalFilename: file.name || "document.pdf",
    contentType: file.type || "application/pdf",
  };

  const result = await enterpriseUpload(env, fileBuffer, context);
  if (!result.success) return errorResponse(result.error, 400);

  return jsonResponse({
    success: true,
    filename: context.originalFilename,
    safeFilename: result.safeFilename,
    url: result.url,
    fileId: result.fileId,
    r2Key: result.r2Key,
    isDuplicate: result.isDuplicate || false,
    fileSize: fileBuffer.byteLength,
    source: "r2",
  });
}

// ─── GET /api/files/:key — Serve from R2 ─────────────────────────────────────
export async function handleServeFile(request, env, params, query) {
  const urlObj = new URL(request.url);
  let fileKey = params?.key || query?.get("key");

  if (!fileKey && urlObj.pathname.includes("/api/r2/file/")) {
    fileKey = urlObj.pathname.split("/api/r2/file/")[1];
  } else if (!fileKey && urlObj.pathname.includes("/api/files/")) {
    fileKey = urlObj.pathname.split("/api/files/")[1];
  } else if (!fileKey && urlObj.pathname.includes("/api/upload/file/images/")) {
    fileKey = urlObj.pathname.split("/api/upload/file/images/")[1];
  } else if (!fileKey && urlObj.pathname.includes("/api/upload/file/documents/")) {
    fileKey = urlObj.pathname.split("/api/upload/file/documents/")[1];
  }

  if (!fileKey) return errorResponse("Missing file key", 400);

  const fileKeyDecoded = decodeURIComponent(fileKey);

  const buckets = [env.R2_BUCKET, env.CYRIXAPP_BUCKET].filter(Boolean);

  for (const bucket of buckets) {
    try {
      let obj = await bucket.get(fileKeyDecoded);
      if (!obj && fileKey !== fileKeyDecoded) {
        obj = await bucket.get(fileKey);
      }
      if (obj) {
        const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
        const etag = obj.etag || obj.httpEtag;

        const ifNoneMatch = request.headers.get("If-None-Match");
        if (etag && ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `"${etag}"`)) {
          return new Response(null, { status: 304 });
        }

        const isPdf = contentType.includes("pdf");

        return new Response(obj.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(obj.size),
            "Cache-Control": "public, max-age=31536000, immutable",
            "ETag": etag ? `"${etag}"` : "",
            "Content-Disposition": isPdf ? 'inline; filename="document.pdf"' : "inline",
            "X-Content-Type-Options": "nosniff",
            "X-Source": "r2-direct",
            "X-Frame-Options": isPdf ? "SAMEORIGIN" : "DENY",
          },
        });
      }
    } catch (_) {}
  }

  // Fallback: Check file_metadata table in D1 for gdrive_file_id
  if (env.DB) {
    try {
      const baseName = fileKeyDecoded.split("/").pop().replace(/\.[^/.]+$/, "");
      const meta = await env.DB.prepare(`
        SELECT gdrive_file_id, content_type FROM file_metadata 
        WHERE r2_object_key LIKE ? OR r2_url LIKE ? OR safe_filename LIKE ? 
        LIMIT 1
      `).bind(`%${baseName}%`, `%${baseName}%`, `%${baseName}%`).first();

      if (meta && meta.gdrive_file_id) {
        const gdriveUrl = `https://drive.google.com/uc?export=view&id=${meta.gdrive_file_id}`;
        let gdriveRes = await fetch(gdriveUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (!gdriveRes.ok) {
          gdriveRes = await fetch(`https://lh3.googleusercontent.com/d/${meta.gdrive_file_id}`);
        }
        if (gdriveRes.ok) {
          const cType = meta.content_type || gdriveRes.headers.get("content-type") || "image/jpeg";
          return new Response(gdriveRes.body, {
            status: 200,
            headers: {
              "Content-Type": cType,
              "Cache-Control": "public, max-age=86400",
              "X-Source": "gdrive-stream-fallback"
            }
          });
        }
      }
    } catch (err) {
      console.warn("GDrive fallback lookup error:", err.message);
    }
  }

  // Fallback: If fileKey itself is a valid Google Drive ID (25-45 chars, no slashes)
  if (/^[a-zA-Z0-9_-]{25,45}$/.test(fileKeyDecoded)) {
    let gdriveRes = await fetch(`https://drive.google.com/uc?export=view&id=${fileKeyDecoded}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!gdriveRes.ok) {
      gdriveRes = await fetch(`https://lh3.googleusercontent.com/d/${fileKeyDecoded}`);
    }
    if (gdriveRes.ok) {
      return new Response(gdriveRes.body, {
        status: 200,
        headers: {
          "Content-Type": gdriveRes.headers.get("content-type") || "image/jpeg",
          "Cache-Control": "public, max-age=86400",
          "X-Source": "gdrive-direct-stream"
        }
      });
    }
  }

  return new Response("File not found", { status: 404 });
}

// ─── DELETE /api/files/:key — Delete from R2 (Admin only) ────────────────────
export async function handleDeleteFile(request, env, params, query, user) {
  if (!user || (user.role !== "Admin" && user.role !== "Manager")) {
    return errorResponse("Insufficient permissions", 403);
  }

  const fileKey = decodeURIComponent(params?.key || "");
  if (!fileKey) return errorResponse("Missing file key", 400);

  // Soft delete in DB
  if (env.DB) {
    await env.DB.prepare(`
      UPDATE file_metadata SET is_deleted = 1, deleted_at = ?, deleted_by = ?
      WHERE r2_object_key = ?
    `).bind(nowISO(), user.user_id, fileKey).run();
  }

  // Physical delete from R2
  const deleted = await deleteFromR2(env, fileKey);

  return jsonResponse({ success: deleted, key: fileKey, deletedBy: user.user_id, deletedAt: nowISO() });
}

// ─── GET /api/files/list — List files by expense (Admin/Manager) ──────────────
export async function handleListFiles(request, env, params, query, user) {
  if (!user) return errorResponse("Authentication required", 401);

  const expenseId = query?.get("expense_id");
  const expenseCode = query?.get("expense_code");
  const employeeId = query?.get("employee_id");

  let sql = "SELECT id, expense_code, original_filename, safe_filename, r2_url, r2_object_key, file_size, content_type, category, upload_date, uploaded_by, is_deleted, created_at FROM file_metadata WHERE is_deleted = 0";
  const binds = [];

  if (expenseId) { sql += " AND expense_id = ?"; binds.push(parseInt(expenseId)); }
  if (expenseCode) { sql += " AND expense_code = ?"; binds.push(expenseCode); }
  if (employeeId) { sql += " AND employee_id = ?"; binds.push(employeeId); }

  // Non-admin users can only see their own files
  if (user.role === "Engineer" || user.role === "Field Operator") {
    sql += " AND employee_id = ?";
    binds.push(user.user_id);
  }

  sql += " ORDER BY created_at DESC LIMIT 100";

  const files = await env.DB.prepare(sql).bind(...binds).all();
  return jsonResponse({ success: true, files: files?.results || [] });
}

// ─── Legacy compatibility (used by expense.js / other routes) ─────────────────
/**
 * @deprecated Use enterpriseUpload() from r2Storage.js directly.
 * Kept for backward compat with existing expense upload references.
 */
export async function uploadFileWithFallback(env, fileOrBuffer, subfolder, filename, mimeType) {
  const buffer = fileOrBuffer instanceof ArrayBuffer
    ? fileOrBuffer
    : await fileOrBuffer.arrayBuffer();

  const result = await enterpriseUpload(env, buffer, {
    category: "expense_photo",
    originalFilename: filename || "upload.jpg",
    contentType: mimeType || "application/octet-stream",
    uploadedBy: "legacy_call",
  });

  if (result.success) return result.url;
  throw new Error("R2 upload failed: " + result.error);
}

// Legacy export — kept for approval.js which imports this
export async function deleteFromGoogleDrive(env, fileId) {
  // GAS/GDrive removed. If called with a fileId that looks like an R2 key, delete from R2.
  if (fileId && !fileId.includes("drive.google.com") && env.R2_BUCKET) {
    try { await env.R2_BUCKET.delete(fileId); } catch (_) {}
  }
  // Otherwise silently succeed — file already removed or was a GDrive ID (no longer supported)
  return true;
}
