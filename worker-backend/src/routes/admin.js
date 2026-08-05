import { runWrite, runBatchWrite } from "../utils/db.js";
import { getPasswordHash, verifyPassword } from "../utils/security.js";
import { computeBaseLocPolicy, checkIsCommuteLeg, buildPolicyComment } from "./expense.js";
import { jsonResponse } from "../utils/http.js";

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 Validation Schema for User Creation/Updates
// ═══════════════════════════════════════════════════════════════════════════
export const saveUserSchema = {
  safeParse(data) {
    if (!data || typeof data !== "object") {
      return { success: false, error: { errors: [{ message: "Invalid payload object" }] } };
    }
    const cleanUserId = (data.user_id || data.e_code || "").trim();
    if (!data.id) {
      if (!cleanUserId || !data.password || !data.name) {
        return {
          success: false,
          data,
          error: { errors: [{ message: "user_id/e_code, password, and name are required" }] }
        };
      }
    }
    if (data.password && typeof data.password === "string" && data.password.trim().length < 8) {
      return {
        success: false,
        data,
        error: { errors: [{ message: "Password must be at least 8 characters long" }] }
      };
    }
    return { success: true, data };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 LOCKED — Approval hierarchy auto-reroute logic. DO NOT MODIFY WITHOUT
// EXPLICIT USER APPROVAL.
// ═══════════════════════════════════════════════════════════════════════════
async function resyncPendingApprovalsForHierarchy(env, hierarchyId, timestamp) {
  const approversRes = await env.DB.prepare(
    "SELECT level_number, approver_id FROM hierarchy_approvers WHERE hierarchy_id = ?"
  ).bind(hierarchyId).all();
  const approverByLevel = {};
  for (const a of (approversRes.results || [])) {
    approverByLevel[a.level_number] = a.approver_id;
  }
  if (Object.keys(approverByLevel).length === 0) return { updated: 0, notified: 0 };

  const requestersRes = await env.DB.prepare(
    "SELECT user_id FROM hierarchy_requesters WHERE hierarchy_id = ?"
  ).bind(hierarchyId).all();
  const requesterIds = (requestersRes.results || []).map(r => r.user_id);
  if (requesterIds.length === 0) return { updated: 0, notified: 0 };

  let updated = 0;
  let notified = 0;

  for (const submitterInternalId of requesterIds) {
    const pendingRows = await env.DB.prepare(`
      SELECT a.id, a.level_number, a.approver_id, a.status, e.expense_code, e.amount
      FROM approvals a
      JOIN expenses e ON a.expense_id = e.id
      WHERE e.user_id = ? AND a.status IN ('pending', 'waiting')
    `).bind(submitterInternalId).all();

    for (const row of (pendingRows.results || [])) {
      const correctApproverId = approverByLevel[row.level_number];
      if (correctApproverId && correctApproverId !== row.approver_id) {
        await runWrite(env, "UPDATE approvals SET approver_id = ?, updated_at = ? WHERE id = ?", [correctApproverId, timestamp, row.id]);
        updated++;

        if (row.status === "pending") {
          const newApprover = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(correctApproverId).first();
          if (newApprover) {
            await runWrite(env,
              "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 Claim Re-routed To You', ?, 'warning', 0, '/approval-center', ?)",
              [newApprover.user_id, `Claim ${row.expense_code} (₹${row.amount}) was re-routed to you because the approval hierarchy was updated.`, timestamp]
            );
            notified++;
          }
        }
      }
    }
  }

  return { updated, notified };
}

/**
 * Internal helper: Re-evaluate existing expenses for a user when their base location changes.
 */
async function runRetroactivePolicyCheck(env, existingUser, newBaseLocation, timestamp) {
  const today = new Date();
  const MONTH_NAMES = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];
  const currentMonth = MONTH_NAMES[today.getMonth()];
  const currentYear = today.getFullYear();

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

  const hospitalsRes = await env.DB.prepare("SELECT DISTINCT hospital_name FROM assets_inventory WHERE hospital_name IS NOT NULL").all().catch(err => {
    console.error("Database query failed in runRetroactivePolicyCheck (hospitals):", err);
    return { results: [] };
  });
  const officialHospitals = new Set((hospitalsRes.results || []).map(h => h.hospital_name.trim().toLowerCase()));

  const baseLocations = (newBaseLocation || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);

  let affectedCount = 0;
  let totalDeducted = 0;
  const batchStatements = [];

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

      for (const log of retroLegLogs) {
        batchStatements.push({
          sql: `INSERT INTO expense_edit_logs 
                 (expense_id, leg_number, field_name, old_value, new_value, comment, editor_name, editor_role, editor_id)
                 VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM', 'Policy', 0)`,
          params: [exp.id, log.leg_number, log.field_name, String(log.old_value), String(log.new_value), log.comment]
        });
      }

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
  if (!user || user.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  try {
    const getParam = (k) => (query && typeof query.get === "function") ? query.get(k) : (query?.[k] || null);
    const zone = getParam("zone");
    const district = getParam("district");
    const managerId = getParam("manager_id");
    const roleParam = getParam("role");
    const statusParam = getParam("status");
    const searchQ = getParam("q");

    let sql = `
      SELECT u.id, u.user_id, u.e_code, u.name, u.designation, u.grade, u.zone, u.district,
             u.manager, u.zonal_manager, u.coordinator, u.mobile_number, u.mail_id,
             u.user_status, u.type, u.date_of_joining, u.date_of_birth, u.e_upkaran_id,
             u.base_reporting_location, u.allowed_windows, u.created_at, u.updated_at,
             r.role
      FROM users u
      LEFT JOIN user_roles r ON u.user_id = r.user_id
    `;
    const conditions = [];
    const binds = [];

    if (zone && zone !== "all") {
      conditions.push("LOWER(TRIM(u.zone)) = LOWER(TRIM(?))");
      binds.push(zone);
    }
    if (district && district !== "all") {
      conditions.push("LOWER(TRIM(u.district)) = LOWER(TRIM(?))");
      binds.push(district);
    }
    if (managerId && managerId !== "all") {
      conditions.push("(LOWER(TRIM(u.manager)) = LOWER(TRIM(?)) OR LOWER(TRIM(u.zonal_manager)) = LOWER(TRIM(?)))");
      binds.push(managerId, managerId);
    }
    if (roleParam && roleParam !== "all") {
      conditions.push("LOWER(TRIM(r.role)) = LOWER(TRIM(?))");
      binds.push(roleParam);
    }
    if (statusParam && statusParam !== "all") {
      conditions.push("LOWER(TRIM(u.user_status)) = LOWER(TRIM(?))");
      binds.push(statusParam);
    }
    if (searchQ && searchQ.trim()) {
      const qClean = `%${searchQ.trim().toLowerCase()}%`;
      conditions.push("(LOWER(u.name) LIKE ? OR LOWER(u.user_id) LIKE ? OR LOWER(u.e_code) LIKE ? OR LOWER(u.mobile_number) LIKE ?)");
      binds.push(qClean, qClean, qClean, qClean);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY u.name ASC";

    const stmt = env.DB.prepare(sql);
    const users = binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();

    const cleanUsers = (users.results || []).map(u => {
      const copy = { ...u };
      delete copy.hashed_password;
      return copy;
    });

    return jsonResponse(cleanUsers);
  } catch (err) {
    console.error("Failed to list users:", err);
    return jsonResponse({ status: "error", error: "Failed to list users" }, 500);
  }
}

/**
 * POST /api/admin/users
 * Create or update a user
 */
export async function handleSaveUser(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const valResult = saveUserSchema.safeParse(body);
  if (!valResult.success) {
    return jsonResponse({ error: valResult.error.errors[0]?.message || "Validation failed" }, 400);
  }

  const {
    id, user_id, name, password, designation, zone, district,
    manager, zonal_manager, coordinator, mobile_number, mail_id, role, user_status
  } = body;

  const timestamp = body.created_at || body.timestamp || new Date().toISOString();

  try {
    if (id) {
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
        const roleExists = await env.DB.prepare("SELECT 1 FROM user_roles WHERE user_id = ?").bind(existing.user_id).first();
        if (roleExists) {
          await runWrite(env, "UPDATE user_roles SET role = ? WHERE user_id = ?", [role, existing.user_id]);
        } else {
          await runWrite(env, "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)", [existing.user_id, role, timestamp]);
        }
      }

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
      const cleanUserId = (user_id || body.e_code || "").trim();
      if (!cleanUserId || !password || !name) {
        return jsonResponse({ error: "user_id/e_code, password, and name are required" }, 400);
      }

      if (password && typeof password === "string" && password.trim().length < 8) {
        return jsonResponse({ error: "Password must be at least 8 characters long" }, 400);
      }

      const existing = await env.DB.prepare(
        "SELECT user_id, e_code FROM users WHERE LOWER(TRIM(user_id)) = LOWER(TRIM(?)) OR LOWER(TRIM(e_code)) = LOWER(TRIM(?))"
      ).bind(cleanUserId, cleanUserId).first();

      if (existing) {
        return jsonResponse({ error: `User ID / Employee Code '${cleanUserId}' already exists.` }, 400);
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
  } catch (err) {
    console.error("Failed to save user:", err);
    return jsonResponse({ status: "error", error: "Failed to save user" }, 500);
  }
}

/**
 * POST /api/admin/users/bulk
 */
export async function handleBulkCreateUsers(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
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

  try {
    const allUsersRes = await env.DB.prepare(`
      SELECT u.id, u.user_id, u.e_code, u.name, u.hashed_password, u.designation, u.grade, u.district, u.zone, u.manager, u.zonal_manager, u.coordinator, u.mobile_number, u.mail_id, u.type, u.date_of_joining, u.date_of_birth, u.e_upkaran_id, u.allowed_windows, r.role as role
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

      const autoWindows = "home,expense,help,profile";

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

          const targetWindows = item.allowed_windows !== undefined ? String(item.allowed_windows).trim() : existing.allowed_windows;
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
        errors.push(`Row ${index + 1} (${eCode}): Failed processing row`);
      }
    }

    if (batchStatements.length > 0) {
      await runBatchWrite(env, batchStatements);
    }

    return jsonResponse({
      status: "success",
      created_count: createdCount,
      failed_count: errors.length,
      errors
    });
  } catch (err) {
    console.error("Failed to execute bulk user import:", err);
    return jsonResponse({ status: "error", error: "Failed to execute bulk user import" }, 500);
  }
}

/**
 * DELETE /api/admin/users/:user_id
 */
export async function handleDeleteUser(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const userId = params.user_id;
  if (!userId || typeof userId !== "string") {
    return jsonResponse({ error: "Invalid user ID" }, 400);
  }

  try {
    const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
    if (!user) return jsonResponse({ error: "User not found" }, 404);

    const statements = [
      { sql: "DELETE FROM user_roles WHERE user_id = ?", params: [userId] },
      { sql: "DELETE FROM password_histories WHERE user_id = ?", params: [user.id] },
      { sql: "DELETE FROM login_logs WHERE user_id = ?", params: [userId] },
      { sql: "DELETE FROM users WHERE id = ?", params: [user.id] }
    ];

    await runBatchWrite(env, statements);
    return jsonResponse({ status: "success", message: "User deleted successfully" });
  } catch (err) {
    console.error("Failed to delete user:", err);
    return jsonResponse({ status: "error", error: "Failed to delete user" }, 500);
  }
}

/**
 * GET /api/admin/hierarchies
 */
export async function handleListHierarchies(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  try {
    const chainsRes = await env.DB.prepare("SELECT * FROM approval_hierarchies ORDER BY id ASC").all();
    const chains = chainsRes.results || [];

    if (chains.length === 0) {
      return jsonResponse([]);
    }

    const requestersRes = await env.DB.prepare(`
      SELECT hr.id, hr.hierarchy_id, hr.user_id, u.name AS user_name, u.user_id AS user_code
      FROM hierarchy_requesters hr
      JOIN users u ON hr.user_id = u.id
    `).all();
    const requesters = requestersRes.results || [];

    const approversRes = await env.DB.prepare(`
      SELECT ha.id, ha.hierarchy_id, ha.level_number, ha.approver_id, u.name AS approver_name, u.user_id AS approver_code, ur.role AS approver_role
      FROM hierarchy_approvers ha
      JOIN users u ON ha.approver_id = u.id
      LEFT JOIN user_roles ur ON u.user_id = ur.user_id
    `).all();
    const approvers = approversRes.results || [];

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
  } catch (err) {
    console.error("Failed to list hierarchies:", err);
    return jsonResponse({ status: "error", error: "Failed to list hierarchies" }, 500);
  }
}

/**
 * POST /api/admin/hierarchies
 */
export async function handleSaveHierarchy(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { id, name, requester_ids, approvers } = body;
  if (!name || !name.trim()) {
    return jsonResponse({ error: "Hierarchy name is required" }, 400);
  }

  const timestamp = new Date().toISOString();
  let hId = id;

  try {
    if (id) {
      const existing = await env.DB.prepare("SELECT 1 FROM approval_hierarchies WHERE id = ?").bind(id).first();
      if (!existing) return jsonResponse({ error: "Hierarchy not found" }, 404);

      await runWrite(env, "UPDATE approval_hierarchies SET name = ? WHERE id = ?", [name.trim(), id]);
      await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [id]);
      await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [id]);
    } else {
      const result = await runWrite(env, "INSERT INTO approval_hierarchies (name) VALUES (?)", [name.trim()]);
      hId = result.meta?.last_row_id;
      if (!hId) {
        return jsonResponse({ error: "Failed to create hierarchy" }, 500);
      }
    }

    if (requester_ids && Array.isArray(requester_ids)) {
      for (const reqId of requester_ids) {
        if (reqId) {
          await runWrite(env, "INSERT INTO hierarchy_requesters (hierarchy_id, user_id) VALUES (?, ?)", [hId, reqId]);
        }
      }
    }

    if (approvers && Array.isArray(approvers)) {
      for (const app of approvers) {
        if (app && app.approver_id && app.level_number) {
          await runWrite(env, "INSERT INTO hierarchy_approvers (hierarchy_id, level_number, approver_id) VALUES (?, ?, ?)", [hId, app.level_number, app.approver_id]);
        }
      }
    }

    const resyncResult = await resyncPendingApprovalsForHierarchy(env, hId, timestamp);
    return jsonResponse({ status: "success", message: "Hierarchy mappings saved successfully", rerouted_claims: resyncResult.updated });
  } catch (err) {
    console.error("Failed to save hierarchy:", err);
    return jsonResponse({ status: "error", error: "Failed to save hierarchy" }, 500);
  }
}

/**
 * PUT /api/admin/users/:user_id
 */
export async function handleUpdateUser(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const userId = params.user_id;
  if (!userId) return jsonResponse({ error: "User ID required" }, 400);

  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  try {
    const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
    if (!user) return jsonResponse({ error: `User '${userId}' not found.` }, 404);

    const timestamp = new Date().toISOString();
    const updates = [];
    const bindings = [];
    const batchStatements = [];

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

    const targetRole = body.role || user.role;
    const targetUid = isUidChanged ? newUserId : user.user_id;

    batchStatements.push({
      sql: "DELETE FROM user_roles WHERE user_id = ? OR user_id = ?",
      params: [user.user_id, targetUid]
    });

    if (updates.length > 0) {
      bindings.push(timestamp);
      bindings.push(user.id);
      batchStatements.push({
        sql: `UPDATE users SET ${updates.join(", ")}, updated_at = ? WHERE id = ?`,
        params: bindings
      });
    }

    if (targetRole) {
      batchStatements.push({
        sql: "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)",
        params: [targetUid, targetRole, timestamp]
      });
    }

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
  } catch (err) {
    console.error("Failed to update user:", err);
    return jsonResponse({ status: "error", error: "Failed to update user" }, 500);
  }
}

/**
 * GET /api/admin/eligible-approvers
 */
export async function handleGetEligibleApprovers(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  try {
    const users = await env.DB.prepare("SELECT id, user_id, e_code, name, designation, zone, district FROM users ORDER BY name ASC").all();
    const result = (users.results || []).map(u => { const o = {...u}; delete o.hashed_password; return o; });
    return jsonResponse(result);
  } catch (err) {
    console.error("Failed to fetch eligible approvers:", err);
    return jsonResponse({ status: "error", error: "Failed to fetch eligible approvers" }, 500);
  }
}

/**
 * DELETE /api/admin/hierarchies/:id
 */
export async function handleDeleteHierarchy(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  const hierarchyId = parseInt(params.id, 10);
  if (isNaN(hierarchyId) || !hierarchyId) return jsonResponse({ error: "Invalid hierarchy ID" }, 400);

  try {
    const existing = await env.DB.prepare("SELECT 1 FROM approval_hierarchies WHERE id = ?").bind(hierarchyId).first();
    if (!existing) return jsonResponse({ error: "Hierarchy not found" }, 404);

    await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [hierarchyId]);
    await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [hierarchyId]);
    await runWrite(env, "DELETE FROM approval_hierarchies WHERE id = ?", [hierarchyId]);

    return jsonResponse({ status: "success", message: "Hierarchy deleted successfully" });
  } catch (err) {
    console.error("Failed to delete hierarchy:", err);
    return jsonResponse({ status: "error", error: "Failed to delete hierarchy" }, 500);
  }
}

/**
 * POST /api/admin/logout-all
 */
export async function handleLogoutAllUsers(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  try {
    await runWrite(env, "UPDATE users SET active_session_id = NULL", []);
    return jsonResponse({ status: "success", message: "All users have been logged out" });
  } catch (err) {
    console.error("Failed to logout all users:", err);
    return jsonResponse({ status: "error", error: "Failed to logout all users" }, 500);
  }
}

/**
 * POST /api/admin/logout-user/:user_code
 */
export async function handleLogoutSingleUser(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  const userCode = params.user_code;
  if (!userCode) return jsonResponse({ error: "Invalid user code" }, 400);

  try {
    const user = await env.DB.prepare("SELECT 1 FROM users WHERE user_id = ?").bind(userCode).first();
    if (!user) return jsonResponse({ error: "User not found" }, 404);

    await runWrite(env, "UPDATE users SET active_session_id = NULL WHERE user_id = ?", [userCode]);
    return jsonResponse({ status: "success", message: `User ${userCode} has been logged out` });
  } catch (err) {
    console.error("Failed to logout single user:", err);
    return jsonResponse({ status: "error", error: "Failed to logout user" }, 500);
  }
}

/**
 * GET /api/admin/hierarchies/export
 */
export async function handleExportHierarchies(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  try {
    const hierarchiesRes = await env.DB.prepare("SELECT * FROM approval_hierarchies ORDER BY id ASC").all();
    const hierarchies = hierarchiesRes.results || [];
    const rows = [];
    rows.push(["hierarchy_name", "requester_e_codes", "level_1_approver", "level_2_approver", "level_3_approver", "level_4_approver", "level_5_approver"]);

    if (hierarchies.length === 0) {
      return jsonResponse({ status: "success", rows });
    }

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

    return jsonResponse({ status: "success", rows });
  } catch (err) {
    console.error("Failed to export hierarchies:", err);
    return jsonResponse({ status: "error", error: "Failed to export hierarchies" }, 500);
  }
}

/**
 * POST /api/admin/hierarchies/bulk
 */
export async function handleBulkImportHierarchies(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
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

  try {
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

        const requesterCodes = String(row.requester_e_codes || "").split(",").map(s => s.trim()).filter(Boolean);
        for (const code of requesterCodes) {
          const u = findUser(code);
          if (u) {
            await runWrite(env, "INSERT INTO hierarchy_requesters (hierarchy_id, user_id) VALUES (?, ?)", [hId, u.id]);
          }
        }

        for (let lvl = 1; lvl <= 5; lvl++) {
          const approverCode = row[`level_${lvl}_approver`];
          if (!approverCode) continue;
          const u = findUser(String(approverCode).trim());
          if (u) {
            await runWrite(env, "INSERT INTO hierarchy_approvers (hierarchy_id, level_number, approver_id) VALUES (?, ?, ?)", [hId, lvl, u.id]);
          }
        }

        await resyncPendingApprovalsForHierarchy(env, hId, new Date().toISOString());
        createdCount++;
      } catch (ex) {
        console.error(`Row ${i + 1} (${hierarchyName}) import error:`, ex);
        const msg = ex.message || "";
        let safeCategory = "Failed processing hierarchy row";
        if (msg.includes("UNIQUE constraint") || msg.includes("Duplicate") || msg.includes("already exists")) {
          safeCategory = "Duplicate entry";
        }
        errors.push(`Row ${i + 1} (${hierarchyName}): ${safeCategory}`);
      }
    }

    return jsonResponse({ status: "success", created_count: createdCount, failed_count: errors.length, errors });
  } catch (err) {
    console.error("Failed to bulk import hierarchies:", err);
    return jsonResponse({ status: "error", error: "Failed to bulk import hierarchies" }, 500);
  }
}

/**
 * POST /api/admin/approvals/repair-stuck
 */
export async function handleRepairStuckApprovals(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const timestamp = new Date().toISOString();

  try {
    const stuckRes = await env.DB.prepare(`
      SELECT a.id, a.expense_id, a.approver_id, a.level_number, e.expense_code, e.amount, e.user_id AS submitter_id
      FROM approvals a
      JOIN expenses e ON a.expense_id = e.id
      WHERE a.status IN ('pending', 'waiting')
        AND NOT EXISTS (
          SELECT 1
          FROM hierarchy_requesters hr
          JOIN hierarchy_approvers ha ON hr.hierarchy_id = ha.hierarchy_id
          WHERE hr.user_id = e.user_id AND ha.approver_id = a.approver_id
        )
    `).all();

    const stuckRows = stuckRes.results || [];
    let repaired = 0;
    const unresolved = [];
    const repairedDetails = [];

    for (const row of stuckRows) {
      const currentHierarchy = await env.DB.prepare(
        "SELECT hierarchy_id FROM hierarchy_requesters WHERE user_id = ? LIMIT 1"
      ).bind(row.submitter_id).first();

      if (!currentHierarchy) {
        unresolved.push({ expense_code: row.expense_code, reason: "Submitter is not mapped to any approval hierarchy" });
        continue;
      }

      const correctApprover = await env.DB.prepare(
        "SELECT approver_id FROM hierarchy_approvers WHERE hierarchy_id = ? AND level_number = ?"
      ).bind(currentHierarchy.hierarchy_id, row.level_number).first();

      if (!correctApprover) {
        unresolved.push({ expense_code: row.expense_code, reason: `No Level ${row.level_number} approver configured for the submitter's current hierarchy` });
        continue;
      }

      if (correctApprover.approver_id !== row.approver_id) {
        await runWrite(env, "UPDATE approvals SET approver_id = ?, updated_at = ? WHERE id = ?", [correctApprover.approver_id, timestamp, row.id]);
        repaired++;
        repairedDetails.push({ expense_code: row.expense_code, level_number: row.level_number, new_approver_id: correctApprover.approver_id });

        const newApprover = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(correctApprover.approver_id).first();
        if (newApprover) {
          await runWrite(env,
            "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 Claim Re-routed To You', ?, 'warning', 0, '/approval-center', ?)",
            [newApprover.user_id, `Claim ${row.expense_code} (₹${row.amount}) was re-routed to you during an approval-hierarchy repair.`, timestamp]
          );
        }
      }
    }

    return jsonResponse({
      status: "success",
      scanned: stuckRows.length,
      repaired,
      unresolved_count: unresolved.length,
      unresolved,
      repaired_details: repairedDetails
    });
  } catch (err) {
    console.error("Failed to repair stuck approvals:", err);
    return jsonResponse({ status: "error", error: "Failed to repair stuck approvals" }, 500);
  }
}

/**
 * GET /api/admin/settings
 */
export async function handleGetSystemSettings(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
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
    console.error("Failed to fetch settings:", err);
    return jsonResponse({ status: "error", error: "Failed to fetch settings" }, 500);
  }
}

/**
 * POST /api/admin/settings
 */
export async function handleSaveSystemSettings(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
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
    console.error("Failed to save settings:", err);
    return jsonResponse({ status: "error", error: "Failed to save settings" }, 500);
  }
}

/**
 * GET /api/admin/expenses/rejected
 */
export async function handleSearchRejectedExpenses(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const search = (query?.get?.("search") || "").trim().toLowerCase();

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

    const stmt = env.DB.prepare(sql);
    const results = bindParams.length > 0 ? await stmt.bind(...bindParams).all() : await stmt.all();
    return jsonResponse({ success: true, data: results.results || [] });
  } catch (err) {
    console.error("Failed to retrieve rejected expenses:", err);
    return jsonResponse({ status: "error", error: "Failed to retrieve rejected expenses" }, 500);
  }
}

