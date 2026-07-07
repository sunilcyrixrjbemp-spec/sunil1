/**
 * DB Migration helper - creates missing tables if they don't exist.
 * Run this from the Cloudflare Worker init or as a one-time migration.
 */

export async function runMigrations(db) {
  const migrations = [
    // OTPs table (required for forgot_password and unlock_account flows, matches FastAPI schema)
    `CREATE TABLE IF NOT EXISTS otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      otp_type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      is_used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Login logs table (required for audit trail)
    `CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT,
      created_at TEXT
    )`,

    // Notifications table (required for alerts)
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    // KPI Appraisals table (to store performance appraisal data)
    `CREATE TABLE IF NOT EXISTS kpi_appraisals (
      user_id TEXT NOT NULL,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      self_achieved_values TEXT,
      manager_achieved_values TEXT,
      core_ratings TEXT,
      submitted_by_self INTEGER DEFAULT 0,
      submitted_by_manager INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, month, year)
    )`
  ];

  for (const sql of migrations) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      console.error(`Migration failed: ${e.message}`, sql.slice(0, 80));
    }
  }
}
