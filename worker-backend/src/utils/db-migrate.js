/**
 * DB Migration helper - creates missing tables if they don't exist.
 * Run this from the Cloudflare Worker init or as a one-time migration.
 */

export async function runMigrations(db) {
  const migrations = [
    // OTP Tokens table (required for forgot_password and unlock_account flows)
    `CREATE TABLE IF NOT EXISTS otp_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      otp TEXT NOT NULL,
      otp_type TEXT NOT NULL DEFAULT 'forgot_password',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, otp_type)
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
