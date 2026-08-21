/**
 * ============================================================
 * TRC ERP v3.0 Database Migration Runner
 * Cyrix Field Connect — Technical Repair Center (TRC)
 * ============================================================
 * Tables created:
 *   1. trc_machine_receive   - Primary warehouse intake & machine metadata
 *   2. trc_assignment        - Engineer assignment history
 *   3. trc_diagnosis         - Equipment diagnostic results & severity
 *   4. trc_spare_requests    - Spare part requisitions & status
 *   5. trc_repairs           - Repair activities, parts used, calibration
 *   6. trc_qc                - 6-point Quality Check checklist
 *   7. trc_media             - Video & photo attachments stored in R2
 *   8. trc_status_history    - 11-step complete audit lifecycle
 *   9. trc_email_logs        - Automated HTML email dispatch records
 *
 * Safe to run multiple times (Idempotent).
 * ============================================================
 */

import { staticLog } from "./logger.js";

export const TRC_MIGRATIONS = [
  // ── 1. Table: trc_machine_receive ──────────────────────────────────────────
  {
    name: "create_trc_machine_receive",
    sql: `CREATE TABLE IF NOT EXISTS trc_machine_receive (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      trc_number            TEXT UNIQUE NOT NULL,
      district              TEXT NOT NULL,
      zone                  TEXT,
      hospital_name         TEXT NOT NULL,
      equipment_name        TEXT NOT NULL,
      equipment_model       TEXT,
      barcode               TEXT NOT NULL,
      serial_number         TEXT,
      complaint_id          TEXT,
      di_name               TEXT,
      coordinator_name      TEXT,
      dm_name               TEXT,
      complaint_date        TEXT,
      oem_name              TEXT,
      machine_status_prior  TEXT,
      receive_date          TEXT NOT NULL,
      receive_time          TEXT NOT NULL,
      received_by_id        TEXT NOT NULL,
      received_by_name      TEXT NOT NULL,
      condition_received    TEXT NOT NULL DEFAULT 'Good',
      accessories_received  TEXT, -- JSON Array string e.g. ["Adapter","Probe","Cable"]
      receive_notes         TEXT,
      video_url             TEXT,
      front_photo_url       TEXT,
      back_photo_url        TEXT,
      damage_photo_url      TEXT,
      current_status        TEXT NOT NULL DEFAULT 'Machine Received in TRC',
      assigned_engineer_id  TEXT,
      assigned_engineer_name TEXT,
      assigned_date         TEXT,
      created_by            TEXT NOT NULL,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    )`
  },
  {
    name: "idx_trc_receive_trc_number",
    sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_trc_receive_trc_number ON trc_machine_receive(trc_number)"
  },
  {
    name: "idx_trc_receive_barcode",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_receive_barcode ON trc_machine_receive(barcode)"
  },
  {
    name: "idx_trc_receive_district",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_receive_district ON trc_machine_receive(district)"
  },
  {
    name: "idx_trc_receive_status",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_receive_status ON trc_machine_receive(current_status)"
  },
  {
    name: "idx_trc_receive_engineer",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_receive_engineer ON trc_machine_receive(assigned_engineer_id)"
  },
  {
    name: "add_warehouse_receive_date_col",
    sql: "ALTER TABLE trc_machine_receive ADD COLUMN warehouse_receive_date TEXT"
  },

  // ── 2. Table: trc_assignment ───────────────────────────────────────────────
  {
    name: "create_trc_assignment",
    sql: `CREATE TABLE IF NOT EXISTS trc_assignment (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      trc_id                INTEGER NOT NULL,
      trc_number            TEXT NOT NULL,
      assigned_engineer_id  TEXT NOT NULL,
      assigned_engineer_name TEXT NOT NULL,
      assigned_by_id        TEXT NOT NULL,
      assigned_by_name      TEXT NOT NULL,
      assign_date           TEXT NOT NULL,
      assign_time           TEXT NOT NULL,
      notes                 TEXT,
      status                TEXT DEFAULT 'Assigned',
      created_by            TEXT NOT NULL,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    )`
  },
  {
    name: "idx_trc_assignment_trc_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_assignment_trc_id ON trc_assignment(trc_id)"
  },
  {
    name: "idx_trc_assignment_engineer",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_assignment_engineer ON trc_assignment(assigned_engineer_id)"
  },

  // ── 3. Table: trc_diagnosis ────────────────────────────────────────────────
  {
    name: "create_trc_diagnosis",
    sql: `CREATE TABLE IF NOT EXISTS trc_diagnosis (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      trc_id                INTEGER NOT NULL,
      trc_number            TEXT NOT NULL,
      diagnosis_date        TEXT NOT NULL,
      diagnosis_time        TEXT NOT NULL,
      issue_category        TEXT NOT NULL, -- Electrical, Mechanical, PCB, Calibration, Software, Display, Sensor, Other
      root_cause            TEXT NOT NULL,
      issue_description     TEXT NOT NULL,
      repairable            TEXT NOT NULL DEFAULT 'Yes', -- Yes / No
      severity              TEXT NOT NULL DEFAULT 'Medium', -- Critical, High, Medium, Low
      diagnosis_video_url   TEXT,
      diagnosis_photos      TEXT, -- JSON Array string of URLs
      diagnosed_by_id       TEXT NOT NULL,
      diagnosed_by_name     TEXT NOT NULL,
      created_by            TEXT NOT NULL,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    )`
  },
  {
    name: "idx_trc_diagnosis_trc_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_diagnosis_trc_id ON trc_diagnosis(trc_id)"
  },

  // ── 4. Table: trc_spare_requests ───────────────────────────────────────────
  {
    name: "create_trc_spare_requests",
    sql: `CREATE TABLE IF NOT EXISTS trc_spare_requests (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      trc_id                INTEGER NOT NULL,
      trc_number            TEXT NOT NULL,
      spare_required        TEXT NOT NULL DEFAULT 'Yes',
      part_name             TEXT NOT NULL,
      part_number           TEXT,
      quantity              INTEGER NOT NULL DEFAULT 1,
      part_photo_url        TEXT,
      damaged_part_photo_url TEXT,
      remarks               TEXT,
      status                TEXT NOT NULL DEFAULT 'Pending', -- Pending, Ordered, Received at TRC, Rejected
      email_sent            INTEGER NOT NULL DEFAULT 0,
      email_recipients      TEXT, -- JSON array
      email_sent_at         TEXT,
      requested_by_id       TEXT NOT NULL,
      requested_by_name     TEXT NOT NULL,
      created_by            TEXT NOT NULL,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    )`
  },
  {
    name: "idx_trc_spares_trc_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_spares_trc_id ON trc_spare_requests(trc_id)"
  },
  {
    name: "idx_trc_spares_status",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_spares_status ON trc_spare_requests(status)"
  },

  // ── 5. Table: trc_repairs ──────────────────────────────────────────────────
  {
    name: "create_trc_repairs",
    sql: `CREATE TABLE IF NOT EXISTS trc_repairs (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      trc_id                INTEGER NOT NULL,
      trc_number            TEXT NOT NULL,
      repair_start_date     TEXT NOT NULL,
      repair_start_time     TEXT,
      repair_end_date       TEXT NOT NULL,
      repair_end_time       TEXT,
      activity_description  TEXT NOT NULL,
      parts_used            TEXT, -- JSON string or comma separated
      calibration_done      TEXT NOT NULL DEFAULT 'No', -- Yes / No
      testing_done          TEXT NOT NULL DEFAULT 'No', -- Yes / No
      repair_summary        TEXT NOT NULL,
      repair_video_url      TEXT,
      repair_photos         TEXT, -- JSON Array string
      repaired_by_id        TEXT NOT NULL,
      repaired_by_name      TEXT NOT NULL,
      created_by            TEXT NOT NULL,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    )`
  },
  {
    name: "idx_trc_repairs_trc_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_repairs_trc_id ON trc_repairs(trc_id)"
  },

  // ── 6. Table: trc_qc ───────────────────────────────────────────────────────
  {
    name: "create_trc_qc",
    sql: `CREATE TABLE IF NOT EXISTS trc_qc (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      trc_id                INTEGER NOT NULL,
      trc_number            TEXT NOT NULL,
      power_on              INTEGER NOT NULL DEFAULT 0,
      self_test_passed      INTEGER NOT NULL DEFAULT 0,
      calibration_passed    INTEGER NOT NULL DEFAULT 0,
      display_ok            INTEGER NOT NULL DEFAULT 0,
      accessories_working   INTEGER NOT NULL DEFAULT 0,
      final_functional_test INTEGER NOT NULL DEFAULT 0,
      all_checks_passed     INTEGER NOT NULL DEFAULT 0,
      qc_video_url          TEXT,
      qc_remarks            TEXT,
      qc_by_id              TEXT NOT NULL,
      qc_by_name            TEXT NOT NULL,
      qc_date               TEXT NOT NULL,
      qc_time               TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'Passed', -- Passed / Failed / Conditional
      created_by            TEXT NOT NULL,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    )`
  },
  {
    name: "idx_trc_qc_trc_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_qc_trc_id ON trc_qc(trc_id)"
  },

  // ── 7. Table: trc_media ────────────────────────────────────────────────────
  {
    name: "create_trc_media",
    sql: `CREATE TABLE IF NOT EXISTS trc_media (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      trc_id                INTEGER NOT NULL,
      trc_number            TEXT,
      stage                 TEXT NOT NULL, -- Receive, Diagnosis, Spare, Repair, QC, Dispatch
      media_type            TEXT NOT NULL, -- video, photo, document
      media_label           TEXT,          -- e.g. "Front Photo", "Receive Video", "Damaged Part"
      file_url              TEXT NOT NULL,
      r2_key                TEXT,
      original_filename     TEXT,
      file_size             INTEGER,
      content_type          TEXT,
      created_by            TEXT NOT NULL,
      created_at            TEXT NOT NULL
    )`
  },
  {
    name: "idx_trc_media_trc_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_media_trc_id ON trc_media(trc_id)"
  },
  {
    name: "idx_trc_media_stage",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_media_stage ON trc_media(stage)"
  },

  // ── 8. Table: trc_status_history ───────────────────────────────────────────
  {
    name: "create_trc_status_history",
    sql: `CREATE TABLE IF NOT EXISTS trc_status_history (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      trc_id                INTEGER NOT NULL,
      trc_number            TEXT,
      from_status           TEXT,
      to_status             TEXT NOT NULL,
      stage_name            TEXT,
      remarks               TEXT,
      changed_by_id         TEXT NOT NULL,
      changed_by_name       TEXT NOT NULL,
      created_at            TEXT NOT NULL
    )`
  },
  {
    name: "idx_trc_history_trc_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_history_trc_id ON trc_status_history(trc_id)"
  },

  // ── 9. Table: trc_email_logs ───────────────────────────────────────────────
  {
    name: "create_trc_email_logs",
    sql: `CREATE TABLE IF NOT EXISTS trc_email_logs (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      trc_id                INTEGER NOT NULL,
      trc_number            TEXT,
      subject               TEXT NOT NULL,
      recipients            TEXT NOT NULL,
      email_type            TEXT NOT NULL, -- spare_requirement, assignment_alert, qc_ready, dispatch
      body_html             TEXT,
      status                TEXT NOT NULL DEFAULT 'sent',
      sent_by_id            TEXT NOT NULL,
      sent_by_name          TEXT NOT NULL,
      sent_at               TEXT NOT NULL
    )`
  },
  {
    name: "idx_trc_email_logs_trc_id",
    sql: "CREATE INDEX IF NOT EXISTS idx_trc_email_logs_trc_id ON trc_email_logs(trc_id)"
  }
];

