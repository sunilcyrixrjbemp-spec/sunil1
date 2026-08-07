/**
 * ============================================================
 * Database Migration Runner v3 — Deduction Traceability & Queue Jobs
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Adds:
 *   - expense_deductions table (Part 6: policy case traceability)
 *   - expense_queue_jobs table  (Part 4: async job tracking)
 *   - policy_case, policy_rule_name columns on expenses table
 *   - queue_job_id, processing_status columns on expenses table
 *
 * Safe to run multiple times — all statements are idempotent.
 * Run via: POST /api/admin/run-migrations-v3 (Admin only)
 * ============================================================
 */

import { staticLog } from "./logger.js";

const MIGRATIONS_V3 = [
  // ── Table: expense_deductions ────────────────────────────────────────────────
  // Stores structured deduction records — one row per deduction per leg per claim.
  // rule_case maps to the 5-case TA/DA policy (1-5). NULL = admin manual deduction.
  {
    name: "create_expense_deductions",
    sql: `CREATE TABLE IF NOT EXISTS expense_deductions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id    INTEGER NOT NULL,
      expense_code  TEXT,
      user_id       TEXT NOT NULL,
      rule_case     INTEGER,
      rule_name     TEXT NOT NULL,
      category      TEXT NOT NULL,
      original_amt  REAL NOT NULL DEFAULT 0.0,
      deducted_amt  REAL NOT NULL DEFAULT 0.0,
      approved_amt  REAL NOT NULL DEFAULT 0.0,
      reason        TEXT,
      applied_by    TEXT NOT NULL DEFAULT 'system',
      itinerary_id  TEXT,
      leg_number    INTEGER,
      created_at    TEXT NOT NULL
    )`
  },
  {
    name: "idx_expense_deductions_expense_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_expense_deductions_expense_id ON expense_deductions(expense_id)"
  },
  {
    name: "idx_expense_deductions_user_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_expense_deductions_user_id ON expense_deductions(user_id)"
  },
  {
    name: "idx_expense_deductions_rule_case",
    sql: "CREATE INDEX IF NOT EXISTS idx_expense_deductions_rule_case ON expense_deductions(rule_case)"
  },

  // ── Table: expense_queue_jobs ────────────────────────────────────────────────
  // Tracks async background job state for each expense submission.
  // job_type: "policy_validate" | "email_notify" | "anomaly_check"
  // status:   "queued" | "processing" | "done" | "failed"
  {
    name: "create_expense_queue_jobs",
    sql: `CREATE TABLE IF NOT EXISTS expense_queue_jobs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id    INTEGER NOT NULL,
      job_type      TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'queued',
      attempts      INTEGER NOT NULL DEFAULT 0,
      last_error    TEXT,
      queued_at     TEXT NOT NULL,
      completed_at  TEXT,
      created_at    TEXT NOT NULL
    )`
  },
  {
    name: "idx_expense_queue_jobs_expense_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_expense_queue_jobs_expense_id ON expense_queue_jobs(expense_id)"
  },
  {
    name: "idx_expense_queue_jobs_status",
    sql: "CREATE INDEX IF NOT EXISTS idx_expense_queue_jobs_status ON expense_queue_jobs(status)"
  },

  // ── Columns: expenses table additions ───────────────────────────────────────
  // policy_case:        which of the 5 locked TA/DA policy rules triggered (NULL = no base deduction)
  // policy_rule_name:   human-readable label, e.g. "Case 2: Home→Base→Errands→Home"
  // queue_job_id:       Cloudflare Queue message ID for tracking async submit jobs
  // processing_status:  "complete" (sync) or "pending_queue" (async, job still processing)
  {
    name: "alter_expenses_add_policy_case",
    sql: "ALTER TABLE expenses ADD COLUMN policy_case INTEGER"
  },
  {
    name: "alter_expenses_add_policy_rule_name",
    sql: "ALTER TABLE expenses ADD COLUMN policy_rule_name TEXT"
  },
  {
    name: "alter_expenses_add_queue_job_id",
    sql: "ALTER TABLE expenses ADD COLUMN queue_job_id TEXT"
  },
  {
    name: "alter_expenses_add_processing_status",
    sql: "ALTER TABLE expenses ADD COLUMN processing_status TEXT DEFAULT 'complete'"
  },

  // ── Performance & Scaling Indexes ──────────────────────────────────────────
  {
    name: "idx_users_manager_clean",
    sql: "CREATE INDEX IF NOT EXISTS idx_users_manager_clean ON users(manager)"
  },
  {
    name: "idx_users_zonal_manager_clean",
    sql: "CREATE INDEX IF NOT EXISTS idx_users_zonal_manager_clean ON users(zonal_manager)"
  },
  {
    name: "idx_users_coordinator_clean",
    sql: "CREATE INDEX IF NOT EXISTS idx_users_coordinator_clean ON users(coordinator)"
  },
  {
    name: "idx_expenses_user_year_month",
    sql: "CREATE INDEX IF NOT EXISTS idx_expenses_user_year_month ON expenses(user_id, year, month)"
  },
  {
    name: "idx_facility_details_district",
    sql: "CREATE INDEX IF NOT EXISTS idx_facility_details_district ON facility_details(district_name)"
  },
  {
    name: "idx_assets_inventory_zone_district",
    sql: "CREATE INDEX IF NOT EXISTS idx_assets_inventory_zone_district ON assets_inventory(zone_name, district_name)"
  }
];

