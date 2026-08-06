/**
 * ============================================================
 * Enterprise HTTP Response Utilities
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Single source of truth for all HTTP responses.
 * Import from this file — do NOT define local jsonResponse().
 * ============================================================
 */

// ─── Allowed CORS origins ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://fieldops.cyrixhealth.com",
  "https://cyrixhealth.com",
  "https://indrae.in",
  "https://www.indrae.in",
  "https://fieldops-api.sunilbishnoi.workers.dev",
  "https://fieldops-secondary-api.sunilbishnoi.workers.dev",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:8787",
];

/**
 * Compute safe CORS origin header value.
 * Returns the exact origin if allowed, or the primary production origin.
 */
export function getAllowedOrigin(requestOrigin) {
  if (!requestOrigin) return "*";
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin.includes("cyrixhealth.com") || 
      requestOrigin.includes("pages.dev") || 
      requestOrigin.includes("workers.dev") || 
      requestOrigin.includes("indrae.in") ||
      requestOrigin.startsWith("http://localhost:") || 
      requestOrigin.startsWith("http://127.0.0.1:")) {
    return requestOrigin;
  }
  return requestOrigin || "*";
}

/**
 * Build CORS headers for a given request origin.
 */
export function corsHeaders(requestOrigin) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(requestOrigin),
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-ID, X-Read-DB",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

/**
 * Enterprise security headers — applied to every response.
 */
export function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "connect-src 'self' https://indrae.in https://*.workers.dev https://script.google.com https://www.google-analytics.com https://analytics.google.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
}

/**
 * Primary JSON response builder.
 * @param {*} data - Response payload
 * @param {number} status - HTTP status code (default 200)
 * @param {string} requestOrigin - Origin header from request (for CORS)
 * @param {Object} extraHeaders - Additional headers to merge
 */
export function jsonResponse(data, status = 200, requestOrigin = null, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(requestOrigin),
      ...securityHeaders(),
      ...extraHeaders,
    },
  });
}

/**
 * Standardized error response.
 * @param {string} message - Human-readable error message
 * @param {number} status - HTTP status code
 * @param {string|null} detail - Optional technical detail (omit in production)
 * @param {string} requestOrigin - Origin for CORS
 * @param {string|null} requestId - Request correlation ID
 */
export function errorResponse(message, status = 500, detail = null, requestOrigin = null, requestId = null) {
  const body = { error: message, status };
  if (detail) body.detail = detail;
  if (requestId) body.requestId = requestId;
  return jsonResponse(body, status, requestOrigin);
}

/**
 * Validation error response (422 Unprocessable Entity).
 */
export function validationError(errors, requestOrigin = null) {
  return jsonResponse(
    { error: "Validation failed", errors: Array.isArray(errors) ? errors : [errors], status: 422 },
    422,
    requestOrigin
  );
}

/**
 * Unauthorized response (401).
 */
export function unauthorizedResponse(message = "Authentication required", requestOrigin = null) {
  return jsonResponse({ error: message, status: 401 }, 401, requestOrigin);
}

/**
 * Forbidden response (403).
 */
export function forbiddenResponse(message = "Access denied", requestOrigin = null) {
  return jsonResponse({ error: message, status: 403 }, 403, requestOrigin);
}

/**
 * Not found response (404).
 */
export function notFoundResponse(message = "Resource not found", requestOrigin = null) {
  return jsonResponse({ error: message, status: 404 }, 404, requestOrigin);
}

/**
 * Rate limit exceeded response (429).
 */
export function rateLimitResponse(retryAfterSeconds = 60, requestOrigin = null) {
  return jsonResponse(
    { error: "Rate limit exceeded. Please try again later.", status: 429, retryAfter: retryAfterSeconds },
    429,
    requestOrigin,
    { "Retry-After": String(retryAfterSeconds) }
  );
}

/**
 * Paginated response wrapper.
 * @param {Array} data - Array of records
 * @param {number} total - Total record count (unpaginated)
 * @param {number} page - Current page (1-indexed)
 * @param {number} pageSize - Page size used
 * @param {string} requestOrigin - Origin for CORS
 */
export function paginatedResponse(data, total, page, pageSize, requestOrigin = null) {
  return jsonResponse(
    {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total,
      },
    },
    200,
    requestOrigin
  );
}

/**
 * HTML response — used for email action confirmation pages.
 * @param {string} html - HTML content
 * @param {number} status - HTTP status
 */
export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...securityHeaders(),
    },
  });
}

/**
 * OPTIONS preflight response.
 */
export function preflightResponse(requestOrigin) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(requestOrigin),
    },
  });
}

/**
 * File/binary response for serving R2 objects.
 * @param {ReadableStream|ArrayBuffer} body
 * @param {string} contentType
 * @param {Object} extraHeaders
 */
export function fileResponse(body, contentType, extraHeaders = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}
