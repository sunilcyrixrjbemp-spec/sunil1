import { runWrite } from "../utils/db.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * GET /api/expense/
 */
export async function handleListExpenses(request, env, params, query, user) {
  const month = query.get("month");
  let result;
  if (month) {
    result = await env.DB.prepare(`
      SELECT * FROM expenses WHERE user_id = ? AND month = ? ORDER BY id DESC
    `).bind(user.id, month).all();
  } else {
    result = await env.DB.prepare(`
      SELECT * FROM expenses WHERE user_id = ? ORDER BY id DESC
    `).bind(user.id).all();
  }
  return jsonResponse(result.results || []);
}

/**
 * GET /api/expense/init
 */
export async function getExpenseInitData(env, targetUser, monthStr) {
  const parts = monthStr.split("-");
  const yearVal = parseInt(parts[0], 10);
  const monthInt = parseInt(parts[1], 10);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[monthInt - 1];

  // Fetch distinct districts and facilities mapped
  const facilitiesRows = await env.DB.prepare(`
    SELECT DISTINCT district_name, facility_name FROM facility_details
  `).all();
  const facilities = {};
  for (const f of (facilitiesRows.results || [])) {
    if (!facilities[f.district_name]) facilities[f.district_name] = [];
    facilities[f.district_name].push(f.facility_name);
  }

  // Submitted dates this month
  const submittedRows = await env.DB.prepare(`
    SELECT itinerary FROM expenses WHERE user_id = ? AND month = ? AND year = ?
  `).bind(targetUser.id, monthName, yearVal).all();
  const submittedDates = (submittedRows.results || []).map(r => r.itinerary).filter(Boolean);

  // Approved limit extensions
  const limits = await env.DB.prepare(`
    SELECT 
      SUM(CASE WHEN request_type = 'KM' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_km,
      SUM(CASE WHEN request_type = 'AUTO' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_auto
    FROM limit_approval_requests
    WHERE user_id = ? AND LOWER(status) = 'approved' AND for_month = ?
  `).bind(targetUser.user_id, monthStr).first();

  const approvedKm = limits?.approved_km || 0.0;
  const approvedAuto = limits?.approved_auto || 0.0;

  // Existing requests status
  const limitReqs = await env.DB.prepare(`
    SELECT * FROM limit_approval_requests WHERE user_id = ? AND for_month = ?
  `).bind(targetUser.user_id, monthStr).all();

  const kmReqs = (limitReqs.results || []).filter(r => r.request_type === "KM").sort((a, b) => b.id - a.id);
  const autoReqs = (limitReqs.results || []).filter(r => r.request_type === "AUTO").sort((a, b) => b.id - a.id);

  const existingKmReq = kmReqs.length > 0 ? { status: kmReqs[0].status, requested_value: kmReqs[0].requested_value } : null;
  const existingAutoReq = autoReqs.length > 0 ? { status: autoReqs[0].status, requested_value: autoReqs[0].requested_value } : null;

  // Allowance rules
  const gradeToLookup = (targetUser.designation || "").toLowerCase().includes("specialist") ? "O1" : targetUser.grade;
  const allowance = await env.DB.prepare("SELECT * FROM allowance_masters WHERE grade = ?").bind(gradeToLookup).first();

  const defaultBike = await env.DB.prepare("SELECT rate_per_km FROM allowance_masters WHERE vehicle_type = 'Bike' LIMIT 1").first();
  const defaultCar = await env.DB.prepare("SELECT rate_per_km FROM allowance_masters WHERE vehicle_type = 'Car' LIMIT 1").first();
  const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
  const fallbackCarRate = defaultCar?.rate_per_km || 9.0;

  let allowanceDict = {
    daily_in_district: allowance?.daily_in_district ?? 150,
    daily_out_district: allowance?.daily_out_district ?? 200,
    daily_hotel: allowance?.daily_hotel ?? 300,
    daily_out_state: allowance?.daily_out_state ?? 400,
    hotel_in_state_s: allowance?.hotel_in_state_s ?? 1000,
    hotel_out_state_s: allowance?.hotel_out_state_s ?? 2000,
    max_km_per_month: allowance?.max_km_per_month ?? 2000,
    rate_bike: allowance?.vehicle_type === "Bike" ? allowance?.rate_per_km : fallbackBikeRate,
    rate_car: allowance?.vehicle_type === "Car" ? allowance?.rate_per_km : fallbackCarRate,
    vehicle_type: allowance?.vehicle_type ?? "Bike"
  };

  // Month-wise accumulated aggregates
  const claims = await env.DB.prepare(`
    SELECT SUM(total_distance) as total_km, SUM(auto_allowance) as total_auto
    FROM expenses WHERE user_id = ? AND month = ? AND year = ? AND status != 'rejected'
  `).bind(targetUser.id, monthName, yearVal).first();

  const accumulatedKm = claims?.total_km || 0.0;
  const accumulatedAuto = claims?.total_auto || 0.0;

  // Append monthly totals inside allowanceDict exactly as Python does
  allowanceDict.current_month_km = accumulatedKm;
  allowanceDict.current_month_auto = accumulatedAuto;
  allowanceDict.max_auto_per_month = 1000;

  // Generate next expense ID code format
  const mm = String(monthInt).padStart(2, "0");
  const yy = String(yearVal).substring(2);

  return {
    success: true,
    user: {
      full_name: targetUser.name,
      e_code: targetUser.user_id,
      grade: targetUser.grade,
      home_district: targetUser.district || "Jodhpur",
      level_first_approver: targetUser.manager || "Admin",
      level_second_approver: targetUser.zonal_manager || "Admin"
    },
    allowance: allowanceDict,
    facilities,
    submitted_dates: submittedDates,
    approved_km: approvedKm,
    approved_auto: approvedAuto,
    existing_km_req: existingKmReq,
    existing_auto_req: existingAutoReq,
    next_exp_id: `RJ-${mm}/${yy}-PENDING`
  };
}

