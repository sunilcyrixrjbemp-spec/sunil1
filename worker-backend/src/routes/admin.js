import { runWrite, runBatchWrite } from "../utils/db.js";
import { getPasswordHash, verifyPassword } from "../utils/security.js";
import { computeBaseLocPolicy, checkIsCommuteLeg, buildPolicyComment } from "./expense.js";
import { jsonResponse } from "../utils/http.js";

/**
 * Internal helper: Re-evaluate existing expenses for a user when their base location changes.
 * Corrects travel_amount and da_amount on all current-month active expenses,
 * updates the expense total, writes a policy comment, and notifies the user.
 */
async function runRetroactivePolicyCheck(env, existingUser, newBaseLocation, timestamp) {
  const today = new Date();
  const MONTH_NAMES = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];
  const currentMonth = MONTH_NAMES[today.getMonth()];
  const currentYear = today.getFullYear();

  // Fetch active expenses for this user (current month, not rejected/draft)
  const expensesRes = await env.DB.prepare(`
    SELECT id, expense_code, itinerary, amount, original_amount
    FROM expenses
    WHERE user_id = ? AND LOWER(month) = LOWER(?) AND year = ?
      AND LOWER(status) NOT IN ('rejected', 'returned_to_draft')
  `).bind(existingUser.id, currentMonth, currentYear).all().catch(err => {
    console.error("Database query failed in runRetroactivePolicyCheck (expenses):", err);
    return { results: [] };
  });

  const expenses = expensesRes.results || [];
  if (expenses.length === 0) return { affected_expenses: 0, total_deducted: 0 };

  // Fetch official hospitals list to resolve dropdown vs custom locations retroactively
  const hospitalsRes = await env.DB.prepare("SELECT DISTINCT hospital_name FROM assets_inventory WHERE hospital_name IS NOT NULL").all().catch(err => {
    console.error("Database query failed in runRetroactivePolicyCheck (hospitals):", err);
    return { results: [] };
  });
  const officialHospitals = new Set((hospitalsRes.results || []).map(h => h.hospital_name.trim().toLowerCase()));

  const baseLocations = (newBaseLocation || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);

  let affectedCount = 0;
  let totalDeducted = 0;
  const batchStatements = [];

  // Fetch legs for all expenses in PARALLEL to eliminate sequential latency
  const allLegsResponses = await Promise.all(
    expenses.map(exp =>
      env.DB.prepare(`
        SELECT itinerary_id, leg_number, from_location, to_location, travel_mode, sub_mode,
          distance_km, travel_amount, sub_amount, da_amount, hotel_amount, local_purchase,
          other_amount, from_district, to_district
        FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC
      `).bind(exp.expense_code).all().catch(err => {
        console.error(`Database query failed for legs of expense ${exp.expense_code}:`, err);
        return { results: [] };
      })
    )
  );

  for (let expIdx = 0; expIdx < expenses.length; expIdx++) {
    const exp = expenses[expIdx];
    const legsRes = allLegsResponses[expIdx];

    const legs = (legsRes.results || []).map(leg => {
      const fromLoc = (leg.from_location || "").trim().toLowerCase();
      const toLoc = (leg.to_location || "").trim().toLowerCase();
      const fromDist = (leg.from_district || "").trim().toLowerCase();
      const toDist = (leg.to_district || "").trim().toLowerCase();
      
      const isOutdoor = fromDist && toDist && fromDist !== toDist;
      const travelType = isOutdoor ? "Outdoor" : "In-District";
      
      // A location is custom if it is not found in the official dropdown hospitals list
      const fromCustom = fromLoc && !officialHospitals.has(fromLoc);
      const toCustom = toLoc && !officialHospitals.has(toLoc);

      return {
        ...leg,
        from: leg.from_location || "",
        to: leg.to_location || "",
        from_custom: fromCustom,
        to_custom: toCustom,
        amount: leg.travel_amount,
        sub_amount: leg.sub_amount,
        da: leg.da_amount,
        travel_type: travelType
      };
    });

    const { isBaseLocOnly, isDaAllowed } = computeBaseLocPolicy(newBaseLocation, legs);
    const hasOutdoorLeg = legs.some(leg => (leg.travel_type || "").trim().toLowerCase() === "outdoor");
    if (hasOutdoorLeg) continue;

    let expenseDeducted = 0;
    let policyApplied = false;
    const retroLegLogs = [];

    for (let idx = 0; idx < legs.length; idx++) {
      const leg = legs[idx];
      const isCommute = !hasOutdoorLeg && checkIsCommuteLeg(leg, baseLocations, idx, legs.length);
      const currentTA = parseFloat(leg.travel_amount || "0");
      const currentSubAmt = parseFloat(leg.sub_amount || "0");
      const currentDA = parseFloat(leg.da_amount || "0");

      const newTA = isCommute ? 0.0 : currentTA;
      const newSubAmt = isCommute ? 0.0 : currentSubAmt;
      const newDA = isDaAllowed ? currentDA : 0.0;

      if (currentTA > newTA) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "travel_amount",
          old_value: currentTA,
          new_value: newTA,
          comment: "[Retroactive] Base Location commute TA not eligible"
        });
      }
      if (currentSubAmt > newSubAmt) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "sub_amount",
          old_value: currentSubAmt,
          new_value: newSubAmt,
          comment: "[Retroactive] Base Location commute local conveyance not eligible"
        });
      }
      if (currentDA > newDA) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "da_amount",
          old_value: currentDA,
          new_value: newDA,
          comment: "[Retroactive] DA not applicable at base location"
        });
      }

      const diff = (currentTA - newTA) + (currentSubAmt - newSubAmt) + (currentDA - newDA);
      if (diff > 0) {
        policyApplied = true;
        expenseDeducted += diff;

        batchStatements.push({
          sql: `
            UPDATE expense_itineraries
            SET travel_amount = ?, sub_amount = ?, da_amount = ?
            WHERE itinerary_id = ?
          `,
          params: [newTA, newSubAmt, newDA, leg.itinerary_id]
        });
      }
    }

    if (policyApplied) {
      const newTotal = parseFloat(exp.amount || 0) - expenseDeducted;
      const newDaTotal = legs.reduce((sum, l, idx) => {
        const isCommute = checkIsCommuteLeg(l, baseLocations, idx, legs.length);
        const currentDA = parseFloat(l.da_amount || "0");
        const newDA = isDaAllowed ? currentDA : 0.0;
        return sum + newDA;
      }, 0);

      batchStatements.push({
        sql: `
          UPDATE expenses SET amount = ?, da_amount = ?, updated_at = ? WHERE id = ?
        `,
        params: [newTotal, newDaTotal, timestamp, exp.id]
      });

      const policyComment = buildPolicyComment(baseLocations, legs, isDaAllowed, exp.itinerary || timestamp.split("T")[0]);
      if (policyComment) {
        batchStatements.push({
          sql: "INSERT INTO expense_edit_logs (expense_id, comment, editor_name, editor_role, editor_id) VALUES (?, ?, 'SYSTEM', 'Policy', 0)",
          params: [exp.id, `[Retroactive] ${policyComment}`]
        });
      }

      // Save leg-level edit history logs
      for (const log of retroLegLogs) {
        batchStatements.push({
          sql: `INSERT INTO expense_edit_logs 
                 (expense_id, leg_number, field_name, old_value, new_value, comment, editor_name, editor_role, editor_id)
                 VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM', 'Policy', 0)`,
          params: [exp.id, log.leg_number, log.field_name, String(log.old_value), String(log.new_value), log.comment]
        });
      }

      // Notify the user
      batchStatements.push({
        sql: "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, 'warning', 0, '/expense', ?)",
        params: [
          existingUser.user_id,
          "⚠️ Expense Adjusted — Base Location Policy",
          `Your expense for ${exp.itinerary || "this period"} has been adjusted per base location TA/DA policy. Commute TA has been deducted.`,
          timestamp
        ]
      });

      affectedCount++;
      totalDeducted += expenseDeducted;
    }
  }

  if (batchStatements.length > 0) {
    await runBatchWrite(env, batchStatements);
  }

  return {
    affected_expenses: affectedCount,
    total_deducted: Math.round(totalDeducted * 100) / 100
  };
}


