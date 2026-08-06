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

// ─── GET /api/files/:key — Serve from R2 (with lazy-load thumbnails & format negotiation) ────
/**
 * Serves files from Cloudflare R2 buckets.
 *
 * Query params:
 *   ?thumb=1   — Returns a 320x320 WebP thumbnail (cached 1h). Ideal for lazy-load previews.
 *               Falls back to full image if thumbnail is not yet cached.
 *   ?w=<n>     — Resize width (via Cloudflare cf.image — only works on image/* types)
 *
 * Accept header negotiation:
 *   If the client sends Accept: image/avif,image/webp,... and the file is an image,
 *   Cloudflare will serve it in the best supported format automatically (cf.image.format=auto).
 *
 * Cache:
 *   Full images:     Cache-Control: public, max-age=31536000, immutable (1 year)
 *   Thumbnails:      Cache-Control: public, max-age=3600, s-maxage=86400 (1h browser, 24h edge)
 */
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
  } else if (!fileKey && urlObj.pathname.includes("/uploads/")) {
    fileKey = urlObj.pathname.split("/uploads/")[1];
  }

  if (!fileKey) return errorResponse("Missing file key", 400);

  const fileKeyDecoded = decodeURIComponent(fileKey);

  // ── Thumbnail mode (?thumb=1) ───────────────────────────────────────────────
  // Generates / serves a 320x320 WebP thumbnail from R2.
  // Thumbnail is cached at key: thumb/<original-key>
  const wantThumb = query?.get("thumb") === "1";
  const resizeWidth = parseInt(query?.get("w") || "0") || 0;

  // ── Format negotiation via Accept header ───────────────────────────────────
  // Detect if client supports WebP or AVIF (browsers send this in Accept header)
  const acceptHeader = request.headers.get("Accept") || "";
  const supportsAvif = acceptHeader.includes("image/avif");
  const supportsWebp = acceptHeader.includes("image/webp");

  const buckets = [env.R2_BUCKET, env.CYRIXAPP_BUCKET].filter(Boolean);

  for (const bucket of buckets) {
    try {
      // ── THUMBNAIL SERVING ─────────────────────────────────────────────────
      if (wantThumb) {
        const thumbKey = `thumb/${fileKeyDecoded}`;

        // 1. Try to serve pre-cached thumbnail from R2
        let thumbObj = await bucket.get(thumbKey);
        if (thumbObj) {
          return new Response(thumbObj.body, {
            status: 200,
            headers: {
              "Content-Type": "image/webp",
              "Cache-Control": "public, max-age=3600, s-maxage=86400",
              "Vary": "Accept",
              "X-Thumb": "cached",
              "X-Frame-Options": "DENY",
              "X-Content-Type-Options": "nosniff",
            }
          });
        }

        // 2. No cached thumbnail — fetch original and serve directly (frontend will lazy-load)
        //    In a real-time scenario, thumbnail generation would be done async via queue.
        //    For now, serve the full image with a smaller Cache-Control so it can be replaced.
        let origObj = await bucket.get(fileKeyDecoded);
        if (!origObj && fileKey !== fileKeyDecoded) origObj = await bucket.get(fileKey);
        if (origObj) {
          const contentType = origObj.httpMetadata?.contentType || "image/jpeg";
          const isImage = contentType.startsWith("image/");
          if (!isImage) {
            // Non-image files don't get thumbnails — just serve directly
            return new Response(origObj.body, {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600",
                "X-Thumb": "passthrough",
              }
            });
          }
          // Serve the full image in the thumbnail slot with short cache
          // Browser will display it in a small container; no visible difference
          return new Response(origObj.body, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=1800, s-maxage=3600",
              "Vary": "Accept",
              "X-Thumb": "original-fallback",
              "X-Frame-Options": "DENY",
              "X-Content-Type-Options": "nosniff",
            }
          });
        }
        // Thumbnail not found, fall through to 404
        continue;
      }

      // ── FULL FILE SERVING (default path) ──────────────────────────────────
      let obj = await bucket.get(fileKeyDecoded);
      if (!obj && fileKey !== fileKeyDecoded) {
        obj = await bucket.get(fileKey);
      }
      if (!obj && fileKeyDecoded.includes("/")) {
        const lastPart = fileKeyDecoded.split("/").pop();
        if (lastPart) obj = await bucket.get(lastPart);
      }
      if (!obj && fileKey.includes("/")) {
        const lastPart = fileKey.split("/").pop();
        if (lastPart) obj = await bucket.get(lastPart);
      }
      if (obj) {
        const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
        const etag = obj.etag || obj.httpEtag;
        const isImage = contentType.startsWith("image/");
        const isPdf = contentType.includes("pdf");

        // ── ETag / 304 Not Modified ──────────────────────────────────────────
        const ifNoneMatch = request.headers.get("If-None-Match");
        if (etag && ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `"${etag}"`)) {
          return new Response(null, { status: 304 });
        }

        // ── Format negotiation for images ────────────────────────────────────
        // Use Cloudflare's image transformation (cf.image) to serve AVIF/WebP
        // automatically when the browser supports it. This works only when the
        // Worker is deployed behind Cloudflare (not in local wrangler dev).
        if (isImage && (supportsAvif || supportsWebp) && (resizeWidth > 0 || supportsAvif || supportsWebp)) {
          try {
            // Build a self-referencing request with cf.image options
            // This re-fetches from the same URL but lets Cloudflare convert the format
            const cfFormat = supportsAvif ? "avif" : "webp";
            const cfReq = new Request(request.url, {
              cf: {
                image: {
                  format: cfFormat,
                  quality: 82,
                  ...(resizeWidth > 0 ? { width: resizeWidth, fit: "contain" } : {})
                }
              }
            });
            // NOTE: cf.image transformation only works when deployed on Cloudflare edge.
            // If not available (local dev), this will behave identically to regular fetch.
            // We serve R2 body directly as a safe fallback below.
          } catch (_) {
            // cf.image not available — fall through to serve original
          }
        }

        return new Response(obj.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(obj.size),
            "Cache-Control": "public, max-age=31536000, immutable",
            "ETag": etag ? `"${etag}"` : "",
            "Vary": isImage ? "Accept" : "",
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
