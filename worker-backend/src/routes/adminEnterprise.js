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
 * GET /api/admin/analytics/cf-infra
 * Fetches REAL Cloudflare Infrastructure metrics via CF REST API + GraphQL Analytics API.
 * Free tiers match the $5/month Workers Paid plan as visible in user's CF billing dashboard.
 * Reads:  env.CF_API_TOKEN, env.CF_ACCOUNT_ID, env.CF_ZONE_ID
 */
export async function handleCfInfraAnalytics(request, env, params, query, user) {
  if (!user || user.role !== "Admin") return errorResponse("Admin access required", 403);

  const token     = env.CF_API_TOKEN || env.CF_AI_API_TOKEN;
  const accountId = env.CF_ACCOUNT_ID || "befbd2e0ff580a1d0d0865f011002053";
  const zoneId    = env.CF_ZONE_ID;

  if (!token || !accountId) {
    return jsonResponse({
      configured: false,
      message: "Cloudflare credentials not configured. Add CF_API_TOKEN and CF_ACCOUNT_ID as Worker secrets.",
      generatedAt: nowISO(),
    });
  }

  const CF_GQL  = "https://api.cloudflare.com/client/v4/graphql";
  const CF_REST = "https://api.cloudflare.com/client/v4";
  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = now.toISOString();

  const gql = (queryStr) =>
    fetch(CF_GQL, { method: "POST", headers, body: JSON.stringify({ query: queryStr }) })
      .then(r => r.json())
      .catch(() => ({ errors: [{ message: "fetch failed" }] }));

  // ── Get email count from our D1 DB (CF Email API doesn't expose via GraphQL) ──
  let emailSentCount = 0;
  try {
    const db = env.DB;
    const monthYear = now.toISOString().slice(0, 7); // e.g. "2026-08"
    const emailResult = await db.prepare(
      `SELECT COUNT(*) as cnt FROM email_logs WHERE sent_at >= ? AND sent_at <= ?`
    ).bind(monthStart, monthEnd).first().catch(() => null);
    emailSentCount = emailResult?.cnt || 0;
  } catch (_) { emailSentCount = 0; }

  // ── Run all CF API calls in parallel ──────────────────────────────────────
  const [
    billingRes, workersRes, workersByScriptRes, workersDailyRes,
    d1Res, r2Res, kvRes, queuesRes, cacheRes, zoneHttpRes,
  ] = await Promise.allSettled([

    // 1. Billing subscriptions (REST)
    fetch(`${CF_REST}/accounts/${accountId}/subscriptions`, { headers })
      .then(r => r.json()).catch(() => null),

    // 2. Workers — total invocations + CPU this month
    gql(`query { viewer { accounts(filter:{accountTag:"${accountId}"}) {
      workersInvocationsAdaptive(limit:1000,
        filter:{datetime_geq:"${monthStart}",datetime_leq:"${monthEnd}"}) {
        sum { requests cpuTime errors subrequests }
      }
    }}}`),

    // 3. Workers — by script (this month)
    gql(`query { viewer { accounts(filter:{accountTag:"${accountId}"}) {
      workersInvocationsAdaptiveGroups(limit:50, filter:{datetime_geq:"${monthStart}"}) {
        dimensions { scriptName }
        sum { requests cpuTime errors }
      }
    }}}`),

    // 4. Workers — daily trend (hourly buckets, this month)
    gql(`query { viewer { accounts(filter:{accountTag:"${accountId}"}) {
      workersInvocationsAdaptiveGroups(limit:744, filter:{datetime_geq:"${monthStart}"}) {
        dimensions { datetimeHour }
        sum { requests cpuTime }
      }
    }}}`),

    // 5. D1 — row reads / writes / queries + storage
    gql(`query { viewer { accounts(filter:{accountTag:"${accountId}"}) {
      d1AnalyticsAdaptiveGroups(limit:30, filter:{datetime_geq:"${monthStart}"}) {
        sum { rowsRead rowsWritten queries readDuration writeDuration }
      }
    }}}`),

    // 6. R2 — storage & operations
    gql(`query { viewer { accounts(filter:{accountTag:"${accountId}"}) {
      r2StorageAdaptiveGroups(limit:30, filter:{datetime_geq:"${monthStart}"}) {
        sum { classAOperations classBOperations storageBytes egressBytes }
      }
    }}}`),

    // 7. KV — operations breakdown
    gql(`query { viewer { accounts(filter:{accountTag:"${accountId}"}) {
      workersKvOperationsAdaptiveGroups(limit:30, filter:{datetime_geq:"${monthStart}"}) {
        sum { readOperations writeOperations deleteOperations listOperations storedBytes }
      }
    }}}`),

    // 8. Queues — standard operations
    gql(`query { viewer { accounts(filter:{accountTag:"${accountId}"}) {
      queuesAdaptiveGroups(limit:30, filter:{datetime_geq:"${monthStart}"}) {
        sum { deliveredMessages }
      }
    }}}`),

    // 9. Cache hit stats (zone-level, 30d)
    zoneId ? gql(`query { viewer { zones(filter:{zoneTag:"${zoneId}"}) {
      httpRequests1dGroups(limit:30) {
        sum { requests cachedRequests bytes cachedBytes }
      }
    }}}`) : Promise.resolve(null),

    // 10. Zone HTTP trend (daily, 30d)
    zoneId ? gql(`query { viewer { zones(filter:{zoneTag:"${zoneId}"}) {
      httpRequests1dGroups(limit:30) {
        dimensions { date }
        sum { requests bytes cachedBytes cachedRequests }
      }
    }}}`) : Promise.resolve(null),
  ]);

  const safeV = (s, d = null) => s.status === "fulfilled" ? s.value : d;

  // ── Parse results ──────────────────────────────────────────────────────────

  const billingData   = safeV(billingRes);
  const subscriptions = billingData?.result || [];
  const activeSubPlan = subscriptions.find(s => s.state === "Active" || s.state === "active") || subscriptions[0] || null;

  const workersAgg    = safeV(workersRes)?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
  const workersTotals = workersAgg.reduce(
    (a, item) => ({ requests: a.requests + (item.sum?.requests||0), cpuTime: a.cpuTime + (item.sum?.cpuTime||0),
      errors: a.errors + (item.sum?.errors||0), subrequests: a.subrequests + (item.sum?.subrequests||0) }),
    { requests:0, cpuTime:0, errors:0, subrequests:0 }
  );

  const byScript = (safeV(workersByScriptRes)?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptiveGroups || [])
    .map(g => ({ name: g.dimensions?.scriptName || "unknown", requests: g.sum?.requests||0, cpuTime: g.sum?.cpuTime||0, errors: g.sum?.errors||0 }))
    .sort((a, b) => b.requests - a.requests);

  const dailyGroups = safeV(workersDailyRes)?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptiveGroups || [];
  const dailyMap    = {};
  for (const g of dailyGroups) {
    const day = (g.dimensions?.datetimeHour || "").slice(0, 10);
    if (!day) continue;
    if (!dailyMap[day]) dailyMap[day] = { day, requests: 0, cpuTime: 0 };
    dailyMap[day].requests += g.sum?.requests || 0;
    dailyMap[day].cpuTime  += g.sum?.cpuTime  || 0;
  }
  const workersDailyTrend = Object.values(dailyMap).sort((a, b) => a.day.localeCompare(b.day));

  const d1Groups = safeV(d1Res)?.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups || [];
  const d1Totals = d1Groups.reduce(
    (a, g) => ({ rowsRead: a.rowsRead+(g.sum?.rowsRead||0), rowsWritten: a.rowsWritten+(g.sum?.rowsWritten||0),
      queries: a.queries+(g.sum?.queries||0) }),
    { rowsRead:0, rowsWritten:0, queries:0 }
  );

  const r2Groups = safeV(r2Res)?.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups || [];
  const r2Totals = r2Groups.reduce(
    (a, g) => ({ classAOperations: a.classAOperations+(g.sum?.classAOperations||0),
      classBOperations: a.classBOperations+(g.sum?.classBOperations||0),
      storageBytes: a.storageBytes+(g.sum?.storageBytes||0),
      egressBytes:  a.egressBytes +(g.sum?.egressBytes ||0) }),
    { classAOperations:0, classBOperations:0, storageBytes:0, egressBytes:0 }
  );

  const kvGroups = safeV(kvRes)?.data?.viewer?.accounts?.[0]?.workersKvOperationsAdaptiveGroups || [];
  const kvTotals = kvGroups.reduce(
    (a, g) => ({ readOperations: a.readOperations+(g.sum?.readOperations||0),
      writeOperations: a.writeOperations+(g.sum?.writeOperations||0),
      deleteOperations: a.deleteOperations+(g.sum?.deleteOperations||0),
      listOperations: a.listOperations+(g.sum?.listOperations||0),
      storedBytes: a.storedBytes+(g.sum?.storedBytes||0) }),
    { readOperations:0, writeOperations:0, deleteOperations:0, listOperations:0, storedBytes:0 }
  );

  const queuesGroups = safeV(queuesRes)?.data?.viewer?.accounts?.[0]?.queuesAdaptiveGroups || [];
  const queuedMessages = queuesGroups.reduce((a, g) => a + (g.sum?.deliveredMessages||0), 0);

  const cacheGroups = safeV(cacheRes)?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  const cacheTotals = cacheGroups.reduce(
    (a, g) => ({ requests: a.requests+(g.sum?.requests||0), cachedRequests: a.cachedRequests+(g.sum?.cachedRequests||0),
      bytes: a.bytes+(g.sum?.bytes||0), cachedBytes: a.cachedBytes+(g.sum?.cachedBytes||0) }),
    { requests:0, cachedRequests:0, bytes:0, cachedBytes:0 }
  );

  const zoneHttpGroups = safeV(zoneHttpRes)?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  const zoneHttpTrend  = zoneHttpGroups.map(g => ({ date: g.dimensions?.date, ...g.sum }))
    .sort((a, b) => (a.date||"").localeCompare(b.date||""));

  // ── Accurate billing — $5 Workers Paid plan (as shown in CF billing dashboard) ──
  // Free tier limits confirmed from user's actual CF billing dashboard screenshots:
  const FREE = {
    WORKER_REQUESTS:  10_000_000,       // first 10M are included
    WORKER_CPU_MS:    30_000_000,       // first 30M are included
    D1_ROWS_READ:     25_000_000_000,   // first 25 billion included
    D1_ROWS_WRITTEN:  50_000_000,       // first 50 million included
    D1_STORAGE_GB:    5,                // first 5GB included
    R2_STORAGE_GB:    10,               // First 10GB-Month included
    R2_CLASS_A:       1_000_000,        // First 1M included
    R2_CLASS_B:       10_000_000,       // First 10M included
    KV_READS:         10_000_000,       // First 10M is included
    KV_WRITES:        1_000_000,        // First 1M is included
    KV_DELETES:       1_000_000,        // First 1M is included
    KV_LISTS:         1_000_000,        // First 1M is included
    KV_STORAGE_GB:    1,                // First 1GB is included
    QUEUES_OPS:       1_000_000,        // First 1M included
    EMAIL_SENT:       3_000,            // First 3,000 emails included
  };

  const r2StorageGB       = r2Totals.storageBytes / (1024**3);
  const kvStorageGB       = kvTotals.storedBytes  / (1024**3);

  const billableWorkerReq = Math.max(0, workersTotals.requests      - FREE.WORKER_REQUESTS);
  const billableWorkerCpu = Math.max(0, workersTotals.cpuTime       - FREE.WORKER_CPU_MS);
  const billableD1Reads   = Math.max(0, d1Totals.rowsRead           - FREE.D1_ROWS_READ);
  const billableD1Writes  = Math.max(0, d1Totals.rowsWritten        - FREE.D1_ROWS_WRITTEN);
  const billableR2Storage = Math.max(0, r2StorageGB                 - FREE.R2_STORAGE_GB);
  const billableR2A       = Math.max(0, r2Totals.classAOperations   - FREE.R2_CLASS_A);
  const billableR2B       = Math.max(0, r2Totals.classBOperations   - FREE.R2_CLASS_B);
  const billableKvReads   = Math.max(0, kvTotals.readOperations     - FREE.KV_READS);
  const billableKvWrites  = Math.max(0, kvTotals.writeOperations    - FREE.KV_WRITES);
  const billableKvDeletes = Math.max(0, kvTotals.deleteOperations   - FREE.KV_DELETES);
  const billableKvLists   = Math.max(0, kvTotals.listOperations     - FREE.KV_LISTS);
  const billableKvStorage = Math.max(0, kvStorageGB                 - FREE.KV_STORAGE_GB);
  const billableQueues    = Math.max(0, queuedMessages              - FREE.QUEUES_OPS);
  const billableEmail     = Math.max(0, emailSentCount              - FREE.EMAIL_SENT);

  // Pricing per CF 2026
  const costWorkerReq  = billableWorkerReq  * 0.30  / 1_000_000;
  const costWorkerCpu  = billableWorkerCpu  * 0.02  / 1_000_000;
  const costD1Reads    = billableD1Reads    * 0.001 / 1_000_000;
  const costD1Writes   = billableD1Writes   * 1.00  / 1_000_000;
  const costR2Storage  = billableR2Storage  * 0.015;
  const costR2A        = billableR2A        * 4.50  / 1_000_000;
  const costR2B        = billableR2B        * 0.36  / 1_000_000;
  const costKvReads    = billableKvReads    * 0.50  / 1_000_000;
  const costKvWrites   = billableKvWrites   * 1.00  / 1_000_000;
  const costKvDeletes  = billableKvDeletes  * 1.00  / 1_000_000;
  const costKvLists    = billableKvLists    * 1.00  / 1_000_000;
  const costKvStorage  = billableKvStorage  * 0.50;
  const costQueues     = billableQueues     * 0.40  / 1_000_000;
  const costEmail      = billableEmail      * 1.00  / 1_000;
  const subCost        = 5.00; // $5/month Workers Paid base (user confirmed)

  const totalCost = subCost + costWorkerReq + costWorkerCpu + costD1Reads + costD1Writes +
    costR2Storage + costR2A + costR2B + costKvReads + costKvWrites +
    costKvDeletes + costKvLists + costKvStorage + costQueues + costEmail;

  // ── Build product rows (matches CF billing dashboard order) ──────────────
  const products = [
    {
      name: "Email Service - Emails Sent",
      subtitle: `First ${FREE.EMAIL_SENT.toLocaleString()} emails included`,
      color: "#22C55E",
      totalUsage: emailSentCount,
      totalLabel: emailSentCount.toLocaleString(),
      billableUsage: billableEmail,
      billableLabel: billableEmail > 0 ? billableEmail.toLocaleString() : "0",
      cost: costEmail.toFixed(4),
    },
    {
      name: "KV Write Operations",
      subtitle: `First ${(FREE.KV_WRITES/1_000_000).toFixed(0)}M is included`,
      color: "#EAB308",
      totalUsage: kvTotals.writeOperations,
      totalLabel: kvTotals.writeOperations >= 1000 ? `${(kvTotals.writeOperations/1000).toFixed(1)}k` : kvTotals.writeOperations.toLocaleString(),
      billableUsage: billableKvWrites,
      billableLabel: billableKvWrites > 0 ? billableKvWrites.toLocaleString() : "0",
      cost: costKvWrites.toFixed(4),
    },
    {
      name: "KV Read Operations",
      subtitle: `First ${(FREE.KV_READS/1_000_000).toFixed(0)}M is included`,
      color: "#EF4444",
      totalUsage: kvTotals.readOperations,
      totalLabel: kvTotals.readOperations >= 1000 ? `${(kvTotals.readOperations/1000).toFixed(2)}k` : kvTotals.readOperations.toLocaleString(),
      billableUsage: billableKvReads,
      billableLabel: billableKvReads > 0 ? billableKvReads.toLocaleString() : "0",
      cost: costKvReads.toFixed(4),
    },
    {
      name: "KV Storage",
      subtitle: `GB, First ${FREE.KV_STORAGE_GB}GB is included`,
      color: "#22C55E",
      totalUsage: kvStorageGB,
      totalLabel: `${kvStorageGB.toFixed(2)} GB-months`,
      billableUsage: billableKvStorage,
      billableLabel: billableKvStorage > 0 ? `${billableKvStorage.toFixed(2)} GB-months` : "0 GB-months",
      cost: costKvStorage.toFixed(4),
    },
    {
      name: "D1 - Rows Written",
      subtitle: `first ${(FREE.D1_ROWS_WRITTEN/1_000_000).toFixed(0)} million included`,
      color: "#3B82F6",
      totalUsage: d1Totals.rowsWritten,
      totalLabel: d1Totals.rowsWritten >= 1_000_000 ? `${(d1Totals.rowsWritten/1_000_000).toFixed(2)}M` : d1Totals.rowsWritten >= 1000 ? `${(d1Totals.rowsWritten/1000).toFixed(2)}k` : d1Totals.rowsWritten.toLocaleString(),
      billableUsage: billableD1Writes,
      billableLabel: billableD1Writes > 0 ? `${(billableD1Writes/1_000_000).toFixed(2)}M` : "0",
      cost: costD1Writes.toFixed(4),
    },
    {
      name: "Workers CPU ms",
      subtitle: `first ${(FREE.WORKER_CPU_MS/1_000_000).toFixed(0)}M are included`,
      color: "#1E293B",
      totalUsage: workersTotals.cpuTime,
      totalLabel: workersTotals.cpuTime >= 1_000_000 ? `${(workersTotals.cpuTime/1_000_000).toFixed(2)}M` : `${(workersTotals.cpuTime/1000).toFixed(2)}k`,
      billableUsage: billableWorkerCpu,
      billableLabel: billableWorkerCpu > 0 ? `${(billableWorkerCpu/1_000_000).toFixed(2)}M` : "0",
      cost: costWorkerCpu.toFixed(4),
    },
    {
      name: "Queues - Standard operations",
      subtitle: `First ${(FREE.QUEUES_OPS/1_000_000).toFixed(0)}M included`,
      color: "#7C3AED",
      totalUsage: queuedMessages,
      totalLabel: queuedMessages.toLocaleString(),
      billableUsage: billableQueues,
      billableLabel: billableQueues > 0 ? billableQueues.toLocaleString() : "0",
      cost: costQueues.toFixed(4),
    },
    {
      name: "D1 - Storage GB-mo",
      subtitle: `first ${FREE.D1_STORAGE_GB}GB included`,
      color: "#A855F7",
      totalUsage: 0, // D1 storage not directly returned in GQL sum, show as unknown
      totalLabel: "—",
      billableUsage: 0,
      billableLabel: "0 GB-months",
      cost: "0.0000",
    },
    {
      name: "Workers Standard Requests",
      subtitle: `first ${(FREE.WORKER_REQUESTS/1_000_000).toFixed(0)}M are included`,
      color: "#14B8A6",
      totalUsage: workersTotals.requests,
      totalLabel: workersTotals.requests >= 1_000_000 ? `${(workersTotals.requests/1_000_000).toFixed(2)}M` : workersTotals.requests >= 1000 ? `${(workersTotals.requests/1000).toFixed(2)}k` : workersTotals.requests.toLocaleString(),
      billableUsage: billableWorkerReq,
      billableLabel: billableWorkerReq > 0 ? `${(billableWorkerReq/1_000_000).toFixed(2)}M` : "0",
      cost: costWorkerReq.toFixed(4),
    },
    {
      name: "D1 - Rows Read",
      subtitle: `first ${(FREE.D1_ROWS_READ/1_000_000_000).toFixed(0)} billion included`,
      color: "#F97316",
      totalUsage: d1Totals.rowsRead,
      totalLabel: d1Totals.rowsRead >= 1_000_000_000 ? `${(d1Totals.rowsRead/1_000_000_000).toFixed(2)}B` : d1Totals.rowsRead >= 1_000_000 ? `${(d1Totals.rowsRead/1_000_000).toFixed(2)}M` : d1Totals.rowsRead.toLocaleString(),
      billableUsage: billableD1Reads,
      billableLabel: billableD1Reads > 0 ? `${(billableD1Reads/1_000_000_000).toFixed(2)}B` : "0",
      cost: costD1Reads.toFixed(4),
    },
    {
      name: "R2 Data Storage",
      subtitle: `First ${FREE.R2_STORAGE_GB}GB-Month included`,
      color: "#EC4899",
      totalUsage: r2StorageGB,
      totalLabel: `${r2StorageGB.toFixed(2)} GB-months`,
      billableUsage: billableR2Storage,
      billableLabel: billableR2Storage > 0 ? `${billableR2Storage.toFixed(2)} GB-months` : "0 GB-months",
      cost: costR2Storage.toFixed(4),
    },
    {
      name: "R2 Storage Class A Operations",
      subtitle: `First ${(FREE.R2_CLASS_A/1_000_000).toFixed(0)}M included`,
      color: "#1D4ED8",
      totalUsage: r2Totals.classAOperations,
      totalLabel: r2Totals.classAOperations >= 1000 ? `${(r2Totals.classAOperations/1000).toFixed(2)}k` : r2Totals.classAOperations.toLocaleString(),
      billableUsage: billableR2A,
      billableLabel: billableR2A > 0 ? billableR2A.toLocaleString() : "0",
      cost: costR2A.toFixed(4),
    },
    {
      name: "R2 Storage Class B Operations",
      subtitle: `First ${(FREE.R2_CLASS_B/1_000_000).toFixed(0)}M included`,
      color: "#EAB308",
      totalUsage: r2Totals.classBOperations,
      totalLabel: r2Totals.classBOperations >= 1000 ? `${(r2Totals.classBOperations/1000).toFixed(2)}k` : r2Totals.classBOperations.toLocaleString(),
      billableUsage: billableR2B,
      billableLabel: billableR2B > 0 ? billableR2B.toLocaleString() : "0",
      cost: costR2B.toFixed(4),
    },
    {
      name: "KV Delete Operations",
      subtitle: `First ${(FREE.KV_DELETES/1_000_000).toFixed(0)}M is included`,
      color: "#FDA4AF",
      totalUsage: kvTotals.deleteOperations,
      totalLabel: kvTotals.deleteOperations.toLocaleString(),
      billableUsage: billableKvDeletes,
      billableLabel: billableKvDeletes > 0 ? billableKvDeletes.toLocaleString() : "0",
      cost: costKvDeletes.toFixed(4),
    },
    {
      name: "KV List Operations",
      subtitle: `First ${(FREE.KV_LISTS/1_000_000).toFixed(0)}M is included`,
      color: "#22D3EE",
      totalUsage: kvTotals.listOperations,
      totalLabel: kvTotals.listOperations.toLocaleString(),
      billableUsage: billableKvLists,
      billableLabel: billableKvLists > 0 ? billableKvLists.toLocaleString() : "0",
      cost: costKvLists.toFixed(4),
    },
  ];

  return jsonResponse({
    configured: true,
    subscription: {
      plan:     activeSubPlan?.ratePlan?.externally_name || "Workers Paid ($5/mo)",
      status:   activeSubPlan?.state || "active",
      currency: "USD",
      monthlyBase: 5.00,
    },
    workers: {
      ...workersTotals,
      freeTierRequests: FREE.WORKER_REQUESTS,
      billableRequests: billableWorkerReq,
      freeTierCpuMs:    FREE.WORKER_CPU_MS,
      billableCpuMs:    billableWorkerCpu,
    },
    workersByScript:    byScript,
    workersDailyTrend,
    d1: {
      ...d1Totals,
      freeTierReads:  FREE.D1_ROWS_READ,
      freeTierWrites: FREE.D1_ROWS_WRITTEN,
      billableReads:  billableD1Reads,
      billableWrites: billableD1Writes,
    },
    r2: {
      ...r2Totals,
      storageGB:        parseFloat(r2StorageGB.toFixed(3)),
      billableStorageGB: parseFloat(billableR2Storage.toFixed(3)),
      freeTierStorageGB: FREE.R2_STORAGE_GB,
      freeTierClassA:   FREE.R2_CLASS_A,
      freeTierClassB:   FREE.R2_CLASS_B,
      billableClassA:   billableR2A,
      billableClassB:   billableR2B,
    },
    kv: {
      ...kvTotals,
      storageGB:       parseFloat(kvStorageGB.toFixed(3)),
      freeTierReads:   FREE.KV_READS,
      freeTierWrites:  FREE.KV_WRITES,
      freeTierDeletes: FREE.KV_DELETES,
      freeTierLists:   FREE.KV_LISTS,
      freeTierStorageGB: FREE.KV_STORAGE_GB,
      billableReads:   billableKvReads,
      billableWrites:  billableKvWrites,
    },
    queues: {
      deliveredMessages: queuedMessages,
      freeTier:          FREE.QUEUES_OPS,
      billable:          billableQueues,
    },
    email: {
      sent:     emailSentCount,
      freeTier: FREE.EMAIL_SENT,
      billable: billableEmail,
    },
    cache: {
      ...cacheTotals,
      hitRatio: cacheTotals.requests > 0 ? Math.round((cacheTotals.cachedRequests/cacheTotals.requests)*100) : 0,
    },
    zoneHttpTrend,
    products,   // ← full billing table for frontend, matches CF billing dashboard
    billing: {
      month:             now.toISOString().slice(0, 7),
      subscriptionUsd:   subCost.toFixed(2),
      workerRequestsUsd: costWorkerReq.toFixed(4),
      workerCpuUsd:      costWorkerCpu.toFixed(4),
      d1ReadsUsd:        costD1Reads.toFixed(4),
      d1WritesUsd:       costD1Writes.toFixed(4),
      r2StorageUsd:      costR2Storage.toFixed(4),
      r2ClassAUsd:       costR2A.toFixed(4),
      r2ClassBUsd:       costR2B.toFixed(4),
      kvOpsUsd:          (costKvReads + costKvWrites + costKvDeletes + costKvLists + costKvStorage).toFixed(4),
      queuesUsd:         costQueues.toFixed(4),
      emailUsd:          costEmail.toFixed(4),
      totalEstimatedUsd: totalCost.toFixed(2),
      currency: "USD",
      note: "Estimates based on real Cloudflare API data. Final bill may differ slightly due to tax or rounding.",
    },
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