/**
 * POST /api/admin/expenses/:expense_id/resubmit
 */
export async function handleResubmitRejectedExpense(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const expenseId = parseInt(params.expense_id, 10);
  if (isNaN(expenseId) || !expenseId) {
    return jsonResponse({ error: "Invalid expense ID" }, 400);
  }

  const timestamp = new Date().toISOString();

  try {
    const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
    if (!expense) {
      return jsonResponse({ error: "Expense claim not found" }, 404);
    }

    if (expense.status !== "rejected") {
      return jsonResponse({ error: "Only rejected expense claims can be re-submitted" }, 400);
    }

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

    statements.push({
      sql: "UPDATE expenses SET status = 'submitted', updated_at = ? WHERE id = ?",
      params: [timestamp, expenseId]
    });

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

    await runBatchWrite(env, statements);

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
    console.error("Failed to resubmit expense claim:", err);
    return jsonResponse({ status: "error", error: "Failed to resubmit expense claim" }, 500);
  }
}

/**
 * POST /api/admin/one-time-adjust
 */
export async function handleOneTimeAdjust(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const timestamp = new Date().toISOString();

  try {
    await env.DB.prepare(`
      UPDATE users 
      SET base_reporting_location = 'District Sahadat Hospital Tonk DH' 
      WHERE name = 'Shahrukh Ali' AND (base_reporting_location IS NULL OR base_reporting_location = '')
    `).run().catch(() => null);

    const usersRes = await env.DB.prepare(`
      SELECT id, user_id, name, base_reporting_location FROM users
      WHERE base_reporting_location IS NOT NULL AND base_reporting_location != ''
    `).all().catch(() => ({ results: [] }));

    const users = usersRes.results || [];
    if (users.length === 0) {
      return jsonResponse({ 
        success: true, 
        message: "No users found with mapped base locations.", 
        adjusted: []
      });
    }

    const adjustedUsers = [];
    let totalExpensesAdjusted = 0;
    let totalDeductionsAmount = 0;

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
      } catch (e) {
        console.error(`One-time adjust failed for user ${user.user_id}:`, e.message);
      }
    }

    return jsonResponse({
      success: true,
      message: `One-time adjustment complete. Adjusted ${totalExpensesAdjusted} claims across ${adjustedUsers.length} users. Total deducted: ₹${totalDeductionsAmount.toFixed(2)}.`,
      summary: {
        total_users_checked: users.length,
        total_users_adjusted: adjustedUsers.length,
        total_expenses_adjusted: totalExpensesAdjusted,
        total_deducted: totalDeductionsAmount,
        details: adjustedUsers
      }
    });
  } catch (err) {
    console.error("Failed to run one-time adjust:", err);
    return jsonResponse({ status: "error", error: "Failed to run one-time adjust" }, 500);
  }
}