/**
 * GET /api/admin/users
 */
export async function handleListUsers(request, env, params, query, user) {
  if (user.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const users = await env.DB.prepare(`
    SELECT u.*, r.role
    FROM users u
    LEFT JOIN user_roles r ON u.user_id = r.user_id
    ORDER BY u.name ASC
  `).all();

  return jsonResponse(users.results || []);
}

/**
 * POST /api/admin/users
 * Create or update a user
 */
export async function handleSaveUser(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const {
    id, user_id, name, password, designation, zone, district,
    manager, zonal_manager, coordinator, mobile_number, mail_id, role, user_status
  } = body;

  const timestamp = new Date().toISOString();

  if (id) {
    // UPDATE existing user
    const existing = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!existing) return jsonResponse({ error: "User not found" }, 404);

    const updates = [];
    const bindings = [];

    if (name) { updates.push("name = ?"); bindings.push(name.trim()); }
    if (designation) { updates.push("designation = ?"); bindings.push(designation); }
    if (zone) { updates.push("zone = ?"); bindings.push(zone); }
    if (district) { updates.push("district = ?"); bindings.push(district); }
    if (manager !== undefined) { updates.push("manager = ?"); bindings.push(manager || null); }
    if (zonal_manager !== undefined) { updates.push("zonal_manager = ?"); bindings.push(zonal_manager || null); }
    if (coordinator !== undefined) { updates.push("coordinator = ?"); bindings.push(coordinator || null); }
    if (mobile_number !== undefined) { updates.push("mobile_number = ?"); bindings.push(mobile_number || null); }
    if (mail_id !== undefined) { updates.push("mail_id = ?"); bindings.push(mail_id || null); }
    if (user_status) { updates.push("user_status = ?"); bindings.push(user_status); }

    // Support additional fields in save/update
    if (body.grade !== undefined) { updates.push("grade = ?"); bindings.push(body.grade); }
    if (body.type !== undefined) { updates.push("type = ?"); bindings.push(body.type); }
    if (body.date_of_joining !== undefined) { updates.push("date_of_joining = ?"); bindings.push(body.date_of_joining || null); }
    if (body.date_of_birth !== undefined) { updates.push("date_of_birth = ?"); bindings.push(body.date_of_birth || null); }
    if (body.e_upkaran_id !== undefined) { updates.push("e_upkaran_id = ?"); bindings.push(body.e_upkaran_id); }
    if (body.base_reporting_location !== undefined) { updates.push("base_reporting_location = ?"); bindings.push(body.base_reporting_location); }
    if (body.allowed_windows !== undefined) { updates.push("allowed_windows = ?"); bindings.push(body.allowed_windows); }

    if (password) {
      const newHash = await getPasswordHash(password);
      updates.push("hashed_password = ?");
      bindings.push(newHash);
      
      // Add to password history (record the OLD password before overwriting)
      await runWrite(env, "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)", [
        existing.id, existing.hashed_password, timestamp
      ]);
    }

    if (updates.length > 0) {
      await runWrite(env, `
        UPDATE users SET ${updates.join(", ")}, updated_at = ? WHERE id = ?
      `, [...bindings, timestamp, id]);
    }

    if (role) {
      // Update role
      const roleExists = await env.DB.prepare("SELECT 1 FROM user_roles WHERE user_id = ?").bind(existing.user_id).first();
      if (roleExists) {
        await runWrite(env, "UPDATE user_roles SET role = ? WHERE user_id = ?", [role, existing.user_id]);
      } else {
        await runWrite(env, "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)", [existing.user_id, role, timestamp]);
      }
    }

    // ── Retroactive base location policy check ─────────────────────────────────
    let retroSummary = null;
    if (body.base_reporting_location !== undefined && body.base_reporting_location !== (existing.base_reporting_location || "")) {
      try {
        retroSummary = await runRetroactivePolicyCheck(env, existing, body.base_reporting_location, timestamp);
      } catch (e) {
        console.error("Retroactive policy check failed:", e.message);
      }
    }

    return jsonResponse({
      status: "success",
      message: "User updated successfully",
      ...(retroSummary ? { policy_adjustment: retroSummary } : {})
    });
  } else {
    // CREATE new user
    const cleanUserId = (user_id || body.e_code || "").trim();
    if (!cleanUserId || !password || !name) {
      return jsonResponse({ error: "user_id/e_code, password, and name are required" }, 400);
    }

    const existing = await env.DB.prepare("SELECT 1 FROM users WHERE user_id = ?").bind(cleanUserId).first();
    if (existing) {
      return jsonResponse({ error: "User ID already exists" }, 400);
    }

    const hashed = await getPasswordHash(password);
    await runWrite(env, `
      INSERT INTO users (
        user_id, e_code, name, hashed_password, user_status, designation, 
        zone, district, manager, zonal_manager, coordinator, mobile_number, 
        mail_id, grade, type, date_of_joining, date_of_birth, e_upkaran_id, 
        base_reporting_location, allowed_windows, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanUserId, cleanUserId, name.trim(), hashed, user_status || "active", designation || "", 
      zone || "", district || "", manager || null, zonal_manager || null, coordinator || null, mobile_number || null, 
      mail_id || null, body.grade || "", body.type || "", body.date_of_joining || null, body.date_of_birth || null, body.e_upkaran_id || "", 
      body.base_reporting_location || "", body.allowed_windows || "home,expense,help,profile", timestamp, timestamp
    ]);

    await runWrite(env, "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)", [
      cleanUserId, role || "user", timestamp
    ]);

    return jsonResponse({ status: "success", message: "User created successfully" });
  }
}

/**
 * DELETE /api/admin/users/:user_id
 */
export async function handleBulkCreateUsers(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let payload;
  try { payload = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  if (!Array.isArray(payload)) {
    return jsonResponse({ error: "Payload must be an array of user objects" }, 400);
  }

  const timestamp = new Date().toISOString();
  let createdCount = 0;
  const errors = [];

  // Pre-fetch all users with their roles joined into memory for O(1) lookups
  const allUsersRes = await env.DB.prepare(`
    SELECT u.*, r.role as role
    FROM users u
    LEFT JOIN user_roles r ON u.user_id = r.user_id
  `).all();
  
  const allUsersMap = new Map();
  const userIdSet = new Set();
  const eCodeSet = new Set();
  const nameSet = new Set();

  for (const u of (allUsersRes.results || [])) {
    const uidLower = (u.user_id || "").toLowerCase();
    allUsersMap.set(uidLower, u);
    userIdSet.add(uidLower);
    if (u.e_code) eCodeSet.add(u.e_code.toLowerCase());
    if (u.name) nameSet.add(u.name.toLowerCase());
  }

  const batchStatements = [];

  for (let index = 0; index < payload.length; index++) {
    const item = payload[index];
    const eCode = String(item.e_code || "").trim();
    if (!eCode) { errors.push(`Row ${index + 1}: Missing Employee Code. Skipped.`); continue; }

    const existing = allUsersMap.get(eCode.toLowerCase());
    const nameCl = String(item.name || "").trim();

    if (!existing && !nameCl) { errors.push(`Row ${index + 1} (${eCode}): Missing Name. Skipped.`); continue; }

    // Resolve manager/coordinator references
    const resolveRef = (val) => {
      if (!val || !val.trim()) return "";
      const vl = val.trim().toLowerCase();
      return (userIdSet.has(vl) || eCodeSet.has(vl) || nameSet.has(vl)) ? val.trim() : "";
    };

    const managerCl = resolveRef(String(item.manager || ""));
    const zonalMgrCl = resolveRef(String(item.zonal_manager || ""));
    const coordCl = resolveRef(String(item.coordinator || ""));
    const roleCl = String(item.role || "").trim();
    const typeCl = String(item.type || "Employee").trim();

    const autoWindows = roleCl.toLowerCase() === "engineer"
      ? "home,expense,help,profile"
      : roleCl.toLowerCase() === "manager"
        ? "home,approval,expense,help,profile"
        : "home,approval,expense,analysis,report,help,profile";

    try {
      if (existing) {
        let passwordChanged = false;
        let newPasswordHash = null;
        if (item.password) {
          const plainPwd = String(item.password).trim();
          const isSamePassword = await verifyPassword(plainPwd, existing.hashed_password);
          if (!isSamePassword) {
            passwordChanged = true;
            newPasswordHash = await getPasswordHash(plainPwd);
          }
        }

        const fieldUpdates = [];
        const fieldBinds = [];

        const isDiff = (val1, val2) => {
          const v1 = val1 === undefined || val1 === null ? "" : String(val1).trim();
          const v2 = val2 === undefined || val2 === null ? "" : String(val2).trim();
          return v1 !== v2;
        };

        if (item.designation !== undefined && isDiff(item.designation, existing.designation)) {
          fieldUpdates.push("designation = ?"); fieldBinds.push(String(item.designation).trim());
        }
        if (item.grade !== undefined && isDiff(item.grade, existing.grade)) {
          fieldUpdates.push("grade = ?"); fieldBinds.push(String(item.grade).trim());
        }
        if (item.district !== undefined && isDiff(item.district, existing.district)) {
          fieldUpdates.push("district = ?"); fieldBinds.push(String(item.district).trim());
        }
        if (item.zone !== undefined && isDiff(item.zone, existing.zone)) {
          fieldUpdates.push("zone = ?"); fieldBinds.push(String(item.zone).trim());
        }
        if (item.mobile_number !== undefined && isDiff(item.mobile_number, existing.mobile_number)) {
          fieldUpdates.push("mobile_number = ?"); fieldBinds.push(String(item.mobile_number).trim());
        }
        if (item.mail_id !== undefined && isDiff(item.mail_id, existing.mail_id)) {
          fieldUpdates.push("mail_id = ?"); fieldBinds.push(String(item.mail_id).trim());
        }
        if (item.date_of_joining !== undefined && isDiff(item.date_of_joining, existing.date_of_joining)) {
          fieldUpdates.push("date_of_joining = ?"); fieldBinds.push(String(item.date_of_joining).trim() || null);
        }
        if (item.date_of_birth !== undefined && isDiff(item.date_of_birth, existing.date_of_birth)) {
          fieldUpdates.push("date_of_birth = ?"); fieldBinds.push(String(item.date_of_birth).trim() || null);
        }
        if (item.e_upkaran_id !== undefined && isDiff(item.e_upkaran_id, existing.e_upkaran_id)) {
          fieldUpdates.push("e_upkaran_id = ?"); fieldBinds.push(String(item.e_upkaran_id).trim());
        }
        if (managerCl !== undefined && isDiff(managerCl, existing.manager)) {
          fieldUpdates.push("manager = ?"); fieldBinds.push(managerCl || null);
        }
        if (zonalMgrCl !== undefined && isDiff(zonalMgrCl, existing.zonal_manager)) {
          fieldUpdates.push("zonal_manager = ?"); fieldBinds.push(zonalMgrCl || null);
        }
        if (coordCl !== undefined && isDiff(coordCl, existing.coordinator)) {
          fieldUpdates.push("coordinator = ?"); fieldBinds.push(coordCl || null);
        }
        if (roleCl && isDiff(roleCl, existing.role)) {
          fieldUpdates.push("role = ?"); fieldBinds.push(roleCl);
        }
        if (typeCl && isDiff(typeCl, existing.type)) {
          fieldUpdates.push("type = ?"); fieldBinds.push(typeCl);
        }

        const targetWindows = item.allowed_windows ? String(item.allowed_windows).trim() : (roleCl ? autoWindows : existing.allowed_windows);
        if (targetWindows !== undefined && isDiff(targetWindows, existing.allowed_windows)) {
          fieldUpdates.push("allowed_windows = ?"); fieldBinds.push(targetWindows);
        }

        if (passwordChanged && newPasswordHash) {
          fieldUpdates.push("hashed_password = ?"); fieldBinds.push(newPasswordHash);
          batchStatements.push({
            sql: "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)",
            params: [existing.id, newPasswordHash, timestamp]
          });
        }

        if (fieldUpdates.length > 0) {
          fieldBinds.push(timestamp); fieldBinds.push(existing.id);
          batchStatements.push({
            sql: `UPDATE users SET ${fieldUpdates.join(", ")}, updated_at = ? WHERE id = ?`,
            params: fieldBinds
          });
          if (roleCl && isDiff(roleCl, existing.role)) {
            batchStatements.push({
              sql: "DELETE FROM user_roles WHERE user_id = ?",
              params: [existing.user_id]
            });
            batchStatements.push({
              sql: "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)",
              params: [existing.user_id, roleCl, timestamp]
            });
          }
          createdCount++;
        }
      } else {
        const pwd = String(item.password || "").trim();
        if (!pwd) { errors.push(`Row ${index + 1} (${eCode}): Missing Password. Skipped.`); continue; }
        const hashed = await getPasswordHash(pwd);
        
        batchStatements.push({
          sql: `INSERT INTO users (user_id, e_code, name, hashed_password, user_status, designation, grade, district, zone, manager, zonal_manager, coordinator, mobile_number, mail_id, role, type, date_of_joining, date_of_birth, e_upkaran_id, allowed_windows, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [eCode, eCode, nameCl, hashed,
            String(item.designation || "").trim(),
            String(item.grade || "").trim(),
            String(item.district || "").trim(),
            String(item.zone || "").trim(),
            managerCl, zonalMgrCl, coordCl,
            String(item.mobile_number || "").trim(),
            String(item.mail_id || "").trim(),
            roleCl, typeCl,
            item.date_of_joining || null,
            item.date_of_birth || null,
            item.e_upkaran_id ? String(item.e_upkaran_id).trim() : null,
            item.allowed_windows ? String(item.allowed_windows).trim() : autoWindows,
            timestamp, timestamp
          ]
        });

        // 160+ IQ subquery to insert password history in same batch without fetching ID synchronously first
        batchStatements.push({
          sql: "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES ((SELECT id FROM users WHERE user_id = ?), ?, ?)",
          params: [eCode, hashed, timestamp]
        });

        batchStatements.push({
          sql: "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)",
          params: [eCode, roleCl || "user", timestamp]
        });

        userIdSet.add(eCode.toLowerCase());
        eCodeSet.add(eCode.toLowerCase());
        nameSet.add(nameCl.toLowerCase());
        createdCount++;
      }
    } catch (ex) {
      errors.push(`Row ${index + 1} (${eCode}): Failed due to ${ex.message}`);
    }
  }

  // Execute all accumulated statements in a single batch transaction
  if (batchStatements.length > 0) {
    await runBatchWrite(env, batchStatements);
  }

  return jsonResponse({
    status: "success",
    created_count: createdCount,
    failed_count: errors.length,
    errors
  });
}

