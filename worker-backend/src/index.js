/**
 * FieldOps Secondary API Server — Cloudflare Worker (JavaScript)
 * Zero-dependency Modular High-Performance Backend
 * Complete Implementation — All Endpoints Matching Python Backend
 */
import { verifyJwt } from "./utils/security.js";
import { runRead } from "./utils/db.js";
import { runMigrations } from "./utils/db-migrate.js";

// Import Auth handlers
import {
  handleLogin, handleRefresh, handleBootstrap,
  handleLogout, handleGetDropdowns, handleForgotPassword,
  handleVerifyOtp, handleResetPassword,
  handleUnlockAccount, handleUnlockVerifyOtp
} from "./routes/auth.js";

// Import User handlers
import {
  handleGetProfile, handleUpdateProfile, handleChangePassword,
  handleUploadProfilePhoto, handleDeleteProfilePhoto
} from "./routes/users.js";

// Import Approval handlers
import { handleGetApprovals, handleApprove, handleReject } from "./routes/approval.js";

// Import Admin handlers
import {
  handleListUsers, handleSaveUser, handleDeleteUser,
  handleListHierarchies, handleSaveHierarchy,
  handleUpdateUser, handleBulkCreateUsers, handleGetEligibleApprovers,
  handleDeleteHierarchy, handleLogoutAllUsers, handleLogoutSingleUser,
  handleExportHierarchies, handleBulkImportHierarchies
} from "./routes/admin.js";

// Import Notifications handlers
import {
  handleGetNotifications, handleMarkRead, handleMarkAllRead, handleDeleteNotification
} from "./routes/notification.js";

// Import Tickets handlers
import {
  handleGetTickets, handleCreateTicket, handleAddComment,
  handleCloseTicket, handleReopenTicket, handleToggleFollowup
} from "./routes/ticket.js";

// Import Uploads handlers
import { handleUploadImage, handleUploadDocument, handleServeFile } from "./routes/upload.js";

// Import Reports handlers
import {
  handleGetMisDashboard, handleGetAssetsInventory, handleGetAssetsFilters, handleGetAssetsStats,
  handleUploadAssetsCSV, handleUploadAssetsChunk
} from "./routes/reports.js";

// Import Expense handlers
import {
  handleListExpenses, handleExpenseInit, handleCreateLimitRequest, handleSubmitExpense,
  handleGetTeamExpenses, handleVerifyBarcode, handleGetAssetValueMaster,
  handleGetEngineerAdvance, handleSaveEngineerAdvance, handleGetExpenseDetails, handleDeleteExpense,
  handleGetMonthSummary, handleGetEngineerMonthClaims, handleGetConsolidatedReport,
  handleServeExpenseAttachment
} from "./routes/expense.js";

// CORS Headers Configuration
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

// Custom Zero-Dependency Router
class Router {
  constructor() {
    this.routes = [];
  }

  get(path, handler, requiresAuth = false) { this.routes.push({ method: "GET", path, handler, requiresAuth }); }
  post(path, handler, requiresAuth = false) { this.routes.push({ method: "POST", path, handler, requiresAuth }); }
  put(path, handler, requiresAuth = false) { this.routes.push({ method: "PUT", path, handler, requiresAuth }); }
  delete(path, handler, requiresAuth = false) { this.routes.push({ method: "DELETE", path, handler, requiresAuth }); }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      // Handle wildcard route like /api/upload/file/*
      if (route.path.endsWith("/*")) {
        const prefix = route.path.slice(0, -2);
        if (pathname.startsWith(prefix)) {
          const wildcardVal = pathname.substring(prefix.length);
          return {
            handler: route.handler,
            requiresAuth: route.requiresAuth,
            params: { "*": wildcardVal, filename: wildcardVal }
          };
        }
      }

      const routeParts = route.path.split("/");
      const pathParts = pathname.split("/");

      if (routeParts.length !== pathParts.length) continue;

      const params = {};
      let matched = true;

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(":")) {
          params[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          matched = false;
          break;
        }
      }

      if (matched) return { handler: route.handler, requiresAuth: route.requiresAuth, params };
    }
    return null;
  }
}

