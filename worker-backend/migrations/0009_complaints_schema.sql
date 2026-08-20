-- Migration: 0009_complaints_schema.sql
-- Standalone Complaint Management Data Ingestion System (Fresh Implementation)

DROP TABLE IF EXISTS complaints;

CREATE TABLE complaints (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id              TEXT NOT NULL UNIQUE,
  district_name             TEXT,
  hospital_type             TEXT,
  hospital_name             TEXT,
  bar_code                  TEXT,
  equipment_name            TEXT,
  equipment_model           TEXT,
  complaint_raise_date      TEXT,   -- store as ISO 'YYYY-MM-DD'
  complaint_close_date      TEXT,
  complaint_status          TEXT,
  total_downtime             TEXT,
  estimated_cost            REAL,
  penalty_days               INTEGER,
  complaint_final_close     TEXT,
  attend_date                TEXT,
  attend_penalty              REAL,
  delay_penalty                REAL,
  total_penalty               REAL,
  is_under_warranty          TEXT,
  service_provider_name      TEXT,
  attended_service_engg_id    TEXT,
  closing_service_engg_id     TEXT,
  created_at                 TEXT DEFAULT (datetime('now')),
  updated_at                 TEXT DEFAULT (datetime('now')),
  uploaded_by                TEXT   -- user id/email of uploader
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_complaint_id ON complaints(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(complaint_status);
CREATE INDEX IF NOT EXISTS idx_complaints_district ON complaints(district_name);

-- Access control: who is allowed to upload complaint data
CREATE TABLE IF NOT EXISTS complaint_upload_permissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL UNIQUE,   -- FK to existing users table
  granted_by   TEXT NOT NULL,          -- admin user id who granted access
  granted_at   TEXT DEFAULT (datetime('now')),
  is_active    INTEGER DEFAULT 1
);

-- Job tracking for large async uploads
CREATE TABLE IF NOT EXISTS complaint_upload_jobs (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id               TEXT NOT NULL UNIQUE,
  file_key             TEXT NOT NULL,     -- R2 object key
  uploaded_by          TEXT NOT NULL,
  total_rows           INTEGER DEFAULT 0,
  processed_rows       INTEGER DEFAULT 0,
  inserted_rows        INTEGER DEFAULT 0,
  updated_rows         INTEGER DEFAULT 0,
  skipped_final_closed INTEGER DEFAULT 0,
  skipped_invalid      INTEGER DEFAULT 0,
  status               TEXT DEFAULT 'pending', -- pending | processing | completed | failed
  error_message        TEXT,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);
