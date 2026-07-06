function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * GET /api/reports/mis-dashboard
 */
export async function handleGetMisDashboard(request, env, params, query, user) {
  const zone = query.get("zone");
  const district = query.get("district");
  const coordinator = query.get("coordinator");
  const month = query.get("month");
  const equipment = query.get("equipment");

  // Verify rj_penalties table exists
  const tableCheck = await env.DB.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='rj_penalties'
  `).first();

  if (!tableCheck) {
    return jsonResponse({
      success: false,
      message: "Penalty database not seeded yet.",
      summary: {}
    });
  }

  // Row-level access control restriction
  let userZone = zone;
  let userDistrict = district;
  let userCoordinator = coordinator;

  const role = (user.role || "").trim();
  if (role === "Zonal Manager") {
    userZone = user.zone;
  } else if (role === "Coordinator") {
    userCoordinator = user.name;
  } else if (role === "Engineer") {
    userDistrict = user.district;
  }

  if (userZone) {
    userZone = userZone.replace(" Zone", "").trim();
  }

  // Build WHERE clause
  const whereClauses = ["1=1"];
  const bindings = [];

  if (userDistrict) {
    whereClauses.push("LOWER(district_name) = LOWER(?)");
    bindings.push(userDistrict);
  }
  if (userCoordinator) {
    whereClauses.push("LOWER(coordinator_name) = LOWER(?)");
    bindings.push(userCoordinator);
  }
  if (month) {
    whereClauses.push("month_text = ?");
    bindings.push(month);
  }
  if (equipment) {
    whereClauses.push("equipment_name = ?");
    bindings.push(equipment);
  }
  if (userZone) {
    const zoneSql = `
      CASE 
        WHEN district_name IN ('Ajmer', 'Bhilwara', 'Nagaur', 'Tonk', 'Beawer', 'Kekri', 'Shahpura') THEN 'Ajmer'
        WHEN district_name IN ('Jaipur', 'Alwar', 'Dausa', 'Jhunjhunu', 'Sikar', 'Dudu', 'Kotputli', 'Neem Ka Thana', 'Khairthal') THEN 'Jaipur'
        WHEN district_name IN ('Jodhpur', 'Barmer', 'Jaisalmer', 'Jalore', 'Pali', 'Sirohi', 'Phalodi', 'Balotra', 'Sanchore') THEN 'Jodhpur'
        WHEN district_name IN ('Bikaner', 'Churu', 'Hanumangarh', 'Sri Ganganagar', 'Ganganagar', 'Anupgarh') THEN 'Bikaner'
        WHEN district_name IN ('Kota', 'Baran', 'Bundi', 'Jhalawar') THEN 'Kota'
        WHEN district_name IN ('Udaipur', 'Banswara', 'Chittorgarh', 'Dungarpur', 'Rajsamand', 'Pratapgarh', 'Salumbar') THEN 'Udaipur'
        ELSE 'Other'
      END
    `;
    whereClauses.push(`LOWER(${zoneSql}) = LOWER(?)`);
    bindings.push(userZone);
  }

  const whereStr = whereClauses.join(" AND ");

  // Fetch dropdown list options dynamically
  const districts = await env.DB.prepare(`
    SELECT DISTINCT district_name FROM rj_penalties WHERE ${whereStr} AND district_name IS NOT NULL AND district_name != '' ORDER BY district_name
  `).bind(...bindings).all();

  const coordinators = await env.DB.prepare(`
    SELECT DISTINCT coordinator_name FROM rj_penalties WHERE ${whereStr} AND coordinator_name IS NOT NULL AND coordinator_name != '' ORDER BY coordinator_name
  `).bind(...bindings).all();

  const months = await env.DB.prepare(`
    SELECT DISTINCT month_text FROM rj_penalties WHERE ${whereStr} AND month_text IS NOT NULL AND month_text != '' ORDER BY month_text
  `).bind(...bindings).all();

  // Summary Metrics Aggregation
  const summary = await env.DB.prepare(`
    SELECT 
      SUM(CAST(total_penalty AS REAL)) as total_penalty,
      COUNT(DISTINCT district_name) as districts_count,
      COUNT(DISTINCT hospital_name) as hospitals_count,
      COUNT(*) as total_records
    FROM rj_penalties
    WHERE ${whereStr}
  `).bind(...bindings).first();

  return jsonResponse({
    success: true,
    summary: {
      total_penalty: summary?.total_penalty || 0,
      districts_count: summary?.districts_count || 0,
      hospitals_count: summary?.hospitals_count || 0,
      total_records: summary?.total_records || 0
    },
    filters: {
      districts: districts.results.map(r => r.district_name),
      coordinators: coordinators.results.map(r => r.coordinator_name),
      months: months.results.map(r => r.month_text)
    }
  });
}

/**
 * GET /api/reports/assets-inventory
 */
export async function handleGetAssetsInventory(request, env, params, query, user) {
  const district = query.get("district");
  const hospital = query.get("hospital");
  const zone = query.get("zone");
  const di = query.get("di");
  const month = query.get("month");
  const statusFilter = query.get("equipment_status");
  const search = query.get("search");
  const page = parseInt(query.get("page") || "1", 10);
  const pageSize = parseInt(query.get("page_size") || "100", 10);

  const whereClauses = ["1=1"];
  const bindings = [];

  if (district) { whereClauses.push("district_name = ?"); bindings.push(district); }
  if (hospital) { whereClauses.push("hospital_name = ?"); bindings.push(hospital); }
  if (zone) { whereClauses.push("zone_name = ?"); bindings.push(zone); }
  if (di) { whereClauses.push("di_name = ?"); bindings.push(di); }
  if (statusFilter) { whereClauses.push("equipment_status = ?"); bindings.push(statusFilter); }

  if (month) {
    const parts = month.split("-");
    if (parts.length === 2) {
      whereClauses.push("is_verified = 1 AND moic_year = ? AND moic_month = ?");
      bindings.push(parseInt(parts[0], 10), parseInt(parts[1], 10));
    }
  }

  if (search) {
    whereClauses.push("(equipment_name LIKE ? OR qr_code LIKE ? OR serial_no LIKE ? OR hospital_name LIKE ?)");
    const searchPattern = `%${search.trim()}%`;
    bindings.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereSql = whereClauses.join(" AND ");

  // 1. Count total
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM assets_inventory WHERE ${whereSql}
  `).bind(...bindings).first();
  const total = countResult?.cnt || 0;

  // 2. Fetch paginated records
  const offset = (page - 1) * pageSize;
  const limitBindings = [...bindings, pageSize, offset];
  const listResult = await env.DB.prepare(`
    SELECT * FROM assets_inventory 
    WHERE ${whereSql} 
    ORDER BY id DESC 
    LIMIT ? OFFSET ?
  `).bind(...limitBindings).all();

  return jsonResponse({
    success: true,
    total,
    page,
    page_size: pageSize,
    assets: listResult.results || []
  });
}