const router = new Router();

// --- Root Welcome ---
router.get("/", async (req, env, params, query) => {
  return jsonResponse({
    status: "ok",
    message: "Welcome to FieldOps Secondary API Server (Cloudflare Worker)",
    version: "1.0.0",
    docs: "/api/health"
  });
});

// --- Health Check ---
router.get("/api/health", async (req, env, params, query) => {
  const result = await env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first();
  return jsonResponse({
    status: "ok",
    server: "cloudflare-worker-secondary",
    database: "connected",
    users_count: result?.cnt || 0,
    timestamp: new Date().toISOString(),
  });
});

// ─── Auth Endpoints ────────────────────────────────────────────────────────────
router.post("/api/auth/login", handleLogin);
router.post("/api/auth/refresh", handleRefresh);
router.get("/api/auth/bootstrap", handleBootstrap, true);
router.post("/api/auth/logout", handleLogout, true);
router.get("/api/auth/dropdowns", handleGetDropdowns);
router.post("/api/auth/forgot-password", handleForgotPassword);
router.post("/api/auth/verify-otp", handleVerifyOtp);
router.post("/api/auth/reset-password", handleResetPassword);
router.post("/api/auth/unlock-account", handleUnlockAccount);
router.post("/api/auth/unlock-verify-otp", handleUnlockVerifyOtp);

// ─── User Profile Endpoints (Requires Auth) ────────────────────────────────────
router.get("/api/users/profile", handleGetProfile, true);
router.put("/api/users/profile", handleUpdateProfile, true);
router.post("/api/users/profile/photo", handleUploadProfilePhoto, true);
router.delete("/api/users/profile/photo", handleDeleteProfilePhoto, true);
router.post("/api/users/change-password", handleChangePassword, true);

// ─── Approval Endpoints — Two path aliases for compatibility ───────────────────
// Frontend calls /api/approval/ (Python backend prefix)
router.get("/api/approval", handleGetApprovals, true);
router.post("/api/approval/:expense_id/approve", handleApprove, true);
router.post("/api/approval/:expense_id/reject", handleReject, true);
// Also handle /api/approvals (worker-style)
router.get("/api/approvals", handleGetApprovals, true);
router.post("/api/approvals/:expense_id/approve", handleApprove, true);
router.post("/api/approvals/:expense_id/reject", handleReject, true);

// ─── Admin Endpoints (Requires Auth) ──────────────────────────────────────────
// NOTE: Specific routes BEFORE wildcard :user_id routes to avoid conflicts
router.get("/api/admin/users", handleListUsers, true);
router.post("/api/admin/users/bulk", handleBulkCreateUsers, true);   // MUST be before /api/admin/users/:user_id
router.post("/api/admin/users", handleSaveUser, true);
router.put("/api/admin/users/:user_id", handleUpdateUser, true);
router.delete("/api/admin/users/:user_id", handleDeleteUser, true);
router.get("/api/admin/eligible-approvers", handleGetEligibleApprovers, true);
// Hierarchies — specific routes first
router.get("/api/admin/hierarchies/export", handleExportHierarchies, true);   // BEFORE /:id
router.post("/api/admin/hierarchies/bulk", handleBulkImportHierarchies, true);
router.get("/api/admin/hierarchies", handleListHierarchies, true);
router.post("/api/admin/hierarchies", handleSaveHierarchy, true);
router.delete("/api/admin/hierarchies/:id", handleDeleteHierarchy, true);
// Session management
router.post("/api/admin/logout-all", handleLogoutAllUsers, true);
router.post("/api/admin/logout-user/:user_code", handleLogoutSingleUser, true);

// ─── Notifications Endpoints (Requires Auth) ───────────────────────────────────
// Frontend calls /api/notifications/ — worker handles without trailing slash
router.get("/api/notifications", handleGetNotifications, true);
router.post("/api/notifications/read-all", handleMarkAllRead, true);   // BEFORE /:id
router.post("/api/notifications/:id/read", handleMarkRead, true);
router.delete("/api/notifications/:id", handleDeleteNotification, true);