export async function handleDeleteUser(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const userId = params.user_id;
  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
  if (!user) return jsonResponse({ error: "User not found" }, 404);

  // Run in a single transactional batch
  const statements = [
    { sql: "DELETE FROM user_roles WHERE user_id = ?", params: [userId] },
    { sql: "DELETE FROM password_histories WHERE user_id = ?", params: [user.id] },
    { sql: "DELETE FROM login_logs WHERE user_id = ?", params: [userId] },
    { sql: "DELETE FROM users WHERE id = ?", params: [user.id] }
  ];

  await runBatchWrite(env, statements);
  return jsonResponse({ status: "success", message: "User deleted successfully" });
}

/**
 * GET /api/admin/hierarchies
 */
export async function handleListHierarchies(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  // Fetch all approval hierarchies
  const chainsRes = await env.DB.prepare("SELECT * FROM approval_hierarchies ORDER BY id ASC").all();
  const chains = chainsRes.results || [];

  if (chains.length === 0) {
    return jsonResponse([]);
  }

  // Fetch all requesters
  const requestersRes = await env.DB.prepare(`
    SELECT hr.id, hr.hierarchy_id, hr.user_id, u.name AS user_name, u.user_id AS user_code
    FROM hierarchy_requesters hr
    JOIN users u ON hr.user_id = u.id
  `).all();
  const requesters = requestersRes.results || [];

  // Fetch all approvers
  const approversRes = await env.DB.prepare(`
    SELECT ha.id, ha.hierarchy_id, ha.level_number, ha.approver_id, u.name AS approver_name, u.user_id AS approver_code, ur.role AS approver_role
    FROM hierarchy_approvers ha
    JOIN users u ON ha.approver_id = u.id
    LEFT JOIN user_roles ur ON u.user_id = ur.user_id
  `).all();
  const approvers = approversRes.results || [];

  // Map them together
  const list = chains.map(chain => {
    const chainRequesters = requesters
      .filter(r => r.hierarchy_id === chain.id)
      .map(r => ({
        id: r.id,
        user_id: r.user_id,
        user_name: r.user_name,
        user_code: r.user_code
      }));

    const chainApprovers = approvers
      .filter(a => a.hierarchy_id === chain.id)
      .map(a => ({
        id: a.id,
        level_number: a.level_number,
        approver_id: a.approver_id,
        approver_name: a.approver_name,
        approver_code: a.approver_code,
        approver_role: a.approver_role || "user"
      }))
      .sort((a, b) => a.level_number - b.level_number);

    return {
      id: chain.id,
      name: chain.name || "",
      requesters: chainRequesters,
      approvers: chainApprovers,
      created_at: chain.created_at,
      updated_at: chain.updated_at
    };
  });

  return jsonResponse(list);
}

