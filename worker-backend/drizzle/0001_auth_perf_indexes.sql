-- Additional High-Performance Indexes for Cloudflare D1
CREATE INDEX IF NOT EXISTS idx_users_user_id_lower ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_e_code ON users(e_code);
CREATE INDEX IF NOT EXISTS idx_users_mail_id ON users(mail_id);
CREATE INDEX IF NOT EXISTS idx_users_mobile_number ON users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_expenses_user_year_month_id ON expenses(user_id, year, month, id DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_year_month_id ON expenses(year, month, id DESC);