// ─── Tickets Endpoints — Two path aliases for compatibility ────────────────────
// Frontend calls /api/ticket/ (Python backend prefix)
router.get("/api/ticket", handleGetTickets, true);
router.post("/api/ticket", handleCreateTicket, true);
router.post("/api/ticket/:ticket_id/comment", handleAddComment, true);
router.post("/api/ticket/:ticket_id/close", handleCloseTicket, true);
router.post("/api/ticket/:ticket_id/reopen", handleReopenTicket, true);
router.post("/api/ticket/:ticket_id/followup", handleToggleFollowup, true);
// Also handle /api/tickets (worker-style)
router.get("/api/tickets", handleGetTickets, true);
router.post("/api/tickets", handleCreateTicket, true);
router.post("/api/tickets/:ticket_id/comment", handleAddComment, true);
router.post("/api/tickets/:ticket_id/close", handleCloseTicket, true);
router.post("/api/tickets/:ticket_id/reopen", handleReopenTicket, true);
router.post("/api/tickets/:ticket_id/followup", handleToggleFollowup, true);

// ─── Uploads Endpoints (Requires Auth) ────────────────────────────────────────
router.post("/api/upload/image", handleUploadImage, true);
router.post("/api/upload/document", handleUploadDocument, true);
router.get("/api/upload/file/images/:filename", handleServeFile, false);
router.get("/api/upload/file/documents/:filename", handleServeFile, false);
router.get("/api/upload/file/gdrive/:filename", handleServeFile, false);
router.get("/uploads/expense_attachments/:filename", handleServeExpenseAttachment, false);

// ─── Reports Endpoints (Requires Auth) ────────────────────────────────────────
router.get("/api/reports/mis-dashboard", handleGetMisDashboard, true);
router.get("/api/reports/assets-inventory", handleGetAssetsInventory, true);
router.get("/api/reports/assets-filters", handleGetAssetsFilters, true);
router.get("/api/reports/assets-stats", handleGetAssetsStats, true);
router.post("/api/reports/upload-assets-csv", handleUploadAssetsCSV, true);
router.post("/api/reports/upload-assets-chunk", handleUploadAssetsChunk, true);

// ─── Expense Endpoints (Requires Auth) ────────────────────────────────────────
// NOTE: Specific named routes BEFORE wildcard :id routes to avoid conflicts
router.get("/api/expense/init", handleExpenseInit, true);
router.post("/api/expense/limit-request", handleCreateLimitRequest, true);
router.get("/api/expense/team", handleGetTeamExpenses, true);
router.get("/api/expense/verify-barcode", handleVerifyBarcode, true);
router.get("/api/expense/asset-value-master", handleGetAssetValueMaster, true);
router.get("/api/expense/month-summary", handleGetMonthSummary, true);
router.get("/api/expense/engineer-month-claims", handleGetEngineerMonthClaims, true);
router.get("/api/expense/engineer-advance", handleGetEngineerAdvance, true);
router.post("/api/expense/engineer-advance", handleSaveEngineerAdvance, true);
router.get("/api/expense/consolidated-report", handleGetConsolidatedReport, true);
// Root + wildcard AFTER all specific paths
router.get("/api/expense", handleListExpenses, true);
router.post("/api/expense", handleSubmitExpense, true);
router.get("/api/expense/:id", handleGetExpenseDetails, true);
router.delete("/api/expense/:id", handleDeleteExpense, true);