/**
 * POST /api/admin/hierarchies
 * Save/update approval chains
 */
export async function handleSaveHierarchy(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // Frontend payload: { id?, name, requester_ids: number[], approvers: { level_number, approver_id }[] }
  const { id, name, requester_ids, approvers } = body;
  if (!name || !name.trim()) {
    return jsonResponse({ error: "Hierarchy name is required" }, 400);
  }

  const timestamp = new Date().toISOString();
  let hId = id;

  if (id) {
    // UPDATE
    const existing = await env.DB.prepare("SELECT 1 FROM approval_hierarchies WHERE id = ?").bind(id).first();
    if (!existing) return jsonResponse({ error: "Hierarchy not found" }, 404);

    await runWrite(env, "UPDATE approval_hierarchies SET name = ? WHERE id = ?", [name.trim(), id]);
    
    // Clear old mappings
    await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [id]);
    await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [id]);
  } else {
    // CREATE
    const result = await runWrite(env, "INSERT INTO approval_hierarchies (name) VALUES (?)", [name.trim()]);
    hId = result.meta?.last_row_id;
    if (!hId) {
      return jsonResponse({ error: "Failed to create hierarchy" }, 500);
    }
  }

  // Insert new requesters
  if (requester_ids && Array.isArray(requester_ids)) {
    for (const reqId of requester_ids) {
      if (reqId) {
        await runWrite(env, "INSERT INTO hierarchy_requesters (hierarchy_id, user_id) VALUES (?, ?)", [hId, reqId]);
      }
    }
  }

  // Insert new approvers
  if (approvers && Array.isArray(approvers)) {
    for (const app of approvers) {
      if (app && app.approver_id && app.level_number) {
        await runWrite(env, "INSERT INTO hierarchy_approvers (hierarchy_id, level_number, approver_id) VALUES (?, ?, ?)", [hId, app.level_number, app.approver_id]);
      }
    }
  }

  return jsonResponse({ status: "success", message: "Hierarchy mappings saved successfully" });
}

/**
 * PUT /api/admin/users/:user_id
 * Update user details (mirrors Python update_user logic)
 */
