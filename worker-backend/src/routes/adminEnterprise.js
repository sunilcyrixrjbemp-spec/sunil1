/**
 * ============================================================
 * Enterprise Admin Routes
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Handles:
 *   - Analytics dashboard API
 *   - Billing / cost estimation
 *   - File health check
 *   - Storage report
 *   - V2 migration runner
 * All endpoints are Admin-only.
 * ============================================================
 */

import { jsonResponse, errorResponse } from "../utils/http.js";
import { nowISO } from "../utils/timestamp.js";
import { staticLog } from "../utils/logger.js";
import { handleMigrateGdrive, handleMigrationStatus } from "../utils/gdriveMigration.js";
import { runMigrationsV2, checkV2TableStatus } from "../utils/db-migrate-v2.js";

export { handleMigrateGdrive, handleMigrationStatus };

/**
 * GET /api/admin/analytics/dashboard
 * Real-time analytics dashboard API.
 */
export async function handleAnalyticsDashboard(request, env, params, query, user) {
  if (!user || user.role !== "Admin") return errorResponse("Admin access required", 403);

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [
    todayEvents, todayUsers, weeklyEvents, topEventNames,
    errorCount, avgResponseTime, emailStats, recentAudit,
  ] = await Promise.allSettled([
    // Today's event count
    env.DB.prepare("SELECT COUNT(*) as cnt FROM analytics_events WHERE DATE(created_at) = ?").bind(today).first(),
    // Active users today
    env.DB.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM analytics_events WHERE DATE(created_at) = ?").bind(today).first(),
    // Last 7 days event breakdown by type
    env.DB.prepare(`
      SELECT event_type, COUNT(*) as cnt
      FROM analytics_events WHERE created_at >= ? GROUP BY event_type ORDER BY cnt DESC
    `).bind(sevenDaysAgo).all(),
    // Top event names
    env.DB.prepare(`
      SELECT event_name, COUNT(*) as cnt FROM analytics_events
      WHERE created_at >= ? GROUP BY event_name ORDER BY cnt DESC LIMIT 10
    `).bind(sevenDaysAgo).all(),
    // Error count today
    env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM analytics_events
      WHERE event_type = 'error' AND DATE(created_at) = ?
    `).bind(today).first(),
    // Average API response time
    env.DB.prepare(`
      SELECT AVG(duration_ms) as avg_ms FROM analytics_events
      WHERE duration_ms IS NOT NULL AND DATE(created_at) = ?
    `).bind(today).first(),
    // Email delivery stats
    env.DB.prepare(`
      SELECT status, COUNT(*) as cnt FROM email_logs
      WHERE created_at >= ? GROUP BY status
    `).bind(sevenDaysAgo).all(),
    // Recent audit log
    env.DB.prepare(`
      SELECT action, entity_type, performed_by_name, created_at
      FROM audit_logs ORDER BY created_at DESC LIMIT 20
    `).all(),
  ]);

  const safe = (result, defaultVal) => result.status === "fulfilled" ? result.value : defaultVal;

  return jsonResponse({
    analytics: {
      todayEvents: safe(todayEvents, { cnt: 0 })?.cnt || 0,
      activeUsersToday: safe(todayUsers, { cnt: 0 })?.cnt || 0,
      errorsToday: safe(errorCount, { cnt: 0 })?.cnt || 0,
      avgResponseTimeMs: Math.round(safe(avgResponseTime, { avg_ms: 0 })?.avg_ms || 0),
    },
    weeklyEventsByType: safe(weeklyEvents, { results: [] })?.results || [],
    topEventNames: safe(topEventNames, { results: [] })?.results || [],
    emailStats: safe(emailStats, { results: [] })?.results || [],
    recentAuditLog: safe(recentAudit, { results: [] })?.results || [],
    generatedAt: nowISO(),
  });
}

/**
 * GET /api/admin/analytics/billing
 * Estimate monthly Cloudflare usage and costs.
 */
export async function handleAnalyticsBilling(request, env, params, query, user) {
  if (!user || user.role !== "Admin") return errorResponse("Admin access required", 403);

  const thisMonth = new Date().toISOString().slice(0, 7); // "2026-08"

  const [eventsThisMonth, emailsThisMonth, filesThisMonth, totalStorageBytes] = await Promise.allSettled([
    env.DB.prepare("SELECT COUNT(*) as cnt FROM analytics_events WHERE created_at LIKE ?").bind(`${thisMonth}%`).first(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM email_logs WHERE created_at LIKE ?").bind(`${thisMonth}%`).first(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM file_metadata WHERE created_at LIKE ? AND is_deleted = 0").bind(`${thisMonth}%`).first(),
    env.DB.prepare("SELECT SUM(file_size) as total FROM file_metadata WHERE is_deleted = 0").first(),
  ]);

  const safe = (r, d) => r.status === "fulfilled" ? r.value : d;

  const workerRequests = safe(eventsThisMonth, { cnt: 0 })?.cnt || 0;
  const emailCount = safe(emailsThisMonth, { cnt: 0 })?.cnt || 0;
  const filesCount = safe(filesThisMonth, { cnt: 0 })?.cnt || 0;
  const storageBytes = safe(totalStorageBytes, { total: 0 })?.total || 0;
  const storageGB = storageBytes / (1024 * 1024 * 1024);

  // Cloudflare Pricing (as of 2026)
  const workerCost = Math.max(0, (workerRequests - 100000) * 0.0000003);
  const storageCost = Math.max(0, (storageGB - 10) * 0.015);
  const r2ClassACost = Math.max(0, (filesCount - 1000000) * 0.0000045);

  return jsonResponse({
    billing: {
      month: thisMonth,
      workerRequests: { count: workerRequests, freeTier: 100000, cost: workerCost.toFixed(4) },
      r2Storage: { bytes: storageBytes, gb: storageGB.toFixed(2), freeTierGb: 10, cost: storageCost.toFixed(4) },
      r2ClassA: { count: filesCount, freeTier: 1000000, cost: r2ClassACost.toFixed(4) },
      emailsSent: { count: emailCount, cost: "0.0000" },
      totalEstimatedCost: (workerCost + storageCost + r2ClassACost).toFixed(4),
      currency: "USD",
    },
    note: "These are estimates based on tracked events. Actual Cloudflare billing may differ.",
    generatedAt: nowISO(),
  });
}

/**
 * GET /api/admin/files/health
 * Check for broken file references (files in DB but not in R2).
 */
export async function handleFileHealth(request, env, params, query, user) {
  if (!user || user.role !== "Admin") return errorResponse("Admin access required", 403);
  if (!env.R2_BUCKET) return jsonResponse({ error: "R2 not configured", broken: [], total: 0 });

  const files = await env.DB.prepare(
    "SELECT id, r2_object_key, r2_url, employee_id FROM file_metadata WHERE r2_object_key IS NOT NULL AND is_deleted = 0 LIMIT 100"
  ).all();

  const broken = [];
  for (const f of (files?.results || [])) {
    if (!f.r2_object_key) continue;
    try {
      const obj = await env.R2_BUCKET.head(f.r2_object_key);
      if (!obj) broken.push({ id: f.id, key: f.r2_object_key, employeeId: f.employee_id, reason: "Not found in R2" });
    } catch (e) {
      broken.push({ id: f.id, key: f.r2_object_key, reason: e.message });
    }
  }

  return jsonResponse({
    total: files?.results?.length || 0,
    broken: broken.length,
    brokenFiles: broken,
    checkedAt: nowISO(),
  });
}

/**
 * GET /api/admin/files/storage-report
 * Storage breakdown by month, category, and source.
 */
export async function handleStorageReport(request, env, params, query, user) {
  if (!user || user.role !== "Admin") return errorResponse("Admin access required", 403);

  const [byMonth, byCategory, bySource, topUploaders] = await Promise.allSettled([
    env.DB.prepare(`
      SELECT strftime('%Y-%m', created_at) as month,
        COUNT(*) as files, SUM(file_size) as bytes
      FROM file_metadata WHERE is_deleted = 0
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).all(),
    env.DB.prepare(`
      SELECT category, COUNT(*) as files, SUM(file_size) as bytes
      FROM file_metadata WHERE is_deleted = 0 GROUP BY category
    `).all(),
    env.DB.prepare(`
      SELECT upload_source, COUNT(*) as files, SUM(file_size) as bytes
      FROM file_metadata WHERE is_deleted = 0 GROUP BY upload_source
    `).all(),
    env.DB.prepare(`
      SELECT uploaded_by, COUNT(*) as files
      FROM file_metadata WHERE is_deleted = 0
      GROUP BY uploaded_by ORDER BY files DESC LIMIT 10
    `).all(),
  ]);

  const safe = (r, d) => r.status === "fulfilled" ? r.value?.results || [] : d;

  return jsonResponse({
    byMonth: safe(byMonth, []),
    byCategory: safe(byCategory, []),
    bySource: safe(bySource, []),
    topUploaders: safe(topUploaders, []),
    generatedAt: nowISO(),
  });
}

/**
 * POST /api/admin/run-migrations-v2
 * Run V2 enterprise database migrations.
 */
export async function handleRunMigrationsV2(request, env, params, query, user) {
  if (!user || user.role !== "Admin") return errorResponse("Admin access required", 403);

  try {
    const db = env._originalDB || env.DB;
    const { applied, errors } = await runMigrationsV2(db);
    const tableStatus = await checkV2TableStatus(db);

    return jsonResponse({
      success: errors.length === 0,
      applied,
      errors,
      tableStatus,
      message: errors.length === 0
        ? `Successfully applied ${applied.length} migrations`
        : `${applied.length} applied, ${errors.length} errors`,
    });
  } catch (e) {
    return errorResponse("Migration failed: " + e.message, 500);
  }
}
