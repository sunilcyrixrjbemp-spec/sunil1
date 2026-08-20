-- 0010_penalty_masters.sql: Master Reference Tables for BEMMP Rajasthan Contract Penalty Engine

CREATE TABLE IF NOT EXISTS penalty_critical_equipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_name TEXT NOT NULL UNIQUE,
  equipment_type TEXT DEFAULT 'Critical',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_penalty_critical_eq_name ON penalty_critical_equipments(equipment_name);

CREATE TABLE IF NOT EXISTS penalty_main_hospitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_name TEXT NOT NULL UNIQUE,
  facility_type TEXT DEFAULT 'MCH',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_penalty_main_hosp_name ON penalty_main_hospitals(facility_name);

CREATE TABLE IF NOT EXISTS penalty_asset_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_name TEXT NOT NULL UNIQUE,
  tender_cost REAL NOT NULL DEFAULT 0.0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_penalty_asset_eq_name ON penalty_asset_values(equipment_name);

CREATE TABLE IF NOT EXISTS penalty_standby_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id TEXT NOT NULL UNIQUE,
  call_status TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_penalty_standby_c_id ON penalty_standby_data(complaint_id);

CREATE TABLE IF NOT EXISTS penalty_di_coordinators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_name TEXT NOT NULL,
  hospital_name TEXT,
  di_name TEXT,
  coordinator_name TEXT,
  zone_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_penalty_di_dist ON penalty_di_coordinators(district_name);
CREATE INDEX IF NOT EXISTS idx_penalty_di_hosp ON penalty_di_coordinators(hospital_name);