/**
 * GET /api/reports/assets-filters
 */
export async function handleGetAssetsFilters(request, env, params, query, user) {
  const combRows = await env.DB.prepare(`
    SELECT DISTINCT zone_name, district_name, di_name 
    FROM assets_inventory 
    WHERE zone_name IS NOT NULL AND zone_name != ''
  `).all();

  const validRajasthanZones = new Set(["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Udaipur", "Bharatpur"]);
  const combinations = [];
  const zonesSet = new Set();
  const districtsSet = new Set();
  const diNamesSet = new Set();

  for (const row of (combRows.results || [])) {
    const zClean = (row.zone_name || "").trim();
    let matchedZone = null;
    for (const rz of validRajasthanZones) {
      if (zClean.toLowerCase().includes(rz.toLowerCase())) {
        matchedZone = rz;
        break;
      }
    }

    if (matchedZone) {
      zonesSet.add(matchedZone);
      districtsSet.add((row.district_name || "").trim());
      diNamesSet.add((row.di_name || "").trim());
      combinations.push({
        zone: matchedZone,
        district: (row.district_name || "").trim(),
        di: (row.di_name || "").trim()
      });
    }
  }

  const monthRows = await env.DB.prepare(`
    SELECT DISTINCT moic_year, moic_month 
    FROM assets_inventory 
    WHERE is_verified = 1 AND moic_year IS NOT NULL AND moic_month IS NOT NULL
    ORDER BY moic_year DESC, moic_month DESC
  `).all();

  const months = (monthRows.results || []).map(r => `${r.moic_year}-${String(r.moic_month).padStart(2, "0")}`);

  return jsonResponse({
    success: true,
    zones: Array.from(zonesSet).sort(),
    districts: Array.from(districtsSet).sort(),
    di_names: Array.from(diNamesSet).sort(),
    months,
    combinations
  });
}