/**
 * Execute all TRC database migrations idempotently.
 * @param {object} db - Cloudflare D1 Database binding
 * @returns {Promise<{ success: boolean, applied: string[], errors: string[] }>}
 */
export async function runMigrationsTrc(db) {
  if (!db) {
    return { success: false, applied: [], errors: ["No database instance provided"] };
  }

  const applied = [];
  const errors = [];

  for (const m of TRC_MIGRATIONS) {
    try {
      await db.prepare(m.sql).run();
      applied.push(m.name);
    } catch (err) {
      // Ignore if table/index already exists
      if (!err.message?.includes("already exists")) {
        errors.push(`${m.name}: ${err.message}`);
        staticLog.warn("TRC Migration step warning", { migration: m.name, error: err.message });
      } else {
        applied.push(m.name);
      }
    }
  }

  return { success: errors.length === 0, applied, errors };
}

/**
 * Check TRC table existence status.
 */
export async function checkTrcTableStatus(db) {
  if (!db) return { status: "no_db" };
  const tableNames = [
    "trc_machine_receive",
    "trc_assignment",
    "trc_diagnosis",
    "trc_spare_requests",
    "trc_repairs",
    "trc_qc",
    "trc_media",
    "trc_status_history",
    "trc_email_logs"
  ];

  const results = {};
  for (const name of tableNames) {
    try {
      const res = await db.prepare(`SELECT count(*) as cnt FROM ${name}`).first();
      results[name] = { exists: true, rowCount: res?.cnt || 0 };
    } catch (e) {
      results[name] = { exists: false, error: e.message };
    }
  }
  return results;
}