/**
 * GET /api/expense/init
 */
export async function handleExpenseInit(request, env, params, query, user) {
  const targetUserId = query.get("user_id") || user.user_id;
  const monthStr = query.get("month"); // Format: YYYY-MM
  if (!monthStr) return jsonResponse({ error: "month parameter is required" }, 400);

  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(targetUserId).first();
  if (!targetUser) return jsonResponse({ error: "User not found" }, 404);

  const data = await getExpenseInitData(env, targetUser, monthStr);
  return jsonResponse(data);
}

/**
 * POST /api/expense/limit-request
 */
export async function handleCreateLimitRequest(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, type, amount, month } = body;
  if (!user_id || !type || !amount || !month) {
    return jsonResponse({ error: "Missing required parameters: user_id, type, amount, month" }, 400);
  }

  const timestamp = new Date().toISOString();
  
  // Find manager from user profile
  const requester = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
  if (!requester) return jsonResponse({ error: "Requester not found" }, 404);

  // We find their coordinator or zonal manager to assign
  const managerId = requester.manager || requester.zonal_manager || "Admin";

  await runWrite(env, `
    INSERT INTO limit_approval_requests (user_id, request_type, requested_value, status, for_month, manager_id, created_at, updated_at)
    VALUES (?, ?, ?, 'Pending', ?, ?, ?, ?)
  `, [user_id, type, amount, month, managerId, timestamp, timestamp]);

  // Notify manager
  await runWrite(env, `
    INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
    VALUES (?, '📥 New Limit Request', ?, 'warning', 0, '/approval-center', ?)
  `, [
    managerId,
    `${requester.name} has requested extra ${amount} ${type} limit for ${month}.`,
    timestamp
  ]);

  return jsonResponse({ status: "success", message: "Limit request raised successfully." });
}

/**
 * GET /api/expense/team
 */
