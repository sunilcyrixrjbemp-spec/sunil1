/**
 * Database Utility Module for Cloudflare Workers
 * Handles local queries (via native binding) and schedules background replication
 * to the Primary D1 database via Cloudflare REST API.
 */

/**
 * Execute a single write query (INSERT/UPDATE/DELETE) locally and replicate to primary DB.
 */
export async function runWrite(env, sql, params = []) {
  // 1. Execute locally on D1 binding
  const result = await env.DB.prepare(sql).bind(...params).run();
  
  // 2. Queue replication to Primary D1 in background (do not block client response)
  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID;
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN;
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL;

  if (primaryAccount && primaryDb && primaryToken) {
    // We trigger replication asynchronously
    replicateToPrimary(primaryAccount, primaryDb, primaryToken, primaryEmail, sql, params)
      .catch(err => console.error("Replication background error:", err));
  } else {
    console.warn("Primary DB replication credentials missing. Local write succeeded but did not replicate.");
  }

  return result;
}

/**
 * Execute a batch of write queries locally and replicate them to primary DB.
 */
export async function runBatchWrite(env, statements) {
  if (!statements || statements.length === 0) return [];
  
  // 1. Map to D1 prepared statements
  const batch = statements.map(s => {
    return env.DB.prepare(s.sql).bind(...(s.params || []));
  });

  // 2. Execute locally
  const results = await env.DB.batch(batch);

  // 3. Replicate batch to Primary D1
  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID;
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN;
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL;

  if (primaryAccount && primaryDb && primaryToken) {
    replicateBatchToPrimary(primaryAccount, primaryDb, primaryToken, primaryEmail, statements)
      .catch(err => console.error("Batch replication background error:", err));
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
