/**
 * User Profile Routes — Cloudflare D1 (direct binding)
 * Rewritten in v2.1.0: Removed Drizzle ORM, GDrive, GAS.
 * Profile photos now stored in R2.
 */

import { verifyPassword, getPasswordHash } from "../utils/security.js";
import { enterpriseUpload, deleteFromR2 } from "../utils/r2Storage.js";
import { jsonResponse, errorResponse } from "../utils/http.js";

function validatePasswordStrength(password) {
  const errors = [];
  if (password.length < 8) errors.push("Password must be at least 8 characters long");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain at least one uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must contain at least one lowercase letter");
  if (!/\d/.test(password)) errors.push("Password must contain at least one digit");
  if (!/[@$!%*?&#]/.test(password)) errors.push("Password must contain at least one special character (@$!%*?&#)");
  return { isValid: errors.length === 0, errors };
}

/**
 * GET /api/users/profile
 */
export async function handleGetProfile(request, env, params, query, user) {
  const profile = { ...user };
  delete profile.hashed_password;
  return jsonResponse(profile);
}

/**
 * PUT /api/users/profile
 */
export async function handleUpdateProfile(request, env, params, query, user) {
  let body;
  try { body = await request.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const { mobile_number, mail_id } = body;
  const sets = [];
  const binds = [];

  if (mobile_number !== undefined) {
    const mobile = (mobile_number || "").trim();
    if (mobile && !/^\+?[0-9\- \(\)]{7,20}$/.test(mobile)) {
      return errorResponse("Invalid mobile number format", 400);
    }
    sets.push("mobile_number = ?");
    binds.push(mobile || null);
  }

  if (mail_id !== undefined) {
    const email = (mail_id || "").trim();
    if (email && !/^[\w\.-]+@[\w\.-]+\.\w+$/.test(email)) {
      return errorResponse("Invalid email address format", 400);
    }
    sets.push("mail_id = ?");
    binds.push(email || null);
  }

  if (sets.length > 0) {
    binds.push(user.user_id);
    await env.DB.prepare(
      `UPDATE users SET ${sets.join(", ")} WHERE user_id = ?`
    ).bind(...binds).run();
  }

  const updated = await env.DB.prepare(
    `SELECT u.*, COALESCE(r.role, u.role) as role FROM users u
     LEFT JOIN user_roles r ON u.user_id = r.user_id
     WHERE u.user_id = ?`
  ).bind(user.user_id).first();

  if (updated) delete updated.hashed_password;
  return jsonResponse(updated || user);
}

/**
 * POST /api/users/change-password
 */
export async function handleChangePassword(request, env, params, query, user) {
  let body;
  try { body = await request.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const { old_password, new_password, confirm_password } = body;
  if (!old_password || !new_password || !confirm_password) {
    return errorResponse("All fields are required", 400);
  }

  // 1. Verify old password
  const oldCorrect = await verifyPassword(old_password, user.hashed_password);
  if (!oldCorrect) return errorResponse("Current password is incorrect", 400);

  // 2. Same as old?
  if (new_password === old_password) {
    return errorResponse("New password must be different from current password", 400);
  }

  // 3. Confirm match
  if (new_password !== confirm_password) {
    return errorResponse("New password and confirmation do not match", 400);
  }

  // 4. Strength
  const strength = validatePasswordStrength(new_password);
  if (!strength.isValid) return errorResponse(strength.errors.join("; "), 400);

  // Resolve numeric user.id (primary key for foreign key in password_histories)
  let numericUserId = user.id;
  if (!numericUserId) {
    const userRow = await env.DB.prepare("SELECT id FROM users WHERE user_id = ?").bind(user.user_id).first();
    numericUserId = userRow?.id;
  }

  // 5. Password history (last 5)
  if (numericUserId) {
    const history = await env.DB.prepare(
      `SELECT hashed_password FROM password_histories WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`
    ).bind(numericUserId).all();

    for (const row of (history?.results || [])) {
      if (await verifyPassword(new_password, row.hashed_password)) {
        return errorResponse("You cannot reuse any of your last 5 passwords.", 400);
      }
    }
  }

  // 6. Update
  const newHash = await getPasswordHash(new_password);
  const now = new Date().toISOString();

  const statements = [
    env.DB.prepare(`UPDATE users SET hashed_password = ?, updated_at = ? WHERE user_id = ?`).bind(newHash, now, user.user_id),
  ];

  if (numericUserId) {
    statements.push(
      env.DB.prepare(`INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)`).bind(numericUserId, newHash, now)
    );
  }

  await env.DB.batch(statements);

  return jsonResponse({ status: "success", message: "Password updated successfully." });
}

/**
 * POST /api/users/profile/photo
 * Upload profile photo to R2
 */
export async function handleUploadProfilePhoto(request, env, params, query, user) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) return errorResponse("No file provided", 400);

    const fileBuffer = await file.arrayBuffer();
    if (fileBuffer.byteLength > 5 * 1024 * 1024) {
      return errorResponse("Profile photo must be under 5MB", 400);
    }

    const ext = (file.name || "photo.jpg").split(".").pop().toLowerCase() || "jpg";
    const filename = `profile_${user.user_id}_${Date.now()}.${ext}`;

    const result = await enterpriseUpload(env, fileBuffer, {
      category: "profile_photos",
      originalFilename: filename,
      contentType: file.type || "image/jpeg",
      uploadedBy: user.user_id,
      employeeId: user.user_id,
      employeeName: user.name,
    });

    if (!result.success) return errorResponse("Upload failed: " + result.error, 500);

    const photoUrl = result.url;
    const now = new Date().toISOString();

    // Delete old photo from R2 if exists
    const oldUser = await env.DB.prepare(`SELECT profile_pic_url FROM users WHERE user_id = ?`).bind(user.user_id).first();
    if (oldUser?.profile_pic_url && oldUser.profile_pic_url.startsWith("/api/files/")) {
      const oldKey = decodeURIComponent(oldUser.profile_pic_url.replace("/api/files/", ""));
      await deleteFromR2(env, oldKey).catch(() => {});
    }

    // Save to DB
    await env.DB.prepare(
      `UPDATE users SET profile_pic_url = ? WHERE user_id = ?`
    ).bind(photoUrl, user.user_id).run();

    return jsonResponse({
      status: "success",
      profile_pic_url: photoUrl,
      profile_photo: photoUrl,
    });
  } catch (e) {
    return errorResponse("Failed to upload photo: " + e.message, 500);
  }
}

/**
 * DELETE /api/users/profile/photo
 */
export async function handleDeleteProfilePhoto(request, env, params, query, user) {
  const currentUser = await env.DB.prepare(`SELECT profile_pic_url FROM users WHERE user_id = ?`).bind(user.user_id).first();

  if (currentUser?.profile_pic_url && currentUser.profile_pic_url.startsWith("/api/files/")) {
    const key = decodeURIComponent(currentUser.profile_pic_url.replace("/api/files/", ""));
    await deleteFromR2(env, key).catch(() => {});
  }

  await env.DB.prepare(`UPDATE users SET profile_pic_url = NULL WHERE user_id = ?`).bind(user.user_id).run();

  return jsonResponse({ status: "success", message: "Profile photo removed successfully" });
}