/**
 * GET /api/reports/assets-stats
 */
export async function handleGetAssetsStats(request, env, params, query, user) {
  const zone = query.get("zone");
  const district = query.get("district");
  const di = query.get("di");
  const month = query.get("month");

  const whereClauses = ["1=1"];
  const bindings = [];

  if (zone) { whereClauses.push("zone_name = ?"); bindings.push(zone); }
  if (district) { whereClauses.push("district_name = ?"); bindings.push(district); }
  if (di) { whereClauses.push("di_name = ?"); bindings.push(di); }

  const whereSql = whereClauses.join(" AND ");

  // SQL Aggregations
  const aggRes = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total_equipment,
      SUM(is_verified) as verified_equipment,
      SUM(CASE WHEN warranty_expired = 0 THEN 1 ELSE 0 END) as under_warranty,
      SUM(warranty_expired) as out_of_warranty,
      SUM(parsed_asset_value) as total_value,
      SUM(CASE WHEN is_verified = 1 THEN parsed_asset_value ELSE 0 END) as verified_value,
      SUM(CASE WHEN is_verified = 1 AND warranty_expired = 1 THEN parsed_asset_value ELSE 0 END) as verified_out_of_warranty_value
    FROM assets_inventory
    WHERE ${whereSql}
  `).bind(...bindings).first();

  const total_equipment = aggRes?.total_equipment || 0;
  const verified_count = aggRes?.verified_equipment || 0;
  const under_warranty_count = aggRes?.under_warranty || 0;
  const out_of_warranty_count = aggRes?.out_of_warranty || 0;
  const total_value = aggRes?.total_value || 0.0;
  const verified_value = aggRes?.verified_value || 0.0;
  const verified_out_of_warranty_value = aggRes?.verified_out_of_warranty_value || 0.0;

  // Billing calculations
  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth() + 1;

  if (month) {
    const parts = month.split("-");
    if (parts.length === 2) {
      targetYear = parseInt(parts[0], 10);
      targetMonth = parseInt(parts[1], 10);
    }
  }

  const arrearRows = await env.DB.prepare(`
    SELECT parsed_asset_value, install_year, install_month
    FROM assets_inventory
    WHERE is_verified = 1 
      AND moic_year = ? 
      AND moic_month = ?
      AND ${whereSql}
  `).bind(targetYear, targetMonth, ...bindings).all();

  let arrearBilling = 0.0;
  for (const r of (arrearRows.results || [])) {
    if (r.parsed_asset_value && r.install_year && r.install_month) {
      const monthlyRate = (r.parsed_asset_value * 6.08 / 100) / 12;
      const monthsDiff = (targetYear - r.install_year) * 12 + (targetMonth - r.install_month);
      if (monthsDiff > 0) {
        arrearBilling += monthlyRate * monthsDiff;
      }
    }
  }

  const monthlyValue = (verified_out_of_warranty_value * 6.08 / 100) / 12;
  const totalBilling = monthlyValue + arrearBilling;

  // Status Distribution
  const statusRows = await env.DB.prepare(`
    SELECT equipment_status, COUNT(*) as cnt 
    FROM assets_inventory 
    WHERE ${whereSql} 
    GROUP BY equipment_status
  `).bind(...bindings).all();

  const statusList = (statusRows.results || []).map(r => ({
    name: r.equipment_status || "Unknown",
    value: r.cnt
  }));

  return jsonResponse({
    success: true,
    total_equipment,
    verified_count,
    under_warranty_count,
    out_of_warranty_count,
    total_value,
    verified_value,
    billing: {
      monthly_billing: monthlyValue,
      arrear_billing: arrearBilling,
      total_billing: totalBilling
    },
    status_distribution: statusList
  });
}
