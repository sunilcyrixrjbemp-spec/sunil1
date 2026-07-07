import { runWrite, runBatchWrite } from "../utils/db.js";
import { getPasswordHash } from "../utils/security.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
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

    if (password) {
      const newHash = await getPasswordHash(password);
      updates.push("hashed_password = ?");
      bindings.push(newHash);
      
      // Add to password history
      await runWrite(env, "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)", [
        existing.id, existing.hashed_password, timestamp
      ]);
    }

    if (updates.length > 0) {
      bindings.push(id);
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

    return jsonResponse({ status: "success", message: "User updated successfully" });
  } else {
    // CREATE new user
    if (!user_id || !password || !name) {
      return jsonResponse({ error: "user_id, password, and name are required" }, 400);
    }

    const cleanUserId = user_id.trim();
    const existing = await env.DB.prepare("SELECT 1 FROM users WHERE user_id = ?").bind(cleanUserId).first();
    if (existing) {
      return jsonResponse({ error: "User ID already exists" }, 400);
    }

    const hashed = await getPasswordHash(password);
    await runWrite(env, `
      INSERT INTO users (user_id, e_code, name, hashed_password, user_status, designation, zone, district, manager, zonal_manager, coordinator, mobile_number, mail_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanUserId, cleanUserId, name.trim(), hashed, user_status || "active",
      designation || "", zone || "", district || "", manager || null, zonal_manager || null,
      coordinator || null, mobile_number || null, mail_id || null, timestamp, timestamp
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
  const result = await env.DB.prepare("SELECT * FROM user_approval_chains ORDER BY id ASC").all();
  return jsonResponse(result.results || []);
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

  const { id, chain_name, requester_designation, levels } = body;
  const timestamp = new Date().toISOString();

  if (id) {
    // UPDATE
    await runWrite(env, "UPDATE user_approval_chains SET chain_name = ?, requester_designation = ? WHERE id = ?", [
      chain_name, requester_designation, id
    ]);
    
    // Clear and update levels
    await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [id]);
    if (levels && levels.length > 0) {
      for (const lvl of levels) {
        await runWrite(env, "INSERT INTO hierarchy_approvers (hierarchy_id, level_number, approver_id) VALUES (?, ?, ?)", [
          id, lvl.level_number, lvl.approver_id
        ]);
      }
    }
  } else {
    // CREATE
    const result = await runWrite(env, "INSERT INTO user_approval_chains (chain_name, requester_designation) VALUES (?, ?)", [
      chain_name, requester_designation
    ]);
    const newId = result.meta?.last_row_id;
    if (newId && levels && levels.length > 0) {
      for (const lvl of levels) {
        await runWrite(env, "INSERT INTO hierarchy_approvers (hierarchy_id, level_number, approver_id) VALUES (?, ?, ?)", [
          newId, lvl.level_number, lvl.approver_id
        ]);
      }
    }
  }

  return jsonResponse({ status: "success", message: "Approval chain saved successfully" });
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

  // Handle sensitive fields: new_user_id, new_e_code, password
  const newUserId = body.new_user_id?.trim();
  const newECode = body.new_e_code?.trim();
  const isUidChanged = newUserId && newUserId !== user.user_id;
  const isEcodeChanged = newECode && newECode !== user.e_code;
  const isPasswordChanged = body.password && body.password.trim() !== "";

  if (isUidChanged || isEcodeChanged || isPasswordChanged) {
    const adminSecPw = body.admin_update_password || "";
    if (adminSecPw.trim() !== "012001@Sunil") {
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
      await runWrite(env, "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)", [user.id, newHash, timestamp]);
    }
    if (isUidChanged) {
      // Update user_roles to reflect new user_id
      await runWrite(env, "UPDATE user_roles SET user_id = ? WHERE user_id = ?", [newUserId, user.user_id]);
      await runWrite(env, "UPDATE notifications SET user_id = ? WHERE user_id = ?", [newUserId, user.user_id]);
      await runWrite(env, "UPDATE limit_approval_requests SET user_id = ? WHERE user_id = ?", [newUserId, user.user_id]);
      await runWrite(env, "UPDATE limit_approval_requests SET manager_id = ? WHERE manager_id = ?", [newUserId, user.user_id]);
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
    e_upkaran_id: "e_upkaran_id", allowed_windows: "allowed_windows"
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
    const oldRole = user.role;
    if (oldRole !== body.role) {
      await runWrite(env, "DELETE FROM user_roles WHERE user_id = ? AND role = ?", [user.user_id, oldRole]);
      const existingRole = await env.DB.prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?").bind(user.user_id, body.role).first();
      if (!existingRole) {
        await runWrite(env, "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)", [user.user_id, body.role, timestamp]);
      }
    }
    updates.push("role = ?"); bindings.push(body.role);
  }

  if (updates.length > 0) {
    bindings.push(timestamp);
    bindings.push(user.id);
    await runWrite(env, `UPDATE users SET ${updates.join(", ")}, updated_at = ? WHERE id = ?`, bindings);
  }

  // Return updated user
  const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  const roleRow = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(updatedUser.user_id).first();
  const result = { ...updatedUser, role: roleRow?.role || "user" };
  delete result.hashed_password;
  return jsonResponse(result);
}

/**
 * POST /api/admin/users/bulk
 * Bulk create or update users
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

  // Pre-fetch all users into memory for O(1) lookups
  const allUsersRes = await env.DB.prepare("SELECT user_id, e_code, name FROM users").all();
  const userIdSet = new Set((allUsersRes.results || []).map(u => (u.user_id || "").toLowerCase()));
  const eCodeSet = new Set((allUsersRes.results || []).map(u => (u.e_code || "").toLowerCase()));
  const nameSet = new Set((allUsersRes.results || []).map(u => (u.name || "").toLowerCase()));

  for (let index = 0; index < payload.length; index++) {
    const item = payload[index];
    const eCode = String(item.e_code || "").trim();
    if (!eCode) { errors.push(`Row ${index + 1}: Missing Employee Code. Skipped.`); continue; }

    const existing = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(eCode).first();
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
        const fieldUpdates = [];
        const fieldBinds = [];
        if (item.designation) { fieldUpdates.push("designation = ?"); fieldBinds.push(String(item.designation).trim()); }
        if (item.grade) { fieldUpdates.push("grade = ?"); fieldBinds.push(String(item.grade).trim()); }
        if (item.district) { fieldUpdates.push("district = ?"); fieldBinds.push(String(item.district).trim()); }
        if (item.zone) { fieldUpdates.push("zone = ?"); fieldBinds.push(String(item.zone).trim()); }
        if (item.mobile_number) { fieldUpdates.push("mobile_number = ?"); fieldBinds.push(String(item.mobile_number).trim()); }
        if (item.mail_id) { fieldUpdates.push("mail_id = ?"); fieldBinds.push(String(item.mail_id).trim()); }
        if (item.date_of_joining) { fieldUpdates.push("date_of_joining = ?"); fieldBinds.push(String(item.date_of_joining).trim()); }
        if (item.date_of_birth) { fieldUpdates.push("date_of_birth = ?"); fieldBinds.push(String(item.date_of_birth).trim()); }
        if (item.e_upkaran_id) { fieldUpdates.push("e_upkaran_id = ?"); fieldBinds.push(String(item.e_upkaran_id).trim()); }
        if (managerCl !== undefined) { fieldUpdates.push("manager = ?"); fieldBinds.push(managerCl); }
        if (zonalMgrCl !== undefined) { fieldUpdates.push("zonal_manager = ?"); fieldBinds.push(zonalMgrCl); }
        if (coordCl !== undefined) { fieldUpdates.push("coordinator = ?"); fieldBinds.push(coordCl); }
        if (roleCl) { fieldUpdates.push("role = ?"); fieldBinds.push(roleCl); }
        if (typeCl) { fieldUpdates.push("type = ?"); fieldBinds.push(typeCl); }
        if (item.allowed_windows) { fieldUpdates.push("allowed_windows = ?"); fieldBinds.push(String(item.allowed_windows).trim()); }
        else if (roleCl) { fieldUpdates.push("allowed_windows = ?"); fieldBinds.push(autoWindows); }
        if (item.password) {
          const h = await getPasswordHash(String(item.password).trim());
          fieldUpdates.push("hashed_password = ?"); fieldBinds.push(h);
          await runWrite(env, "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)", [existing.id, h, timestamp]);
        }

        if (fieldUpdates.length > 0) {
          fieldBinds.push(timestamp); fieldBinds.push(existing.id);
          await runWrite(env, `UPDATE users SET ${fieldUpdates.join(", ")}, updated_at = ? WHERE id = ?`, fieldBinds);
          if (roleCl) {
            await runWrite(env, "DELETE FROM user_roles WHERE user_id = ?", [existing.user_id]);
            await runWrite(env, "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)", [existing.user_id, roleCl, timestamp]);
          }
          createdCount++;
        }
      } else {
        const pwd = String(item.password || "").trim();
        if (!pwd) { errors.push(`Row ${index + 1} (${eCode}): Missing Password. Skipped.`); continue; }
        const hashed = await getPasswordHash(pwd);
        await runWrite(env, `
          INSERT INTO users (user_id, e_code, name, hashed_password, user_status, designation, grade, district, zone, manager, zonal_manager, coordinator, mobile_number, mail_id, role, type, date_of_joining, date_of_birth, e_upkaran_id, allowed_windows, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [eCode, eCode, nameCl, hashed,
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
        ]);

        // Get new user's id for password history
        const newUser = await env.DB.prepare("SELECT id FROM users WHERE user_id = ?").bind(eCode).first();
        if (newUser) {
          await runWrite(env, "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)", [newUser.id, hashed, timestamp]);
          await runWrite(env, "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)", [eCode, roleCl || "user", timestamp]);
        }

        userIdSet.add(eCode.toLowerCase());
        eCodeSet.add(eCode.toLowerCase());
        nameSet.add(nameCl.toLowerCase());
        createdCount++;
      }
    } catch (ex) {
      errors.push(`Row ${index + 1} (${eCode}): Failed due to ${ex.message}`);
    }
  }

  return jsonResponse({
    status: "success",
    created_count: createdCount,
    failed_count: errors.length,
    errors
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

  const existing = await env.DB.prepare("SELECT 1 FROM user_approval_chains WHERE id = ?").bind(hierarchyId).first();
  if (!existing) return jsonResponse({ error: "Hierarchy not found" }, 404);

  await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [hierarchyId]);
  await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [hierarchyId]);
  await runWrite(env, "DELETE FROM user_approval_chains WHERE id = ?", [hierarchyId]);

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

  const hierarchies = await env.DB.prepare("SELECT * FROM user_approval_chains ORDER BY id ASC").all();
  const rows = [];
  rows.push(["hierarchy_name", "requester_e_codes", "level_1_approver", "level_2_approver", "level_3_approver", "level_4_approver", "level_5_approver"]);

  for (const h of (hierarchies.results || [])) {
    const requesters = await env.DB.prepare(`
      SELECT u.e_code, u.user_id FROM hierarchy_requesters hr
      JOIN users u ON hr.user_id = u.id
      WHERE hr.hierarchy_id = ?
    `).bind(h.id).all();
    const approvers = await env.DB.prepare(`
      SELECT ha.level_number, u.e_code, u.user_id FROM hierarchy_approvers ha
      JOIN users u ON ha.approver_id = u.id
      WHERE ha.hierarchy_id = ? ORDER BY ha.level_number ASC
    `).bind(h.id).all();

    const reqCodes = (requesters.results || []).map(r => r.e_code || r.user_id).join(",");
    const lvlApps = ["", "", "", "", ""];
    for (const a of (approvers.results || [])) {
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
      let existingH = await env.DB.prepare("SELECT id FROM user_approval_chains WHERE chain_name = ?").bind(hierarchyName).first();
      let hId;

      if (existingH) {
        hId = existingH.id;
        await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [hId]);
        await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [hId]);
      } else {
        const hResult = await runWrite(env, "INSERT INTO user_approval_chains (chain_name) VALUES (?)", [hierarchyName]);
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