/**
 * GET /api/admin/allowance-rates
 */
export async function handleGetAllowanceRates(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  try {
    const rows = await env.DB.prepare("SELECT * FROM allowance_master ORDER BY id ASC").all();
    return jsonResponse(rows.results || []);
  } catch (err) {
    console.error("Failed to fetch allowance rates:", err);
    return jsonResponse({ status: "error", error: "Failed to fetch allowance rates" }, 500);
  }
}

/**
 * POST /api/admin/allowance-rates
 */
export async function handleSaveAllowanceRates(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const rates = Array.isArray(body) ? body : (body.rates || []);
  if (rates.length === 0) {
    return jsonResponse({ error: "No allowance rates data provided" }, 400);
  }

  try {
    const statements = [];
    for (const r of rates) {
      if (!r.id) continue;
      statements.push({
        sql: `UPDATE allowance_master SET 
                hotel_in_state_s = ?, 
                hotel_in_state_d = ?, 
                hotel_out_state_s = ?, 
                hotel_out_state_d = ?, 
                daily_in_district = ?, 
                daily_out_district = ?, 
                daily_hotel = ?, 
                daily_out_state = ?, 
                vehicle_type = ?, 
                rate_per_km = ?, 
                max_km_per_month = ?
              WHERE id = ?`,
        params: [
          parseFloat(r.hotel_in_state_s || 0),
          parseFloat(r.hotel_in_state_d || 0),
          parseFloat(r.hotel_out_state_s || 0),
          parseFloat(r.hotel_out_state_d || 0),
          parseFloat(r.daily_in_district || 0),
          parseFloat(r.daily_out_district || 0),
          parseFloat(r.daily_hotel || 0),
          parseFloat(r.daily_out_state || 0),
          r.vehicle_type || "Bike",
          parseFloat(r.rate_per_km || 0),
          parseInt(r.max_km_per_month || 0, 10),
          r.id
        ]
      });
    }

    if (statements.length > 0) {
      await runBatchWrite(env, statements);
    }

    return jsonResponse({ status: "success", message: "Allowance rates updated successfully." });
  } catch (err) {
    console.error("Failed to save allowance rates:", err);
    return jsonResponse({ status: "error", error: "Failed to save allowance rates" }, 500);
  }
}

