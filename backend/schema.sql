-- Cloudflare D1 Schema definitions for Expense Management System

-- Drop tables if they exist
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS password_histories;
DROP TABLE IF EXISTS otps;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS users;

-- 1. Users Table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    e_code TEXT,
    name TEXT NOT NULL,
    hashed_password TEXT NOT NULL,
    user_status TEXT DEFAULT 'active', -- active, locked, disabled
    date_of_joining TEXT, -- ISO format string (YYYY-MM-DD)
    date_of_birth TEXT, -- ISO format string (YYYY-MM-DD)
    e_upkaran_id TEXT,
    grade TEXT,
    district TEXT,
    zone TEXT,
    manager TEXT,
    zonal_manager TEXT,
    coordinator TEXT,
    failed_attempt INTEGER DEFAULT 0,
    mobile_number TEXT,
    mail_id TEXT,
    designation TEXT,
    role TEXT DEFAULT 'Engineer',
    type TEXT,
    allowed_windows TEXT DEFAULT 'home,approval,expense,analysis,report,help,profile',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_user_id ON users(user_id);

-- 2. Password Histories Table
CREATE TABLE password_histories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Login Logs Table
CREATE TABLE login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    login_status TEXT NOT NULL, -- success, failed, locked
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_logs_user_id ON login_logs(user_id);

-- 4. OTPs Table
CREATE TABLE otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    otp_type TEXT NOT NULL, -- reset_password, unlock_account
    expires_at TEXT NOT NULL, -- datetime string
    is_used INTEGER DEFAULT 0, -- boolean (0 or 1)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_otps_user_id ON otps(user_id);

-- 5. Expenses Table
CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'draft', -- draft, submitted, approved, rejected
    travel_mode TEXT, -- bike, car, public
    itinerary TEXT, -- JSON string
    description TEXT,
    attachments TEXT, -- JSON array string
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Approvals Table
CREATE TABLE approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    approver_id INTEGER NOT NULL,
    level_number INTEGER DEFAULT 1,
    status TEXT NOT NULL, -- pending, approved, rejected, waiting, cancelled
    comments TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY(approver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Assets Table
CREATE TABLE assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    asset_type TEXT,
    zone TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial Admin User
-- Password: Sunil@9784 (Hashed: $2b$12$v3CUpUmHcZjuvNc5Xi03qOw6wHMWdxPFhylkutzQM/EmVqOIEw8Zy)
INSERT INTO users (
    user_id, e_code, name, hashed_password, user_status, 
    date_of_joining, date_of_birth, e_upkaran_id, grade, 
    district, zone, manager, zonal_manager, coordinator, 
    failed_attempt, mobile_number, mail_id, designation, role, type, allowed_windows
) VALUES (
    'Admin', NULL, 'Admin System', '$2b$12$v3CUpUmHcZjuvNc5Xi03qOw6wHMWdxPFhylkutzQM/EmVqOIEw8Zy', 'active',
    '2025-01-13', '2003-07-10', NULL, 'A',
    'All', 'All', 'admin', 'admin', 'admin',
    0, '9876543210', 'admin@cyrixhealthcare.com', 'Admin', 'Admin', 'System', 'home,admin,approval,expense,analysis,report,help,profile'
);

-- Seed initial password history for Admin
INSERT INTO password_histories (user_id, hashed_password) 
VALUES (1, '$2b$12$v3CUpUmHcZjuvNc5Xi03qOw6wHMWdxPFhylkutzQM/EmVqOIEw8Zy');

-- 7. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Seed initial admin role
INSERT OR IGNORE INTO user_roles (user_id, role) VALUES ('Admin', 'Admin');

-- 8. Approval Hierarchies Table
CREATE TABLE IF NOT EXISTS approval_hierarchies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- 9. Hierarchy Requesters Table
CREATE TABLE IF NOT EXISTS hierarchy_requesters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hierarchy_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL UNIQUE,
    FOREIGN KEY(hierarchy_id) REFERENCES approval_hierarchies(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Hierarchy Approvers Table
CREATE TABLE IF NOT EXISTS hierarchy_approvers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hierarchy_id INTEGER NOT NULL,
    level_number INTEGER NOT NULL,
    approver_id INTEGER NOT NULL,
    UNIQUE(hierarchy_id, level_number),
    FOREIGN KEY(hierarchy_id) REFERENCES approval_hierarchies(id) ON DELETE CASCADE,
    FOREIGN KEY(approver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 11. Engineer Advances Table
CREATE TABLE IF NOT EXISTS engineer_advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    advance_amount REAL DEFAULT 0.0,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month, year)
);
CREATE INDEX IF NOT EXISTS idx_engineer_advances_user ON engineer_advances(user_id);

