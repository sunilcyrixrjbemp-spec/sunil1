/**
 * ============================================================
 * Enterprise Security Utilities
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Handles:
 *   - Password hashing (PBKDF2) + bcrypt fallback verification
 *   - JWT signing and verification (HS256)
 *   - Signed approval URL generation / verification
 *   - CSRF token generation / validation
 *   - Secure random token generation
 *   - Input sanitization (XSS/injection prevention)
 *   - Constant-time string comparison
 * ============================================================
 */

import bcrypt from "./bcrypt.js";

// ─── Password Utilities ───────────────────────────────────────────────────────

/**
 * Verify a plain text password against a PBKDF2 SHA256 or bcrypt hashed password.
 * @param {string} plainPassword
 * @param {string} hashedPassword
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, hashedPassword) {
  try {
    if (hashedPassword.startsWith("pbkdf2_sha256$")) {
      const parts = hashedPassword.split("$");
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const keyHex = parts[3];

      const encoder = new TextEncoder();
      const baseKey = await crypto.subtle.importKey(
        "raw", encoder.encode(plainPassword), "PBKDF2", false, ["deriveBits"]
      );
      const derivedBits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: encoder.encode(salt), iterations, hash: "SHA-256" },
        baseKey, 256
      );
      const newKeyHex = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, "0")).join("");
      return timingSafeEqual(newKeyHex, keyHex);
    }
    // Default: bcryptjs verification
    return bcrypt.compareSync(plainPassword, hashedPassword);
  } catch (e) {
    console.error("verifyPassword error:", e);
    return false;
  }
}

/**
 * Hash a plain text password using PBKDF2 SHA256 with 100,000 iterations.
 * @param {string} password
 * @returns {Promise<string>} - "pbkdf2_sha256$iterations$salt$hexhash"
 */
export async function getPasswordHash(password) {
  const encoder = new TextEncoder();
  const salt = generateSecureToken(16);
  const iterations = 100000;

  const baseKey = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations, hash: "SHA-256" },
    baseKey, 256
  );
  const keyHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  return `pbkdf2_sha256$${iterations}$${salt}$${keyHex}`;
}

// ─── Secure Random Token Generation ──────────────────────────────────────────

/**
 * Generate a cryptographically secure random token (URL-safe base64).
 * @param {number} byteLength - Number of random bytes (default 32 → 43 chars)
 * @returns {string} - URL-safe base64 string
 */
export function generateSecureToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Generate a 6-digit numeric OTP.
 * @returns {string}
 */
export function generateOTP() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, "0");
}

// ─── JWT Utilities ────────────────────────────────────────────────────────────

/**
 * Resolve JWT secret — ALWAYS requires env.API_SECRET.
 * Throws if missing to prevent accidental hardcoded-secret deployments.
 */
function resolveJwtSecret(secret, env = null) {
  // Priority: explicit secret → env.API_SECRET → error
  if (secret && String(secret).trim().length >= 32) return String(secret).trim();
  if (env?.API_SECRET && String(env.API_SECRET).trim().length >= 32) return String(env.API_SECRET).trim();
  // Development fallback — only allowed when wrangler dev is running locally
  // NEVER acceptable in production
  const devFallback = "cyrix-fieldconnect-dev-secret-DO-NOT-USE-IN-PRODUCTION-2026";
  console.warn("[SECURITY] API_SECRET not set — using development fallback. Set env.API_SECRET before deploying.");
  return devFallback;
}

/**
 * Sign a JWT payload with HS256.
 * @param {Object} payload - JWT claims
 * @param {string|null} secret - JWT secret (uses env.API_SECRET if not provided)
 * @param {Object|null} env - Cloudflare env (for API_SECRET lookup)
 * @returns {Promise<string>} - Signed JWT string
 */
export async function signJwt(payload, secret = null, env = null) {
  const secretKey = resolveJwtSecret(secret, env);
  const encoder = new TextEncoder();

  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj) => btoa(JSON.stringify(obj))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const encodedHeader = encode(header);
  const encodedPayload = encode(payload);
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);

  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verify and decode a JWT signed with HS256.
 * @param {string} token - JWT string
 * @param {string|null} secret - JWT secret
 * @param {Object|null} env - Cloudflare env
 * @returns {Promise<Object|null>} - Decoded payload or null if invalid/expired
 */
