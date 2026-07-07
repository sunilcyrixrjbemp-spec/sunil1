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
  ];

  for (const sql of migrations) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      console.error(`Migration failed: ${e.message}`, sql.slice(0, 80));
    }
  }
}