export async function handleUpdateUser(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const userId = params.user_id;
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
  if (!user) return jsonResponse({ error: `User '${userId}' not found.` }, 404);

  const timestamp = new Date().toISOString();
  const updates = [];
  const bindings = [];
  const batchStatements = [];

  // Handle sensitive fields: new_user_id, new_e_code, password
  const newUserId = body.new_user_id?.trim();
  const newECode = body.new_e_code?.trim();
  const isUidChanged = newUserId && newUserId !== user.user_id;
  const isEcodeChanged = newECode && newECode !== user.e_code;
  const isPasswordChanged = body.password && body.password.trim() !== "";

  if (isUidChanged || isEcodeChanged || isPasswordChanged) {
    const adminSecPw = body.admin_update_password || "";
    const expectedPw = (env.ADMIN_UPDATE_PASSWORD || "012001@Sunil").trim();
    if (adminSecPw.trim() !== expectedPw) {
      return jsonResponse({ error: "Invalid admin security password to change User ID / Employee Code / Password." }, 400);
    }
    if (isUidChanged) {
      const existingUid = await env.DB.prepare("SELECT 1 FROM users WHERE user_id = ?").bind(newUserId).first();
      if (existingUid) return jsonResponse({ error: `User ID '${newUserId}' is already in use.` }, 400);
    }
    if (isEcodeChanged) {
      const existingEc = await env.DB.prepare("SELECT 1 FROM users WHERE e_code = ?").bind(newECode).first();
      if (existingEc) return jsonResponse({ error: `Employee Code '${newECode}' is already in use.` }, 400);
    }
    if (isPasswordChanged) {
      const newHash = await getPasswordHash(body.password.trim());
      updates.push("hashed_password = ?"); bindings.push(newHash);
      batchStatements.push({
        sql: "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)",
        params: [user.id, newHash, timestamp]
      });
    }
    if (isUidChanged) {
      updates.push("user_id = ?"); bindings.push(newUserId);
    }
    if (isEcodeChanged || isUidChanged) {
      updates.push("e_code = ?"); bindings.push(newECode || user.e_code);
    }
  }

  // Standard field updates
  const fieldMap = {
    name: "name", designation: "designation", grade: "grade", district: "district",
    zone: "zone", manager: "manager", zonal_manager: "zonal_manager", coordinator: "coordinator",
    mobile_number: "mobile_number", mail_id: "mail_id", type: "type",
    date_of_joining: "date_of_joining", date_of_birth: "date_of_birth",
    e_upkaran_id: "e_upkaran_id", base_reporting_location: "base_reporting_location", allowed_windows: "allowed_windows"
  };

  for (const [reqField, dbField] of Object.entries(fieldMap)) {
    if (body[reqField] !== undefined) {
      updates.push(`${dbField} = ?`);
      bindings.push(body[reqField]);
    }
  }

  if (body.user_status !== undefined) {
    const statusClean = body.user_status.trim().toLowerCase();
    if (!["active", "locked", "disabled"].includes(statusClean)) {
      return jsonResponse({ error: "Status must be 'active', 'locked', or 'disabled'." }, 400);
    }
    updates.push("user_status = ?"); bindings.push(statusClean);
    if (statusClean === "active") { updates.push("failed_attempt = ?"); bindings.push(0); }
  }

  if (body.role !== undefined) {
    updates.push("role = ?"); bindings.push(body.role);
  }

  // 1. Prepare role & target user_id values
  const targetRole = body.role || user.role;
  const targetUid = isUidChanged ? newUserId : user.user_id;

  // Deleting user_roles FIRST avoids SQLITE_CONSTRAINT_FOREIGNKEY when updating users(user_id)
  batchStatements.push({
    sql: "DELETE FROM user_roles WHERE user_id = ? OR user_id = ?",
    params: [user.user_id, targetUid]
  });

  // 2. UPDATE USERS TABLE
  if (updates.length > 0) {
    bindings.push(timestamp);
    bindings.push(user.id);
    batchStatements.push({
      sql: `UPDATE users SET ${updates.join(", ")}, updated_at = ? WHERE id = ?`,
      params: bindings
    });
  }

  // 3. Re-insert user_roles entry with targetUid (which now exists in users table)
  if (targetRole) {
    batchStatements.push({
      sql: "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)",
      params: [targetUid, targetRole, timestamp]
    });
  }

  // 4. Cascading updates for child tables storing user_id / e_code / names
  if (isUidChanged) {
    batchStatements.push({
      sql: "UPDATE limit_approval_requests SET user_id = ? WHERE user_id = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE limit_approval_requests SET manager_id = ? WHERE manager_id = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE kpi_appraisals SET user_id = ? WHERE user_id = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE engineer_advances SET user_id = ? WHERE user_id = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE engineer_advances SET created_by = ? WHERE created_by = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE login_logs SET user_id = ? WHERE user_id = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE otps SET user_id = ? WHERE user_id = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE db_op_logs SET user_id = ? WHERE user_id = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE users SET manager = ? WHERE manager = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE users SET zonal_manager = ? WHERE zonal_manager = ?",
      params: [newUserId, user.user_id]
    });
    batchStatements.push({
      sql: "UPDATE users SET coordinator = ? WHERE coordinator = ?",
      params: [newUserId, user.user_id]
    });
  }

  if (body.name && body.name.trim() !== user.name) {
    const newName = body.name.trim();
    batchStatements.push({
      sql: "UPDATE db_op_logs SET user_name = ? WHERE user_name = ?",
      params: [newName, user.name]
    });
    batchStatements.push({
      sql: "UPDATE users SET manager = ? WHERE manager = ?",
      params: [newName, user.name]
    });
    batchStatements.push({
      sql: "UPDATE users SET zonal_manager = ? WHERE zonal_manager = ?",
      params: [newName, user.name]
    });
    batchStatements.push({
      sql: "UPDATE users SET coordinator = ? WHERE coordinator = ?",
      params: [newName, user.name]
    });
  }

  if (batchStatements.length > 0) {
    await runBatchWrite(env, batchStatements);
  }

  // ── Retroactive base location policy check (if location changed) ────────────
  let retroSummary = null;
  const oldBaseLocation = user.base_reporting_location || "";
  const newBaseLocation = body.base_reporting_location;
  if (newBaseLocation !== undefined && newBaseLocation !== oldBaseLocation) {
    try {
      retroSummary = await runRetroactivePolicyCheck(env, user, newBaseLocation, timestamp);
    } catch (e) {
      console.error("Retroactive policy check failed in handleUpdateUser:", e.message);
    }
  }

  // Return updated user
  const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  const roleRow = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(updatedUser.user_id).first();
  const result = { ...updatedUser, role: roleRow?.role || "user" };
  delete result.hashed_password;

  return jsonResponse({
    ...result,
    ...(retroSummary && retroSummary.affected_expenses > 0 ? {
      policy_adjustment: {
        message: `Base location policy applied. ${retroSummary.affected_expenses} expense(s) adjusted. Total deducted: ₹${retroSummary.total_deducted}.`,
        affected_expenses: retroSummary.affected_expenses,
        total_deducted: retroSummary.total_deducted
      }
    } : {})
  });
}


/**
 * GET /api/admin/eligible-approvers
 * Returns all users (same as users list) who can be approvers
 */
