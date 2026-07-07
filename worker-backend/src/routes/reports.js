import { runBatchWrite } from "../utils/db.js";

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

  // 3. Chart 1: Status Distribution
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

  // 4. Chart 2: Top 5 Types
  const typeRows = await env.DB.prepare(`
    SELECT equipment_type, COUNT(*) as cnt 
    FROM assets_inventory 
    WHERE ${whereSql} 
    GROUP BY equipment_type 
    ORDER BY cnt DESC 
    LIMIT 5
  `).bind(...bindings).all();
  const topTypes = (typeRows.results || []).map(r => ({
    name: r.equipment_type || "Other",
    value: r.cnt
  }));

  // 5. Chart 3: Warranty Breakdown
  const warrantyRows = await env.DB.prepare(`
    SELECT warranty_expired, COUNT(*) as cnt 
    FROM assets_inventory 
    WHERE ${whereSql} 
    GROUP BY warranty_expired
  `).bind(...bindings).all();
  
  let underWarranty = 0;
  let outOfWarranty = 0;
  for (const r of (warrantyRows.results || [])) {
    if (parseInt(r.warranty_expired || "0", 10) === 1) {
      outOfWarranty = r.cnt;
    } else {
      underWarranty = r.cnt;
    }
  }
  const warrantyList = [
    { name: "Under Warranty", value: underWarranty },
    { name: "Out of Warranty", value: outOfWarranty }
  ];

  return jsonResponse({
    success: true,
    total_equipment,
    verified_equipment: verified_count,
    under_warranty: under_warranty_count,
    out_of_warranty: out_of_warranty_count,
    total_value: Math.round(total_value * 100) / 100,
    verified_value: Math.round(verified_value * 100) / 100,
    verified_out_of_warranty_value: Math.round(verified_out_of_warranty_value * 100) / 100,
    monthly_value: Math.round(monthlyValue * 100) / 100,
    arrear_billing: Math.round(arrearBilling * 100) / 100,
    total_billing: Math.round(totalBilling * 100) / 100,
    charts: {
      top_types: topTypes,
      status_list: statusList,
      warranty_list: warrantyList
    }
  });
}

// ── Bulk CSV Import Optimizations & Helpers ─────────────────────────────

const CSV_HEADER_MAP = {
  "district name": "district_name",
  "hospital name": "hospital_name",
  "department name": "department_name",
  "group name": "group_name",
  "equipment name": "equipment_name",
  "model name": "model_name",
  "serial no": "serial_no",
  "serial no.": "serial_no",
  "equipment category": "equipment_category",
  "qr code": "qr_code",
  "stock register page no": "stock_register_page_no",
  "stock register page no.": "stock_register_page_no",
  "recieved date": "received_date",
  "received date": "received_date",
  "installation date": "installation_date",
  "inventory entry date": "inventory_entry_date",
  "moic verified date": "moic_verified_date",
  "po date": "po_date",
  "po cost": "po_cost",
  "inventory status": "inventory_status",
  "equipment status": "equipment_status",
  "supplier": "supplier",
  "warranty details": "warranty_details",
  "asset value": "asset_value",
  "di name": "di_name",
  "dm name": "dm_name",
  "coordinator name": "coordinator_name",
  "zone name": "zone_name",
  "hospital type": "hospital_type",
  "facility type": "facility_type",
  "equipment type": "equipment_type",
};

function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