// --- Main Entry point ---
export default {
  async fetch(request, env, ctx) {
    // Store ctx on env for background tasks access (e.g. replication)
    env.ctx = ctx;

    // Eagerly run migrations BEFORE the DB intercept so tables exist for all handlers
    if (env.DB && !env._migrationsRun) {
      try {
        await runMigrations(env.DB);
        env._migrationsRun = true; // flag so we only run once per worker instance
      } catch (e) {
        console.error("Migration error:", e);
      }
    }

    // Background index creation (non-blocking, safe to run async)
    if (env.DB) {
      ctx.waitUntil((async () => {
        try {
          const dbObj = env._originalDB || env.DB;
          await dbObj.exec(`
            CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
            CREATE INDEX IF NOT EXISTS idx_approvals_expense_id ON approvals(expense_id);
            CREATE INDEX IF NOT EXISTS idx_approvals_approver_id ON approvals(approver_id);
            CREATE INDEX IF NOT EXISTS idx_hierarchy_requesters_user_id ON hierarchy_requesters(user_id);
            CREATE INDEX IF NOT EXISTS idx_hierarchy_approvers_approver_id ON hierarchy_approvers(approver_id);
          `);
        } catch (e) {
          console.error("Self-healing indexes failed:", e);
        }
      })());
    }

    // Intercept D1 database connection for read control routing
    if (env.DB && !env._originalDB) {
      env._originalDB = env.DB;
      const originalDB = env.DB;
      
      env.DB = {
        prepare(sql) {
          const stmt = originalDB.prepare(sql);
          
          function wrapStmt(s, params) {
            const originalAll = s.all;
            const originalFirst = s.first;
            const originalRun = s.run;
            
            s.all = async function() {
              const isSelect = sql.trim().toLowerCase().startsWith("select") || sql.trim().toLowerCase().startsWith("with");
              if (isSelect) {
                return await runRead(env, sql, params, request);
              }
              return await originalAll.call(s);
            };
            
            s.first = async function(column) {
              const isSelect = sql.trim().toLowerCase().startsWith("select") || sql.trim().toLowerCase().startsWith("with");
              if (isSelect) {
                const res = await runRead(env, sql, params, request);
                const row = res.results && res.results[0];
                if (!row) return null;
                if (column) return row[column];
                return row;
              }
              return await originalFirst.call(s, column);
            };
            
            s.run = async function() {
              return await originalRun.call(s);
            };
            
            const originalBind = s.bind;
            s.bind = function(...newParams) {
              const newStmt = originalBind.apply(s, newParams);
              return wrapStmt(newStmt, newParams);
            };
            
            return s;
          }
          
          return wrapStmt(stmt, []);
        },
        batch(statements) {
          return originalDB.batch(statements);
        },
        exec(sql) {
          return originalDB.exec(sql);
        }
      };
    }

    const url = new URL(request.url);
    let pathname = url.pathname;
    if (pathname.endsWith("/") && pathname !== "/") {
      pathname = pathname.slice(0, -1);
    }
    const { searchParams } = url;
    const method = request.method;
    const origin = request.headers.get("Origin") || "*";

    // Handle OPTIONS Preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Match route
    const route = router.match(method, pathname);
    if (!route) {
      return jsonResponse({ error: "Endpoint not found", path: pathname }, 404, origin);
    }

    // Verify auth if route requires it
    let user = null;
    if (route.requiresAuth) {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return jsonResponse({ error: "Missing or invalid authorization header" }, 401, origin);
      }
      const token = authHeader.split(" ")[1];
      const payload = await verifyJwt(token, env.API_SECRET);
      if (!payload || payload.type !== "access") {
        return jsonResponse({ error: "Session expired or invalid token" }, 401, origin);
      }

      user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(payload.sub).first();
      if (!user) {
        return jsonResponse({ error: "Invalid session" }, 401, origin);
      }
      if (user.user_status !== "active") {
        return jsonResponse({ error: "Account status is inactive or locked" }, 403, origin);
      }
    }

    try {
      // Execute route handler
      const response = await route.handler(request, env, route.params, searchParams, user);

      // Centralized CORS injection
      const newResponse = new Response(response.body, response);
      const cors = corsHeaders(origin);
      for (const [key, value] of Object.entries(cors)) {
        newResponse.headers.set(key, value);
      }
      return newResponse;
    } catch (error) {
      console.error(`Route error [${method} ${pathname}]:`, error);
      return jsonResponse({ error: "Internal server error", detail: error.message }, 500, origin);
    }
  },
};
