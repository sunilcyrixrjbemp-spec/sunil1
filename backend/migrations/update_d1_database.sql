-- SQL Migration script to update Cloudflare D1 production database schema
-- Run this script using wrangler:
-- npx wrangler d1 execute <database-name> --file=backend/migrations/update_d1_database.sql --remote

-- 1. Create table expense_edit_logs
CREATE TABLE IF NOT EXISTS expense_edit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER,
    leg_number INTEGER,
    field_name VARCHAR(100),
    old_value VARCHAR(255),
    new_value VARCHAR(255),
    comment TEXT,
    editor_name VARCHAR(100),
    editor_role VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add columns to expenses table (ignore errors if columns already exist)
ALTER TABLE expenses ADD COLUMN original_amount FLOAT DEFAULT 0.0;
ALTER TABLE expenses ADD COLUMN original_da_amount FLOAT DEFAULT 0.0;
ALTER TABLE expenses ADD COLUMN original_hotel_amount FLOAT DEFAULT 0.0;
ALTER TABLE expenses ADD COLUMN original_other_expense_amount FLOAT DEFAULT 0.0;
ALTER TABLE expenses ADD COLUMN original_local_purchase_amount FLOAT DEFAULT 0.0;
ALTER TABLE expenses ADD COLUMN calibration_count INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN mobilise_count INTEGER DEFAULT 0;

-- 3. Add columns to expense_itineraries table (ignore errors if columns already exist)
ALTER TABLE expense_itineraries ADD COLUMN original_distance_km FLOAT DEFAULT 0.0;
ALTER TABLE expense_itineraries ADD COLUMN original_travel_amount FLOAT DEFAULT 0.0;
ALTER TABLE expense_itineraries ADD COLUMN original_sub_amount FLOAT DEFAULT 0.0;
ALTER TABLE expense_itineraries ADD COLUMN original_da_amount FLOAT DEFAULT 0.0;
ALTER TABLE expense_itineraries ADD COLUMN original_hotel_amount FLOAT DEFAULT 0.0;
ALTER TABLE expense_itineraries ADD COLUMN original_other_amount FLOAT DEFAULT 0.0;
ALTER TABLE expense_itineraries ADD COLUMN original_local_purchase FLOAT DEFAULT 0.0;
ALTER TABLE expense_itineraries ADD COLUMN calibration_count INTEGER DEFAULT 0;
ALTER TABLE expense_itineraries ADD COLUMN mobilise_count INTEGER DEFAULT 0;
