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
import { handleGetApprovals, handleApprove, handleReject, handleReturnToDraft, handleAutoApprovalExpiry, handleBulkApprove } from "./routes/approval.js";

// Import Admin handlers
import {
  handleListUsers, handleSaveUser, handleDeleteUser,
  handleListHierarchies, handleSaveHierarchy,
  handleUpdateUser, handleBulkCreateUsers, handleGetEligibleApprovers,
  handleDeleteHierarchy, handleLogoutAllUsers, handleLogoutSingleUser,
  handleExportHierarchies, handleBulkImportHierarchies, handleRepairStuckApprovals,
  handleGetSystemSettings, handleSaveSystemSettings,
  handleSearchRejectedExpenses, handleResubmitRejectedExpense,
  handleOneTimeAdjust, handleGetAllowanceRates, handleSaveAllowanceRates
} from "./routes/admin.js";



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
  handleServeExpenseAttachment, handleGetTeamUsers, handleGetKpiAppraisal, handleSaveKpiAppraisal,
  handleGetPolicyRules, handleRetroactiveBasePolicyCheck, handleBulkRetroactivePolicyCheck, handleReverseExpense
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

// Custom Zero-Dependency Router — HashMap-based for O(1) method filtering
class Router {
  constructor() {
    // Separate route arrays per HTTP method — avoids scanning unrelated methods
    this.routes = { GET: [], POST: [], PUT: [], DELETE: [] };
  }

  _add(method, path, handler, requiresAuth) {
    const isWildcard = path.endsWith("/*");
    const wildcardPrefix = isWildcard ? path.slice(0, -2) : null;
    const parts = isWildcard ? [] : path.split("/");
    this.routes[method].push({ path, handler, requiresAuth, isWildcard, wildcardPrefix, parts });
  }
  get(path, handler, requiresAuth = false) { this._add("GET", path, handler, requiresAuth); }
  post(path, handler, requiresAuth = false) { this._add("POST", path, handler, requiresAuth); }
  put(path, handler, requiresAuth = false) { this._add("PUT", path, handler, requiresAuth); }
  delete(path, handler, requiresAuth = false) { this._add("DELETE", path, handler, requiresAuth); }

