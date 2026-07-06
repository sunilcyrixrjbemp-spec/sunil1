import { verifyPassword, signJwt, verifyJwt } from "../utils/security.js";

/**
 * Helper to build JSON responses in routes
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Helper to log login attempts to db
 */
async function logLogin(db, userId, ipAddress, userAgent, status) {
  try {
    const timestamp = new Date().toISOString();
    await db.prepare(`
      INSERT INTO login_logs (user_id, ip_address, user_agent, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, ipAddress, userAgent, status, timestamp).run();
  } catch (e) {
    console.error("Failed to log login:", e);
  }
}

/**
 * POST /api/auth/login
 */
export async function handleLogin(request, env, params, query) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, password, force } = body;
  if (!user_id || !password) {
    return jsonResponse({ error: "user_id and password are required" }, 400);
  }

  const ipAddress = request.headers.get("cf-connecting-ip") || "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || "Unknown";

  // 1. Fetch user from DB
  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
  if (!user) {
    await logLogin(env.DB, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Invalid User ID or Password" }, 401);
  }

  // 2. Check user status
  if (user.user_status === "disabled") {
    await logLogin(env.DB, user_id, ipAddress, userAgent, "failed");
    return jsonResponse({ error: "Your account is disabled. Please contact the administrator." }, 403);
  }

  if (user.user_status === "locked") {
    await logLogin(env.DB, user_id, ipAddress, userAgent, "locked");
    return jsonResponse({ error: "Your account is locked. Please use the Unlock Account option." }, 403);
  }

  // 3. Verify password
  const passwordCorrect = await verifyPassword(password, user.hashed_password);
  if (!passwordCorrect) {
    const failedAttempts = (user.failed_attempt || 0) + 1;
    
    if (failedAttempts >= 5) {
      await env.DB.prepare("UPDATE users SET failed_attempt = ?, user_status = 'locked' WHERE user_id = ?")
        .bind(failedAttempts, user_id).run();
      await logLogin(env.DB, user_id, ipAddress, userAgent, "locked");
      return jsonResponse({ error: "Your account has been locked due to 5 failed login attempts." }, 403);
    } else {
      await env.DB.prepare("UPDATE users SET failed_attempt = ? WHERE user_id = ?")
        .bind(failedAttempts, user_id).run();
      await logLogin(env.DB, user_id, ipAddress, userAgent, "failed");
      const attemptsLeft = 5 - failedAttempts;
      return jsonResponse({ error: `Invalid User ID or Password. ${attemptsLeft} attempts remaining.` }, 401);
    }
  }

  // 4. Single session validation
  if (user.active_session_id && !force) {
    return jsonResponse({ error: "ALREADY_LOGGED_IN" }, 409);
  }

  // 5. Success - generate new active session ID
  const sessionId = crypto.randomUUID();
  await env.DB.prepare("UPDATE users SET active_session_id = ?, failed_attempt = 0 WHERE user_id = ?")
    .bind(sessionId, user_id).run();
  
  await logLogin(env.DB, user_id, ipAddress, userAgent, "success");

  // Create access and refresh tokens
  const secretKey = env.API_SECRET;
  const accessExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 Days
  const refreshExp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 365 Days

  const accessToken = await signJwt({ sub: user.user_id, sid: sessionId, exp: accessExp, type: "access" }, secretKey);
  const refreshToken = await signJwt({ sub: user.user_id, sid: sessionId, exp: refreshExp, type: "refresh" }, secretKey);

  // Fetch role
  const roleRow = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(user_id).first();

  return jsonResponse({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    user: {
      user_id: user.user_id,
      name: user.name,
      e_code: user.e_code,
      role: roleRow?.role || "user"
    }
  });
}

/**
 * POST /api/auth/refresh
 */
export async function handleRefresh(request, env, params, query) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { refresh_token } = body;
  if (!refresh_token) {
    return jsonResponse({ error: "refresh_token required" }, 400);
  }

  const payload = await verifyJwt(refresh_token, env.API_SECRET);
  if (!payload || payload.type !== "refresh") {
    return jsonResponse({ error: "Invalid or expired refresh token" }, 401);
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(payload.sub).first();
  if (!user || user.active_session_id !== payload.sid) {
    return jsonResponse({ error: "Session expired or invalid" }, 401);
  }

  const sessionId = crypto.randomUUID();
  await env.DB.prepare("UPDATE users SET active_session_id = ? WHERE user_id = ?")
    .bind(sessionId, user.user_id).run();

  const accessExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const refreshExp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  const accessToken = await signJwt({ sub: user.user_id, sid: sessionId, exp: accessExp, type: "access" }, env.API_SECRET);
  const newRefreshToken = await signJwt({ sub: user.user_id, sid: sessionId, exp: refreshExp, type: "refresh" }, env.API_SECRET);

  return jsonResponse({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: "bearer"
  });
}