export async function handleGetTeamExpenses(request, env, params, query, user) {
  const month = query.get("month");
  let result;
  
  if (user.role === "Admin") {
    if (month) {
      result = await env.DB.prepare("SELECT e.*, u.name as employee_name FROM expenses e JOIN users u ON e.user_id = u.id WHERE e.month = ? ORDER BY e.id DESC").bind(month).all();
    } else {
      result = await env.DB.prepare("SELECT e.*, u.name as employee_name FROM expenses e JOIN users u ON e.user_id = u.id ORDER BY e.id DESC").all();
    }
  } else {
    // Managers see expenses they are assigned to review in approvals
    if (month) {
      result = await env.DB.prepare(`
        SELECT DISTINCT e.*, u.name as employee_name 
        FROM expenses e
        JOIN approvals a ON e.id = a.expense_id
        JOIN users u ON e.user_id = u.id
        WHERE a.approver_id = ? AND e.month = ?
        ORDER BY e.id DESC
      `).bind(user.id, month).all();
    } else {
      result = await env.DB.prepare(`
        SELECT DISTINCT e.*, u.name as employee_name 
        FROM expenses e
        JOIN approvals a ON e.id = a.expense_id
        JOIN users u ON e.user_id = u.id
        WHERE a.approver_id = ?
        ORDER BY e.id DESC
      `).bind(user.id).all();
    }
  }

  return jsonResponse(result.results || []);
}

/**
 * GET /api/expense/verify-barcode
 */
export async function handleVerifyBarcode(request, env, params, query, user) {
  const barcode = query.get("barcode");
  if (!barcode) return jsonResponse({ error: "barcode parameter is required" }, 400);

  const asset = await env.DB.prepare(`
    SELECT * FROM assets_inventory WHERE qr_code = ? OR serial_no = ? LIMIT 1
  `).bind(barcode, barcode).first();

  if (!asset) {
    return jsonResponse({ valid: false, message: "Asset QR/Serial number not found in master database." });
  }

  return jsonResponse({
    valid: true,
    asset_name: asset.equipment_name,
    hospital_name: asset.hospital_name,
    district_name: asset.district_name,
    serial_no: asset.serial_no
  });
}

/**
 * GET /api/expense/asset-value-master
 */
export async function handleGetAssetValueMaster(request, env, params, query, user) {
  const result = await env.DB.prepare(`
    SELECT DISTINCT equipment_name as equipment_name, CAST(parsed_asset_value AS REAL) as asset_value 
    FROM assets_inventory 
    WHERE parsed_asset_value IS NOT NULL AND parsed_asset_value > 0
    ORDER BY equipment_name ASC
  `).all();
  return jsonResponse(result.results || []);
}

/**
 * GET /api/expense/:id
 */
export async function handleGetExpenseDetails(request, env, params, query, user) {
  const expenseId = parseInt(params.id, 10);
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) return jsonResponse({ error: "Expense claim not found" }, 404);

  // Fetch related itineraries
  const itineraries = await env.DB.prepare(`
    SELECT * FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC
  `).bind(expense.expense_code).all();

  // Fetch edit logs
  const editLogs = await env.DB.prepare(`
    SELECT * FROM expense_edit_logs WHERE expense_id = ? ORDER BY created_at DESC
  `).bind(expenseId).all();

  // Fetch breakdown calls
  const breakdowns = await env.DB.prepare(`
    SELECT * FROM expense_breakdown_calls WHERE expense_id = ?
  `).bind(expenseId).all();

  // Fetch pms calls
  const pmsCalls = await env.DB.prepare(`
    SELECT * FROM expense_pms_calls WHERE expense_id = ?
  `).bind(expenseId).all();

  // Fetch calibrates
  const calibrates = await env.DB.prepare(`
    SELECT * FROM expense_calibrations WHERE expense_id = ?
  `).bind(expenseId).all();

  // Fetch mobilises
  const mobilises = await env.DB.prepare(`
    SELECT * FROM expense_asset_mobilises WHERE expense_id = ?
  `).bind(expenseId).all();

  // Fetch taggings
  const taggings = await env.DB.prepare(`
    SELECT * FROM expense_asset_taggings WHERE expense_id = ?
  `).bind(expenseId).all();

  return jsonResponse({
    expense,
    itineraries: itineraries.results || [],
    edit_logs: editLogs.results || [],
    breakdowns: breakdowns.results || [],
    pms: pmsCalls.results || [],
    calibrates: calibrates.results || [],
    mobilises: mobilises.results || [],
    taggings: taggings.results || []
  });
}

/**
 * DELETE /api/expense/:id
 */
