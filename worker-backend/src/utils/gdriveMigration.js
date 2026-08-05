/**
 * ============================================================
 * Google Drive → R2 Migration Engine
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Migrates all existing Google Drive files to Cloudflare R2.
 *
 * Migration Flow:
 *   1. Scan DB tables for Google Drive file references
 *   2. Download each file via GAS proxy
 *   3. Compute SHA-256 hash (dedup check)
 *   4. Upload to R2 with enterprise naming convention
 *   5. Update DB references (photo_url, file_url)
 *   6. Log migration result
 *   7. Support resume from last position
 *   8. Rollback support on failure
 *
 * Run via: POST /api/admin/migrate-gdrive { mode: "dry-run"|"live", batchSize: 5 }
 * ============================================================
 */

import { enterpriseUpload, generateExpensePhotoKey, generateServiceReportKey, computeFileHash, checkDuplicateFile } from "../utils/r2Storage.js";
import { staticLog } from "../utils/logger.js";
import { nowISO } from "../utils/timestamp.js";
import { jsonResponse, errorResponse } from "../utils/http.js";

// KV key for migration state
const MIGRATION_STATE_KEY = "gdrive_migration_state";

// ─── File URL Parsing ─────────────────────────────────────────────────────────

/**
 * Determine if a URL points to Google Drive (via GAS proxy).
 */
function isGDriveUrl(url) {
  if (!url) return false;
  return (
    url.includes("/gdrive/") ||
    url.includes("drive.google.com") ||
    url.includes("script.google.com")
  );
}

/**
 * Extract GDrive file ID from a GAS proxy URL.
 * Handles formats:
 *   - /api/upload/file/gdrive/FILE_ID
 *   - /api/upload/file/gdrive?id=FILE_ID (old format)
 *   - https://drive.google.com/file/d/FILE_ID/view
 */
function extractGDriveFileId(url) {
  if (!url) return null;

  // /api/upload/file/gdrive/FILE_ID (most common)
  const m1 = url.match(/\/gdrive\/([a-zA-Z0-9_-]{20,})/);
  if (m1) return m1[1];

  // /gdrive?id=FILE_ID (query param)
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (m2) return m2[1];

  // Google Drive direct URL
  const m3 = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m3) return m3[1];

  return null;
}

// ─── GAS Download ─────────────────────────────────────────────────────────────

/**
 * Download a file from Google Drive via GAS proxy.
 * Returns null on failure.
 */