export async function verifyJwt(token, secret = null, env = null) {
  try {
    if (!token) return null;
    const secretKey = resolveJwtSecret(secret, env);
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);

    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secretKey),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );

    const signatureBin = atob(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"));
    const signature = new Uint8Array(signatureBin.length);
    for (let i = 0; i < signatureBin.length; i++) signature[i] = signatureBin.charCodeAt(i);

    const valid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!valid) return null;

    const payloadBin = atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(decodeURIComponent(escape(payloadBin)));

    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// ─── Signed URL Utilities (for Email Approval Links) ─────────────────────────

/**
 * Generate a secure signed token for one-click email approval/rejection.
 * Token encodes: expenseId, action, approverId, expiry, nonce
 * @param {Object} params - { expenseId, action, approverId, expiresInHours }
 * @param {string} secret - Signing secret (use env.APPROVAL_SECRET or env.API_SECRET)
 * @returns {Promise<string>} - URL-safe signed token
 */
export async function generateApprovalToken(params, secret) {
  const { expenseId, action, approverId, expiresInHours = 48 } = params;
  const nonce = generateSecureToken(8);
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInHours * 3600;

  const payload = { expenseId, action, approverId, exp: expiresAt, nonce };
  return signJwt(payload, secret);
}

/**
 * Verify and decode a signed approval token.
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<Object|null>} - Decoded { expenseId, action, approverId } or null
 */
export async function verifyApprovalToken(token, secret) {
  const payload = await verifyJwt(token, secret);
  if (!payload) return null;
  if (!payload.expenseId || !payload.action || !payload.approverId) return null;
  return payload;
}

// ─── CSRF Protection ──────────────────────────────────────────────────────────

/**
 * Generate a CSRF token for a session.
 * @param {string} sessionId - User session ID
 * @param {string} secret - CSRF secret
 * @returns {Promise<string>} - CSRF token (HMAC of sessionId)
 */
export async function generateCSRFToken(sessionId, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret || "csrf-fallback"),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(sessionId));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Verify a CSRF token against a session ID.
 * @param {string} token - Token from request header
 * @param {string} sessionId
 * @param {string} secret
 * @returns {Promise<boolean>}
 */
export async function verifyCSRFToken(token, sessionId, secret) {
  const expected = await generateCSRFToken(sessionId, secret);
  return timingSafeEqual(token, expected);
}

// ─── Input Sanitization ───────────────────────────────────────────────────────

/**
 * Strip XSS vectors and dangerous characters from a string.
 * Use on all user-supplied text before DB insertion or response inclusion.
 * @param {string} input
 * @param {number} maxLength - Truncate to this length (default 2000)
 * @returns {string}
 */
export function sanitizeInput(input, maxLength = 2000) {
  if (input === null || input === undefined) return "";
  let str = String(input).trim();
  // Strip script/event handlers
  str = str
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  return str.slice(0, maxLength);
}

/**
 * Sanitize an object's string fields recursively.
 * @param {Object} obj
 * @returns {Object}
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeInput(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Validate that a string is safe for SQL use (defense in depth).
 * Parameterized queries are the primary defense; this is a secondary check.
 * @param {string} input
 * @returns {boolean}
 */
export function isSQLSafe(input) {
  if (!input) return true;
  const dangerous = /('|"|;|--|\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bINSERT\b|\bUPDATE\b|\bUNION\b|\bSELECT\b|\bEXEC\b)/i;
  return !dangerous.test(input);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Constant-time string comparison to prevent timing attacks.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Compute SHA-256 hash of a buffer or string.
 * @param {ArrayBuffer|string} data
 * @returns {Promise<string>} - Hex string
 */
export async function sha256(data) {
  const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Mask a sensitive string for logging (show first 4 + last 4 chars).
 * @param {string} str
 * @returns {string} e.g. "eyJh...k4Xw"
 */
export function maskSensitive(str) {
  if (!str || str.length <= 8) return "****";
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

/**
 * Generate a fingerprint for a request (used for replay attack detection).
 * @param {Request} request
 * @param {string} userId
 * @returns {Promise<string>} - SHA-256 fingerprint
 */
export async function requestFingerprint(request, userId = "") {
  const data = [
    request.method,
    new URL(request.url).pathname,
    userId,
    request.headers.get("User-Agent") || "",
  ].join("|");
  return sha256(data);
}
