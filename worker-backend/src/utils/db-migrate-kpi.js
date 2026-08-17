/**
 * ============================================================
 * Database Migration Runner — KPI Module
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Adds KPI Assignment, Submission, Scoring, Deletion Requests,
 * and Score Query tables to the D1 database.
 *
 * Safe to run multiple times — all statements are idempotent.
 * Run via: POST /api/admin/run-migrations-kpi (Admin only)
 * ============================================================
 */

import { staticLog } from "./logger.js";

const MIGRATIONS_KPI = [
  // ── Table: kpi_assignments ──────────────────────────────────────────────────
  // One row per employee per financial year. Holds KRA definitions and weights.
  {
    name: "create_kpi_assignments",
    sql: `CREATE TABLE IF NOT EXISTS kpi_assignments (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id             TEXT NOT NULL,
      financial_year      TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'draft',
      job_role_weight     REAL NOT NULL DEFAULT 80,
      esms_weight         REAL NOT NULL DEFAULT 0,
      core_values_weight  REAL NOT NULL DEFAULT 20,
      starts_from         TEXT,
      kras                TEXT,
      rejection_reason    TEXT,
      approved_by         TEXT,
      approved_at         TEXT,
      submitted_at        TEXT,
      created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at          TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, financial_year)
    )`
  },
  {
    name: "idx_kpi_assignments_user_fy",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_assignments_user_fy ON kpi_assignments(user_id, financial_year)"
  },
  {
    name: "idx_kpi_assignments_status",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_assignments_status ON kpi_assignments(status)"
  },

  // ── Table: kpi_submissions ─────────────────────────────────────────────────
  // One row per employee per month. Tracks self-assessment and scoring status.
  {
    name: "create_kpi_submissions",
    sql: `CREATE TABLE IF NOT EXISTS kpi_submissions (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id       INTEGER NOT NULL,
      user_id             TEXT NOT NULL,
      period_month        TEXT NOT NULL,
      financial_year      TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'draft',
      self_data           TEXT,
      manager_scores      TEXT,
      core_values_ratings TEXT,
      anything_to_add     TEXT,
      self_total_score    REAL,
      final_total_score   REAL,
      final_job_score     REAL,
      final_esms_score    REAL,
      final_core_score    REAL,
      return_reason       TEXT,
      scored_by           TEXT,
      scored_at           TEXT,
      submitted_at        TEXT,
      finalized_at        TEXT,
      created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at          TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, period_month, financial_year)
    )`
  },
  {
    name: "idx_kpi_submissions_user_month",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_submissions_user_month ON kpi_submissions(user_id, period_month)"
  },
  {
    name: "idx_kpi_submissions_assignment",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_submissions_assignment ON kpi_submissions(assignment_id)"
  },
  {
    name: "idx_kpi_submissions_status",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_submissions_status ON kpi_submissions(status)"
  },

  // ── Table: kpi_deletion_requests ───────────────────────────────────────────
  // Employee can request deletion of a finalized monthly submission.
  {
    name: "create_kpi_deletion_requests",
    sql: `CREATE TABLE IF NOT EXISTS kpi_deletion_requests (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id   INTEGER NOT NULL,
      user_id         TEXT NOT NULL,
      period_month    TEXT NOT NULL,
      financial_year  TEXT NOT NULL,
      reason          TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      reviewed_by     TEXT,
      reviewed_at     TEXT,
      review_note     TEXT,
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(submission_id)
    )`
  },
  {
    name: "idx_kpi_deletion_requests_user",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_deletion_requests_user ON kpi_deletion_requests(user_id)"
  },
  {
    name: "idx_kpi_deletion_requests_status",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_deletion_requests_status ON kpi_deletion_requests(status)"
  },

  // ── Table: kpi_queries ─────────────────────────────────────────────────────
  // Employee raises a score revision query; manager responds.
  {
    name: "create_kpi_queries",
    sql: `CREATE TABLE IF NOT EXISTS kpi_queries (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id   INTEGER NOT NULL,
      user_id         TEXT NOT NULL,
      period_month    TEXT NOT NULL,
      financial_year  TEXT NOT NULL,
      query_text      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'open',
      response_text   TEXT,
      responded_by    TEXT,
      responded_at    TEXT,
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: "idx_kpi_queries_user",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_queries_user ON kpi_queries(user_id)"
  },
  {
    name: "idx_kpi_queries_submission",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_queries_submission ON kpi_queries(submission_id)"
  },
  {
    name: "idx_kpi_queries_status",
    sql: "CREATE INDEX IF NOT EXISTS idx_kpi_queries_status ON kpi_queries(status)"
  }
];

/**
 * Run all KPI module migrations against the given D1 database binding.
 * Safe to call multiple times.
 *
 * @param {D1Database} db - The Cloudflare D1 database binding (env.DB)
 * @returns {Promise<{applied: string[], errors: string[]}>}
 */
export async function runMigrationsKpi(db) {
  const applied = [];
  const errors  = [];

  staticLog.info("Starting KPI module database migrations", { total: MIGRATIONS_KPI.length });

  for (const migration of MIGRATIONS_KPI) {
    try {
      await db.prepare(migration.sql).run();
      applied.push(migration.name);
      staticLog.info(`KPI Migration applied: ${migration.name}`);
    } catch (e) {
      if (
        e.message &&
        (e.message.includes("already exists") ||
         e.message.includes("duplicate column") ||
         e.message.includes("UNIQUE constraint"))
      ) {
        applied.push(`${migration.name} (already existed)`);
        continue;
      }
      errors.push(`${migration.name}: ${e.message}`);
      staticLog.error(`KPI Migration failed: ${migration.name}`, { error: e.message });
    }
  }

  staticLog.info("KPI module migrations complete", { applied: applied.length, errors: errors.length });
  return { applied, errors };
}

/**
 * Check which KPI tables exist in the database.
 * @param {D1Database} db
 */
export async function checkKpiTableStatus(db) {
  const result = {};
  for (const table of ["kpi_assignments", "kpi_submissions", "kpi_deletion_requests", "kpi_queries"]) {
    try {
      await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).first();
      result[table] = true;
    } catch (_) {
      result[table] = false;
    }
  }
  return result;
}
