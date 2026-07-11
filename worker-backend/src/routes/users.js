import { verifyPassword, getPasswordHash } from "../utils/security.js";
import { uploadToGoogleDrive, deleteFromGoogleDrive } from "./upload.js";
import { runWrite, runBatchWrite } from "../utils/db.js";

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
    await runWrite(env, `
      UPDATE users SET ${updates.join(", ")}, updated_at = datetime('now')
      WHERE id = ?
    `, bindings);
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

  const statements = [
    {
      sql: "UPDATE users SET hashed_password = ? WHERE id = ?",
      params: [newHash, user.id]
    },
    {
      sql: "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)",
      params: [user.id, newHash, timestamp]
    }
  ];
  await runBatchWrite(env, statements);

  return jsonResponse({ status: "success", message: "Password has been updated successfully." });
}

/**
 * POST /api/users/profile/photo
 * Upload a profile photo to Google Drive
 */
export async function handleUploadProfilePhoto(request, env, params, query, user) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return jsonResponse({ error: "No file provided" }, 400);
    }

    const timestamp = new Date().toISOString();
    const ext = (file.name || "photo.jpg").split(".").pop().toLowerCase() || "jpg";
    const filename = `profile_${user.user_id}_${Date.now()}.${ext}`;

    let photoUrl = null;
    try {
      const fileId = await uploadToGoogleDrive(env, file, "Profile_Pictures", filename);
      photoUrl = `/api/upload/file/gdrive/${fileId}`;
    } catch (e) {
      console.error("Profile photo upload failed:", e);
      return jsonResponse({ error: "Failed to upload photo to Google Drive: " + e.message }, 500);
    }

    // Update user record
    await runWrite(env, "UPDATE users SET profile_photo = ?, updated_at = ? WHERE id = ?", [photoUrl, timestamp, user.id]);

    const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
    const roleRow = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(user.user_id).first();
    const result = { ...updatedUser, role: roleRow?.role || "user" };
    delete result.hashed_password;

    return jsonResponse({ status: "success", profile_photo: photoUrl, user: result });
  } catch (e) {
    return jsonResponse({ error: "Failed to upload photo: " + e.message }, 500);
  }
}

/**
 * DELETE /api/users/profile/photo
 * Remove profile photo from Google Drive
 */
export async function handleDeleteProfilePhoto(request, env, params, query, user) {
  const timestamp = new Date().toISOString();

  // Try to delete from Google Drive if it exists
  if (user.profile_photo && user.profile_photo.includes("/gdrive/")) {
    const fileId = user.profile_photo.split("/gdrive/").pop();
    await deleteFromGoogleDrive(env, fileId).catch(() => {});
  }

  // Clear from DB
  await runWrite(env, "UPDATE users SET profile_photo = NULL, updated_at = ? WHERE id = ?", [timestamp, user.id]);

  const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  const roleRow = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(user.user_id).first();
  const result = { ...updatedUser, role: roleRow?.role || "user" };
  delete result.hashed_password;

  return jsonResponse({ status: "success", message: "Profile photo removed successfully", user: result });
}

