/**
 * Database Utility Module for Cloudflare Workers
 * Handles local queries (via native binding) and schedules background replication
 * to the Primary D1 database via Cloudflare REST API.
 */

/**
 * Execute a single write query (INSERT/UPDATE/DELETE) locally and replicate to primary DB.
 */
export async function runWrite(env, sql, params = []) {
  if (sql.toLowerCase().includes("notifications")) {
    return { success: true, meta: { changes: 0 } };
  }
  // 1. Execute locally on D1 binding
  const result = await env.DB.prepare(sql).bind(...params).run();
  
  if (env.SKIP_PRIMARY_SYNC === "true") {
    return result;
  }

  // 2. Queue replication to Primary D1 in background (do not block client response)
  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID ? env.PRIMARY_CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID ? env.PRIMARY_CLOUDFLARE_DATABASE_ID.trim() : "";
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN ? env.PRIMARY_CLOUDFLARE_API_TOKEN.trim() : "";
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL ? env.PRIMARY_CLOUDFLARE_EMAIL.trim() : "";

  if (primaryAccount && primaryDb && primaryToken) {
    const promise = replicateToPrimary(primaryAccount, primaryDb, primaryToken, primaryEmail, sql, params);
    if (env.ctx && typeof env.ctx.waitUntil === "function") {
      env.ctx.waitUntil(promise);
    } else {
      promise.catch(err => console.error("Replication background error:", err));
    }
  } else {
    console.warn("Primary DB replication credentials missing. Local write succeeded but did not replicate.");
  }

  return result;
}

/**
 * Execute a batch of write queries locally and replicate them to primary DB.
 */
export async function runBatchWrite(env, statements) {
  // Filter out any notification queries to prevent D1 database reads/writes
  statements = (statements || []).filter(s => !s.sql.toLowerCase().includes("notifications"));
  if (statements.length === 0) return [];
  
  // 1. Map to D1 prepared statements
  const batch = statements.map(s => {
    return env.DB.prepare(s.sql).bind(...(s.params || []));
  });

  // 2. Execute locally
  const results = await env.DB.batch(batch);

  if (env.SKIP_PRIMARY_SYNC === "true") {
    return results;
  }

  // 3. Replicate batch to Primary D1
  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID ? env.PRIMARY_CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID ? env.PRIMARY_CLOUDFLARE_DATABASE_ID.trim() : "";
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN ? env.PRIMARY_CLOUDFLARE_API_TOKEN.trim() : "";
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL ? env.PRIMARY_CLOUDFLARE_EMAIL.trim() : "";

  if (primaryAccount && primaryDb && primaryToken) {
    const promise = replicateBatchToPrimary(primaryAccount, primaryDb, primaryToken, primaryEmail, statements);
    if (env.ctx && typeof env.ctx.waitUntil === "function") {
      env.ctx.waitUntil(promise);
    } else {
      promise.catch(err => console.error("Batch replication background error:", err));
    }
  }

  return results;
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
  if (sql.toLowerCase().includes("notifications")) {
    return { results: [], success: true };
  }

  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID ? env.PRIMARY_CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID ? env.PRIMARY_CLOUDFLARE_DATABASE_ID.trim() : "";
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN ? env.PRIMARY_CLOUDFLARE_API_TOKEN.trim() : "";
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL ? env.PRIMARY_CLOUDFLARE_EMAIL.trim() : "";

  const hasPrimary = !!(primaryAccount && primaryDb && primaryToken);
  let usePrimary = false;

  // Force routing to Primary DB for master/setup tables that are not written to by edge worker,
  // ensuring consistent asset, allowance, hierarchy, and user credentials reads.
  const lowerSql = sql.toLowerCase();
  const isMasterTableQuery = 
    lowerSql.includes("assets_inventory") || 
    lowerSql.includes("allowance_master") || 
    lowerSql.includes("facility_detail") || 
    lowerSql.includes("asset_value_master") ||
    lowerSql.includes("users") ||
    lowerSql.includes("hierarchy_") ||
    lowerSql.includes("user_approval_chains");
    
  if (hasPrimary && isMasterTableQuery) {
    usePrimary = true;
  }

  // 1. Header-based override
  if (request && hasPrimary) {
    const headerVal = request.headers.get("x-read-db");
    if (headerVal === "primary") {
      usePrimary = true;
    } else if (headerVal === "secondary") {
      usePrimary = false;
    }
  }

  // 2. Env variable override
  if (!usePrimary && request && request.headers.get("x-read-db") === null) {
    if (env.READ_DATABASE === "primary" && hasPrimary) {
      usePrimary = true;
    } else if (env.READ_DATABASE === "secondary") {
      usePrimary = false;
    }
  }

  // 3. Fallback to Date-based round robin (50/50 split starting Aug 3, 2026)
  if (hasPrimary && !usePrimary && (!request || request.headers.get("x-read-db") !== "secondary") && env.READ_DATABASE !== "secondary") {
    // Current IST Date/Time
    const now = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    if (now >= ROUND_ROBIN_START_DATE) {
      readCounter = (readCounter + 1) % 2;
      usePrimary = (readCounter === 1);
    }
  }

  const originalDB = env._originalDB || env.DB;

  if (usePrimary) {
    try {
      return await fetchPrimaryD1(primaryAccount, primaryDb, primaryToken, primaryEmail, sql, params);
    } catch (e) {
      console.warn("Primary D1 read failed, falling back to local Secondary D1:", e);
      return await originalDB.prepare(sql).bind(...params).all();
    }
  } else {
    try {
      return await originalDB.prepare(sql).bind(...params).all();
    } catch (e) {
      if (hasPrimary) {
        console.warn("Local Secondary D1 read failed, falling back to Primary:", e);
        try {
          return await fetchPrimaryD1(primaryAccount, primaryDb, primaryToken, primaryEmail, sql, params);
        } catch (err) {
          console.error("Both Secondary and Primary D1 reads failed:", err);
          throw e;
        }
      } else {
        throw e;
      }
    }
  }
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
