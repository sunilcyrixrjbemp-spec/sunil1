/**
 * ============================================================
 * Database Migration Runner v2 — Enterprise Tables
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Adds all 6 enterprise tables (v2.0.0) using safe IF NOT EXISTS.
 * Safe to run multiple times — idempotent.
 * ============================================================
 */

import { staticLog } from "./logger.js";

const MIGRATIONS_V2 = [
  // ── Table 25: File Metadata (R2 Storage Tracking) ─────────────────────────
  {
    name: "create_file_metadata",
    sql: `CREATE TABLE IF NOT EXISTS file_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER,
      expense_code TEXT,
      itinerary_id TEXT,
      travel_name TEXT,
      employee_id TEXT,
      employee_name TEXT,
      original_filename TEXT NOT NULL,
      safe_filename TEXT NOT NULL,
      file_hash TEXT,
      file_size INTEGER,
      content_type TEXT,
      image_width INTEGER,
      image_height INTEGER,
      r2_object_key TEXT,
      r2_url TEXT,
      r2_bucket TEXT,
      r2_folder_path TEXT,
      thumbnail_key TEXT,
      thumbnail_url TEXT,
      upload_source TEXT DEFAULT 'r2',
      gdrive_file_id TEXT,
      migrated_at TEXT,
      category TEXT,
      trip_date TEXT,
      upload_date TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      hospital TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_by TEXT,
      is_archived INTEGER DEFAULT 0,
      archived_at TEXT,
      version_number INTEGER DEFAULT 1,
      parent_file_id INTEGER,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  },
  { name: "idx_file_metadata_expense_id", sql: "CREATE INDEX IF NOT EXISTS idx_file_metadata_expense_id ON file_metadata(expense_id)" },
  { name: "idx_file_metadata_hash",       sql: "CREATE INDEX IF NOT EXISTS idx_file_metadata_hash ON file_metadata(file_hash)" },
  { name: "idx_file_metadata_employee",   sql: "CREATE INDEX IF NOT EXISTS idx_file_metadata_employee ON file_metadata(employee_id)" },
  { name: "idx_file_metadata_category",   sql: "CREATE INDEX IF NOT EXISTS idx_file_metadata_category ON file_metadata(category)" },
  { name: "idx_file_metadata_source",     sql: "CREATE INDEX IF NOT EXISTS idx_file_metadata_source ON file_metadata(upload_source)" },
  { name: "idx_file_metadata_deleted",    sql: "CREATE INDEX IF NOT EXISTS idx_file_metadata_deleted ON file_metadata(is_deleted)" },

  // ── Table 26: Audit Logs (Compliance & Security) ──────────────────────────
  {
    name: "create_audit_logs",
    sql: `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      performed_by_id TEXT,
      performed_by_name TEXT,
      performed_by_role TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      request_id TEXT,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL
    )`
  },
  { name: "idx_audit_entity",  sql: "CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)" },
  { name: "idx_audit_user",    sql: "CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(performed_by_id)" },
  { name: "idx_audit_action",  sql: "CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)" },
  { name: "idx_audit_created", sql: "CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)" },

  // ── Table 27: Analytics Events ─────────────────────────────────────────────
  {
    name: "create_analytics_events",
    sql: `CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_name TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT,
      page_url TEXT,
      referrer TEXT,
      device_type TEXT,
      browser TEXT,
      os TEXT,
      country TEXT,
      ip_hash TEXT,
      duration_ms INTEGER,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    )`
  },
  { name: "idx_analytics_user_date", sql: "CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON analytics_events(user_id, created_at)" },
  { name: "idx_analytics_event",     sql: "CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event_type, event_name)" },
  { name: "idx_analytics_session",   sql: "CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id)" },
  { name: "idx_analytics_created",   sql: "CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at)" },

  // ── Table 28: Email Logs ───────────────────────────────────────────────────
  {
    name: "create_email_logs",
    sql: `CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      recipient_user_id TEXT,
      subject TEXT NOT NULL,
      template_name TEXT,
      status TEXT DEFAULT 'queued',
      attempts INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      sent_at TEXT,
      opened_at TEXT,
      error_message TEXT,
      message_id TEXT,
      provider TEXT DEFAULT 'cloudflare',
      priority INTEGER DEFAULT 5,
      related_entity_type TEXT,
      related_entity_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  },
  { name: "idx_email_status",    sql: "CREATE INDEX IF NOT EXISTS idx_email_status ON email_logs(status)" },
  { name: "idx_email_recipient", sql: "CREATE INDEX IF NOT EXISTS idx_email_recipient ON email_logs(recipient_email)" },
  { name: "idx_email_created",   sql: "CREATE INDEX IF NOT EXISTS idx_email_created ON email_logs(created_at)" },

  // ── Table 29: System Metrics ───────────────────────────────────────────────
  {
    name: "create_system_metrics",
    sql: `CREATE TABLE IF NOT EXISTS system_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      unit TEXT,
      tags_json TEXT,
      recorded_at TEXT NOT NULL
    )`
  },
  { name: "idx_metrics_type", sql: "CREATE INDEX IF NOT EXISTS idx_metrics_type ON system_metrics(metric_type)" },
  { name: "idx_metrics_date", sql: "CREATE INDEX IF NOT EXISTS idx_metrics_date ON system_metrics(recorded_at)" },

  // ── Table 30: Approval Tokens (One-Click Email Approval) ──────────────────
  {
    name: "create_approval_tokens",
    sql: `CREATE TABLE IF NOT EXISTS approval_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL,
      expense_code TEXT,
      approver_id TEXT NOT NULL,
      approver_email TEXT,
      action TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      used_from_ip TEXT,
      is_revoked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )`
  },
  { name: "idx_approval_tokens_hash",     sql: "CREATE INDEX IF NOT EXISTS idx_approval_tokens_hash ON approval_tokens(token_hash)" },
  { name: "idx_approval_tokens_expense",  sql: "CREATE INDEX IF NOT EXISTS idx_approval_tokens_expense ON approval_tokens(expense_id)" },
  { name: "idx_approval_tokens_approver", sql: "CREATE INDEX IF NOT EXISTS idx_approval_tokens_approver ON approval_tokens(approver_id)" },

  // ── Additional Missing Index on expenses (expense_code lookup) ─────────────
  { name: "idx_expenses_expense_code", sql: "CREATE INDEX IF NOT EXISTS idx_expenses_expense_code ON expenses(expense_code)" },
];