export async function handleDeleteExpense(request, env, params, query, user) {
  const expenseId = parseInt(params.id, 10);
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) return jsonResponse({ error: "Expense claim not found" }, 404);

  if (expense.user_id !== user.id && user.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  // Delete everything in a batch
  await env.DB.batch([
    env.DB.prepare("DELETE FROM approvals WHERE expense_id = ?").bind(expenseId),
    env.DB.prepare("DELETE FROM expense_edit_logs WHERE expense_id = ?").bind(expenseId),
    env.DB.prepare("DELETE FROM expense_breakdown_calls WHERE expense_id = ?").bind(expenseId),
    env.DB.prepare("DELETE FROM expense_pms_calls WHERE expense_id = ?").bind(expenseId),
    env.DB.prepare("DELETE FROM expense_calibrations WHERE expense_id = ?").bind(expenseId),
    env.DB.prepare("DELETE FROM expense_asset_mobilises WHERE expense_id = ?").bind(expenseId),
    env.DB.prepare("DELETE FROM expense_asset_taggings WHERE expense_id = ?").bind(expenseId),
    env.DB.prepare("DELETE FROM expense_itineraries WHERE exp_id = ?").bind(expense.expense_code),
    env.DB.prepare("DELETE FROM expenses WHERE id = ?").bind(expenseId)
  ]);

  return jsonResponse({ status: "success", message: "Expense claim deleted successfully." });
}

/**
 * GET /api/expense/engineer-advance
 */
export async function handleGetEngineerAdvance(request, env, params, query, user) {
  const userCode = query.get("user_code");
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10);

  const adv = await env.DB.prepare(`
    SELECT * FROM engineer_advances WHERE user_code = ? AND month = ? AND year = ?
  `).bind(userCode, month, year).first();

  return jsonResponse(adv || { advance_amount: 0.0 });
}

/**
 * POST /api/expense/engineer-advance
 */