export async function handleGetEligibleApprovers(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  const users = await env.DB.prepare("SELECT * FROM users ORDER BY name ASC").all();
  const result = (users.results || []).map(u => { const o = {...u}; delete o.hashed_password; return o; });
  return jsonResponse(result);
}

/**
 * DELETE /api/admin/hierarchies/:id
 */
export async function handleDeleteHierarchy(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  const hierarchyId = parseInt(params.id, 10);
  if (!hierarchyId) return jsonResponse({ error: "Invalid hierarchy ID" }, 400);

  const existing = await env.DB.prepare("SELECT 1 FROM approval_hierarchies WHERE id = ?").bind(hierarchyId).first();
  if (!existing) return jsonResponse({ error: "Hierarchy not found" }, 404);

  await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [hierarchyId]);
  await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [hierarchyId]);
  await runWrite(env, "DELETE FROM approval_hierarchies WHERE id = ?", [hierarchyId]);

  return jsonResponse({ status: "success", message: "Hierarchy deleted successfully" });
}

/**
 * POST /api/admin/logout-all
 * Logs out all users by clearing all active session IDs
 */
export async function handleLogoutAllUsers(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  await runWrite(env, "UPDATE users SET active_session_id = NULL", []);
  return jsonResponse({ status: "success", message: "All users have been logged out" });
}

/**
 * POST /api/admin/logout-user/:user_code
 */
export async function handleLogoutSingleUser(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  const userCode = params.user_code;
  const user = await env.DB.prepare("SELECT 1 FROM users WHERE user_id = ?").bind(userCode).first();
  if (!user) return jsonResponse({ error: "User not found" }, 404);

  await runWrite(env, "UPDATE users SET active_session_id = NULL WHERE user_id = ?", [userCode]);
  return jsonResponse({ status: "success", message: `User ${userCode} has been logged out` });
}

/**
 * GET /api/admin/hierarchies/export
 * Export hierarchies as CSV (returns JSON of CSV-structured rows for frontend processing)
 */
export async function handleExportHierarchies(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const hierarchiesRes = await env.DB.prepare("SELECT * FROM approval_hierarchies ORDER BY id ASC").all();
  const hierarchies = hierarchiesRes.results || [];
  const rows = [];
  rows.push(["hierarchy_name", "requester_e_codes", "level_1_approver", "level_2_approver", "level_3_approver", "level_4_approver", "level_5_approver"]);

  if (hierarchies.length === 0) {
    return jsonResponse({ status: "success", rows });
  }

  // Fetch all requesters in a single query
  const requestersRes = await env.DB.prepare(`
    SELECT hr.hierarchy_id, u.e_code, u.user_id FROM hierarchy_requesters hr
    JOIN users u ON hr.user_id = u.id
  `).all();
  const requesters = requestersRes.results || [];

  const requestersMap = {};
  for (const r of requesters) {
    if (!requestersMap[r.hierarchy_id]) {
      requestersMap[r.hierarchy_id] = [];
    }
    requestersMap[r.hierarchy_id].push(r);
  }

  // Fetch all approvers in a single query
  const approversRes = await env.DB.prepare(`
    SELECT ha.hierarchy_id, ha.level_number, u.e_code, u.user_id FROM hierarchy_approvers ha
    JOIN users u ON ha.approver_id = u.id
  `).all();
  const approvers = approversRes.results || [];

  const approversMap = {};
  for (const a of approvers) {
    if (!approversMap[a.hierarchy_id]) {
      approversMap[a.hierarchy_id] = [];
    }
    approversMap[a.hierarchy_id].push(a);
  }

  for (const h of hierarchies) {
    const chainRequesters = requestersMap[h.id] || [];
    const chainApprovers = approversMap[h.id] || [];

    const reqCodes = chainRequesters.map(r => r.e_code || r.user_id).join(",");
    const lvlApps = ["", "", "", "", ""];
    for (const a of chainApprovers) {
      if (a.level_number >= 1 && a.level_number <= 5) {
        lvlApps[a.level_number - 1] = a.e_code || a.user_id;
      }
    }
    rows.push([h.name || h.chain_name || "", reqCodes, ...lvlApps]);
  }

  // Return as JSON array (frontend will convert to CSV/blob for download)
  return jsonResponse({ status: "success", rows });
}

/**
 * POST /api/admin/hierarchies/bulk
 * Bulk import hierarchies from CSV-parsed JSON rows
 */
export async function handleBulkImportHierarchies(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  const rows = body.rows || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonResponse({ error: "No rows provided" }, 400);
  }

  const timestamp = new Date().toISOString();
  let createdCount = 0;
  const errors = [];

  // Pre-fetch all users for quick lookup
  const allUsersRes = await env.DB.prepare("SELECT id, user_id, e_code FROM users").all();
  const userByECode = {};
  const userByUserId = {};
  for (const u of (allUsersRes.results || [])) {
    if (u.e_code) userByECode[u.e_code.toLowerCase()] = u;
    if (u.user_id) userByUserId[u.user_id.toLowerCase()] = u;
  }

  const findUser = (code) => {
    if (!code) return null;
    const cl = code.trim().toLowerCase();
    return userByECode[cl] || userByUserId[cl] || null;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hierarchyName = String(row.hierarchy_name || "").trim();
    if (!hierarchyName) { errors.push(`Row ${i + 1}: Missing hierarchy_name`); continue; }

    try {
      // Check if hierarchy already exists
      let existingH = await env.DB.prepare("SELECT id FROM approval_hierarchies WHERE name = ?").bind(hierarchyName).first();
      let hId;

      if (existingH) {
        hId = existingH.id;
        await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [hId]);
        await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [hId]);
      } else {
        const hResult = await runWrite(env, "INSERT INTO approval_hierarchies (name) VALUES (?)", [hierarchyName]);
        hId = hResult.meta?.last_row_id;
        if (!hId) throw new Error("Failed to create hierarchy");
      }

      // Insert requesters
      const requesterCodes = String(row.requester_e_codes || "").split(",").map(s => s.trim()).filter(Boolean);
      for (const code of requesterCodes) {
        const u = findUser(code);
        if (u) {
          await runWrite(env, "INSERT INTO hierarchy_requesters (hierarchy_id, user_id) VALUES (?, ?)", [hId, u.id]);
        }
      }

      // Insert level approvers
      for (let lvl = 1; lvl <= 5; lvl++) {
        const approverCode = row[`level_${lvl}_approver`];
        if (!approverCode) continue;
        const u = findUser(String(approverCode).trim());
        if (u) {
          await runWrite(env, "INSERT INTO hierarchy_approvers (hierarchy_id, level_number, approver_id) VALUES (?, ?, ?)", [hId, lvl, u.id]);
        }
      }

      createdCount++;
    } catch (ex) {
      errors.push(`Row ${i + 1} (${hierarchyName}): ${ex.message}`);
    }
  }

  return jsonResponse({ status: "success", created_count: createdCount, failed_count: errors.length, errors });
}

/**
 * GET /api/admin/settings
 */