/**
 * Run all v2 enterprise migrations.
 * Safe to run multiple times (idempotent via IF NOT EXISTS).
 *
 * @param {Object} db - D1 database binding (env.DB or env._originalDB)
 * @returns {Promise<{ applied: string[], errors: string[] }>}
 */
export async function runMigrationsV2(db) {
  const applied = [];
  const errors = [];

  staticLog.info("Starting database migrations v2.0.0", { total: MIGRATIONS_V2.length });

  for (const migration of MIGRATIONS_V2) {
    try {
      await db.prepare(migration.sql).run();
      applied.push(migration.name);
      staticLog.info(`Migration applied: ${migration.name}`);
    } catch (e) {
      // Index already exists errors are not real errors — skip silently
      if (e.message && (
        e.message.includes("already exists") ||
        e.message.includes("duplicate column")
      )) {
        applied.push(migration.name + " (already existed)");
        continue;
      }
      errors.push(`${migration.name}: ${e.message}`);
      staticLog.error(`Migration failed: ${migration.name}`, { error: e.message });
    }
  }

  staticLog.info("Database migrations v2.0.0 complete", {
    applied: applied.length,
    errors: errors.length,
  });

  return { applied, errors };
}

/**
 * Check which v2 tables exist in the database.
 * Useful for the admin dashboard migration status.
 *
 * @param {Object} db
 * @returns {Promise<Object>} - { tableName: boolean }
 */
export async function checkV2TableStatus(db) {
  const tables = [
    "file_metadata", "audit_logs", "analytics_events",
    "email_logs", "system_metrics", "approval_tokens"
  ];

  const status = {};
  for (const table of tables) {
    try {
      await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).first();
      status[table] = true;
    } catch (_) {
      status[table] = false;
    }
  }
  return status;
}
