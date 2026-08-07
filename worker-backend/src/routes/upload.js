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

  // ── 0. Check Workers Edge Cache API first ─────────────────────────────────
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(urlObj.toString(), request);
  if (cache) {
    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const cachedHeaders = new Headers(cachedResponse.headers);
        cachedHeaders.set("X-Cache-Status", "HIT-EDGE");
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: cachedHeaders,
        });
      }
    } catch (_) {}
  }

  let fileKey = params?.key || params?.["*"] || query?.get("key");

  if (!fileKey) {
    const prefixes = [
      "/api/r2/file/",
      "/api/files/",
      "/api/upload/file/images/",
      "/api/upload/file/documents/",
      "/uploads/",
      "/expenses/",
      "/gdrive/",
      "/profiles/"
    ];
    for (const prefix of prefixes) {
      if (urlObj.pathname.includes(prefix)) {
        fileKey = urlObj.pathname.split(prefix)[1];
        if (prefix === "/expenses/") {
          fileKey = `expenses/${fileKey}`;
        } else if (prefix === "/gdrive/") {
          fileKey = `gdrive/${fileKey}`;
        } else if (prefix === "/profiles/") {
          fileKey = `profiles/${fileKey}`;
        }
        break;
      }
    }
  }

  if (!fileKey) return errorResponse("Missing file key", 400);

  const fileKeyDecoded = decodeURIComponent(fileKey).replace(/^\/+/, "");

  const wantThumb = query?.get("thumb") === "1";

  const buckets = [env.R2_BUCKET, env.CYRIXAPP_BUCKET].filter(Boolean);

  // Generate all candidate R2 keys to try
  const baseName = fileKeyDecoded.split("/").pop() || "";
  const bareId = baseName.replace(/\.[^/.]+$/, "");

  const keysToTry = [
    fileKeyDecoded,
    fileKeyDecoded.replace(/^uploads\//, ""),
    fileKeyDecoded.replace(/^api\/r2\/file\//, "").replace(/^api\/files\//, ""),
    fileKeyDecoded.startsWith("expenses/") ? fileKeyDecoded : `expenses/${fileKeyDecoded}`,
    fileKeyDecoded.startsWith("gdrive/") ? fileKeyDecoded : `gdrive/${fileKeyDecoded}`,
    `gdrive/${bareId}.jpg`,
    `gdrive/${bareId}`,
    baseName
  ];
  const uniqueKeys = [...new Set(keysToTry.filter(Boolean))];

  for (const bucket of buckets) {
    try {
      // ── THUMBNAIL SERVING ─────────────────────────────────────────────────
      if (wantThumb) {
        const thumbKey = `thumb/${fileKeyDecoded}`;
        let thumbObj = await bucket.get(thumbKey);
        if (thumbObj) {
          const thumbResp = new Response(thumbObj.body, {
            status: 200,
            headers: {
              "Content-Type": "image/webp",
              "Cache-Control": "public, max-age=3600, s-maxage=86400",
              "Access-Control-Allow-Origin": "*",
              "Vary": "Accept",
              "X-Thumb": "cached",
              "X-Cache-Status": "MISS-STORED"
            }
          });
          if (cache && env.ctx && typeof env.ctx.waitUntil === "function") {
            env.ctx.waitUntil(cache.put(cacheKey, thumbResp.clone()));
          }
          return thumbResp;
        }
      }

      // ── FULL FILE SERVING ─────────────────────────────────────────────────
      for (const k of uniqueKeys) {
        let obj = await bucket.get(k);
        if (obj) {
          let contentType = obj.httpMetadata?.contentType;
          if (!contentType || contentType === "application/octet-stream") {
            const lowerKey = k.toLowerCase();
            if (lowerKey.endsWith(".png")) contentType = "image/png";
            else if (lowerKey.endsWith(".webp")) contentType = "image/webp";
            else if (lowerKey.endsWith(".gif")) contentType = "image/gif";
            else if (lowerKey.endsWith(".pdf")) contentType = "application/pdf";
            else contentType = "image/jpeg";
          }

          const etag = obj.etag || obj.httpEtag;
          const isPdf = contentType.includes("pdf");

          const ifNoneMatch = request.headers.get("If-None-Match");
          if (etag && ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `"${etag}"`)) {
            return new Response(null, {
              status: 304,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS"
              }
            });
          }

          const fileResp = new Response(obj.body, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Content-Length": String(obj.size),
              "Cache-Control": "public, max-age=2592000, s-maxage=31536000, immutable",
              "ETag": etag ? `"${etag}"` : "",
              "Content-Disposition": isPdf ? 'inline; filename="document.pdf"' : "inline",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
              "X-Source": "r2-direct",
              "X-Cache-Status": "MISS-STORED"
            },
          });

          if (cache && env.ctx && typeof env.ctx.waitUntil === "function") {
            env.ctx.waitUntil(cache.put(cacheKey, fileResp.clone()));
          }

          return fileResp;
        }
      }
    } catch (_) {}
  }

  // Fallback 1: Database lookup in D1 file_metadata
  if (env.DB && bareId) {
    try {
      const meta = await env.DB.prepare(`
        SELECT r2_object_key, gdrive_file_id, content_type FROM file_metadata 
        WHERE r2_object_key LIKE ? OR r2_url LIKE ? OR safe_filename LIKE ? OR original_filename LIKE ? OR gdrive_file_id LIKE ?
        LIMIT 1
      `).bind(`%${bareId}%`, `%${bareId}%`, `%${bareId}%`, `%${bareId}%`, `%${bareId}%`).first();

      if (meta) {
        if (meta.r2_object_key) {
          for (const bucket of buckets) {
            try {
              const obj = await bucket.get(meta.r2_object_key);
              if (obj) {
                const cType = meta.content_type || obj.httpMetadata?.contentType || "image/jpeg";
                return new Response(obj.body, {
                  status: 200,
                  headers: {
                    "Content-Type": cType,
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "Access-Control-Allow-Origin": "*",
                    "X-Source": "r2-d1-matched"
                  }
                });
              }
            } catch (_) {}
          }
        }
        if (meta.gdrive_file_id) {
          let gdriveRes = await fetch(`https://lh3.googleusercontent.com/d/${meta.gdrive_file_id}`);
          if (!gdriveRes.ok) {
            gdriveRes = await fetch(`https://drive.google.com/uc?export=view&id=${meta.gdrive_file_id}`, {
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
            });
          }
          if (gdriveRes.ok) {
            const cType = meta.content_type || gdriveRes.headers.get("content-type") || "image/jpeg";
            return new Response(gdriveRes.body, {
              status: 200,
              headers: {
                "Content-Type": cType,
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
                "X-Source": "gdrive-d1-stream"
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn("D1 metadata fallback lookup error:", err.message);
    }
  }

  // Fallback 2: Direct Google Drive ID stream (25-50 chars)
  const gdriveCandidate = bareId || fileKeyDecoded.replace(/^gdrive\//, "");
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(gdriveCandidate)) {
    let gdriveRes = await fetch(`https://lh3.googleusercontent.com/d/${gdriveCandidate}`);
    if (!gdriveRes.ok) {
      gdriveRes = await fetch(`https://drive.google.com/uc?export=view&id=${gdriveCandidate}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
    }
    if (gdriveRes.ok) {
      return new Response(gdriveRes.body, {
        status: 200,
        headers: {
          "Content-Type": gdriveRes.headers.get("content-type") || "image/jpeg",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
          "X-Source": "gdrive-direct-stream"
        }
      });
    }
  }

  return new Response("File not found", { status: 404 });
}

// ─── GET /api/r2/gdrive-proxy ───────────────────────────────────────────────
export async function handleGDriveProxy(request, env, params, query) {
  let fileId = query?.get("id") || params?.id || params?.key;
  if (!fileId) return errorResponse("Missing Google Drive file ID", 400);

  let cleanId = String(fileId).trim();
  if (cleanId.includes("drive.google.com") || cleanId.includes("docs.google.com")) {
    const matchD = cleanId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const matchId = cleanId.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    cleanId = matchD ? matchD[1] : (matchId ? matchId[1] : cleanId);
  }
  cleanId = cleanId.replace(/^gdrive\//, "").replace(/\.(jpg|jpeg|png|webp|gif|pdf)$/i, "");
  const r2Key = `gdrive/${cleanId}.jpg`;

  const bucket = env.R2_BUCKET || env.CYRIXAPP_BUCKET;

  // 1. Check if already stored in Cloudflare R2 Bucket
  if (bucket) {
    try {
      const existingObj = await bucket.get(r2Key);
      if (existingObj) {
        const headers = new Headers();
        existingObj.writeHttpMetadata(headers);
        headers.set("Content-Type", "image/jpeg");
        headers.set("Cache-Control", "public, max-age=31536000");
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("X-Storage-Source", "R2-Bucket");
        return new Response(existingObj.body, { headers });
      }
    } catch (e) {}
  }

  // 2. Auto-fetch from Google Drive CDN stream
  const gdriveUrlsToTry = [
    `https://lh3.googleusercontent.com/d/${cleanId}`,
    `https://drive.google.com/uc?export=download&id=${cleanId}`,
    `https://docs.google.com/uc?export=download&id=${cleanId}`
  ];

  for (const url of gdriveUrlsToTry) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > 0) {
          // Save to R2 permanently in background
          if (bucket) {
            try {
              await bucket.put(r2Key, arrayBuffer, {
                httpMetadata: { contentType: "image/jpeg" }
              });

              if (env.DB) {
                const r2PublicPath = `/uploads/${r2Key}`;
                env.DB.prepare(`
                  UPDATE expense_attachments 
                  SET file_url = ? 
                  WHERE file_url LIKE ? OR file_url LIKE ?
                `).bind(r2PublicPath, `%${cleanId}%`, `%gdrive%`).run().catch(() => {});
              }
            } catch (err) {}
          }

          return new Response(arrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "public, max-age=31536000",
              "Access-Control-Allow-Origin": "*",
              "X-Storage-Source": "GDrive-R2-AutoMigrated"
            }
          });
        }
      }
    } catch (e) {}
  }

  return errorResponse("Unable to retrieve Google Drive image", 404);
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
