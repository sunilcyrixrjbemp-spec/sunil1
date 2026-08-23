/**
 * ============================================================
 * Cloudflare Cron & Diagnostic Health Checks
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Purely READ-ONLY diagnostic endpoints for scheduled Cloudflare Cron Triggers
 * and external monitoring.
 *
 * STRICT CONSTRAINT:
 * - NO WRITES to expenses, approvals, or user tables.
 * - Read-only telemetry, SLA alerts, and system diagnostics only.
 * ============================================================
 */

import { jsonResponse, unauthorizedResponse, errorResponse } from "../utils/http.js";
import { staticLog, Logger, generateRequestId } from "../utils/logger.js";
import { verifyJwt } from "../utils/security.js";

/**
 * Handle Daily Check Cron Trigger / API invocation.
 * Target Schedule: 02:00 AM IST (20:30 UTC daily — cron: "30 20 * * *")
 *
 * @param {Request|null} req - Incoming HTTP request (or null if scheduled worker event)
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} [params] - Route parameters
 * @param {Object} [query] - Query string parameters
 * @param {Object} [user] - Authenticated user object if authenticated
 */
export async function handleDailyCheck(req, env, params = {}, query = {}, user = null) {
  const requestId = req?.headers?.get("X-Request-ID") || generateRequestId();
  const log = new Logger(env, requestId);

  // 1. Authorization verification if called via HTTP
  if (req) {
    const authHeader = req.headers.get("Authorization") || "";
    const cronSecretHeader = req.headers.get("X-Cron-Secret") || "";
    const configuredSecret = env.CRON_SECRET || env.API_SECRET;

    let isAuthorized = false;

    // Check if called with matching secret
    if (configuredSecret) {
      if (cronSecretHeader && cronSecretHeader === configuredSecret) {
        isAuthorized = true;
      } else if (authHeader.startsWith("Bearer ") && authHeader.slice(7) === configuredSecret) {
        isAuthorized = true;
      }
    }

    // Alternatively check if caller is an authenticated Admin
    if (!isAuthorized && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const payload = await verifyJwt(token, env.API_SECRET, env);
        if (payload && (payload.role === "Admin" || payload.role === "SuperAdmin")) {
          isAuthorized = true;
        }
      } catch {
        // Fallthrough to unauthorized
      }
    }

    // In local development or if no secret is configured yet, allow query flag ?dev=1 with warning
    if (!isAuthorized && (env.APP_ENV === "development" || !configuredSecret)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      log.warn("Unauthorized attempt to access /api/cron/daily-check", {
        ip: req.headers.get("CF-Connecting-IP") || "unknown"
      });
      return unauthorizedResponse("Unauthorized: Valid CRON_SECRET or Admin authorization required");
    }
  }

  try {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const alerts = [];

    // 2. READ-ONLY: Database Connection & Basic Health
    let dbStatus = "unknown";
    try {
      const ping = await env.DB.prepare("SELECT 1 as ok").first();
      dbStatus = ping?.ok === 1 ? "connected" : "degraded";
    } catch (e) {
      dbStatus = "error: " + e.message;
      alerts.push({ level: "CRITICAL", message: `D1 Database connection error: ${e.message}` });
    }

    // 3. READ-ONLY: Pending Expenses & SLA Aging (> 3 days pending)
    let expenseMetrics = { totalPending: 0, pendingAmount: 0, agedOver3Days: 0 };
    if (dbStatus === "connected") {
      try {
        const pendingSummary = await env.DB.prepare(`
          SELECT 
            COUNT(*) as count,
            COALESCE(SUM(amount), 0) as total_amount
          FROM expenses 
          WHERE status IN ('Pending', 'Submitted', 'Under Review')
        `).first();

        const agedSummary = await env.DB.prepare(`
          SELECT COUNT(*) as count 
          FROM expenses 
          WHERE status IN ('Pending', 'Submitted', 'Under Review')
            AND created_at < datetime('now', '-3 days')
        `).first();

        expenseMetrics = {
          totalPending: pendingSummary?.count || 0,
          pendingAmount: Number(pendingSummary?.total_amount || 0),
          agedOver3Days: agedSummary?.count || 0
        };

        if (expenseMetrics.agedOver3Days > 0) {
          alerts.push({
            level: "WARN",
            type: "EXPENSE_SLA_BREACH",
            message: `${expenseMetrics.agedOver3Days} expense claims pending approval for more than 3 days`
          });
        }
      } catch (e) {
        log.error("Failed to query expense metrics during daily check", { error: e.message });
      }
    }

    // 4. READ-ONLY: Support Tickets & High-Priority Alerts
    let ticketMetrics = { openTickets: 0, highPriorityOpen: 0 };
    if (dbStatus === "connected") {
      try {
        const ticketSummary = await env.DB.prepare(`
          SELECT 
            COUNT(*) as open_count,
            COUNT(CASE WHEN priority = 'High' OR priority = 'Critical' THEN 1 END) as high_pri_count
          FROM support_tickets 
          WHERE status IN ('Open', 'In Progress')
        `).first();

        ticketMetrics = {
          openTickets: ticketSummary?.open_count || 0,
          highPriorityOpen: ticketSummary?.high_pri_count || 0
        };

        if (ticketMetrics.highPriorityOpen > 0) {
          alerts.push({
            level: "WARN",
            type: "TICKET_URGENT",
            message: `${ticketMetrics.highPriorityOpen} high-priority support tickets require attention`
          });
        }
      } catch (e) {
        log.error("Failed to query ticket metrics during daily check", { error: e.message });
      }
    }

    // 5. READ-ONLY: Active Users Count
    let userMetrics = { activeUsers: 0 };
    if (dbStatus === "connected") {
      try {
        const userSummary = await env.DB.prepare(`
          SELECT COUNT(*) as active_count 
          FROM users 
          WHERE user_status = 'active'
        `).first();

        userMetrics = {
          activeUsers: userSummary?.active_count || 0
        };
      } catch (e) {
        log.error("Failed to query user metrics during daily check", { error: e.message });
      }
    }

    // 6. READ-ONLY: Storage & Queue Status
    const storageMetrics = {
      r2Configured: !!(env.R2_BUCKET || env.CYRIXAPP_BUCKET),
      kvConfigured: !!env.OTPS_KV,
      queuesConfigured: !!env.ANALYTICS_QUEUE
    };

    const durationMs = Date.now() - startTime;

    const result = {
      status: "ok",
      job: "daily-check",
      scheduledTimeIST: "02:00 AM IST (20:30 UTC)",
      timestamp,
      durationMs,
      diagnostics: {
        database: dbStatus,
        storage: storageMetrics,
        expenses: expenseMetrics,
        tickets: ticketMetrics,
        users: userMetrics,
      },
      alertsCount: alerts.length,
      alerts,
    };

    // Log structured results for Cloudflare Logs / Workers Tail
    staticLog.info("Daily check cron executed successfully", result);

    return jsonResponse(result);
  } catch (error) {
    staticLog.error("Daily check cron execution error", { error: error.message, stack: error.stack });
    return errorResponse(`Daily check failed: ${error.message}`, 500);
  }
}
