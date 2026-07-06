import { verifyPassword, getPasswordHash } from "../utils/security.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function validatePasswordStrength(password) {
  const errors = [];
  if (password.length < 8) errors.push("Password must be at least 8 characters long");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain at least one uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must contain at least one lowercase letter");
  if (!/\d/.test(password)) errors.push("Password must contain at least one digit");
  if (!/[@$!%*?&#]/.test(password)) errors.push("Password must contain at least one special character (@$!%*?&#)");
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * GET /api/users/profile
 */
export async function handleGetProfile(request, env, params, query, user) {
  const roleRow = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(user.user_id).first();
  const profile = { ...user };
  delete profile.hashed_password;
  profile.role = roleRow?.role || "user";
  return jsonResponse(profile);
}

/**
 * PUT /api/users/profile
 */
export async function handleUpdateProfile(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { mobile_number, mail_id } = body;
  const updates = [];
  const bindings = [];

  if (mobile_number !== undefined) {
    const mobile = (mobile_number || "").trim();
    if (mobile && !/^\+?[0-9\- \(\)]{7,20}$/.test(mobile)) {
      return jsonResponse({ error: "Invalid mobile number format" }, 400);
    }
    updates.push("mobile_number = ?");
    bindings.push(mobile || null);
  }

  if (mail_id !== undefined) {
    const email = (mail_id || "").trim();
    if (email && !/^[\w\.-]+@[\w\.-]+\.\w+$/.test(email)) {
      return jsonResponse({ error: "Invalid email address format" }, 400);
    }
    updates.push("mail_id = ?");
    bindings.push(email || null);
  }

  if (updates.length > 0) {
    bindings.push(user.id);
    await env.DB.prepare(`
      UPDATE users SET ${updates.join(", ")}, updated_at = datetime('now')
      WHERE id = ?
    `).bind(...bindings).run();
  }

  const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  const roleRow = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(user.user_id).first();

  return jsonResponse({
    ...updatedUser,
    role: roleRow?.role || "user"
  });
}

/**
 * POST /api/users/change-password
 */
export async function handleChangePassword(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { old_password, new_password, confirm_password } = body;
  if (!old_password || !new_password || !confirm_password) {
    return jsonResponse({ error: "All fields are required" }, 400);
  }

  // 1. Verify old password
  const oldCorrect = await verifyPassword(old_password, user.hashed_password);
  if (!oldCorrect) {
    return jsonResponse({ error: "Current password is incorrect" }, 400);
  }

  // 2. Match check
  if (new_password === old_password) {
    return jsonResponse({ error: "New password must be different from current password" }, 400);
  }

  if (new_password !== confirm_password) {
    return jsonResponse({ error: "New password and confirmation password do not match" }, 400);
  }

  // 3. Password strength
  const strength = validatePasswordStrength(new_password);
  if (!strength.isValid) {
    return jsonResponse({ error: strength.errors.join("; ") }, 400);
  }

  // 4. Check password history (last 5)
  const history = await env.DB.prepare(`
    SELECT hashed_password FROM password_histories
    WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 5
  `).bind(user.id).all();

  const historyHashes = (history.results || []).map(r => r.hashed_password);
  for (const histHash of historyHashes) {
    if (await verifyPassword(new_password, histHash)) {
      return jsonResponse({ error: "You cannot reuse any of your last 5 passwords." }, 400);
    }
  }

  // 5. Update password & history
  const newHash = await getPasswordHash(new_password);
  const timestamp = new Date().toISOString();

  await env.DB.prepare("UPDATE users SET hashed_password = ? WHERE id = ?").bind(newHash, user.id).run();
  await env.DB.prepare(`
    INSERT INTO password_histories (user_id, hashed_password, created_at)
    VALUES (?, ?, ?)
  `).bind(user.id, newHash, timestamp).run();

  return jsonResponse({ status: "success", message: "Password has been updated successfully." });
}