export async function handleGetSystemSettings(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  try {
    const rowsRes = await env.DB.prepare("SELECT * FROM system_settings").all();
    const rows = rowsRes.results || [];
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    return jsonResponse({ success: true, settings });
  } catch (err) {
    return jsonResponse({ error: "Failed to fetch settings", detail: err.message }, 500);
  }
}

/**
 * POST /api/admin/settings
 */
export async function handleSaveSystemSettings(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const settings = body.settings || {};
  const statements = [];
  for (const [key, value] of Object.entries(settings)) {
    statements.push({
      sql: "INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)",
      params: [key, String(value)]
    });
  }

  try {
    if (statements.length > 0) {
      await runBatchWrite(env, statements);
    }
    return jsonResponse({ success: true, message: "Settings saved successfully" });
  } catch (err) {
    return jsonResponse({ error: "Failed to save settings", detail: err.message }, 500);
  }
}

/**
 * GET /api/admin/expenses/rejected
 */
export async function handleSearchRejectedExpenses(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const search = (query.get("search") || "").trim().toLowerCase();

  try {
    let sql = `
      SELECT e.id, e.expense_code, e.amount, e.status, e.itinerary as expense_date, e.description, 
             u.name as employee_name, u.user_id as employee_code
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.status = 'rejected'
    `;
    const bindParams = [];

    if (search) {
      sql += ` AND (LOWER(e.expense_code) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(u.user_id) LIKE ?)`;
      const term = `%${search}%`;
      bindParams.push(term, term, term);
    }

    sql += ` ORDER BY e.itinerary DESC, e.id DESC`;

    const results = await env.DB.prepare(sql).bind(...bindParams).all();
    return jsonResponse({ success: true, data: results.results || [] });
  } catch (err) {
    return jsonResponse({ error: "Failed to retrieve rejected expenses", detail: err.message }, 500);
  }
}

/**
 * POST /api/admin/expenses/:expense_id/resubmit
 */
export async function handleResubmitRejectedExpense(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const expenseId = parseInt(params.expense_id, 10);
  if (!expenseId) {
    return jsonResponse({ error: "Invalid expense ID" }, 400);
  }

  const timestamp = new Date().toISOString();

  // 1. Fetch the expense
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) {
    return jsonResponse({ error: "Expense claim not found" }, 404);
  }

  if (expense.status !== "rejected") {
    return jsonResponse({ error: "Only rejected expense claims can be re-submitted" }, 400);
  }

  // 2. Query the user and hierarchy approval chain for this expense's creator
  const approvalChain = await env.DB.prepare(`
    SELECT a.* 
    FROM hierarchy_approvers a
    JOIN hierarchy_requesters hr ON a.hierarchy_id = hr.hierarchy_id
    WHERE hr.user_id = ?
    ORDER BY a.level_number ASC
  `).bind(expense.user_id).all();

  const approvals = approvalChain.results || [];
  if (approvals.length === 0) {
    return jsonResponse({ error: "This employee is not mapped to any approval hierarchy team. Cannot route for approval." }, 400);
  }

  const statements = [];

  // 3. Reset the expense status to 'submitted'
  statements.push({
    sql: "UPDATE expenses SET status = 'submitted', updated_at = ? WHERE id = ?",
    params: [timestamp, expenseId]
  });

  // 4. Re-create or reset approvals records
  statements.push({
    sql: "DELETE FROM approvals WHERE expense_id = ?",
    params: [expenseId]
  });

  for (const step of approvals) {
    statements.push({
      sql: `INSERT INTO approvals (expense_id, approver_id, level_number, status, comments, created_at, updated_at)
            VALUES (?, ?, ?, ?, '', ?, ?)`,
      params: [
        expenseId,
        step.approver_id,
        step.level_number,
        step.level_number === 1 ? "pending" : "waiting",
        timestamp,
        timestamp
      ]
    });
  }

  try {
    await runBatchWrite(env, statements);

    // 5. Send notifications
    const creatorUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
    const firstApproverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(approvals[0].approver_id).first();

    if (creatorUser) {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '🔄 Claim Reset to Submitted', ?, 'info', 0, '/home', ?)", [
        creatorUser.user_id,
        `Your rejected claim ${expense.expense_code} has been reset to Submitted by the administrator.`,
        timestamp
      ]);
    }

    if (firstApproverUser) {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 New Claim for Approval (Reset)', ?, 'warning', 0, '/approval-center', ?)", [
        firstApproverUser.user_id,
        `Claim ${expense.expense_code} (₹${expense.amount}) has been reset by the Admin and is pending your review.`,
        timestamp
      ]);
    }

    return jsonResponse({ success: true, message: "Expense claim status reset to Submitted successfully." });
  } catch (err) {
    return jsonResponse({ error: "Failed to resubmit expense claim", detail: err.message }, 500);
  }
}

/**
 * POST /api/admin/one-time-adjust
 * Runs a one-time trigger across ALL users with a mapped base_reporting_location
 * and corrects their active current-month claims per travel policy.
 */
