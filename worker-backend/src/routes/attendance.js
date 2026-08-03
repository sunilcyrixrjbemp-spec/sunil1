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