function parseDateFlexible(dateStr) {
  if (!dateStr || ["--", "", "NA", "N/A"].includes(dateStr.trim())) return null;
  dateStr = dateStr.trim();

  let timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    return new Date(timestamp);
  }

  const dmYRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  const match = dateStr.match(dmYRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function isWarrantyExpired(warrantyDetails) {
  if (!warrantyDetails || ["--", "", "NA", "N/A"].includes(warrantyDetails.trim())) {
    return true;
  }
  const parts = warrantyDetails.split(" to ");
  if (parts.length < 2) return true;
  const endDate = parseDateFlexible(parts[parts.length - 1].trim());
  if (!endDate) return true;
  return new Date() > endDate;
}

/**
 * POST /api/reports/upload-assets-csv
 * Optimized bulk asset importing with O(1) in-memory checks per chunk (chunk size = 500)
 * to avoid N database read operations.
 */
export async function handleUploadAssetsCSV(request, env, params, query, user) {
  if (user.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse({ error: "Invalid form data" }, 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return jsonResponse({ error: "No file uploaded" }, 400);
  }

  const csvText = await file.text();
  const parsedRows = parseCSV(csvText);
  if (parsedRows.length < 2) {
    return jsonResponse({ error: "CSV file is empty or missing header row" }, 400);
  }

  const rawHeader = parsedRows[0];
  const headerMap = {};
  for (let i = 0; i < rawHeader.length; i++) {
    const colName = rawHeader[i].trim().toLowerCase();
    const standardName = CSV_HEADER_MAP[colName];
    if (standardName) {
      headerMap[standardName] = i;
    }
  }

  if (headerMap["qr_code"] === undefined) {
    return jsonResponse({ error: "CSV missing mandatory 'qr_code' column header" }, 400);
  }

  // De-duplicate CSV rows in-memory by qr_code to prevent self-collision
  const seenQrCodes = new Set();
  const uniqueRecords = [];
  
  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.length === 1 && row[0] === "") continue;

    const record = {};
    for (const [colName, idx] of Object.entries(headerMap)) {
      record[colName] = (row[idx] || "").trim();
    }

    const qr = record["qr_code"];
    if (!qr || qr === "--" || qr === "") {
      continue;
    }

    if (seenQrCodes.has(qr)) {
      continue;
    }
    seenQrCodes.add(qr);
    uniqueRecords.push(record);
  }

  const totalInputRows = parsedRows.length - 1; // excluding header
  const insertStatements = [];

  for (const record of uniqueRecords) {
    let assetVal = 0.0;
    try {
      assetVal = parseFloat(String(record.asset_value || "0").replace(/,/g, "").trim()) || 0.0;
    } catch (err) {}

    const moicDate = parseDateFlexible(record.moic_verified_date);
    const isVerified = moicDate ? 1 : 0;
    const moicYear = moicDate ? moicDate.getFullYear() : null;
    const moicMonth = moicDate ? moicDate.getMonth() + 1 : null;

    const installDate = parseDateFlexible(record.installation_date);
    const installYear = installDate ? installDate.getFullYear() : null;
    const installMonth = installDate ? installDate.getMonth() + 1 : null;

    const expired = isWarrantyExpired(record.warranty_details) ? 1 : 0;

    insertStatements.push({
      sql: `
        INSERT OR IGNORE INTO assets_inventory (
          district_name, hospital_name, department_name, group_name,
          equipment_name, model_name, serial_no, equipment_category,
          qr_code, stock_register_page_no, received_date, installation_date,
          inventory_entry_date, moic_verified_date, po_date, po_cost,
          inventory_status, equipment_status, supplier, warranty_details,
          asset_value, di_name, dm_name, coordinator_name, zone_name,
          hospital_type, facility_type, equipment_type,
          is_verified, warranty_expired, parsed_asset_value,
          moic_year, moic_month, install_year, install_month
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        record.district_name || "", record.hospital_name || "", record.department_name || "", record.group_name || "",
        record.equipment_name || "", record.model_name || "", record.serial_no || "", record.equipment_category || "",
        record.qr_code, record.stock_register_page_no || "", record.received_date || "", record.installation_date || "",
        record.inventory_entry_date || "", record.moic_verified_date || "", record.po_date || "", record.po_cost || "",
        record.inventory_status || "", record.equipment_status || "", record.supplier || "", record.warranty_details || "",
        record.asset_value || "", record.di_name || "", record.dm_name || "", record.coordinator_name || "", record.zone_name || "",
        record.hospital_type || "", record.facility_type || "", record.equipment_type || "",
        isVerified, expired, assetVal,
        moicYear, moicMonth, installYear, installMonth
      ]
    });
  }

  let insertedCount = 0;
  if (insertStatements.length > 0) {
    const chunkSize = 1000;
    const allBatches = [];
    for (let idx = 0; idx < insertStatements.length; idx += chunkSize) {
      const chunk = insertStatements.slice(idx, idx + chunkSize);
      allBatches.push(runBatchWrite(env, chunk));
    }
    
    // Execute all batch writes concurrently for maximum performance
    const batchResults = await Promise.all(allBatches);
    for (const batchRes of batchResults) {
      for (const statementRes of (batchRes || [])) {
        insertedCount += (statementRes.meta?.changes || 0);
      }
    }
  }

  const skippedCount = totalInputRows - insertedCount;

  return jsonResponse({
    success: true,
    inserted: insertedCount,
    skipped: skippedCount,
    message: `Successfully processed CSV file. Inserted ${insertedCount} new assets, skipped ${skippedCount} duplicate/invalid entries.`
  });
}

/**
 * POST /api/reports/upload-assets-chunk
 * Accepts parsed JSON rows and uploads them in high-speed parallel batches,
 * skipping existing qr_code duplicates.
 */
export async function handleUploadAssetsChunk(request, env, params, query, user) {
  if (user.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const rows = body.rows || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonResponse({
      success: true,
      inserted: 0,
      skipped: 0,
      message: "No rows to process"
    });
  }

  // De-duplicate rows in-memory by qr_code to prevent self-collision
  const seenQrCodes = new Set();
  const uniqueRecords = [];
  
  for (const record of rows) {
    const qr = (record.qr_code || "").trim();
    if (!qr || qr === "--" || qr === "") {
      continue;
    }

    if (seenQrCodes.has(qr)) {
      continue;
    }
    seenQrCodes.add(qr);
    uniqueRecords.push(record);
  }

  const totalInputRows = rows.length;
  const insertStatements = [];

  for (const record of uniqueRecords) {
    let assetVal = 0.0;
    try {
      assetVal = parseFloat(String(record.asset_value || "0").replace(/,/g, "").trim()) || 0.0;
    } catch (err) {}

    const moicDate = parseDateFlexible(record.moic_verified_date);
    const isVerified = moicDate ? 1 : 0;
    const moicYear = moicDate ? moicDate.getFullYear() : null;
    const moicMonth = moicDate ? moicDate.getMonth() + 1 : null;

    const installDate = parseDateFlexible(record.installation_date);
    const installYear = installDate ? installDate.getFullYear() : null;
    const installMonth = installDate ? installDate.getMonth() + 1 : null;

    const expired = isWarrantyExpired(record.warranty_details) ? 1 : 0;

    insertStatements.push({
      sql: `
        INSERT OR IGNORE INTO assets_inventory (
          district_name, hospital_name, department_name, group_name,
          equipment_name, model_name, serial_no, equipment_category,
          qr_code, stock_register_page_no, received_date, installation_date,
          inventory_entry_date, moic_verified_date, po_date, po_cost,
          inventory_status, equipment_status, supplier, warranty_details,
          asset_value, di_name, dm_name, coordinator_name, zone_name,
          hospital_type, facility_type, equipment_type,
          is_verified, warranty_expired, parsed_asset_value,
          moic_year, moic_month, install_year, install_month
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        record.district_name || "", record.hospital_name || "", record.department_name || "", record.group_name || "",
        record.equipment_name || "", record.model_name || "", record.serial_no || "", record.equipment_category || "",
        record.qr_code, record.stock_register_page_no || "", record.received_date || "", record.installation_date || "",
        record.inventory_entry_date || "", record.moic_verified_date || "", record.po_date || "", record.po_cost || "",
        record.inventory_status || "", record.equipment_status || "", record.supplier || "", record.warranty_details || "",
        record.asset_value || "", record.di_name || "", record.dm_name || "", record.coordinator_name || "", record.zone_name || "",
        record.hospital_type || "", record.facility_type || "", record.equipment_type || "",
        isVerified, expired, assetVal,
        moicYear, moicMonth, installYear, installMonth
      ]
    });
  }

  let insertedCount = 0;
  if (insertStatements.length > 0) {
    const chunkSize = 1000;
    const allBatches = [];
    for (let idx = 0; idx < insertStatements.length; idx += chunkSize) {
      const chunk = insertStatements.slice(idx, idx + chunkSize);
      allBatches.push(runBatchWrite(env, chunk));
    }
    
    // Execute all batch writes concurrently for maximum performance
    const batchResults = await Promise.all(allBatches);
    for (const batchRes of batchResults) {
      for (const statementRes of (batchRes || [])) {
        insertedCount += (statementRes.meta?.changes || 0);
      }
    }
  }

  const skippedCount = totalInputRows - insertedCount;

  return jsonResponse({
    success: true,
    inserted: insertedCount,
    skipped: skippedCount,
    message: `Successfully processed chunk. Inserted ${insertedCount} new assets, skipped ${skippedCount} duplicate/invalid entries.`
  });
}
