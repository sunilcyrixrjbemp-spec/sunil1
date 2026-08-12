-- Financial Audit Trail & Change Ledger Table for Cloudflare D1
CREATE TABLE IF NOT EXISTS expense_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  expense_code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'user',
  action_type TEXT NOT NULL, -- 'SUBMITTED', 'POLICY_DEDUCTION', 'MANAGER_EDIT', 'APPROVED', 'REJECTED', 'RETURNED'
  field_name TEXT,           -- 'total_amount', 'da_amount', 'ta_amount', 'hotel_amount', 'other_expense_amount'
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  snapshot_json TEXT,        -- Full financial snapshot JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_expense_code ON expense_audit_logs(expense_code);
CREATE INDEX IF NOT EXISTS idx_audit_expense_id ON expense_audit_logs(expense_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON expense_audit_logs(user_id);
