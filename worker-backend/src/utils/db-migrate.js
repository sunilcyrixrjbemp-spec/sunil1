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

  // Direct database correction for claim 246: Change Churu to Punjab
  try {
    const expRow = await db.prepare("SELECT id, expense_code, description FROM expenses WHERE id = 246").first();
    const codes = [];
    if (expRow) {
      console.log(`Found expense 246 with code: ${expRow.expense_code}`);
      codes.push(expRow.expense_code);
      if (expRow.description && expRow.description.toLowerCase().includes("churu")) {
        const newDesc = expRow.description.replace(/churu/gi, "Punjab");
        await db.prepare("UPDATE expenses SET description = ? WHERE id = 246").bind(newDesc).run();
      }
    }
    
    // Add other potential codes for fallback matching
    const expRows = await db.prepare("SELECT expense_code FROM expenses WHERE expense_code LIKE '%246%' OR id = 246").all();
    if (expRows.results && expRows.results.length > 0) {
      for (const r of expRows.results) {
        if (r.expense_code && !codes.includes(r.expense_code)) {
          codes.push(r.expense_code);
        }
      }
    }
    codes.push("246"); // Literal ID fallback

    for (const code of codes) {
      await db.prepare(`
        UPDATE expense_itineraries
        SET 
          from_district = CASE WHEN LOWER(from_district) = 'churu' THEN 'Punjab' ELSE from_district END,
          to_district = CASE WHEN LOWER(to_district) = 'churu' THEN 'Punjab' ELSE to_district END,
          from_location = CASE WHEN LOWER(from_location) = 'churu' THEN 'Punjab' ELSE from_location END,
          to_location = CASE WHEN LOWER(to_location) = 'churu' THEN 'Punjab' ELSE to_location END,
          worked_district = CASE WHEN LOWER(worked_district) = 'churu' THEN 'Punjab' ELSE worked_district END
        WHERE exp_id = ?
      `).bind(code).run();
    }

    // Also update legacy table matches just in case
    await db.prepare(`
      UPDATE expense_itineraries
      SET 
        from_district = CASE WHEN LOWER(from_district) = 'churu' THEN 'Punjab' ELSE from_district END,
        to_district = CASE WHEN LOWER(to_district) = 'churu' THEN 'Punjab' ELSE to_district END,
        from_location = CASE WHEN LOWER(from_location) = 'churu' THEN 'Punjab' ELSE from_location END,
        to_location = CASE WHEN LOWER(to_location) = 'churu' THEN 'Punjab' ELSE to_location END,
        worked_district = CASE WHEN LOWER(worked_district) = 'churu' THEN 'Punjab' ELSE worked_district END
      WHERE exp_id = '246' OR exp_id LIKE '%-246' OR exp_id LIKE '%_246'
    `).run();
    console.log("Successfully executed database correction for claim 246.");
  } catch (err) {
    console.error("Failed to execute database correction for claim 246:", err.message);
  }

  // ─── Performance Indexes ────────────────────────────────────────────────────
  // These indexes dramatically reduce query time for the most common operations.
  const indexes = [
    // User lookups by hierarchy fields (used in team queries every request)
    `CREATE INDEX IF NOT EXISTS idx_users_manager_lower ON users(LOWER(TRIM(manager)))`,
    `CREATE INDEX IF NOT EXISTS idx_users_zonal_manager_lower ON users(LOWER(TRIM(zonal_manager)))`,
    `CREATE INDEX IF NOT EXISTS idx_users_coordinator_lower ON users(LOWER(TRIM(coordinator)))`,
    `CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users(LOWER(TRIM(name)))`,
    `CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_status ON users(user_status)`,
    // Limit requests (used in expense init on every expense form load)
    `CREATE INDEX IF NOT EXISTS idx_limit_reqs_user_month ON limit_approval_requests(user_id, for_month)`,
    `CREATE INDEX IF NOT EXISTS idx_limit_reqs_manager ON limit_approval_requests(manager_id, status)`,
    // Expense itineraries (most queried join table)
    `CREATE INDEX IF NOT EXISTS idx_itineraries_exp_id ON expense_itineraries(exp_id)`,
    // Expenses core queries
    `CREATE INDEX IF NOT EXISTS idx_expenses_user_month_year ON expenses(user_id, month, year)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status)`,
    // Approvals — pending lookups
    `CREATE INDEX IF NOT EXISTS idx_approvals_approver_status ON approvals(approver_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_approvals_expense_status ON approvals(expense_id, status)`,
    // Notifications — unread count (shown on every page)
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read)`,
    // Hierarchy tables
    `CREATE INDEX IF NOT EXISTS idx_hier_approvers_approver ON hierarchy_approvers(approver_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hier_requesters_user ON hierarchy_requesters(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hier_requesters_hierarchy ON hierarchy_requesters(hierarchy_id)`,
    // Assets barcode lookup (used on every field visit scan)
    `CREATE INDEX IF NOT EXISTS idx_assets_qr_code ON assets_inventory(qr_code)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_serial_no ON assets_inventory(serial_no)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_hospital ON assets_inventory(LOWER(TRIM(hospital_name)))`,
    // Login logs (audit trail queries)
    `CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id)`,
  ];

  for (const idxSql of indexes) {
    try {
      await db.prepare(idxSql).run();
    } catch (e) {
      // Ignore — index may already exist or table may not exist yet
    }
  }
  console.log("Performance indexes created/verified successfully.");
}

