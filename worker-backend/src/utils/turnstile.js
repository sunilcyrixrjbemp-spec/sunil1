/**
 * ============================================================
 * Cloudflare Turnstile Token Verification Middleware
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Zero-dependency Cloudflare Turnstile siteverify wrapper.
 * Protects login endpoints from credential stuffing and automated bots.
 * ============================================================
 */

import { jsonResponse } from "./http.js";
import { staticLog } from "./logger.js";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// Cloudflare's official always-pass testing secret key
const CLOUDFLARE_DUMMY_SECRET = "1x0000000000000000000000000000000AA";

/**
 * Verify Turnstile token with Cloudflare API.
 *
 * @param {string} token - The cf-turnstile-response token from frontend
 * @param {string} ip - Client IP address
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verifyTurnstileToken(token, ip, env) {
  const secretKey = env.TURNSTILE_SECRET_KEY || (env.APP_ENV === "development" ? CLOUDFLARE_DUMMY_SECRET : null);

  // If Turnstile is not enabled or secret not set in non-production, allow gracefully
  if (!secretKey) {
    if (env.APP_ENV === "production") {
      // In production without key configured, log warning and allow (fail open until admin sets secret)
      staticLog.warn("TURNSTILE_SECRET_KEY not set in production. Turnstile check bypassed.");
      return { success: true, bypassed: true };
    }
    return { success: true, bypassed: true };
  }

  // If token is missing
  if (!token) {
    // If native app header is present or in development without token, allow
    return {
      success: false,
      error: "Bot verification token missing. Please complete the security check."
    };
  }

  try {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (ip) {
      formData.append("remoteip", ip);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: formData,
    });

    const outcome = await response.json();
    if (!outcome.success) {
      staticLog.warn("Turnstile verification failed", {
        errorCodes: outcome["error-codes"],
        ip
      });
      return {
        success: false,
        error: "Turnstile verification failed. Please refresh and try again."
      };
    }

    return { success: true };
  } catch (error) {
    staticLog.error("Error connecting to Cloudflare Turnstile API", { error: error.message });
    // Fail open in case of external API network issue so real users aren't locked out
    return { success: true, warning: "Turnstile API unreachable" };
  }
}

/**
 * Middleware wrapper around auth login handler.
 * Validates Turnstile challenge token before passing control to handleLogin.
 *
 * @param {Function} handler - The original handleLogin function
 * @returns {Function} Wrapped handler
 */
export function withTurnstileVerification(handler) {
  return async function turnstileProtectedHandler(request, env, ...rest) {
    // Only verify POST login requests
    if (request.method !== "POST") {
      return handler(request, env, ...rest);
    }

    // Check if client is a native mobile app (Capacitor sends custom header or user agent)
    const userAgent = request.headers.get("User-Agent") || "";
    const isNativeApp = request.headers.get("X-Platform") === "native" ||
                        userAgent.includes("Capacitor") ||
                        userAgent.includes("CyrixFieldNative");

    if (isNativeApp) {
      // Bypass Turnstile for native mobile app clients
      return handler(request, env, ...rest);
    }

    let clonedBody;
    try {
      // Clone request to inspect turnstile token without exhausting original stream
      const clonedRequest = request.clone();
      clonedBody = await clonedRequest.json();
    } catch {
      return handler(request, env, ...rest);
    }

    const turnstileToken = clonedBody?.turnstile_token ||
                           clonedBody?.["cf-turnstile-response"] ||
                           request.headers.get("CF-Turnstile-Token");

    const clientIP = request.headers.get("CF-Connecting-IP") ||
                     request.headers.get("X-Forwarded-For") ||
                     "127.0.0.1";

    // If Turnstile secret is configured or token was provided
    if (env.TURNSTILE_SECRET_KEY || turnstileToken) {
      const verification = await verifyTurnstileToken(turnstileToken, clientIP, env);
      if (!verification.success) {
        return jsonResponse({
          error: verification.error || "Bot verification failed",
          detail: "TURNSTILE_FAILED"
        }, 403);
      }
    }

    return handler(request, env, ...rest);
  };
}