export async function handleOneTimeAdjust(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const timestamp = new Date().toISOString();

  // Ensure Shahrukh Ali's base reporting location is mapped
  await env.DB.prepare(`
    UPDATE users 
    SET base_reporting_location = 'District Sahadat Hospital Tonk DH' 
    WHERE name = 'Shahrukh Ali' AND (base_reporting_location IS NULL OR base_reporting_location = '')
  `).run().catch(() => null);

  // Run database diagnostics to identify why zero claims are matching
  const diagTotalUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first().then(r => r?.count).catch(() => 0);
  const diagMappedUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE base_reporting_location IS NOT NULL AND base_reporting_location != ''").first().then(r => r?.count).catch(() => 0);
  const diagJulyClaims = await env.DB.prepare("SELECT COUNT(*) as count FROM expenses WHERE LOWER(month) = 'july' AND year = 2026").first().then(r => r?.count).catch(() => 0);

  // Trace specific target expenses to analyze why they got TA
  const idsToTrace = [9, 39, 40, 41, 894];
  const traceResults = [];
  for (const id of idsToTrace) {
    const exp = await env.DB.prepare("SELECT * FROM expenses WHERE id = ? OR expense_code LIKE ?")
      .bind(id, `%-${String(id).padStart(6, '0')}`).first().catch(() => null);
    if (exp) {
      const userRec = await env.DB.prepare("SELECT name, base_reporting_location FROM users WHERE id = ? OR user_id = ?")
        .bind(exp.user_id, exp.user_id).first().catch(() => null);
      const userStr = userRec ? `${userRec.name} (Base:${userRec.base_reporting_location})` : `User:${exp.user_id}`;
      const legs = await env.DB.prepare("SELECT * FROM expense_itineraries WHERE exp_id = ?").bind(exp.expense_code).all().catch(() => ({ results: [] }));
      const legDetails = (legs.results || []).map(l => `${l.leg_number}:${l.from_location}->${l.to_location}(TA=${l.travel_amount},Sub=${l.sub_amount},DA=${l.da_amount},fDist=${l.from_district},tDist=${l.to_district})`).join(" | ");
      traceResults.push(`ID ${id} (${exp.expense_code}, ${userStr}): Month:${exp.month}, Amount:${exp.amount}, Legs:[${legDetails}]`);
    } else {
      traceResults.push(`ID ${id} not found`);
    }
  }
  const allUsersDb = await env.DB.prepare("SELECT id, user_id, name, base_reporting_location FROM users").all().catch(() => ({ results: [] }));
  const userListStr = (allUsersDb.results || []).map(u => `${u.name}(Base:${u.base_reporting_location},UID:${u.user_id})`).join(" | ");
  const exp894Trace = traceResults.join(" || ") + " || USERS: " + userListStr;
  const diagSampleMonths = await env.DB.prepare("SELECT DISTINCT month, year FROM expenses LIMIT 5").all().then(r => (r.results || []).map(x => `${x.month} ${x.year}`).join(", ")).catch(() => "error");
  const diagSampleBases = await env.DB.prepare("SELECT DISTINCT base_reporting_location FROM users WHERE base_reporting_location IS NOT NULL AND base_reporting_location != '' LIMIT 5").all().then(r => (r.results || []).map(x => x.base_reporting_location).join(", ")).catch(() => "error");

  // Detailed inspect of user_id formats
  const diagSampleExpenses = await env.DB.prepare("SELECT user_id, COUNT(*) as count FROM expenses WHERE LOWER(month) = 'july' AND year = 2026 GROUP BY user_id LIMIT 5").all().catch(() => ({ results: [] }));
  const sampleExpenseUserIds = (diagSampleExpenses.results || []).map(x => `${typeof x.user_id}:${x.user_id} (${x.count} claims)`).join(", ");

  // Fetch official hospitals to resolve dropdown vs custom locations
  const hospitalsRes = await env.DB.prepare("SELECT DISTINCT hospital_name FROM assets_inventory WHERE hospital_name IS NOT NULL").all().catch(() => ({ results: [] }));
  const officialHospitals = new Set((hospitalsRes.results || []).map(h => h.hospital_name.trim().toLowerCase()));

  // Fetch all active users with mapped base locations
  const usersRes = await env.DB.prepare(`
    SELECT id, user_id, name, base_reporting_location FROM users
    WHERE base_reporting_location IS NOT NULL AND base_reporting_location != ''
  `).all().catch(() => ({ results: [] }));

  const users = usersRes.results || [];
  const diagSampleUsers = users.slice(0, 5).map(x => `id=${typeof x.id}:${x.id}, user_id=${typeof x.user_id}:${x.user_id}`).join(", ");

  if (users.length === 0) {
    return jsonResponse({ 
      success: true, 
      message: `No users found with mapped base locations. (Total users in DB: ${diagTotalUsers}, Mapped: ${diagMappedUsers}).`, 
      adjusted: [],
      diagnostics: { diagTotalUsers, diagMappedUsers, diagJulyClaims, diagSampleMonths, diagSampleBases }
    });
  }

  const adjustedUsers = [];
  let totalExpensesAdjusted = 0;
  let totalDeductionsAmount = 0;
  const traceLogs = [];
  for (const user of users) {
    try {
      const summary = await runRetroactivePolicyCheck(env, user, user.base_reporting_location, timestamp);
      if (summary && summary.affected_expenses > 0) {
        adjustedUsers.push({
          user_id: user.user_id,
          name: user.name,
          base_reporting_location: user.base_reporting_location,
          affected_expenses: summary.affected_expenses,
          total_deducted: summary.total_deducted
        });
        totalExpensesAdjusted += summary.affected_expenses;
        totalDeductionsAmount += summary.total_deducted;
      }

      // Collect trace for debugging a few users
      if (traceLogs.length < 3) {
        const expensesRes = await env.DB.prepare(`
          SELECT id, expense_code, itinerary, amount, original_amount, da_amount
          FROM expenses
          WHERE user_id = ? AND LOWER(month) = 'july' AND year = 2026
            AND LOWER(status) NOT IN ('rejected', 'returned_to_draft')
        `).bind(user.id).all().catch(() => ({ results: [] }));
        const exps = expensesRes.results || [];
        for (const exp of exps.slice(0, 1)) {
          const legsRes = await env.DB.prepare(`
            SELECT itinerary_id, leg_number, from_location, to_location, travel_mode, sub_mode,
              distance_km, travel_amount, sub_amount, da_amount, hotel_amount, local_purchase,
              other_amount, from_district, to_district
            FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC
          `).bind(exp.expense_code).all().catch(() => ({ results: [] }));
          
          const rawLegs = legsRes.results || [];
          const legs = rawLegs.map(leg => {
            const fromLoc = (leg.from_location || "").trim().toLowerCase();
            const toLoc = (leg.to_location || "").trim().toLowerCase();
            const fromDist = (leg.from_district || "").trim().toLowerCase();
            const toDist = (leg.to_district || "").trim().toLowerCase();
            const isOutdoor = fromDist && toDist && fromDist !== toDist;
            const travelType = isOutdoor ? "Outdoor" : "In-District";
            const fromCustom = fromLoc && !officialHospitals.has(fromLoc);
            const toCustom = toLoc && !officialHospitals.has(toLoc);
            return {
              ...leg,
              from: leg.from_location || "",
              to: leg.to_location || "",
              from_custom: fromCustom,
              to_custom: toCustom,
              amount: leg.travel_amount,
              sub_amount: leg.sub_amount,
              da: leg.da_amount,
              travel_type: travelType
            };
          });

          const { isBaseLocOnly, isDaAllowed } = computeBaseLocPolicy(
            user.base_reporting_location,
            legs
          );

          const legLocs = legs.map(l => `${l.from_location}->${l.to_location} (${l.travel_type})`).join(" | ");
          traceLogs.push(`${user.name}(Base:${user.base_reporting_location}): code:${exp.expense_code} legs:[${legLocs}] isBaseOnly:${isBaseLocOnly} isDa:${isDaAllowed}`);
        }
      }
    } catch (e) {
      console.error(`One-time adjust failed for user ${user.user_id}:`, e.message);
      traceLogs.push(`${user.name} ERROR: ${e.message}`);
    }
  }

  const diagTrace = traceLogs.join(" | ");
  const diagMsg = `Trace: [${diagTrace}]. July Claims: ${diagJulyClaims}. Exp894: [${exp894Trace}].`;

  return jsonResponse({
    success: true,
    message: `One-time adjustment complete. Adjusted ${totalExpensesAdjusted} claims across ${adjustedUsers.length} users. Total deducted: ₹${totalDeductionsAmount.toFixed(2)}. Details: ${diagMsg}`,
    summary: {
      total_users_checked: users.length,
      total_users_adjusted: adjustedUsers.length,
      total_expenses_adjusted: totalExpensesAdjusted,
      total_deducted: totalDeductionsAmount,
      details: adjustedUsers,
      diagnostics: { diagTotalUsers, diagMappedUsers, diagJulyClaims, diagSampleMonths, diagSampleBases, diagSampleUsers, sampleExpenseUserIds, diagTrace }
    }
  });
}

