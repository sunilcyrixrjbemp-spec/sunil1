/**
 * Database Utility Module for Cloudflare Workers
 * Handles local queries (via native binding) and schedules background replication
 * to the Primary D1 database via Cloudflare REST API.
 */

// ─── Global Query Cache for Ultrafast Reads ──────────────────────────────────
const MEMORY_CACHE = new Map();

const ALL_KNOWN_TABLES = [
  "users", "user_roles", "password_histories", "expenses", "expense_master",
  "expense_itineraries", "expense_asset_taggings", "approvals", "approval_hierarchies",
  "hierarchy_requesters", "hierarchy_approvers", "limit_approval_requests",
  "notifications", "allowance_master", "facility_details", "login_logs", "otps",
  "kpi_appraisals", "rj_penalties", "assets_inventory", "asset_value_master"
];

function extractTables(sql) {
  const sqlLower = sql.toLowerCase();
  const found = [];
  for (const t of ALL_KNOWN_TABLES) {
    const regex = new RegExp(`\\b${t}\\b`);
    if (regex.test(sqlLower)) {
      found.push(t);
    }
  }
  return found;
}

function getCacheKey(sql, params) {
  return `${sql}:${JSON.stringify(params)}`;
}

function getCachedResult(sql, params) {
  const key = getCacheKey(sql, params);
  const cached = MEMORY_CACHE.get(key);
  if (cached) {
    if (Date.now() < cached.expiresAt) {
      return cached.data;
    } else {
      MEMORY_CACHE.delete(key);
    }
  }
  return null;
}

function setCachedResult(sql, params, data) {
  const sqlLower = sql.toLowerCase();
  let ttl = 30000; // Default: 30 seconds cache for all read queries!
  
  if (sqlLower.includes("allowance_master") || sqlLower.includes("facility_details") || sqlLower.includes("asset_value_master")) {
    ttl = 3600000; // 1 hour for static tables
  } else if (sqlLower.includes("login_logs") || sqlLower.includes("notifications") || sqlLower.includes("otps")) {
    ttl = 5000; // 5 seconds for volatile status tables
  }

  const key = getCacheKey(sql, params);
  const tables = extractTables(sql);
  
  MEMORY_CACHE.set(key, {
    data,
    tables,
    expiresAt: Date.now() + ttl
  });
}

function invalidateCacheOnWrite(sql) {
  const writeTables = extractTables(sql);
  if (writeTables.length === 0) return;

  for (const [key, cached] of MEMORY_CACHE.entries()) {
    const hasOverlap = (cached.tables || []).some(t => writeTables.includes(t));
    if (hasOverlap) {
      MEMORY_CACHE.delete(key);
    }
  }
}

/**
 * Execute a single write query (INSERT/UPDATE/DELETE) locally and replicate to primary DB.
 */
export async function runWrite(env, sql, params = []) {
  const originalDB = env._originalDB || env.DB;
  
  // Invalidate any relevant query cache entries before writing
  invalidateCacheOnWrite(sql);

  // 1. Prepare local write promise
  const localWritePromise = originalDB.prepare(sql).bind(...params).run();

  // 2. Prepare primary replication write promise (if credentials available)
  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID ? env.PRIMARY_CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID ? env.PRIMARY_CLOUDFLARE_DATABASE_ID.trim() : "";
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN ? env.PRIMARY_CLOUDFLARE_API_TOKEN.trim() : "";
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL ? env.PRIMARY_CLOUDFLARE_EMAIL.trim() : "";

  const shouldReplicate = env.SKIP_PRIMARY_SYNC !== "true" && primaryAccount && primaryDb && primaryToken;

  if (shouldReplicate) {
    const replicationPromise = replicateToPrimary(primaryAccount, primaryDb, primaryToken, primaryEmail, sql, params);
    
    // Execute both in parallel (sath-sath) and wait for both to complete
    const [localResult] = await Promise.all([localWritePromise, replicationPromise]);
    return localResult;
  } else {
    return await localWritePromise;
  }
}

/**
 * Execute a batch of write queries locally and replicate them to primary DB.
 */
export async function runBatchWrite(env, statements) {
  if (statements.length === 0) return [];
  
  const originalDB = env._originalDB || env.DB;

  // Invalidate any relevant query cache entries
  for (const s of statements) {
    invalidateCacheOnWrite(s.sql);
  }

  // 1. Prepare local batch promise
  const batch = statements.map(s => {
    return originalDB.prepare(s.sql).bind(...(s.params || []));
  });
  const localBatchPromise = originalDB.batch(batch);

  // 2. Prepare primary batch replication promise (if credentials available)
  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID ? env.PRIMARY_CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID ? env.PRIMARY_CLOUDFLARE_DATABASE_ID.trim() : "";
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN ? env.PRIMARY_CLOUDFLARE_API_TOKEN.trim() : "";
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL ? env.PRIMARY_CLOUDFLARE_EMAIL.trim() : "";

  const shouldReplicate = env.SKIP_PRIMARY_SYNC !== "true" && primaryAccount && primaryDb && primaryToken;

  if (shouldReplicate) {
    const replicationPromise = replicateBatchToPrimary(primaryAccount, primaryDb, primaryToken, primaryEmail, statements);
    
    // Execute both in parallel (sath-sath) and wait for both to complete
    const [localResults] = await Promise.all([localBatchPromise, replicationPromise]);
    return localResults;
  } else {
    return await localBatchPromise;
  }
}