  match(method, pathname) {
    const methodRoutes = this.routes[method] || [];
    const pathParts = pathname.split("/");

    for (const route of methodRoutes) {
      // Handle wildcard route like /api/upload/file/*
      if (route.isWildcard) {
        if (pathname.startsWith(route.wildcardPrefix)) {
          const wildcardVal = pathname.substring(route.wildcardPrefix.length);
          return {
            handler: route.handler,
            requiresAuth: route.requiresAuth,
            params: { "*": wildcardVal, filename: wildcardVal }
          };
        }
        continue;
      }

      if (route.parts.length !== pathParts.length) continue;

      const params = {};
      let matched = true;

      for (let i = 0; i < route.parts.length; i++) {
        if (route.parts[i].startsWith(":")) {
          params[route.parts[i].slice(1)] = pathParts[i];
        } else if (route.parts[i] !== pathParts[i]) {
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
router.post("/api/approval/bulk-approve", handleBulkApprove, true);
router.post("/api/approval/:expense_id/approve", handleApprove, true);
router.post("/api/approval/:expense_id/reject", handleReject, true);
router.post("/api/approval/:expense_id/return-to-draft", handleReturnToDraft, true);
// Also handle /api/approvals (worker-style)
router.get("/api/approvals", handleGetApprovals, true);
router.post("/api/approvals/bulk-approve", handleBulkApprove, true);
router.post("/api/approvals/:expense_id/approve", handleApprove, true);
router.post("/api/approvals/:expense_id/reject", handleReject, true);
router.post("/api/approvals/:expense_id/return-to-draft", handleReturnToDraft, true);

// ─── Admin Endpoints (Requires Auth) ──────────────────────────────────────────
// NOTE: Specific routes BEFORE wildcard :user_id routes to avoid conflicts
router.get("/api/admin/allowance-rates", handleGetAllowanceRates, true);
router.post("/api/admin/allowance-rates", handleSaveAllowanceRates, true);
router.get("/api/admin/settings", handleGetSystemSettings, true);
router.post("/api/admin/settings", handleSaveSystemSettings, true);
router.get("/api/admin/expenses/rejected", handleSearchRejectedExpenses, true);
router.post("/api/admin/expenses/:expense_id/resubmit", handleResubmitRejectedExpense, true);
router.post("/api/admin/one-time-adjust", handleOneTimeAdjust, true);
router.get("/api/admin/users", handleListUsers, true);
router.post("/api/admin/users/bulk", handleBulkCreateUsers, true);   // MUST be before /api/admin/users/:user_id
router.post("/api/admin/users", handleSaveUser, true);
router.put("/api/admin/users/:user_id", handleUpdateUser, true);
router.delete("/api/admin/users/:user_id", handleDeleteUser, true);
router.get("/api/admin/eligible-approvers", handleGetEligibleApprovers, true);
// Hierarchies — specific routes first
router.get("/api/admin/hierarchies/export", handleExportHierarchies, true);   // BEFORE /:id
router.post("/api/admin/hierarchies/bulk", handleBulkImportHierarchies, true);
router.post("/api/admin/approvals/repair-stuck", handleRepairStuckApprovals, true);
router.get("/api/admin/hierarchies", handleListHierarchies, true);
router.post("/api/admin/hierarchies", handleSaveHierarchy, true);
router.delete("/api/admin/hierarchies/:id", handleDeleteHierarchy, true);
// Session management
router.post("/api/admin/logout-all", handleLogoutAllUsers, true);
router.post("/api/admin/logout-user/:user_code", handleLogoutSingleUser, true);

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
router.get("/api/expense/team-users", handleGetTeamUsers, true);
router.get("/api/expense/kpi-appraisal", handleGetKpiAppraisal, true);
router.post("/api/expense/kpi-appraisal", handleSaveKpiAppraisal, true);
router.get("/api/expense/verify-barcode", handleVerifyBarcode, true);
router.get("/api/expense/asset-value-master", handleGetAssetValueMaster, true);
router.get("/api/expense/month-summary", handleGetMonthSummary, true);
router.get("/api/expense/engineer-month-claims", handleGetEngineerMonthClaims, true);
router.get("/api/expense/engineer-advance", handleGetEngineerAdvance, true);
router.post("/api/expense/engineer-advance", handleSaveEngineerAdvance, true);
router.get("/api/expense/consolidated-report", handleGetConsolidatedReport, true);
router.get("/api/expense/policy-rules", handleGetPolicyRules, true);
router.post("/api/expense/retroactive-policy-check", handleRetroactiveBasePolicyCheck, true);
router.post("/api/expense/retroactive-policy-check-bulk", handleBulkRetroactivePolicyCheck, true);
router.get("/api/expense", handleListExpenses, true);
router.post("/api/expense", handleSubmitExpense, true);
router.get("/api/expense/:id", handleGetExpenseDetails, true);
router.delete("/api/expense/:id", handleDeleteExpense, true);
router.post("/api/expense/:id/reverse", handleReverseExpense, true);



// Dedicated migration endpoint — call once after deployment, not on every request
router.post("/api/admin/run-migrations", async (req, env, params, query, user) => {
  if (!user || user.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }
  try {
    await runMigrations(env._originalDB || env.DB);
    return jsonResponse({ success: true, message: "Migrations completed successfully" });
  } catch (e) {
    return jsonResponse({ error: "Migration error: " + e.message }, 500);
  }
}, true);


// --- Main Entry point ---
export default {
  async fetch(request, env, ctx) {
    // Store ctx on env for background tasks access (e.g. replication)
    env.ctx = ctx;

    // Intercept D1 database connection for read control routing
    if (env.DB && !env._originalDB) {
      env._originalDB = env.DB;
      const originalDB = env.DB;
      
      env.DB = {
        prepare(sql) {
          const stmt = originalDB.prepare(sql);
          const sqlTrimLower = sql.trim().toLowerCase();
          const isSelect = sqlTrimLower.startsWith("select") || sqlTrimLower.startsWith("with");
          
          function wrapStmt(nativeStmt, params) {
            return new Proxy(nativeStmt, {
              get(target, prop, receiver) {
                if (prop === "all") {
                  return async function() {
                    if (isSelect) {
                      return await runRead(env, sql, params, request);
                    }
                    return await target.all();
                  };
                }
                
                if (prop === "first") {
                  return async function(column) {
                    if (isSelect) {
                      const res = await runRead(env, sql, params, request);
                      const row = res.results && res.results[0];
                      if (!row) return null;
                      if (column) return row[column];
                      return row;
                    }
                    return await target.first(column);
                  };
                }
                
                if (prop === "run") {
                  return async function() {
                    return await target.run();
                  };
                }
                
                if (prop === "bind") {
                  return function(...newParams) {
                    const newNativeStmt = target.bind(...newParams);
                    return wrapStmt(newNativeStmt, newParams);
                  };
                }
                
                const val = target[prop];
                if (typeof val === "function") {
                  return val.bind(target);
                }
                return val;
              }
            });
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

      // Fetch user + their admin-assigned role from user_roles (overrides users.role column)
      user = await env.DB.prepare(`
        SELECT u.*, COALESCE(r.role, u.role) as role, u.allowed_windows
        FROM users u
        LEFT JOIN user_roles r ON u.user_id = r.user_id
        WHERE u.user_id = ?
      `).bind(payload.sub).first();
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
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleAutoApprovalExpiry(env));
  }
};
