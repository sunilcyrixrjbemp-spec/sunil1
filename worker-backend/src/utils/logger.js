/**
 * ============================================================
 * Enterprise Structured Logger
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Provides structured JSON logging with levels, request correlation,
 * user context, and performance timing. Logs are written async
 * via the ANALYTICS_QUEUE to avoid blocking request handlers.
 * ============================================================
 */

export const LogLevel = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
  CRITICAL: "CRITICAL",
};

/**
 * Generate a unique request ID for correlation.
 * Format: req_<timestamp_base36>_<random_hex>
 */
export function generateRequestId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(16).slice(2, 10);
  return `req_${ts}_${rand}`;
}

/**
 * Core logger class — one instance per request.
 * Usage:
 *   const log = new Logger(env, requestId, { userId: "EMP001", role: "Engineer" });
 *   log.info("User logged in", { ip: "1.2.3.4" });
 *   log.error("DB query failed", { sql: "SELECT...", error: e.message });
 */
export class Logger {
  /**
   * @param {Object} env - Cloudflare Worker env
   * @param {string} requestId - Correlation ID for this request
   * @param {Object} context - User context ({ userId, role, name })
   */
  constructor(env, requestId = null, context = {}) {
    this.env = env;
    this.requestId = requestId || generateRequestId();
    this.context = context;
    this.startTime = Date.now();
  }

  /**
   * Set user context after authentication.
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Core log method — formats and outputs a structured log entry.
   */
  _log(level, message, data = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      requestId: this.requestId,
      message,
      ...this.context,
      ...data,
      elapsedMs: Date.now() - this.startTime,
    };

    // Always write to console (appears in wrangler tail / CF dashboard)
    if (level === LogLevel.ERROR || level === LogLevel.CRITICAL) {
      console.error(JSON.stringify(entry));
    } else if (level === LogLevel.WARN) {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }

    // For ERROR+ levels, attempt async queue write if ANALYTICS_QUEUE is bound
    if (
      (level === LogLevel.ERROR || level === LogLevel.CRITICAL) &&
      this.env?.ANALYTICS_QUEUE
    ) {
      // Non-blocking — fire and forget
      this.env.ANALYTICS_QUEUE.send({
        type: "error_log",
        payload: entry,
      }).catch(() => {/* swallow — logging must never crash the app */});
    }
  }

  debug(message, data = {}) { this._log(LogLevel.DEBUG, message, data); }
  info(message, data = {})  { this._log(LogLevel.INFO,  message, data); }
  warn(message, data = {})  { this._log(LogLevel.WARN,  message, data); }
  error(message, data = {}) { this._log(LogLevel.ERROR, message, data); }
  critical(message, data = {}) { this._log(LogLevel.CRITICAL, message, data); }

  /**
   * Log an API request completion with timing.
   */
  apiComplete(method, path, status, extra = {}) {
    this._log(LogLevel.INFO, `${method} ${path} → ${status}`, {
      method, path, status, durationMs: Date.now() - this.startTime, ...extra,
    });
  }

  /**
   * Log a database query for performance monitoring.
   */
  dbQuery(operation, table, durationMs, extra = {}) {
    const level = durationMs > 500 ? LogLevel.WARN : LogLevel.DEBUG;
    this._log(level, `DB ${operation} on ${table} (${durationMs}ms)`, {
      dbOp: operation, table, durationMs, ...extra,
    });
  }

  /**
   * Log a security event (failed auth, rate limit, suspicious activity).
   */
  security(event, data = {}) {
    this._log(LogLevel.WARN, `[SECURITY] ${event}`, { securityEvent: event, ...data });
  }

  /**
   * Log an audit action — high-priority, always stored.
   */
  audit(action, entityType, entityId, oldValue = null, newValue = null) {
    this._log(LogLevel.INFO, `[AUDIT] ${action} on ${entityType}:${entityId}`, {
      auditAction: action, entityType, entityId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    });
  }
}

/**
 * Simple static logger for use outside request context (cron jobs, queue processors).
 */
export const staticLog = {
  debug: (msg, data = {}) => console.log(JSON.stringify({ level: "DEBUG", ts: new Date().toISOString(), message: msg, ...data })),
  info:  (msg, data = {}) => console.log(JSON.stringify({ level: "INFO",  ts: new Date().toISOString(), message: msg, ...data })),
  warn:  (msg, data = {}) => console.warn(JSON.stringify({ level: "WARN",  ts: new Date().toISOString(), message: msg, ...data })),
  error: (msg, data = {}) => console.error(JSON.stringify({ level: "ERROR", ts: new Date().toISOString(), message: msg, ...data })),
};

/**
 * Format error for logging — handles Error objects and strings.
 */
export function formatError(e) {
  if (e instanceof Error) {
    return { message: e.message, name: e.name, stack: e.stack };
  }
  return { message: String(e) };
}
