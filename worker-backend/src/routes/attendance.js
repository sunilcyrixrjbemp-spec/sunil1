function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * GET /api/attendance
 * Query parameters: month (default 'July'), year (default 2026), zone, district, status, user_id, search
 */
export async function handleGetAttendance(request, env, params, query, user) {
  try {
    const month = query.get("month") || "July";
    const year = parseInt(query.get("year") || "2026", 10);
    const statusFilter = query.get("status");
    const search = query.get("search");
    let zone = query.get("zone");
    let district = query.get("district");

    // Apply RBAC row-level restrictions
    const role = (user.role || "").trim();
    if (role === "Zonal Manager") {
      zone = user.zone;
    } else if (role === "Coordinator" || role === "Engineer") {
      district = user.district;
    }

    let sql = `
      SELECT 
        a.id,
        a.employee_code,
        a.employee_name,
        a.date,
        a.status,
        a.month,
        a.year,
        u.designation,
        u.district,
        u.zone
      FROM attendance a
      LEFT JOIN users u ON (
        REPLACE(REPLACE(u.user_id, '-', ''), ' ', '') = REPLACE(REPLACE(a.employee_code, '-', ''), ' ', '')
        OR REPLACE(REPLACE(u.e_code, '-', ''), ' ', '') = REPLACE(REPLACE(a.employee_code, '-', ''), ' ', '')
        OR LOWER(TRIM(u.name)) = LOWER(TRIM(a.employee_name))
      )
      WHERE a.month = ? AND a.year = ?
    `;

    const bindings = [month, year];

    if (zone) {
      sql += " AND LOWER(u.zone) = LOWER(?)";
      bindings.push(zone);
    }
    if (district) {
      sql += " AND LOWER(u.district) = LOWER(?)";
      bindings.push(district);
    }
    if (statusFilter) {
      sql += " AND a.status = ?";
      bindings.push(statusFilter);
    }
    if (search) {
      sql += " AND (LOWER(a.employee_code) LIKE LOWER(?) OR LOWER(a.employee_name) LIKE LOWER(?))";
      bindings.push(`%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY a.employee_code, a.date ASC;";

    const records = await env.DB.prepare(sql).bind(...bindings).all();
    const rows = records.results || [];

    // Transform into employee-wise matrix
    const matrixMap = {};
    for (const r of rows) {
      const empCode = r.employee_code;
      if (!matrixMap[empCode]) {
        matrixMap[empCode] = {
          employee_code: empCode,
          employee_name: r.employee_name,
          designation: r.designation || "",
          district: r.district || "",
          zone: r.zone || "",
          dates: {}
        };
      }
      matrixMap[empCode].dates[r.date] = r.status;
    }

    return jsonResponse({
      success: true,
      month,
      year,
      count: Object.keys(matrixMap).length,
      data: Object.values(matrixMap)
    });
  } catch (error) {
    console.error("handleGetAttendance error:", error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * GET /api/attendance/summary
 */
export async function handleGetAttendanceSummary(request, env, params, query, user) {
  try {
    const month = query.get("month") || "July";
    const year = parseInt(query.get("year") || "2026", 10);

    const summarySql = `
      SELECT 
        status,
        COUNT(*) as count
      FROM attendance
      WHERE month = ? AND year = ?
      GROUP BY status;
    `;

    const summaryRes = await env.DB.prepare(summarySql).bind(month, year).all();
    const statusCounts = {};
    (summaryRes.results || []).forEach(row => {
      statusCounts[row.status] = row.count;
    });

    // Available months list
    const monthsSql = "SELECT DISTINCT month, year FROM attendance ORDER BY year DESC, month DESC;";
    const monthsRes = await env.DB.prepare(monthsSql).all();

    return jsonResponse({
      success: true,
      month,
      year,
      statusCounts,
      availableMonths: monthsRes.results || []
    });
  } catch (error) {
    console.error("handleGetAttendanceSummary error:", error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * GET /api/attendance/discrepancies
 */
export async function handleGetAttendanceDiscrepancies(request, env, params, query, user) {
  try {
    const month = query.get("month") || "July";
    const year = parseInt(query.get("year") || "2026", 10);

    const sql = `
      SELECT 
        e.id as expense_id,
        e.expense_code,
        u.user_id as emp_code,
        u.name as emp_name,
        u.designation,
        u.district,
        u.zone,
        e.itinerary as expense_date,
        a.status as attendance_status,
        e.amount,
        e.status as expense_status,
        e.description
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN attendance a ON (
        REPLACE(REPLACE(u.user_id, '-', ''), ' ', '') = REPLACE(REPLACE(a.employee_code, '-', ''), ' ', '')
        OR REPLACE(REPLACE(u.e_code, '-', ''), ' ', '') = REPLACE(REPLACE(a.employee_code, '-', ''), ' ', '')
        OR LOWER(TRIM(u.name)) = LOWER(TRIM(a.employee_name))
      ) AND e.itinerary = a.date
      WHERE e.month = ? AND e.year = ?
      AND (a.status IS NULL OR a.status NOT IN ('P', 'WO-P'))
      ORDER BY a.status, e.itinerary DESC;
    `;

    const res = await env.DB.prepare(sql).bind(month, year).all();
    const rows = res.results || [];

    const totalAmount = rows.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return jsonResponse({
      success: true,
      month,
      year,
      discrepancy_count: rows.length,
      discrepancy_amount: totalAmount,
      data: rows
    });
  } catch (error) {
    console.error("handleGetAttendanceDiscrepancies error:", error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

export async function handleSendSubmissionReminder(request, env, params, query, user) {
  try {
    const body = await request.json();
    const { empCode, pendingDays, missingDates, monthName, year } = body;

    if (!empCode) {
      return jsonResponse({ success: false, error: "empCode is required" }, 400);
    }

    // 1. Fetch engineer info and reporting hierarchy
    const empRows = await env.DB.prepare(`
      SELECT 
        u.id, u.user_id, u.name, u.mail_id, u.district, u.zone, u.designation,
        u.manager_id, u.division_manager_id, u.coordinator_id
      FROM users u
      WHERE REPLACE(REPLACE(u.user_id, '-', ''), ' ', '') = REPLACE(REPLACE(?, '-', ''), ' ', '')
         OR REPLACE(REPLACE(u.e_code, '-', ''), ' ', '') = REPLACE(REPLACE(?, '-', ''), ' ', '')
         OR u.id = ?
      LIMIT 1
    `).bind(empCode, empCode, parseInt(empCode) || 0).all();

    const emp = empRows.results?.[0];
    if (!emp) {
      return jsonResponse({ success: false, error: "Engineer not found in database" }, 404);
    }

    const engineerEmail = emp.mail_id;
    if (!engineerEmail) {
      return jsonResponse({ success: false, error: `Engineer ${emp.name} does not have a registered email address` }, 400);
    }

    // 2. Fetch hierarchy emails (Manager, DM, Coordinator) for CC
    const managerIds = [emp.manager_id, emp.division_manager_id, emp.coordinator_id].filter(Boolean);
    let ccList = [];

    if (managerIds.length > 0) {
      const placeholders = managerIds.map(() => "?").join(",");
      const managerRows = await env.DB.prepare(`
        SELECT mail_id FROM users WHERE id IN (${placeholders}) OR user_id IN (${placeholders})
      `).bind(...managerIds, ...managerIds.map(String)).all();

      ccList = (managerRows.results || [])
        .map(m => m.mail_id)
        .filter(m => m && m.includes("@") && m !== engineerEmail);
    }

    // Also include logged-in sender (coordinator/admin) in CC if different
    if (user.email && user.email.includes("@") && user.email !== engineerEmail && !ccList.includes(user.email)) {
      ccList.push(user.email);
    }

    const uniqueCC = [...new Set(ccList)];

    const { sendSubmissionReminderEmail } = await import("../email/sender.js");
    await sendSubmissionReminderEmail(env, {
      to: engineerEmail,
      name: emp.name,
      userId: emp.user_id,
      empCode: emp.user_id || empCode,
      district: emp.district,
      zone: emp.zone,
      pendingDays: pendingDays || (missingDates?.length || 1),
      missingDates: missingDates || [],
      monthName: monthName || "Current Month",
      year: year || 2026,
      ccList: uniqueCC,
    });

    return jsonResponse({
      success: true,
      message: `Reminder email sent to ${emp.name} (${engineerEmail}) with ${uniqueCC.length} manager(s)/coordinator(s) in CC.`,
      to: engineerEmail,
      cc: uniqueCC,
    });
  } catch (error) {
    console.error("handleSendSubmissionReminder error:", error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * GET /api/attendance/leaves
 * Query: month (e.g. "2026-08" or "August"), employee_code (optional)
 */
export async function handleGetEngineerLeaves(request, env, params, query, user) {
  try {
    const monthQuery = query.get("month") || "";
    const empCode = query.get("employee_code") || "";

    let sql = `
      SELECT id, user_id, employee_code, employee_name, date, month, year, leave_type, reason, marked_by, created_at
      FROM engineer_leaves
      WHERE 1=1
    `;
    const bindings = [];

    if (monthQuery) {
      sql += ` AND (month = ? OR date LIKE ?)`;
      bindings.push(monthQuery, `${monthQuery}%`);
    }

    if (empCode) {
      sql += ` AND (REPLACE(REPLACE(employee_code, '-', ''), ' ', '') = REPLACE(REPLACE(?, '-', ''), ' ', '') OR user_id = ?)`;
      bindings.push(empCode, empCode);
    }

    sql += ` ORDER BY date ASC`;

    // Ensure table exists on first query
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS engineer_leaves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        employee_code TEXT NOT NULL,
        employee_name TEXT,
        date TEXT NOT NULL,
        month TEXT NOT NULL,
        year INTEGER NOT NULL,
        leave_type TEXT DEFAULT 'Leave',
        reason TEXT,
        marked_by TEXT,
        marked_by_role TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_code, date)
      )
    `).run();

    const res = await env.DB.prepare(sql).bind(...bindings).all();
    const rows = res.results || [];

    return jsonResponse({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error("handleGetEngineerLeaves error:", error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * POST /api/attendance/mark-leave
 * Body: { employee_code, dates: string[], leave_type, reason }
 */
export async function handleMarkEngineerLeave(request, env, params, query, user) {
  try {
    const body = await request.json();
    const { employee_code, employee_name, dates = [], leave_type = "Leave", reason = "" } = body;

    const targetEmpCode = employee_code || user.user_id || user.e_code;
    if (!targetEmpCode || !Array.isArray(dates) || dates.length === 0) {
      return jsonResponse({ success: false, error: "employee_code and valid dates array are required" }, 400);
    }

    // Ensure table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS engineer_leaves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        employee_code TEXT NOT NULL,
        employee_name TEXT,
        date TEXT NOT NULL,
        month TEXT NOT NULL,
        year INTEGER NOT NULL,
        leave_type TEXT DEFAULT 'Leave',
        reason TEXT,
        marked_by TEXT,
        marked_by_role TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_code, date)
      )
    `).run();

    // Fetch user details
    const empRows = await env.DB.prepare(`
      SELECT id, user_id, name, district, zone FROM users
      WHERE REPLACE(REPLACE(user_id, '-', ''), ' ', '') = REPLACE(REPLACE(?, '-', ''), ' ', '')
         OR REPLACE(REPLACE(e_code, '-', ''), ' ', '') = REPLACE(REPLACE(?, '-', ''), ' ', '')
      LIMIT 1
    `).bind(targetEmpCode, targetEmpCode).all();

    const emp = empRows.results?.[0];
    const resolvedName = employee_name || emp?.name || targetEmpCode;
    const resolvedUserId = emp?.user_id || targetEmpCode;

    const savedLeaves = [];
    for (const dStr of dates) {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) continue;

      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, "0");
      const monthStr = `${year}-${monthNum}`;

      await env.DB.prepare(`
        INSERT INTO engineer_leaves (user_id, employee_code, employee_name, date, month, year, leave_type, reason, marked_by, marked_by_role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_code, date) DO UPDATE SET
          leave_type = excluded.leave_type,
          reason = excluded.reason,
          marked_by = excluded.marked_by,
          marked_by_role = excluded.marked_by_role,
          created_at = CURRENT_TIMESTAMP
      `).bind(
        resolvedUserId,
        targetEmpCode,
        resolvedName,
        dStr,
        monthStr,
        year,
        leave_type,
        reason,
        user.user_id || user.id || "system",
        user.role || "Admin"
      ).run();

      savedLeaves.push(dStr);
    }

    return jsonResponse({
      success: true,
      message: `Successfully marked ${savedLeaves.length} date(s) as ${leave_type} for ${resolvedName}.`,
      employee_code: targetEmpCode,
      dates: savedLeaves
    });
  } catch (error) {
    console.error("handleMarkEngineerLeave error:", error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * DELETE /api/attendance/leaves/:id
 */
export async function handleDeleteEngineerLeave(request, env, params, query, user) {
  try {
    const leaveId = params.id;
    if (!leaveId) {
      return jsonResponse({ success: false, error: "Leave ID is required" }, 400);
    }

    await env.DB.prepare(`DELETE FROM engineer_leaves WHERE id = ?`).bind(leaveId).run();

    return jsonResponse({
      success: true,
      message: "Leave entry removed successfully."
    });
  } catch (error) {
    console.error("handleDeleteEngineerLeave error:", error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}