/**
 * Helper to build auth headers for D1 REST API
 */
function buildAuthHeaders(token, email) {
  const headers = {
    "Content-Type": "application/json"
  };
  
  if (token.startsWith("cfk_")) {
    headers["X-Auth-Key"] = token;
    headers["X-Auth-Email"] = email || "Sunil.cyrixrjbemp@gmail.com";
  } else {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Async fetch call to replicate a single statement to the Primary D1 Database
 */
async function replicateToPrimary(accountId, dbId, token, email, sql, params) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const headers = buildAuthHeaders(token, email);

  const payload = {
    sql: sql,
    params: params || []
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) {
      console.error("Replication failed on Primary D1:", data.errors);
    }
  } catch (e) {
    console.error("Replication connection failed:", e);
  }
}

/**
 * Async fetch call to replicate a batch of statements to the Primary D1 Database
 */
async function replicateBatchToPrimary(accountId, dbId, token, email, statements) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const headers = buildAuthHeaders(token, email);

  const payload = statements.map(s => ({
    sql: s.sql,
    params: s.params || []
  }));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) {
      console.error("Batch replication failed on Primary D1:", data.errors);
    }
  } catch (e) {
    console.error("Batch replication connection failed:", e);
  }
}

let readCounter = 0;
const ROUND_ROBIN_START_DATE = new Date("2026-08-03T00:00:00+05:30"); // IST

/**
 * Execute a read query (SELECT/WITH) with smart routing between Primary and Secondary D1.
 * Matches Python backend date-based round-robin routing logic.
 */
export async function runRead(env, sql, params = [], request = null) {
  // Check memory cache first
  const cached = getCachedResult(sql, params);
  if (cached) {
    return cached;
  }

  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID ? env.PRIMARY_CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID ? env.PRIMARY_CLOUDFLARE_DATABASE_ID.trim() : "";
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN ? env.PRIMARY_CLOUDFLARE_API_TOKEN.trim() : "";
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL ? env.PRIMARY_CLOUDFLARE_EMAIL.trim() : "";

  const hasPrimary = !!(primaryAccount && primaryDb && primaryToken);
  let usePrimary = false;

  // 1. Date check (Current IST Date/Time)
  const now = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
  if (hasPrimary) {
    if (now < ROUND_ROBIN_START_DATE) {
      // Until August 3, 2026: permanently route all reads to secondary database
      usePrimary = false;
    } else {
      // After August 3, 2026: split 50/50 split round robin
      readCounter = (readCounter + 1) % 2;
      usePrimary = (readCounter === 1);
    }
  }

  // 2. Header-based override (for debugging and test execution)
  if (request && hasPrimary) {
    const headerVal = request.headers.get("x-read-db");
    if (headerVal === "primary") {
      usePrimary = true;
    } else if (headerVal === "secondary") {
      usePrimary = false;
    }
  }

  // 3. Env variable override
  if (request && request.headers.get("x-read-db") === null) {
    if (env.READ_DATABASE === "primary" && hasPrimary) {
      usePrimary = true;
    } else if (env.READ_DATABASE === "secondary") {
      usePrimary = false;
    }
  }

  const originalDB = env._originalDB || env.DB;
  let result;

  if (usePrimary) {
    try {
      result = await fetchPrimaryD1(primaryAccount, primaryDb, primaryToken, primaryEmail, sql, params);
    } catch (e) {
      console.warn("Primary D1 read failed, falling back to local Secondary D1:", e);
      result = await originalDB.prepare(sql).bind(...params).all();
    }
  } else {
    try {
      result = await originalDB.prepare(sql).bind(...params).all();
    } catch (e) {
      if (hasPrimary) {
        console.warn("Local Secondary D1 read failed, falling back to Primary:", e);
        try {
          result = await fetchPrimaryD1(primaryAccount, primaryDb, primaryToken, primaryEmail, sql, params);
        } catch (err) {
          console.error("Both Secondary and Primary D1 reads failed:", err);
          throw e;
        }
      } else {
        throw e;
      }
    }
  }

  // Save the result to cache before returning
  setCachedResult(sql, params, result);
  return result;
}

async function fetchPrimaryD1(accountId, dbId, token, email, sql, params) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const headers = buildAuthHeaders(token, email);

  const payload = {
    sql: sql,
    params: params || []
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status} from Primary D1: ${await res.text()}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Primary D1 returned query errors: ${JSON.stringify(data.errors)}`);
  }

  if (data.result && data.result[0]) {
    return data.result[0];
  }
  return { results: [], success: true };
}
