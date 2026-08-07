/**
 * ============================================================
 * Enterprise Rate Limiting Middleware
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * KV-based rate limiting shared across all Cloudflare PoPs.
 *
 * Rate Limit Rules:
 *   - Global IP:       10 requests/minute
 *   - Login endpoint:  5 attempts/hour per IP
 *   - OTP endpoints:   3 requests/hour per userId
 *   - Email sends:     3 emails/hour per userId
 *   - API (auth'd):    120 requests/minute per userId
 *   - Admin bypass:    Admin role users bypass user-level limits
 *
 * Storage: Cloudflare KV (OTPS_KV namespace)
 * Key format: rl:<type>:<identifier>
 * ============================================================
 */

// ─── Rate Limit Configurations ────────────────────────────────────────────────
const RATE_LIMITS = {
  // IP-based limits (generous limits to prevent 429 lockouts on shared mobile/office IPs)
  ip_global:        { max: 600, windowSec: 60,   keyPrefix: "rl:ip_global" },
  ip_login:         { max: 60,  windowSec: 300,  keyPrefix: "rl:ip_login"  },
  ip_forgot:        { max: 15,  windowSec: 300,  keyPrefix: "rl:ip_forgot" },

  // User-based limits (Admin role bypasses these)
  user_api:         { max: 300, windowSec: 60,   keyPrefix: "rl:user_api"  },
  user_otp:         { max: 10,  windowSec: 300,  keyPrefix: "rl:user_otp"  },
  user_email:       { max: 10,  windowSec: 300,  keyPrefix: "rl:user_email"},
  user_upload:      { max: 100, windowSec: 60,   keyPrefix: "rl:user_upload"},
};

/**
 * Get the client IP address from the request.
 * Cloudflare injects the real IP in CF-Connecting-IP.
 */
export function getClientIP(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    "unknown"
  );
}

/**
 * Check and increment a rate limit counter in KV.
 * Returns { allowed: boolean, remaining: number, resetAfter: number }
 *
 * @param {Object} kv - KV namespace binding (env.OTPS_KV)
 * @param {string} limitType - Key from RATE_LIMITS config
 * @param {string} identifier - IP address or userId
 * @returns {Promise<{allowed: boolean, remaining: number, resetAfter: number, limit: number}>}
 */
async function checkRateLimit(kv, limitType, identifier) {
  const config = RATE_LIMITS[limitType];
  if (!config) return { allowed: true, remaining: 999, resetAfter: 0, limit: 999 };

  const key = `${config.keyPrefix}:${identifier}`;

  try {
    // Get current counter value with metadata (metadata stores expiry time)
    const { value, metadata } = await kv.getWithMetadata(key, { type: "text" });

    const now = Math.floor(Date.now() / 1000);
    let count = 0;
    let windowExpiry = now + config.windowSec;

    if (value && metadata?.expiry) {
      count = parseInt(value, 10) || 0;
      windowExpiry = metadata.expiry;

      // If window has expired, reset
      if (now >= windowExpiry) {
        count = 0;
        windowExpiry = now + config.windowSec;
      }
    }

    const remaining = Math.max(0, config.max - count - 1);
    const resetAfter = Math.max(0, windowExpiry - now);

    if (count >= config.max) {
      return { allowed: false, remaining: 0, resetAfter, limit: config.max };
    }

    // Increment counter
    await kv.put(key, String(count + 1), {
      expirationTtl: resetAfter > 0 ? resetAfter : config.windowSec,
      metadata: { expiry: windowExpiry },
    });

    return { allowed: true, remaining, resetAfter, limit: config.max };
  } catch (e) {
    // KV failure — fail open (allow request) but log the issue
    console.error(`[RateLimit] KV error for ${limitType}:${identifier}:`, e);
    return { allowed: true, remaining: 1, resetAfter: 0, limit: config.max };
  }
}

/**
 * Reset a rate limit counter (used after successful auth, OTP verification, etc.)
 * @param {Object} kv - KV namespace
 * @param {string} limitType - Key from RATE_LIMITS
 * @param {string} identifier - IP or userId
 */
export async function resetRateLimit(kv, limitType, identifier) {
  const config = RATE_LIMITS[limitType];
  if (!config || !kv) return;
  try {
    const key = `${config.keyPrefix}:${identifier}`;
    await kv.delete(key);
  } catch (e) {
    console.warn(`[RateLimit] Failed to reset ${limitType}:${identifier}:`, e);
  }
}

/**
 * Check if a user role should bypass user-level rate limits.
 * IP-level limits are NEVER bypassed.
 */
function isAdminBypass(userRole) {
  return (userRole || "").toLowerCase() === "admin";
}

/**
 * ─── MIDDLEWARE: Global IP rate limiter ───────────────────────────────────────
 * Call this at the very start of the request, before any routing.
 * Returns null if allowed, or a Response if rate-limited.
 *
 * @param {Request} request
 * @param {Object} env - Cloudflare env
 * @param {string} requestOrigin - For CORS headers on error response
 */