/**
 * Run all v3 migrations against the given D1 database binding.
 * Safe to call multiple times — uses CREATE TABLE IF NOT EXISTS and
 * silently skips "already exists" / "duplicate column" errors.
 *
 * @param {D1Database} db - The Cloudflare D1 database binding (env.DB)
 * @returns {Promise<{applied: string[], errors: string[]}>}
 */
export async function runMigrationsV3(db) {
  const applied = [];
  const errors  = [];

  staticLog.info("Starting database migrations v3.0.0", { total: MIGRATIONS_V3.length });

  for (const migration of MIGRATIONS_V3) {
    try {
      await db.prepare(migration.sql).run();
      applied.push(migration.name);
      staticLog.info(`Migration applied: ${migration.name}`);
    } catch (e) {
      // These are expected when running idempotently — skip silently
      if (
        e.message &&
        (e.message.includes("already exists") ||
         e.message.includes("duplicate column") ||
         e.message.includes("UNIQUE constraint") ||
         e.message.includes("no such column: policy_case") === false)
      ) {
        applied.push(`${migration.name} (already existed)`);
        continue;
      }
      errors.push(`${migration.name}: ${e.message}`);
      staticLog.error(`Migration failed: ${migration.name}`, { error: e.message });
    }
  }

  staticLog.info("Database migrations v3.0.0 complete", {
    applied: applied.length,
    errors:  errors.length
  });

  return { applied, errors };
}

/**
 * Check which v3 tables / columns exist in the database.
 * Used by the admin dashboard migration status display.
 *
 * @param {D1Database} db
 * @returns {Promise<Object>} - { tableName: boolean, columnName: boolean }
 */
export async function checkV3TableStatus(db) {
  const result = {};

  // Check tables
  for (const table of ["expense_deductions", "expense_queue_jobs"]) {
    try {
      await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).first();
      result[table] = true;
    } catch (_) {
      result[table] = false;
    }
  }

  // Check columns on expenses table
  for (const col of ["policy_case", "policy_rule_name", "queue_job_id", "processing_status"]) {
    try {
      await db.prepare(`SELECT ${col} FROM expenses LIMIT 1`).first();
      result[`expenses.${col}`] = true;
    } catch (_) {
      result[`expenses.${col}`] = false;
    }
  }

  return result;
}
