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
    )`,
    // asset_value_master table
    `CREATE TABLE IF NOT EXISTS asset_value_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      equipment_name TEXT NOT NULL, 
      rmsc_tender_cost REAL NOT NULL
    )`,
    // assets_inventory table
    `CREATE TABLE IF NOT EXISTS assets_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district_name TEXT,
      hospital_name TEXT,
      department_name TEXT,
      group_name TEXT,
      equipment_name TEXT,
      model_name TEXT,
      serial_no TEXT,
      equipment_category TEXT,
      qr_code TEXT UNIQUE,
      stock_register_page_no TEXT,
      received_date TEXT,
      installation_date TEXT,
      inventory_entry_date TEXT,
      moic_verified_date TEXT,
      po_date TEXT,
      po_cost TEXT,
      inventory_status TEXT,
      equipment_status TEXT,
      supplier TEXT,
      warranty_details TEXT,
      asset_value TEXT,
      parsed_asset_value REAL,
      di_name TEXT,
      dm_name TEXT,
      coordinator_name TEXT,
      zone_name TEXT,
      hospital_type TEXT,
      facility_type TEXT,
      equipment_type TEXT,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of migrations) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      console.error(`Migration failed: ${e.message}`, sql.slice(0, 80));
    }
  }

  // Seed local asset_value_master if empty
  try {
    const countRes = await db.prepare("SELECT COUNT(*) as count FROM asset_value_master").first();
    if (countRes && countRes.count === 0) {
      const seedValues = [
        ["Digital Zone Monitor", 28000.0],
        ["MicroMGIT Fluorescence Reader", 467000.0],
        ["T-Piece Resuscitator", 27000.0],
        ["Patient Warmer", 107000.0],
        ["ECG Machine Single Channel", 40000.0]
      ];
      for (const [name, cost] of seedValues) {
        await db.prepare("INSERT INTO asset_value_master (equipment_name, rmsc_tender_cost) VALUES (?, ?)").bind(name, cost).run();
      }
    }
  } catch (err) {
    console.error("Failed to seed asset_value_master:", err.message);
  }

  // Seed local assets_inventory if empty
  try {
    const invCountRes = await db.prepare("SELECT COUNT(*) as count FROM assets_inventory").first();
    if (invCountRes && invCountRes.count === 0) {
      await db.prepare(`
        INSERT INTO assets_inventory (
          district_name, hospital_name, equipment_name, model_name, serial_no, qr_code, inventory_status, asset_value, parsed_asset_value
        ) VALUES (
          'Udaipur', 'Khandi Ovari Nicha Fala Phc Udaipur', 'ECG Machine Single Channel', 'Model Not Available', 'V101s21071775', '(8004890615671) 67113689', 'Verified Inventory', '40000', 40000.0
        )
      `).run();
    }
  } catch (err) {
    console.error("Failed to seed assets_inventory:", err.message);
  }

  // Self-healing database repair: Set local_purchase to original_local_purchase if it is 0/null and original is > 0
  try {
    await db.prepare(`
      UPDATE expense_itineraries 
      SET local_purchase = original_local_purchase 
      WHERE (local_purchase = 0 OR local_purchase IS NULL) 
        AND original_local_purchase > 0
    `).run();
    console.log("Successfully executed local_purchase self-healing query.");
  } catch (err) {
    console.error("Failed to execute local_purchase self-healing query:", err.message);
  }
}