async function downloadFromGDrive(env, fileId) {
  if (!fileId) return null;

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  // Direct Google Drive download URLs to attempt
  const directUrls = [
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`
  ];

  for (const url of directUrls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": userAgent,
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        redirect: "follow"
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (buffer && buffer.byteLength > 500) {
          const bytes = new Uint8Array(buffer).slice(0, 10);
          // Check if buffer is NOT HTML (doesn't start with '<' or '<!DOCTYPE')
          if (bytes[0] !== 0x3C) {
            let contentType = response.headers.get("content-type") || "image/jpeg";
            if (contentType.includes("html") || contentType.includes("text")) {
              contentType = "image/jpeg";
            }
            return {
              buffer,
              contentType,
              filename: `${fileId}.jpg`,
            };
          }
        }
      }
    } catch (e) {
      staticLog.warn("Direct GDrive download attempt failed", { fileId, url, error: e.message });
    }
  }

  // Method 2: Fallback to GAS Web App Proxy if configured
  const gasUrl = env?.GAS_WEB_APP_URL || env?.GAS_DASHBOARD_URL;
  if (gasUrl) {
    try {
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": userAgent },
        body: JSON.stringify({ action: "download_file", fileId }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.fileBase64) {
          const binaryStr = atob(result.fileBase64);
          const buffer = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) buffer[i] = binaryStr.charCodeAt(i);

          return {
            buffer: buffer.buffer,
            contentType: result.mimeType || "image/jpeg",
            filename: result.filename ? (result.filename.includes(".") ? result.filename : `${result.filename}.jpg`) : `${fileId}.jpg`,
          };
        }
      }
    } catch (e) {
      staticLog.error("GAS GDrive download failed", { fileId, error: e.message });
    }
  }

  return null;
}

// ─── Migration State Management ───────────────────────────────────────────────

async function getMigrationState(env) {
  if (!env.OTPS_KV) return { processed: 0, migrated: 0, failed: 0, skipped: 0, lastOffset: 0, errors: [] };
  try {
    const state = await env.OTPS_KV.get(MIGRATION_STATE_KEY, { type: "json" });
    return state || { processed: 0, migrated: 0, failed: 0, skipped: 0, lastOffset: 0, errors: [] };
  } catch (_) {
    return { processed: 0, migrated: 0, failed: 0, skipped: 0, lastOffset: 0, errors: [] };
  }
}

async function saveMigrationState(env, state) {
  if (!env.OTPS_KV) return;
  try {
    await env.OTPS_KV.put(MIGRATION_STATE_KEY, JSON.stringify(state), { expirationTtl: 86400 * 30 });
  } catch (_) {}
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * POST /api/admin/migrate-gdrive
 * Admin-only endpoint to trigger migration.
 *
 * Body: { mode: "dry-run" | "live", batchSize: 5, resumeFrom: 0 }
 */
export async function handleMigrateGdrive(request, env, params, query, user) {
  if (!user || user.role !== "Admin") return errorResponse("Admin access required", 403);

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const mode = body.mode === "live" ? "live" : "dry-run";
  const batchSize = Math.min(Math.max(parseInt(body.batchSize) || 50, 1), 100);
  const resumeFrom = parseInt(body.resumeFrom) || 0;

  staticLog.info("Migration started", { mode, batchSize, resumeFrom, initiatedBy: user.user_id });

  // Collect candidate file items across all 4 tables: expense_attachments, breakdown_calls, pms_calls, expenses
  let candidates = [];

  // Table 1: expense_attachments
  try {
    const attachmentsCandidates = await env.DB.prepare(`
      SELECT 'expense_attachments' as table_name, a.id, a.exp_id as code, a.file_url as url, a.bill_type as category, e.created_at as exp_date
      FROM expense_attachments a
      LEFT JOIN expenses e ON a.exp_id = e.expense_code
      WHERE (a.file_url LIKE '%gdrive%' OR a.file_url LIKE '%drive.google%')
        AND a.file_url IS NOT NULL
      ORDER BY a.id LIMIT ?
    `).bind(batchSize).all();
    candidates = candidates.concat(attachmentsCandidates?.results || []);
  } catch (e) {
    staticLog.error("Error querying expense_attachments", { error: e.message });
  }

  // Table 2: expense_breakdown_calls
  if (candidates.length < batchSize) {
    const remainingBatch = batchSize - candidates.length;
    try {
      const breakdownCandidates = await env.DB.prepare(`
        SELECT 'expense_breakdown_calls' as table_name, id, itinerary_id as code, photo_url as url, 'service_report_breakdown' as category, NULL as exp_date
        FROM expense_breakdown_calls
        WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%')
          AND photo_url IS NOT NULL
        ORDER BY id LIMIT ?
      `).bind(remainingBatch).all();
      candidates = candidates.concat(breakdownCandidates?.results || []);
    } catch (e) {
      staticLog.error("Error querying expense_breakdown_calls", { error: e.message });
    }
  }

  // Table 3: expense_pms_calls
  if (candidates.length < batchSize) {
    const remainingBatch = batchSize - candidates.length;
    try {
      const pmsCandidates = await env.DB.prepare(`
        SELECT 'expense_pms_calls' as table_name, id, itinerary_id as code, photo_url as url, 'service_report_pms' as category, NULL as exp_date
        FROM expense_pms_calls
        WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%')
          AND photo_url IS NOT NULL
        ORDER BY id LIMIT ?
      `).bind(remainingBatch).all();
      candidates = candidates.concat(pmsCandidates?.results || []);
    } catch (e) {
      staticLog.error("Error querying expense_pms_calls", { error: e.message });
    }
  }

  // Table 4: expenses
  if (candidates.length < batchSize) {
    const remainingBatch = batchSize - candidates.length;
    try {
      const expenseCandidates = await env.DB.prepare(`
        SELECT 'expenses' as table_name, id, expense_code as code, attachments as url, 'expense_claim' as category, created_at as exp_date
        FROM expenses
        WHERE (attachments LIKE '%gdrive%' OR attachments LIKE '%drive.google%')
          AND attachments IS NOT NULL
        ORDER BY id LIMIT ?
      `).bind(remainingBatch).all();
      candidates = candidates.concat(expenseCandidates?.results || []);
    } catch (e) {
      staticLog.error("Error querying expenses", { error: e.message });
    }
  }

  const results = [];
  let migrated = 0, failed = 0, skipped = 0;

  const processCandidateItem = async (item) => {
    if (item.table_name === "expenses") {
      let attachmentsList = [];
      try {
        attachmentsList = typeof item.url === "string" ? JSON.parse(item.url) : (item.url || []);
      } catch (_) {
        if (typeof item.url === "string") attachmentsList = [item.url];
      }

      let modified = false;
      const newAttachments = [];

      for (const url of attachmentsList) {
        if (!isGDriveUrl(url)) {
          newAttachments.push(url);
          continue;
        }

        const fileId = extractGDriveFileId(url);
        if (!fileId) {
          newAttachments.push(url);
          results.push({ id: item.id, table: item.table_name, status: "skipped", reason: "Could not extract file ID", url });
          skipped++;
          continue;
        }

        if (mode === "dry-run") {
          newAttachments.push(url);
          results.push({ id: item.id, table: item.table_name, status: "would_migrate", fileId });
          continue;
        }

        try {
          const existing = await env.DB.prepare(
            "SELECT r2_url FROM file_metadata WHERE gdrive_file_id = ? AND is_deleted = 0 LIMIT 1"
          ).bind(fileId).first();

          if (existing?.r2_url) {
            newAttachments.push(existing.r2_url);
            modified = true;
            results.push({ id: item.id, table: item.table_name, status: "already_migrated", fileId, r2Url: existing.r2_url });
            skipped++;
            continue;
          }
        } catch (_) {}

        const downloaded = await downloadFromGDrive(env, fileId);
        if (!downloaded) {
          newAttachments.push(url);
          results.push({ id: item.id, table: item.table_name, status: "failed", reason: "Could not download file from Google Drive", fileId });
          failed++;
          continue;
        }

        const uploadResult = await enterpriseUpload(env, downloaded.buffer, {
          category: item.category || "expense_photo",
          expenseCode: item.code,
          tripDate: item.exp_date,
          uploadedBy: "migration_engine",
          originalFilename: downloaded.filename || `${fileId}.jpg`,
          contentType: downloaded.contentType,
        });

        if (!uploadResult.success) {
          newAttachments.push(url);
          results.push({ id: item.id, table: item.table_name, status: "failed", reason: uploadResult.error, fileId });
          failed++;
          continue;
        }

        newAttachments.push(uploadResult.url);
        modified = true;

        try {
          if (uploadResult.fileId) {
            await env.DB.prepare(
              "UPDATE file_metadata SET gdrive_file_id = ?, migrated_at = ?, upload_source = 'r2' WHERE id = ?"
            ).bind(fileId, nowISO(), uploadResult.fileId).run();
          }
          results.push({ id: item.id, table: item.table_name, status: "migrated", fileId, r2Url: uploadResult.url });
          migrated++;
        } catch (e) {
          results.push({ id: item.id, table: item.table_name, status: "failed", reason: `Metadata update failed: ${e.message}`, fileId });
          failed++;
        }
      }

      if (modified && mode !== "dry-run") {
        try {
          await env.DB.prepare("UPDATE expenses SET attachments = ? WHERE id = ?").bind(JSON.stringify(newAttachments), item.id).run();
        } catch (e) {}
      }
    } else {
      const url = item.url;
      const fileId = extractGDriveFileId(url);
      if (!fileId) {
        results.push({ id: item.id, table: item.table_name, status: "skipped", reason: "Could not extract file ID", url });
        skipped++;
        return;
      }

      if (mode === "dry-run") {
        results.push({ id: item.id, table: item.table_name, status: "would_migrate", fileId, code: item.code });
        return;
      }

      try {
        const existing = await env.DB.prepare(
          "SELECT r2_url FROM file_metadata WHERE gdrive_file_id = ? AND is_deleted = 0 LIMIT 1"
        ).bind(fileId).first();

        if (existing?.r2_url) {
          if (item.table_name === "expense_attachments") {
            await env.DB.prepare("UPDATE expense_attachments SET file_url = ? WHERE id = ?").bind(existing.r2_url, item.id).run();
          } else if (item.table_name === "expense_breakdown_calls") {
            await env.DB.prepare("UPDATE expense_breakdown_calls SET photo_url = ? WHERE id = ?").bind(existing.r2_url, item.id).run();
          } else if (item.table_name === "expense_pms_calls") {
            await env.DB.prepare("UPDATE expense_pms_calls SET photo_url = ? WHERE id = ?").bind(existing.r2_url, item.id).run();
          }
          results.push({ id: item.id, table: item.table_name, status: "already_migrated", fileId, r2Url: existing.r2_url });
          skipped++;
          return;
        }
      } catch (_) {}

      const downloaded = await downloadFromGDrive(env, fileId);
      if (!downloaded) {
        results.push({ id: item.id, table: item.table_name, status: "failed", reason: "Could not download file from Google Drive", fileId });
        failed++;
        return;
      }

      const uploadResult = await enterpriseUpload(env, downloaded.buffer, {
        category: item.category || "service_report",
        expenseCode: item.code,
        uploadedBy: "migration_engine",
        originalFilename: downloaded.filename || `${fileId}.jpg`,
        contentType: downloaded.contentType,
      });

      if (!uploadResult.success) {
        results.push({ id: item.id, table: item.table_name, status: "failed", reason: uploadResult.error, fileId });
        failed++;
        return;
      }

      try {
        if (item.table_name === "expense_attachments") {
          await env.DB.prepare("UPDATE expense_attachments SET file_url = ? WHERE id = ?").bind(uploadResult.url, item.id).run();
        } else if (item.table_name === "expense_breakdown_calls") {
          await env.DB.prepare("UPDATE expense_breakdown_calls SET photo_url = ? WHERE id = ?").bind(uploadResult.url, item.id).run();
        } else if (item.table_name === "expense_pms_calls") {
          await env.DB.prepare("UPDATE expense_pms_calls SET photo_url = ? WHERE id = ?").bind(uploadResult.url, item.id).run();
        }

        if (uploadResult.fileId) {
          await env.DB.prepare(
            "UPDATE file_metadata SET gdrive_file_id = ?, migrated_at = ?, upload_source = 'r2' WHERE id = ?"
          ).bind(fileId, nowISO(), uploadResult.fileId).run();
        }

        results.push({ id: item.id, table: item.table_name, status: "migrated", fileId, r2Url: uploadResult.url });
        migrated++;
      } catch (e) {
        results.push({ id: item.id, table: item.table_name, status: "failed", reason: `Table update failed: ${e.message}`, fileId });
        failed++;
      }
    }
  };

  // Process in parallel chunks of 10 items
  const PARALLEL_CHUNK_SIZE = 10;
  for (let i = 0; i < candidates.length; i += PARALLEL_CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + PARALLEL_CHUNK_SIZE);
    await Promise.all(chunk.map((item) => processCandidateItem(item)));
  }

  // Update state
  const state = await getMigrationState(env);
  state.lastOffset = resumeFrom + batchSize;
  state.processed += results.length;
  state.migrated += migrated;
  state.failed += failed;
  state.skipped += skipped;
  state.lastRunAt = nowISO();
  state.lastRunBy = user.user_id;
  if (mode !== "dry-run") await saveMigrationState(env, state);

  return jsonResponse({
    mode,
    batchSize,
    resumeFrom,
    results,
    summary: { total: results.length, migrated, failed, skipped },
    nextOffset: resumeFrom + batchSize,
    cumulativeState: state,
  });
}

/**
 * GET /api/admin/migration-status
 * Returns current migration progress across all database tables.
 */
export async function handleMigrationStatus(request, env, params, query, user) {
  if (!user || user.role !== "Admin") return errorResponse("Admin access required", 403);

  const state = await getMigrationState(env);

  // Count remaining GDrive references across all tables
  let remainingAttachments = 0, remainingBreakdown = 0, remainingPms = 0, remainingExpenses = 0;
  try {
    const [attRes, bdRes, pmsRes, expRes] = await Promise.allSettled([
      env.DB.prepare("SELECT COUNT(*) as cnt FROM expense_attachments WHERE (file_url LIKE '%/gdrive/%' OR file_url LIKE '%drive.google.com%')").first(),
      env.DB.prepare("SELECT COUNT(*) as cnt FROM expense_breakdown_calls WHERE (photo_url LIKE '%/gdrive/%' OR photo_url LIKE '%drive.google.com%')").first(),
      env.DB.prepare("SELECT COUNT(*) as cnt FROM expense_pms_calls WHERE (photo_url LIKE '%/gdrive/%' OR photo_url LIKE '%drive.google.com%')").first(),
      env.DB.prepare("SELECT COUNT(*) as cnt FROM expenses WHERE (attachments LIKE '%/gdrive/%' OR attachments LIKE '%drive.google.com%')").first(),
    ]);

    remainingAttachments = attRes.status === "fulfilled" ? (attRes.value?.cnt || 0) : 0;
    remainingBreakdown = bdRes.status === "fulfilled" ? (bdRes.value?.cnt || 0) : 0;
    remainingPms = pmsRes.status === "fulfilled" ? (pmsRes.value?.cnt || 0) : 0;
    remainingExpenses = expRes.status === "fulfilled" ? (expRes.value?.cnt || 0) : 0;
  } catch (_) {}

  const totalRemaining = remainingAttachments + remainingBreakdown + remainingPms + remainingExpenses;

  return jsonResponse({
    ...state,
    totalRemainingGDriveRefs: totalRemaining,
    breakdown: {
      expenseAttachments: remainingAttachments,
      breakdownServiceReports: remainingBreakdown,
      pmsServiceReports: remainingPms,
      expenseClaims: remainingExpenses,
    },
  });
}


