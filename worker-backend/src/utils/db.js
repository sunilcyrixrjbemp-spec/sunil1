/**
 * ============================================================
 * Simplified Database Utility — Single Primary D1 Only
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * ARCHITECTURE CHANGE (v2.1.0):
 *   - REMOVED: Secondary DB replication, round-robin read routing,
 *     PRIMARY_CLOUDFLARE_API_TOKEN fetch calls for DB writes.
 *   - NOW: All reads/writes go directly to env.DB (the one bound D1).
 *   - KEPT: In-memory query cache (same TTL logic — huge performance win).
 *   - KEPT: Cache invalidation on writes.
 *   - KEPT: Notification table guard (legacy).
 *
 * This eliminates ~150ms of network latency per write that
 * was previously added by the replication REST call.
 * ============================================================
 */

// ─── In-Memory Query Cache ────────────────────────────────────────────────────
const MEMORY_CACHE = new Map();

const ALL_KNOWN_TABLES = [
  "users", "user_roles", "password_histories", "expenses", "expense_master",
  "expense_itineraries", "expense_asset_taggings", "approvals", "approval_hierarchies",
  "hierarchy_requesters", "hierarchy_approvers", "limit_approval_requests",
  "allowance_master", "facility_details", "login_logs", "otps",
  "kpi_appraisals", "rj_penalties", "assets_inventory", "asset_value_master",
  // V2 enterprise tables
  "file_metadata", "audit_logs", "analytics_events", "email_logs",
  "system_metrics", "approval_tokens",
];

function extractTables(sql) {
  const sqlLower = sql.toLowerCase();
  return ALL_KNOWN_TABLES.filter(t => new RegExp(`\\b${t}\\b`).test(sqlLower));
}

function getCacheKey(sql, params) {
  return `${sql}:${JSON.stringify(params)}`;
}

function getCachedResult(sql, params) {
  const key = getCacheKey(sql, params);
  const cached = MEMORY_CACHE.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  if (cached) MEMORY_CACHE.delete(key);
  return null;
}

function setCachedResult(sql, params, data) {
  const sqlLower = sql.toLowerCase();
  let ttl = 30_000; // 30s default

  if (sqlLower.includes("allowance_master") || sqlLower.includes("facility_details") || sqlLower.includes("asset_value_master") || sqlLower.includes("system_settings")) {
    ttl = 3_600_000; // 1 hour — static/config tables
  } else if (sqlLower.includes("login_logs") || sqlLower.includes("otps") || sqlLower.includes("approval_tokens")) {
    ttl = 5_000; // 5s — security-sensitive
  } else if (sqlLower.includes("audit_logs") || sqlLower.includes("analytics_events")) {
    ttl = 60_000; // 1 min — write-heavy analytics
  }

  MEMORY_CACHE.set(getCacheKey(sql, params), {
    data,
    tables: extractTables(sql),
    expiresAt: Date.now() + ttl,
  });
}

function invalidateCacheOnWrite(sql) {
  const writeTables = extractTables(sql);
  if (writeTables.length === 0) return;
  for (const [key, cached] of MEMORY_CACHE.entries()) {
    if ((cached.tables || []).some(t => writeTables.includes(t))) {
      MEMORY_CACHE.delete(key);
    }
  }
}

// ─── Single DB Accessor ────────────────────────────────────────────────────────

function getDB(env) {
  return env.DB; // One database. Full stop.
}

// ─── Exported Functions (same API surface — backward compatible) ───────────────

/**
 * Execute a SELECT / WITH read query.
 * Uses in-memory cache for performance.
 * @param {Object} env
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<D1Result>}
 */
export async function runRead(env, sql, params = []) {
  const cached = getCachedResult(sql, params);
  if (cached) return cached;

  const db = getDB(env);
  try {
    const result = await db.prepare(sql).bind(...params).all();
    setCachedResult(sql, params, result);
    return result;
  } catch (err) {
    throw new Error(`DB Read Error: ${err.message} | SQL: ${sql.slice(0, 120)}`);
  }
}

/**
 * Execute a single INSERT / UPDATE / DELETE write.
 * Invalidates related cache entries.
 * @param {Object} env
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<D1Result>}
 */
export async function runWrite(env, sql, params = []) {
  // Legacy guard: skip writes to removed notifications table
  if (sql.toLowerCase().includes("notifications")) {
    return { success: true, meta: { last_row_id: 1, changes: 0 } };
  }

  invalidateCacheOnWrite(sql);
  const db = getDB(env);
  try {
    return await db.prepare(sql).bind(...params).run();
  } catch (err) {
    throw new Error(`DB Write Error: ${err.message} | SQL: ${sql.slice(0, 120)}`);
  }
}

/**
 * Execute a batch of write statements atomically.
 * More efficient than multiple runWrite calls.
 * @param {Object} env
 * @param {Array<{sql: string, params: Array}>} statements
 * @returns {Promise<D1Result[]>}
 */
export async function runBatchWrite(env, statements) {
  if (!statements || statements.length === 0) return [];

  // Filter out legacy notifications table writes
  const active = statements.filter(s => {
    if ((s.sql || "").toLowerCase().includes("notifications")) return false;
    return true;
  });

  if (active.length === 0) {
    return statements.map(() => ({ success: true, meta: { last_row_id: 1, changes: 0 } }));
  }

  // Invalidate cache
  for (const s of active) invalidateCacheOnWrite(s.sql);

  const db = getDB(env);
  const batch = active.map(s => db.prepare(s.sql).bind(...(s.params || [])));

  try {
    const results = await db.batch(batch);
    // Re-assemble to match original indices (accounting for filtered notifications stmts)
    let ri = 0;
    return statements.map(s => {
      if ((s.sql || "").toLowerCase().includes("notifications")) {
        return { success: true, meta: { last_row_id: 1, changes: 0 } };
      }
      return results[ri++];
    });
  } catch (err) {
    throw new Error(`DB Batch Write Error: ${err.message}`);
  }
}

/**
 * Clear the entire in-memory cache.
 * Useful after bulk imports or migrations.
 */
export function clearCache() {
  MEMORY_CACHE.clear();
}

/**
 * Get cache stats (for admin dashboard).
 */
export function getCacheStats() {
  const now = Date.now();
  let live = 0;
  let expired = 0;
  for (const [, v] of MEMORY_CACHE) {
    if (now < v.expiresAt) live++;
    else expired++;
  }
  return { total: MEMORY_CACHE.size, live, expired };
}