export async function handleSaveEngineerAdvance(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_code, month, year, advance_amount } = body;
  const timestamp = new Date().toISOString();

  const existing = await env.DB.prepare(`
    SELECT * FROM engineer_advances WHERE user_code = ? AND month = ? AND year = ?
  `).bind(user_code, month, year).first();

  if (existing) {
    await runWrite(env, `
      UPDATE engineer_advances SET advance_amount = ?, updated_at = ? WHERE id = ?
    `, [advance_amount, timestamp, existing.id]);
  } else {
    await runWrite(env, `
      INSERT INTO engineer_advances (user_code, month, year, advance_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user_code, month, year, advance_amount, timestamp, timestamp]);
  }

  return jsonResponse({ status: "success", message: "Advance updated successfully." });
}

/**
 * POST /api/expense/
 * Submit itinerary expense claim
 */
export async function handleSubmitExpense(request, env, params, query, user) {
  // Since multipart/form-data processing is complex, we extract form values
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse({ error: "Invalid multipart form data" }, 400);
  }

  const payloadStr = formData.get("payload");
  if (!payloadStr) return jsonResponse({ error: "payload is required" }, 400);

  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch (e) {
    return jsonResponse({ error: "Invalid payload JSON" }, 400);
  }

  const {
    claim_month, claim_year, date, travel_mode, amount, description,
    total_distance, auto_allowance, itinerary_legs, breakdown_calls, pms_calls, calibrates, mobilises, taggings
  } = payload;

  const timestamp = new Date().toISOString();
  
  // Generate expense code EXP-YYYYMMDD-XXXX
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const countResult = await env.DB.prepare("SELECT COUNT(*) as cnt FROM expenses WHERE expense_code LIKE ?").bind(`EXP-${todayStr}-%`).first();
  const count = countResult?.cnt || 0;
  const expenseCode = `EXP-${todayStr}-${String(count + 1).padStart(4, "0")}`;

  // Insert main expense
  const expRes = await runWrite(env, `
    INSERT INTO expenses (user_id, claim_month, claim_year, expense_code, amount, description, status, itinerary, travel_mode, total_distance, auto_allowance, month, year, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'submitted_l1', ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    user.id, claim_month, claim_year, expenseCode, amount, description || "",
    date, travel_mode || "Bike", total_distance || 0.0, auto_allowance || 0.0,
    claim_month, claim_year, timestamp, timestamp
  ]);

  const newExpId = expRes.meta?.last_row_id;
  if (!newExpId) return jsonResponse({ error: "Failed to save expense claim" }, 500);

  // Insert itinerary legs
  if (itinerary_legs && itinerary_legs.length > 0) {
    for (const leg of itinerary_legs) {
      await runWrite(env, `
        INSERT INTO expense_itineraries (exp_id, leg_number, start_point, end_point, travel_mode, distance_km, travel_amount, sub_amount, hotel_amount, other_amount, da_amount, local_purchase)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        expenseCode, leg.leg_number, leg.start_point, leg.end_point, leg.travel_mode,
        leg.distance_km || 0.0, leg.travel_amount || 0.0, leg.sub_amount || 0.0,
        leg.hotel_amount || 0.0, leg.other_amount || 0.0, leg.da_amount || 0.0, leg.local_purchase || 0.0
      ]);
    }
  }

  // Helper function to insert sub-details
  const insertSubDetails = async (array, table, columns, valuesExpr) => {
    if (array && array.length > 0) {
      for (const item of array) {
        const cols = ["expense_id", ...columns];
        const placeholders = cols.map(() => "?").join(", ");
        const binds = [newExpId, ...valuesExpr(item)];
        await runWrite(env, `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`, binds);
      }
    }
  };

  await insertSubDetails(breakdown_calls, "expense_breakdown_calls", ["call_no", "hospital_name", "equipment_name", "photo_url"], item => [item.call_no, item.hospital_name, item.equipment_name, item.photo_url || ""]);
  await insertSubDetails(pms_calls, "expense_pms_calls", ["pms_no", "hospital_name", "equipment_name", "photo_url"], item => [item.pms_no, item.hospital_name, item.equipment_name, item.photo_url || ""]);
  await insertSubDetails(calibrates, "expense_calibrations", ["calibration_no", "hospital_name", "equipment_name", "photo_url"], item => [item.calibration_no, item.hospital_name, item.equipment_name, item.photo_url || ""]);
  await insertSubDetails(mobilises, "expense_asset_mobilises", ["mobilise_no", "hospital_name", "equipment_name", "photo_url"], item => [item.mobilise_no, item.hospital_name, item.equipment_name, item.photo_url || ""]);
  await insertSubDetails(taggings, "expense_asset_taggings", ["tagging_no", "hospital_name", "equipment_name", "photo_url"], item => [item.tagging_no, item.hospital_name, item.equipment_name, item.photo_url || ""]);

  // Create approvals level sequence
  const approvalChain = await env.DB.prepare(`
    SELECT a.* 
    FROM hierarchy_approvers a
    JOIN user_approval_chains c ON a.hierarchy_id = c.id
    WHERE LOWER(c.requester_designation) = LOWER(?)
    ORDER BY a.level_number ASC
  `).bind(user.designation || "").all();

  if (approvalChain.results && approvalChain.results.length > 0) {
    for (const step of approvalChain.results) {
      const stepStatus = step.level_number === 1 ? "pending" : "waiting";
      await runWrite(env, `
        INSERT INTO approvals (expense_id, approver_id, level_number, status, comments, created_at, updated_at)
        VALUES (?, ?, ?, ?, '', ?, ?)
      `, [newExpId, step.approver_id, step.level_number, stepStatus, timestamp, timestamp]);

      if (stepStatus === "pending") {
        const approverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(step.approver_id).first();
        if (approverUser) {
          await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 New Claim for Approval', ?, 'warning', 0, '/approval-center', ?)", [
            approverUser.user_id, `${user.name} submitted a new claim ${expenseCode} (₹${amount}) for your review.`, timestamp
          ]);
        }
      }
    }
  } else {
    // If no chain matches, auto approve or assign to manager
    const managerId = user.manager || "Admin";
    const manager = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(managerId).first();
    if (manager) {
      await runWrite(env, `
        INSERT INTO approvals (expense_id, approver_id, level_number, status, comments, created_at, updated_at)
        VALUES (?, ?, 1, 'pending', '', ?, ?)
      `, [newExpId, manager.id, timestamp, timestamp]);

      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 New Claim for Approval', ?, 'warning', 0, '/approval-center', ?)", [
        managerId, `${user.name} submitted a new claim ${expenseCode} (₹${amount}) for your review.`, timestamp
      ]);
    }
  }

  return jsonResponse({
    status: "success",
    message: "Expense claim submitted successfully.",
    expense_id: newExpId,
    expense_code: expenseCode
  });
}
