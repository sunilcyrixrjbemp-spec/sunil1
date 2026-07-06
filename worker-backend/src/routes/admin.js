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