/**
 * GET /api/test/time or /api/admin/test/time
 * Returns current server UTC timestamp and IST converted string for verification
 */
export async function handleTestTime(request, env) {
  const utcNow = new Date().toISOString();
  const istNow = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  return jsonResponse({
    status: "ok",
    utc_timestamp: utcNow,
    ist_timestamp: istNow,
    timezone: "Asia/Kolkata",
    offset: "+05:30"
  });
}

/**
 * POST /api/admin/revert-claim-deductions
 * Reverts policy deductions for a specific claim code (e.g. "000640" or "RJ-07/26-000640")
 * restoring original travel_amount, sub_amount, da_amount, and total amount.
 */
export async function handleRevertClaimDeductions(request, env, params, query, adminUser) {
  if (!adminUser || adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  let body = {};
  try {
    body = await request.json();
  } catch (e) {}

  const claimSearch = (body.expense_code || body.claim_code || body.id || "000640").toString().trim();

  try {
    const expense = await env.DB.prepare(`
      SELECT * FROM expenses 
      WHERE LOWER(expense_code) = LOWER(?) 
         OR LOWER(expense_code) LIKE LOWER(?) 
         OR id = ?
    `).bind(claimSearch, `%${claimSearch}%`, parseInt(claimSearch, 10) || -1).first();

    if (!expense) {
      return jsonResponse({ error: `Expense claim matching '${claimSearch}' not found.` }, 404);
    }

    const expCode = expense.expense_code;

    // 1. Revert legs in expense_itineraries
    await env.DB.prepare(`
      UPDATE expense_itineraries
      SET travel_amount = CASE WHEN original_travel_amount IS NOT NULL AND original_travel_amount > 0 THEN original_travel_amount ELSE travel_amount END,
          sub_amount = CASE WHEN original_sub_amount IS NOT NULL AND original_sub_amount > 0 THEN original_sub_amount ELSE sub_amount END,
          da_amount = CASE WHEN original_da_amount IS NOT NULL AND original_da_amount > 0 THEN original_da_amount ELSE da_amount END
      WHERE exp_id = ?
    `).bind(expCode).run();

    // 2. Re-calculate total restored amounts from legs
    const legsRes = await env.DB.prepare(`
      SELECT SUM(travel_amount + sub_amount + da_amount + hotel_amount + other_amount + local_purchase) as total_sum,
             SUM(da_amount) as total_da
      FROM expense_itineraries
      WHERE exp_id = ?
    `).bind(expCode).first();

    const restoredTotal = legsRes?.total_sum || expense.original_amount || expense.amount;
    const restoredDa = legsRes?.total_da || expense.original_da_amount || expense.da_amount;

    // 3. Update expenses table
    await env.DB.prepare(`
      UPDATE expenses
      SET amount = ?,
          da_amount = ?,
          status = CASE WHEN status = 'approved' AND ? > 0 THEN 'pending' ELSE status END,
          deduction_reason = NULL,
          updated_at = ?
      WHERE id = ?
    `).bind(restoredTotal, restoredDa, restoredTotal, new Date().toISOString(), expense.id).run();

    // 4. Log to expense_edit_logs
    await env.DB.prepare(`
      INSERT INTO expense_edit_logs (exp_id, field_name, old_value, new_value, comment, edited_by, timestamp)
      VALUES (?, 'amount', ?, ?, ?, ?, ?)
    `).bind(
      expense.id,
      String(expense.amount),
      String(restoredTotal),
      `[Admin Action] Policy deductions reverted on user request for claim ${expCode}`,
      adminUser?.name || "Admin",
      new Date().toISOString()
    ).run().catch(() => null);

    return jsonResponse({
      success: true,
      message: `Successfully reverted policy deductions for claim ${expCode}. Restored total: ₹${restoredTotal}.`,
      claim_code: expCode,
      restored_amount: restoredTotal,
      restored_da: restoredDa
    });
  } catch (err) {
    console.error("Failed to revert claim deductions:", err);
    return jsonResponse({ status: "error", error: "Failed to revert claim deductions: " + err.message }, 500);
  }
}