export async function globalIPRateLimit(request, env, requestOrigin = null) {
  if (!env.OTPS_KV) return null; // KV not bound — skip (dev mode)

  const ip = getClientIP(request);
  if (ip === "unknown") return null;

  const result = await checkRateLimit(env.OTPS_KV, "ip_global", ip);
  if (!result.allowed) {
    const { rateLimitResponse } = await import("./http.js");
    return rateLimitResponse(result.resetAfter, requestOrigin);
  }
  return null;
}

/**
 * ─── MIDDLEWARE: Login endpoint rate limiter ──────────────────────────────────
 * Returns null if allowed, or a Response if blocked.
 *
 * @param {Request} request
 * @param {Object} env
 * @param {string} requestOrigin
 */
export async function loginRateLimit(request, env, requestOrigin = null) {
  if (!env.OTPS_KV) return null;

  const ip = getClientIP(request);
  const result = await checkRateLimit(env.OTPS_KV, "ip_login", ip);
  if (!result.allowed) {
    const { jsonResponse } = await import("./http.js");
    return jsonResponse(
      {
        error: "Too many login attempts. Account temporarily restricted. Try again in 1 hour.",
        status: 429,
        retryAfter: result.resetAfter,
      },
      429,
      requestOrigin,
      { "Retry-After": String(result.resetAfter) }
    );
  }
  return null;
}

/**
 * ─── MIDDLEWARE: OTP endpoint rate limiter ────────────────────────────────────
 * Rate limited per userId (not IP) to prevent OTP enumeration.
 *
 * @param {Object} env
 * @param {string} userId - User identifier
 * @param {string} requestOrigin
 */
export async function otpRateLimit(env, userId, requestOrigin = null) {
  if (!env.OTPS_KV || !userId) return null;

  const result = await checkRateLimit(env.OTPS_KV, "user_otp", userId);
  if (!result.allowed) {
    const { jsonResponse } = await import("./http.js");
    return jsonResponse(
      {
        error: "Too many OTP requests. Please wait before requesting another OTP.",
        status: 429,
        retryAfter: result.resetAfter,
      },
      429,
      requestOrigin,
      { "Retry-After": String(result.resetAfter) }
    );
  }
  return null;
}

/**
 * ─── MIDDLEWARE: Email rate limiter ───────────────────────────────────────────
 * 3 emails per user per hour. Admin role bypasses.
 *
 * @param {Object} env
 * @param {string} userId
 * @param {string} userRole
 */
export async function emailRateLimit(env, userId, userRole = "") {
  if (!env.OTPS_KV || !userId) return { allowed: true };
  if (isAdminBypass(userRole)) return { allowed: true };

  return await checkRateLimit(env.OTPS_KV, "user_email", userId);
}

/**
 * ─── MIDDLEWARE: Authenticated user API rate limiter ─────────────────────────
 * 120 requests/minute per authenticated user. Admin bypasses.
 *
 * @param {Object} env
 * @param {string} userId
 * @param {string} userRole
 * @param {string} requestOrigin
 */
export async function userAPIRateLimit(env, userId, userRole = "", requestOrigin = null) {
  if (!env.OTPS_KV || !userId) return null;
  if (isAdminBypass(userRole)) return null;

  const result = await checkRateLimit(env.OTPS_KV, "user_api", userId);
  if (!result.allowed) {
    const { rateLimitResponse } = await import("./http.js");
    return rateLimitResponse(result.resetAfter, requestOrigin);
  }
  return null;
}

/**
 * ─── MIDDLEWARE: Upload rate limiter ─────────────────────────────────────────
 * 30 uploads/minute per authenticated user.
 */
export async function uploadRateLimit(env, userId, requestOrigin = null) {
  if (!env.OTPS_KV || !userId) return null;

  const result = await checkRateLimit(env.OTPS_KV, "user_upload", userId);
  if (!result.allowed) {
    const { jsonResponse } = await import("./http.js");
    return jsonResponse(
      { error: "Upload rate limit exceeded. Maximum 30 uploads per minute.", status: 429 },
      429, requestOrigin,
      { "Retry-After": String(result.resetAfter) }
    );
  }
  return null;
}

/**
 * Get current rate limit status for a user (for dashboard display).
 * @param {Object} kv
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export async function getRateLimitStatus(kv, userId) {
  if (!kv || !userId) return {};
  const checks = {};
  for (const [type, config] of Object.entries(RATE_LIMITS)) {
    if (type.startsWith("user_")) {
      try {
        const key = `${config.keyPrefix}:${userId}`;
        const val = await kv.get(key, { type: "text" });
        checks[type] = { used: parseInt(val || "0", 10), max: config.max };
      } catch (_) {
        checks[type] = { used: 0, max: config.max };
      }
    }
  }
  return checks;
}
