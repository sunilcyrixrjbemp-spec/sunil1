import { getLegacyExpenseHashId } from "../routes/approval.js";

/**
 * Resolves a legacy hash ID (negative integer <= -200000) to its original exp_id string.
 * Uses legacy_hash_mapping table as a cache to achieve O(1) lookups.
 * If not cached, it runs a fallback scanning search checking both MD5 and formula-based hashes.
 */
export async function resolveLegacyExpenseId(env, hashIdVal) {
  if (typeof hashIdVal !== "number" || isNaN(hashIdVal) || hashIdVal > -200000) {
    return null;
  }

  // 1. Try mapping cache table first
  try {
    const cached = await env.DB.prepare("SELECT exp_id FROM legacy_hash_mapping WHERE hash_id = ?")
      .bind(hashIdVal)
      .first();
    if (cached && cached.exp_id) {
      return cached.exp_id;
    }
  } catch (err) {
    console.warn("legacy_hash_mapping table lookup failed, maybe migrations haven't run yet:", err.message);
  }

  // 2. Fallback scan on expense_master
  try {
    const allRows = await env.DB.prepare("SELECT exp_id FROM expense_master").all();
    const rows = allRows.results || [];
    
    for (const row of rows) {
      if (!row.exp_id) continue;
      
      // Check MD5-based hash (used in listing details)
      const md5Hash = await getLegacyExpenseHashId(row.exp_id);
      if (md5Hash === hashIdVal) {
        await cacheMapping(env, hashIdVal, row.exp_id);
        return row.exp_id;
      }

      // Check Python-based formula hash (used in approval/rejection)
      const numId = parseInt(row.exp_id, 10);
      if (!isNaN(numId)) {
        const formulaHash = -((numId * 73 + 19) % 800000 + 200000);
        if (formulaHash === hashIdVal) {
          await cacheMapping(env, hashIdVal, row.exp_id);
          return row.exp_id;
        }
      }
    }
  } catch (err) {
    console.warn("Fallback scan on expense_master failed:", err.message);
  }

  return null;
}

async function cacheMapping(env, hashId, expId) {
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO legacy_hash_mapping (hash_id, exp_id) VALUES (?, ?)")
      .bind(hashId, expId)
      .run();
  } catch (err) {
    console.warn("Failed to write legacy mapping to cache table:", err.message);
  }
}
