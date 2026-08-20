/**
 * ============================================================
 * Cyrix Field Connect — Cloudflare Worker Backend
 * Single-Server Architecture — Cloudflare Only
 * ============================================================
 * Enterprise-grade zero-dependency modular backend.
 *
 * Architecture:
 *   Request → Rate Limiter → CORS/Security Headers
 *           → Route Match → JWT Auth → Handler
 *           → Response (with security headers injected)
 *
 * v2.1.0 — Single-Server Cloudflare Edition
 * ============================================================
 */

import { verifyJwt } from "./utils/security.js";
import { runRead } from "./utils/db.js";
import { runMigrations } from "./utils/db-migrate.js";
import { runMigrationsV3, checkV3TableStatus } from "./utils/db-migrate-v3.js";
import {
  jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse,
  notFoundResponse, preflightResponse, corsHeaders, securityHeaders,
  getAllowedOrigin
} from "./utils/http.js";
import { globalIPRateLimit, loginRateLimit, getClientIP } from "./utils/rateLimit.js";
import { Logger, generateRequestId } from "./utils/logger.js";

// ─── Route Handler Imports ────────────────────────────────────────────────────

// Auth handlers
import {
  handleLogin, handleRefresh, handleBootstrap,
  handleLogout, handleGetDropdowns, handleForgotPassword,
  handleVerifyOtp, handleResetPassword,
  handleUnlockAccount, handleUnlockVerifyOtp
} from "./routes/auth.js";

// User profile handlers
import {
  handleGetProfile, handleUpdateProfile, handleChangePassword,
  handleUploadProfilePhoto, handleDeleteProfilePhoto
} from "./routes/users.js";

// Approval handlers
import {
  handleGetApprovals, handleApprove, handleReject,
  handleReturnToDraft, handleAutoApprovalExpiry, handleBulkApprove,
  handleGetRouteBenchmark
} from "./routes/approval.js";

// Admin handlers
import {
  handleListUsers, handleSaveUser, handleDeleteUser,
  handleListHierarchies, handleSaveHierarchy,
  handleUpdateUser, handleBulkCreateUsers, handleGetEligibleApprovers,
  handleDeleteHierarchy, handleLogoutAllUsers, handleLogoutSingleUser,
  handleExportHierarchies, handleBulkImportHierarchies, handleRepairStuckApprovals,
  handleGetSystemSettings, handleSaveSystemSettings,
  handleSearchRejectedExpenses, handleResubmitRejectedExpense,
  handleGetExpenseHierarchyLevels, handleResetExpenseApprovalLevel,
  handleOneTimeAdjust, handleGetAllowanceRates, handleSaveAllowanceRates,
  handleTestTime, handleRevertClaimDeductions, handleBulkToggleBulkApproval,
  handleGetFacilities, handleSaveFacility, handleDeleteFacility
} from "./routes/admin.js";

// Ticket handlers
import {
  handleGetTickets, handleCreateTicket, handleAddComment,
  handleCloseTicket, handleReopenTicket, handleToggleFollowup,
  handleGetTicketStats, handleAssignTicket, handleUpdateTicketStatus
} from "./routes/ticket.js";

// Upload handlers
import {
  handleUploadImage, handleUploadDocument, handleServeFile, handleGDriveProxy
} from "./routes/upload.js";

// Reports handlers
import {
  handleGetMisDashboard, handleGetAssetsInventory, handleGetAssetsFilters,
  handleGetAssetsStats, handleUploadAssetsCSV, handleUploadAssetsChunk,
  handleGetAssetsCsvTemplate, handleGetDistrictFacilitiesSummary, handleManualAddAsset
} from "./routes/reports.js";

// Expense handlers
import {
  handleListExpenses, handleExpenseInit, handleCreateLimitRequest,
  handleSubmitExpense, handleGetTeamExpenses, handleVerifyBarcode,
  handleGetAssetValueMaster, handleGetEngineerAdvance, handleSaveEngineerAdvance,
  handleGetExpenseDetails, handleDeleteExpense, handleGetMonthSummary,
  handleGetEngineerMonthClaims, handleGetConsolidatedReport,
  handleServeExpenseAttachment, handleGetTeamUsers, handleGetKpiAppraisal,
  handleSaveKpiAppraisal, handleGetPolicyRules, handleRetroactiveBasePolicyCheck,
  handleBulkRetroactivePolicyCheck, handleReverseExpense, handleEvaluatePolicy,
  handleSaveFieldAsset, handleGetFieldAssetByBarcode, handleGetOpenCalls,
  handleGetExpenseAuditTrail, handleLogClientGlitch, handleGetKvDiagnosticLogs
} from "./routes/expense.js";

// Penalty handlers
import { handleVerifyBarcode as handleVerifyPenaltyBarcode, handleSavePenalty, handleGetPenaltyList } from "./routes/penalty.js";

// Complaint Management handlers (Standalone Ingestion System)
import {
  handleCheckPermission as handleCheckComplaintPermission,
  handleListPermissions as handleListComplaintPermissions,
  handleTogglePermission as handleToggleComplaintPermission,
  handleUploadChunk as handleUploadComplaintChunk,
  handleInitLargeUpload as handleInitLargeComplaintUpload,
  handleDirectFileUpload as handleDirectComplaintFileUpload,
  handleEnqueueJob as handleEnqueueComplaintJob,
  handleGetJobStatus as handleGetComplaintJobStatus
} from "./routes/complaints.js";

// Live Contract Penalty Engine handlers
import {
  handleLivePenaltySummary,
  handleLivePenaltyRecords,
  handleLivePenaltyRepeaters
} from "./routes/penaltyLive.js";

// Attendance handlers
import {
  handleGetAttendance, handleGetAttendanceSummary, handleGetAttendanceDiscrepancies
} from "./routes/attendance.js";

// ─── Enterprise Route Handlers (Direct Imports) ───────────────────────────────
import {
  handleMigrateGdrive, handleMigrationStatus,
  handleAnalyticsDashboard, handleAnalyticsBilling,
  handleFileHealth, handleStorageReport, handleRunMigrationsV2,
} from "./routes/adminEnterprise.js";

import { handleEmailAction } from "./routes/emailAction.js";

import {
  handleDeleteFile, handleListFiles,
} from "./routes/upload.js";

import {
  handleGetWhatsappStatus,
  handleSaveWhatsappConfig,
  handleGenerateWhatsappPairingCode,
  handleTestWhatsappDispatch
} from "./routes/whatsapp.js";

// KPI Module handlers
import {
  handleGetKpiAssignment, handleSaveKpiAssignment, handleSubmitKpiAssignment,
  handleApproveKpiAssignment, handleRejectKpiAssignment, handleSetKpiStartsFrom,
  handleGetKpiSubmission, handleSaveKpiSubmission, handleSubmitKpiSubmission,
  handleScoreKpiSubmission, handleFinalizeKpiSubmission, handleReturnKpiSubmission,
  handleGetKpiHistory,
  handleGetKpiYearAnalytics, handleGetKpiAttainment,
  handleGetKpiTeam, handleGetKpiTeamMembers, handleGetTeamMemberSummary,
  handleGetPendingApprovals,
  handleGetKpiDeletions, handleRaiseKpiDeletion, handleApproveDeletion, handleRejectDeletion,
  handleGetKpiQueries, handleRaiseKpiQuery, handleRespondToQuery,
  handleGetKpiNotifications
} from "./routes/kpi.js";

// KPI DB Migration
import { runMigrationsKpi, checkKpiTableStatus } from "./utils/db-migrate-kpi.js";

// ─── Router — O(1) Method-Grouped Hash Map Router ────────────────────────────
class Router {
  constructor() {
    this.routes = { GET: [], POST: [], PUT: [], DELETE: [] };
  }

  _add(method, path, handler, requiresAuth, requiredRoles = null) {
    const isWildcard = path.endsWith("/*");
    const wildcardPrefix = isWildcard ? path.slice(0, -2) : null;
    const parts = isWildcard ? [] : path.split("/");
    this.routes[method].push({
      path, handler, requiresAuth, isWildcard, wildcardPrefix, parts, requiredRoles
    });
  }

  get(path, handler, requiresAuth = false, roles = null) { this._add("GET", path, handler, requiresAuth, roles); }
  post(path, handler, requiresAuth = false, roles = null) { this._add("POST", path, handler, requiresAuth, roles); }
  put(path, handler, requiresAuth = false, roles = null) { this._add("PUT", path, handler, requiresAuth, roles); }
  delete(path, handler, requiresAuth = false, roles = null) { this._add("DELETE", path, handler, requiresAuth, roles); }

  match(method, pathname) {
    const methodRoutes = this.routes[method] || [];
    const pathParts = pathname.split("/");

    for (const route of methodRoutes) {
      if (route.isWildcard) {
        if (pathname.startsWith(route.wildcardPrefix)) {
          const wildcardVal = pathname.substring(route.wildcardPrefix.length);
          return {
            handler: route.handler,
            requiresAuth: route.requiresAuth,
            requiredRoles: route.requiredRoles,
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
      if (matched) return { handler: route.handler, requiresAuth: route.requiresAuth, requiredRoles: route.requiredRoles, params };
    }
    return null;
  }
}

const router = new Router();

// ─── Health Check ─────────────────────────────────────────────────────────────
router.get("/", async (req, env) => {
  return jsonResponse({
    status: "ok",
    message: "Cyrix Field Connect — Worker Backend v2.0.0",
    server: "cloudflare-worker-enterprise",
    timestamp: new Date().toISOString(),
  });
});

router.get("/api/health", async (req, env) => {
  const result = await env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first();
  return jsonResponse({
    status: "ok",
    server: "cloudflare-worker-enterprise",
    version: "2.0.0",
    database: "connected",
    users_count: result?.cnt || 0,
    timestamp: new Date().toISOString(),
  });
});

// ─── Auth Endpoints ───────────────────────────────────────────────────────────
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

// ─── User Profile Endpoints ───────────────────────────────────────────────────
router.get("/api/users/profile", handleGetProfile, true);
router.put("/api/users/profile", handleUpdateProfile, true);
router.post("/api/users/profile/photo", handleUploadProfilePhoto, true);
router.delete("/api/users/profile/photo", handleDeleteProfilePhoto, true);
router.post("/api/users/change-password", handleChangePassword, true);

// ─── Approval Endpoints — Two path aliases for compatibility ──────────────────
router.get("/api/approval/route-benchmark", handleGetRouteBenchmark, true);
router.get("/api/approval", handleGetApprovals, true);
router.post("/api/approval/bulk-approve", handleBulkApprove, true);
router.post("/api/approval/:expense_id/approve", handleApprove, true);
router.post("/api/approval/:expense_id/reject", handleReject, true);
router.post("/api/approval/:expense_id/return-to-draft", handleReturnToDraft, true);
router.get("/api/approvals", handleGetApprovals, true);
router.post("/api/approvals/bulk-approve", handleBulkApprove, true);
router.post("/api/approvals/:expense_id/approve", handleApprove, true);
router.post("/api/approvals/:expense_id/reject", handleReject, true);
router.post("/api/approvals/:expense_id/return-to-draft", handleReturnToDraft, true);

// ─── Admin Endpoints ──────────────────────────────────────────────────────────
router.get("/api/admin/allowance-rates", handleGetAllowanceRates, true, ["Admin"]);
router.post("/api/admin/allowance-rates", handleSaveAllowanceRates, true, ["Admin"]);
router.get("/api/admin/settings", handleGetSystemSettings, true, ["Admin"]);
router.post("/api/admin/settings", handleSaveSystemSettings, true, ["Admin"]);
router.get("/api/admin/expenses/rejected", handleSearchRejectedExpenses, true);
router.post("/api/admin/expenses/:expense_id/resubmit", handleResubmitRejectedExpense, true, ["Admin"]);
router.get("/api/admin/expenses/:expense_id/hierarchy-levels", handleGetExpenseHierarchyLevels, true, ["Admin"]);
router.post("/api/admin/expenses/:expense_id/reset-level", handleResetExpenseApprovalLevel, true, ["Admin"]);
router.post("/api/admin/one-time-adjust", handleOneTimeAdjust, true, ["Admin"]);
router.get("/api/admin/users", handleListUsers, true, ["Admin"]);
router.post("/api/admin/users/bulk", handleBulkCreateUsers, true, ["Admin"]);
router.post("/api/admin/users", handleSaveUser, true, ["Admin"]);
router.put("/api/admin/users/:user_id", handleUpdateUser, true, ["Admin"]);
router.post("/api/admin/users/bulk-approval-toggle", handleBulkToggleBulkApproval, true, ["Admin"]);
router.delete("/api/admin/users/:user_id", handleDeleteUser, true, ["Admin"]);
router.get("/api/admin/eligible-approvers", handleGetEligibleApprovers, true, ["Admin"]);
router.get("/api/admin/hierarchies/export", handleExportHierarchies, true, ["Admin"]);
router.post("/api/admin/hierarchies/bulk", handleBulkImportHierarchies, true, ["Admin"]);
router.post("/api/admin/approvals/repair-stuck", handleRepairStuckApprovals, true, ["Admin"]);
router.get("/api/admin/hierarchies", handleListHierarchies, true, ["Admin"]);
router.post("/api/admin/hierarchies", handleSaveHierarchy, true, ["Admin"]);
router.delete("/api/admin/hierarchies/:id", handleDeleteHierarchy, true, ["Admin"]);
router.post("/api/admin/logout-all", handleLogoutAllUsers, true, ["Admin"]);
router.post("/api/admin/logout-user/:user_code", handleLogoutSingleUser, true, ["Admin"]);
router.get("/api/admin/facilities", handleGetFacilities, true, ["Admin"]);
router.post("/api/admin/facilities", handleSaveFacility, true, ["Admin"]);
router.delete("/api/admin/facilities/:id", handleDeleteFacility, true, ["Admin"]);

// Penalty Module Routes
router.post("/api/penalty/verify-barcode", handleVerifyPenaltyBarcode, true);
router.post("/api/penalty/save", handleSavePenalty, true);
router.get("/api/penalty/list", handleGetPenaltyList, true);

// Admin migrations
router.post("/api/admin/run-migrations", async (req, env, params, query, user) => {
  if (!user || user.role !== "Admin") return forbiddenResponse("Admin access required");
  try {
    await runMigrations(env._originalDB || env.DB);
    return jsonResponse({ success: true, message: "Migrations v1 completed successfully" });
  } catch (e) {
    return errorResponse("Migration error: " + e.message, 500);
  }
}, true, ["Admin"]);

// Enterprise admin routes (Sprint 2+)
router.post("/api/admin/migrate-gdrive", async (req, env, params, query, user) => {
  if (!handleMigrateGdrive) return errorResponse("Migration engine not yet available", 503);
  return handleMigrateGdrive(req, env, params, query, user);
}, true, ["Admin"]);

router.get("/api/admin/migration-status", async (req, env, params, query, user) => {
  if (!handleMigrationStatus) return errorResponse("Migration engine not yet available", 503);
  return handleMigrationStatus(req, env, params, query, user);
}, true, ["Admin"]);

router.get("/api/admin/analytics/dashboard", async (req, env, params, query, user) => {
  if (!handleAnalyticsDashboard) return errorResponse("Analytics dashboard not yet available", 503);
  return handleAnalyticsDashboard(req, env, params, query, user);
}, true, ["Admin"]);

router.get("/api/admin/analytics/billing", async (req, env, params, query, user) => {
  if (!handleAnalyticsBilling) return errorResponse("Billing analytics not yet available", 503);
  return handleAnalyticsBilling(req, env, params, query, user);
}, true, ["Admin"]);

router.get("/api/admin/files/health", async (req, env, params, query, user) => {
  if (!handleFileHealth) return errorResponse("File management not yet available", 503);
  return handleFileHealth(req, env, params, query, user);
}, true, ["Admin"]);

router.get("/api/admin/files/storage-report", async (req, env, params, query, user) => {
  if (!handleStorageReport) return errorResponse("Storage report not yet available", 503);
  return handleStorageReport(req, env, params, query, user);
}, true, ["Admin"]);

router.post("/api/admin/run-migrations-v2", async (req, env, params, query, user) => {
  if (!handleRunMigrationsV2) return errorResponse("V2 migrations not yet available", 503);
  if (!user || user.role !== "Admin") return forbiddenResponse("Admin access required");
  return handleRunMigrationsV2(req, env, params, query, user);
}, true, ["Admin"]);

router.post("/api/admin/run-migrations-v3", async (req, env, params, query, user) => {
  if (!user || user.role !== "Admin") return forbiddenResponse("Admin access required");
  try {
    const result = await runMigrationsV3(env.DB);
    return jsonResponse({
      success: result.errors.length === 0,
      message: `Migrations v3 complete — ${result.applied.length} applied, ${result.errors.length} errors`,
      applied: result.applied,
      errors: result.errors
    });
  } catch (e) {
    return errorResponse("Migration v3 error: " + e.message, 500);
  }
}, true, ["Admin"]);

router.get("/api/admin/migration-status-v3", async (req, env, params, query, user) => {
  if (!user || user.role !== "Admin") return forbiddenResponse("Admin access required");
  try {
    const status = await checkV3TableStatus(env.DB);
    return jsonResponse({ success: true, v3_status: status });
  } catch (e) {
    return errorResponse("Status check error: " + e.message, 500);
  }
}, true, ["Admin"]);

// ─── File Management (Sprint 6) ───────────────────────────────────────────────
router.post("/api/files/:id/archive", async (req, env, params, query, user) => {
  if (!handleArchiveFile) return errorResponse("File management not yet available", 503);
  return handleArchiveFile(req, env, params, query, user);
}, true);
router.post("/api/files/:id/restore", async (req, env, params, query, user) => {
  if (!handleRestoreFile) return errorResponse("File management not yet available", 503);
  return handleRestoreFile(req, env, params, query, user);
}, true);

// ─── Email One-Click Action (Sprint 4) ───────────────────────────────────────
// Public endpoint — no auth required (uses signed token in query)
router.get("/api/expense/email-action", async (req, env, params, query, user) => {
  if (!handleEmailAction) return errorResponse("Email action not yet available", 503);
  return handleEmailAction(req, env, params, query, user);
}, false);

// ─── WhatsApp Gateway Routes ───────────────────────────────────────────────
router.get("/api/whatsapp/status", async (req, env) => handleGetWhatsappStatus(req, env), true);
router.post("/api/whatsapp/config", async (req, env) => handleSaveWhatsappConfig(req, env), true);
router.post("/api/whatsapp/pairing-code", async (req, env) => handleGenerateWhatsappPairingCode(req, env), true);
router.post("/api/whatsapp/test-alert", async (req, env) => handleTestWhatsappDispatch(req, env), true);

// ─── Test/Dev Endpoints ───────────────────────────────────────────────────────
router.get("/api/test/time", handleTestTime, false);
router.get("/api/admin/test/time", handleTestTime, true);

// ─── Ticket Endpoints — Two path aliases ─────────────────────────────────────
router.get("/api/ticket/stats", handleGetTicketStats, true);
router.get("/api/ticket", handleGetTickets, true);
router.post("/api/ticket", handleCreateTicket, true);
router.post("/api/ticket/:ticket_id/assign", handleAssignTicket, true);
router.post("/api/ticket/:ticket_id/status", handleUpdateTicketStatus, true);
router.post("/api/ticket/:ticket_id/comment", handleAddComment, true);
router.post("/api/ticket/:ticket_id/close", handleCloseTicket, true);
router.post("/api/ticket/:ticket_id/reopen", handleReopenTicket, true);
router.post("/api/ticket/:ticket_id/followup", handleToggleFollowup, true);
router.get("/api/tickets/stats", handleGetTicketStats, true);
router.get("/api/tickets", handleGetTickets, true);
router.post("/api/tickets", handleCreateTicket, true);
router.post("/api/tickets/:ticket_id/assign", handleAssignTicket, true);
router.post("/api/tickets/:ticket_id/status", handleUpdateTicketStatus, true);
router.post("/api/tickets/:ticket_id/comment", handleAddComment, true);
router.post("/api/tickets/:ticket_id/close", handleCloseTicket, true);
router.post("/api/tickets/:ticket_id/reopen", handleReopenTicket, true);
router.post("/api/tickets/:ticket_id/followup", handleToggleFollowup, true);

// ─── Upload Endpoints ─────────────────────────────────────────────────────────
router.get("/api/r2/gdrive-proxy", handleGDriveProxy, false);
router.post("/api/upload/image", handleUploadImage, true);
router.post("/api/upload/document", handleUploadDocument, true);
// R2 file serving (primary path & aliases)
router.get("/api/r2/file/*", handleServeFile, false);
router.get("/api/r2/file/:key", handleServeFile, false);
router.get("/api/files/*", handleServeFile, false);
router.get("/api/files/:key", handleServeFile, false);
router.get("/api/files/list", handleListFiles, true);
router.delete("/api/files/:key", handleDeleteFile, true);
// Legacy paths (kept for backward compat)
router.get("/api/upload/file/images/:filename", handleServeFile, false);
router.get("/api/upload/file/documents/:filename", handleServeFile, false);
router.get("/uploads/expense_attachments/:filename", handleServeExpenseAttachment, false);
router.get("/uploads/*", handleServeFile, false);
router.get("/uploads/:key", handleServeFile, false);
router.get("/expenses/*", handleServeFile, false);
router.get("/expenses/:key", handleServeFile, false);
router.get("/gdrive/*", handleServeFile, false);
router.get("/gdrive/:key", handleServeFile, false);
router.get("/api/upload/file/gdrive/*", handleServeFile, false);
router.get("/api/upload/file/gdrive/:key", handleServeFile, false);
router.get("/profiles/*", handleServeFile, false);
router.get("/profiles/:key", handleServeFile, false);

// ─── Standalone Complaint Management Ingestion Endpoints ───────────────────
router.get("/api/complaints/check-permission", handleCheckComplaintPermission, true);
router.get("/api/complaints/permissions", handleListComplaintPermissions, true);
router.post("/api/complaints/permissions/toggle", handleToggleComplaintPermission, true);
router.post("/api/complaints/upload/chunk", handleUploadComplaintChunk, true);
router.post("/api/complaints/upload/init-large", handleInitLargeComplaintUpload, true);
router.put("/api/complaints/upload/file/:job_id", handleDirectComplaintFileUpload, true);
router.post("/api/complaints/upload/file/:job_id", handleDirectComplaintFileUpload, true);
router.post("/api/complaints/upload/enqueue", handleEnqueueComplaintJob, true);
router.get("/api/complaints/upload-jobs/:job_id", handleGetComplaintJobStatus, true);

// ─── Live Contract Penalty Engine Endpoints ─────────────────────────────────
router.get("/api/complaints/live-penalty/summary", handleLivePenaltySummary, true);
router.get("/api/complaints/live-penalty/records", handleLivePenaltyRecords, true);
router.get("/api/complaints/live-penalty/repeaters", handleLivePenaltyRepeaters, true);

// ─── Reports Endpoints ────────────────────────────────────────────────────────
router.get("/api/reports/mis-dashboard", handleGetMisDashboard, true);
router.get("/api/reports/assets-inventory", handleGetAssetsInventory, true);
router.get("/api/reports/assets-filters", handleGetAssetsFilters, true);
router.get("/api/reports/assets-stats", handleGetAssetsStats, true);
router.get("/api/reports/district-facilities-summary", handleGetDistrictFacilitiesSummary, true);
router.get("/api/reports/assets-csv-template", handleGetAssetsCsvTemplate, true);
router.post("/api/reports/upload-assets-csv", handleUploadAssetsCSV, true);
router.post("/api/reports/upload-assets-chunk", handleUploadAssetsChunk, true);
router.post("/api/reports/assets/manual", handleManualAddAsset, true);

// ─── Attendance Endpoints ─────────────────────────────────────────────────────
router.get("/api/attendance/summary", handleGetAttendanceSummary, true);
router.get("/api/attendance/discrepancies", handleGetAttendanceDiscrepancies, true);
router.get("/api/attendance", handleGetAttendance, true);

// ─── Expense Endpoints ────────────────────────────────────────────────────────
router.get("/api/expense/init", handleExpenseInit, true);
router.post("/api/expense/limit-request", handleCreateLimitRequest, true);
router.get("/api/expense/team", handleGetTeamExpenses, true);
router.get("/api/expense/team-users", handleGetTeamUsers, true);
router.get("/api/expense/kpi-appraisal", handleGetKpiAppraisal, true);
router.post("/api/expense/kpi-appraisal", handleSaveKpiAppraisal, true);
router.get("/api/expense/verify-barcode", handleVerifyBarcode, true);
router.post("/api/expense/assets/tag", handleSaveFieldAsset, true);
router.get("/api/expense/assets/by-barcode", handleGetFieldAssetByBarcode, true);
router.get("/api/expense/calls/open-calls", handleGetOpenCalls, true);
router.get("/api/expense/asset-value-master", handleGetAssetValueMaster, true);
router.get("/api/expense/month-summary", handleGetMonthSummary, true);
router.get("/api/expense/engineer-month-claims", handleGetEngineerMonthClaims, true);
router.get("/api/expense/engineer-advance", handleGetEngineerAdvance, true);
router.post("/api/expense/engineer-advance", handleSaveEngineerAdvance, true);
router.get("/api/expense/consolidated-report", handleGetConsolidatedReport, true);
router.get("/api/expense/policy-rules", handleGetPolicyRules, true);
router.post("/api/expense/evaluate-policy", handleEvaluatePolicy, true);
router.post("/api/expense/retroactive-policy-check", handleRetroactiveBasePolicyCheck, true);
router.post("/api/expense/retroactive-policy-check-bulk", handleBulkRetroactivePolicyCheck, true);
router.get("/api/expense", handleListExpenses, true);
router.post("/api/expense", handleSubmitExpense, true);
router.get("/api/expense/:id", handleGetExpenseDetails, true);
router.get("/api/expense/:id/audit-trail", handleGetExpenseAuditTrail, true);
router.delete("/api/expense/:id", handleDeleteExpense, true);
router.post("/api/expense/:id/reverse", handleReverseExpense, true);
router.post("/api/expense/log-client-glitch", handleLogClientGlitch, true);
router.get("/api/expense/kv-diagnostic-logs", handleGetKvDiagnosticLogs, true);

// ─── KPI Module Endpoints ───────────────────────────────────────────────────────────────────
// KPI Assignments (setup, approval workflow)
router.get("/api/kpi/assignment", handleGetKpiAssignment, true);
router.post("/api/kpi/assignment", handleSaveKpiAssignment, true);
router.post("/api/kpi/assignment/:id/submit", handleSubmitKpiAssignment, true);
router.post("/api/kpi/assignment/:id/approve", handleApproveKpiAssignment, true);
router.post("/api/kpi/assignment/:id/reject", handleRejectKpiAssignment, true);
router.post("/api/kpi/assignment/:id/starts-from", handleSetKpiStartsFrom, true);
// KPI Submissions (monthly self-assessment)
router.get("/api/kpi/submission", handleGetKpiSubmission, true);
router.post("/api/kpi/submission", handleSaveKpiSubmission, true);
router.post("/api/kpi/submission/:id/submit", handleSubmitKpiSubmission, true);
router.post("/api/kpi/submission/:id/score", handleScoreKpiSubmission, true);
router.post("/api/kpi/submission/:id/finalize", handleFinalizeKpiSubmission, true);
router.post("/api/kpi/submission/:id/return", handleReturnKpiSubmission, true);
// KPI History
router.get("/api/kpi/history", handleGetKpiHistory, true);
// KPI Analytics
router.get("/api/kpi/analytics/year", handleGetKpiYearAnalytics, true);
router.get("/api/kpi/analytics/attainment", handleGetKpiAttainment, true);
// KPI Team (manager)
router.get("/api/kpi/team/members", handleGetKpiTeamMembers, true);
router.get("/api/kpi/team/:employeeId/summary", handleGetTeamMemberSummary, true);
router.get("/api/kpi/team", handleGetKpiTeam, true);
// KPI Approvals
router.get("/api/kpi/approvals/pending", handleGetPendingApprovals, true);
// KPI Deletion Requests
router.get("/api/kpi/deletions", handleGetKpiDeletions, true);
router.post("/api/kpi/deletions", handleRaiseKpiDeletion, true);
router.post("/api/kpi/deletions/:id/approve", handleApproveDeletion, true);
router.post("/api/kpi/deletions/:id/reject", handleRejectDeletion, true);
// KPI Score Queries
router.get("/api/kpi/queries", handleGetKpiQueries, true);
router.post("/api/kpi/queries", handleRaiseKpiQuery, true);
router.post("/api/kpi/queries/:id/respond", handleRespondToQuery, true);
// KPI Notifications
router.get("/api/kpi/notifications", handleGetKpiNotifications, true);
// KPI DB Migration
router.post("/api/admin/run-migrations-kpi", async (req, env, params, query, user) => {
  if (!user || user.role !== "Admin") return forbiddenResponse("Admin access required");
  try {
    const result = await runMigrationsKpi(env.DB);
    return jsonResponse({ success: result.errors.length === 0, message: `KPI Migrations complete — ${result.applied.length} applied, ${result.errors.length} errors`, applied: result.applied, errors: result.errors });
  } catch (e) {
    return errorResponse("KPI Migration error: " + e.message, 500);
  }
}, true, ["Admin"]);
router.get("/api/admin/migration-status-kpi", async (req, env, params, query, user) => {
  if (!user || user.role !== "Admin") return forbiddenResponse("Admin access required");
  try {
    const status = await checkKpiTableStatus(env.DB);
    return jsonResponse({ success: true, kpi_status: status });
  } catch (e) {
    return errorResponse("KPI status check error: " + e.message, 500);
  }
}, true, ["Admin"]);

// ─── No DB Proxy Needed — Single D1, direct env.DB ───────────────────────────
// wrapDB removed in v2.1.0 (single-server architecture)

// ─── Main Fetch Handler ───────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // Store ctx for background tasks (waitUntil)
    env.ctx = ctx;

    const url = new URL(request.url);
    let pathname = url.pathname;
    if (pathname.endsWith("/") && pathname !== "/") pathname = pathname.slice(0, -1);
    const { searchParams } = url;
    const method = request.method;
    const origin = request.headers.get("Origin") || null;
    const requestId = request.headers.get("X-Request-ID") || generateRequestId();

    // Initialize request logger
    const log = new Logger(env, requestId);

    // ── OPTIONS Preflight ────────────────────────────────────────────────────
    if (method === "OPTIONS") {
      return preflightResponse(origin);
    }

    // ── Global IP Rate Limit (check before ANYTHING else) ────────────────────
    // Skip rate limiting for static file serving
    const isFileServing = pathname.startsWith("/api/upload/file/") || pathname.startsWith("/uploads/");
    if (!isFileServing && env.OTPS_KV) {
      const rateLimitResponse = await globalIPRateLimit(request, env, origin);
      if (rateLimitResponse) {
        log.security("Global IP rate limit exceeded", { ip: getClientIP(request), path: pathname });
        return injectResponseHeaders(rateLimitResponse, requestId, origin);
      }
    }

    // ── Special: Login endpoint rate limiting (login only, NOT forgot-password) ─
    if (pathname === "/api/auth/login" && method === "POST") {
      const loginLimit = await loginRateLimit(request, env, origin);
      if (loginLimit) {
        log.security("Login rate limit exceeded", { ip: getClientIP(request) });
        return injectResponseHeaders(loginLimit, requestId, origin);
      }
    }

    // ── Route Matching ───────────────────────────────────────────────────────
    const route = router.match(method, pathname);
    if (!route) {
      return injectResponseHeaders(
        notFoundResponse(`Endpoint not found: ${method} ${pathname}`, origin),
        requestId, origin
      );
    }

    // ── Authentication ───────────────────────────────────────────────────────
    let user = null;
    if (route.requiresAuth) {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return injectResponseHeaders(
          unauthorizedResponse("Missing or invalid authorization header", origin),
          requestId, origin
        );
      }

      const token = authHeader.split(" ")[1];
      const payload = await verifyJwt(token, env.API_SECRET, env);
      if (!payload || payload.type !== "access") {
        return injectResponseHeaders(
          unauthorizedResponse("Session expired or invalid token", origin),
          requestId, origin
        );
      }

      // Fetch user with effective role (admin-assigned role overrides users.role)
      user = await env.DB.prepare(`
        SELECT u.*, COALESCE(r.role, u.role) as role, u.allowed_windows
        FROM users u
        LEFT JOIN user_roles r ON u.user_id = r.user_id
        WHERE u.user_id = ?
      `).bind(payload.sub).first();

      if (!user) {
        return injectResponseHeaders(
          unauthorizedResponse("Invalid session — user not found", origin),
          requestId, origin
        );
      }

      if (user.user_status !== "active") {
        if (user.active_session_id) {
          await env.DB.prepare("UPDATE users SET active_session_id = NULL WHERE user_id = ?").bind(user.user_id).run().catch(() => {});
        }
        return injectResponseHeaders(
          unauthorizedResponse(`Account is ${user.user_status}. Session terminated. Please contact administrator.`, origin),
          requestId, origin
        );
      }

      // Role-based access control (if route specifies required roles)
      if (route.requiredRoles && route.requiredRoles.length > 0) {
        const userRole = (user.role || "").trim();
        if (!route.requiredRoles.includes(userRole)) {
          log.security("RBAC access denied", { userId: user.user_id, role: userRole, required: route.requiredRoles, path: pathname });
          return injectResponseHeaders(
            forbiddenResponse("Insufficient permissions for this action", origin),
            requestId, origin
          );
        }
      }

      // Set logger context after auth
      log.setContext({ userId: user.user_id, role: user.role, name: user.name });
    }

    // ── Pre-read body for rejection hook (before handler consumes it) ────────
    let preReadBody = null;
    const isRejectRoute = method === "POST" &&
      (/\/api\/approvals?\/(-?\d+)\/reject$/.test(pathname));
    if (isRejectRoute) {
      try {
        const cloned = request.clone();
        preReadBody = await cloned.json();
      } catch (_) {}
    }

    // ── Route Handler Execution ──────────────────────────────────────────────
    try {
      const startMs = Date.now();
      const response = await route.handler(request, env, route.params, searchParams, user);
      const durationMs = Date.now() - startMs;

      log.apiComplete(method, pathname, response.status, { durationMs });

      // Warn on slow requests (>2000ms)
      if (durationMs > 2000) {
        log.warn("Slow request detected", { method, path: pathname, durationMs });
      }

      // ── Post-rejection email hook ────────────────────────────────────────
      if (isRejectRoute && response.status === 200 && user && env.ctx) {
        env.ctx.waitUntil((async () => {
          try {
            const { sendExpenseStatusEmail } = await import("./email/sender.js");
            const expenseId = parseInt(
              (pathname.match(/\/api\/approvals?\/(-?\d+)\/reject$/) || [])[1], 10
            );
            if (!expenseId || expenseId <= 0) return;

            const comments = preReadBody?.comments || "";

            // Fetch expense + employee in parallel
            const [expense, approvalRow] = await Promise.all([
              env.DB.prepare("SELECT * FROM expenses WHERE id = ? LIMIT 1").bind(expenseId).first(),
              env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? ORDER BY id DESC LIMIT 1").bind(expenseId).first(),
            ]);
            if (!expense) return;

            const employee = await env.DB.prepare(
              "SELECT * FROM users WHERE id = ? LIMIT 1"
            ).bind(expense.user_id).first();
            if (!employee || !employee.mail_id) return;

            // Build period string: "August 2026"
            const monthNames = ["January","February","March","April","May","June",
              "July","August","September","October","November","December"];
            const monthNum = parseInt(expense.month, 10);
            const monthLabel = (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)
              ? monthNames[monthNum - 1]
              : (expense.month || "");
            const period = expense.year
              ? `${monthLabel} ${expense.year}`
              : monthLabel;

            // Total amount: amount + da_amount + hotel_amount + other_expense_amount
            const totalAmt =
              (expense.amount || 0) +
              (expense.da_amount || 0) +
              (expense.hotel_amount || 0) +
              (expense.other_expense_amount || 0) +
              (expense.local_purchase_amount || 0);

            // Format: dd-mmm-yy HH:mm:ss (e.g. 06-Aug-26 00:20:02)
            const _now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            const _dd  = String(_now.getDate()).padStart(2, "0");
            const _mmm = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][_now.getMonth()];
            const _yy  = String(_now.getFullYear()).slice(-2);
            const _hh  = String(_now.getHours()).padStart(2, "0");
            const _min = String(_now.getMinutes()).padStart(2, "0");
            const _ss  = String(_now.getSeconds()).padStart(2, "0");
            const rejectedAt = `${_dd}-${_mmm}-${_yy} ${_hh}:${_min}:${_ss}`;

            // Format expense date: dd-mmm-yyyy from created_at
            let expenseDate = period;
            if (expense.created_at) {
              try {
                const ed = new Date(expense.created_at);
                const edDay = String(ed.getDate()).padStart(2, "0");
                const edMon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][ed.getMonth()];
                expenseDate = `${edDay}-${edMon}-${ed.getFullYear()}`;
              } catch (_) {}
            }

            await sendExpenseStatusEmail(env, {
              to: employee.mail_id,
              name: employee.name,
              userId: employee.user_id,
              action: "rejected",
              expenseCode: expense.expense_code || `EXP-${expenseId}`,
              expenseNumericId: expenseId,
              travelName: expense.description || "",
              expenseMonth: expenseDate,
              claimedAmount: totalAmt,
              approverName: user.name,
              approvedBy: user.name,
              rejectionReason: comments,
              rejectedAt,
            });
          } catch (emailErr) {
            staticLog.error("Post-reject email failed", { error: emailErr.message });
          }
        })());
      }
      // ── End rejection email hook ─────────────────────────────────────────

      return injectResponseHeaders(response, requestId, origin);
    } catch (error) {
      log.error("Unhandled route error", {
        method, path: pathname,
        error: error.message, stack: error.stack
      });
      return injectResponseHeaders(
        errorResponse("Internal server error", 500, error.message, origin, requestId),
        requestId, origin
      );
    }
  },

  // ─── Scheduled Handler (Cron Jobs) ──────────────────────────────────────────
  async scheduled(event, env, ctx) {
    const { staticLog } = await import("./utils/logger.js");
    staticLog.info("Scheduled cron triggered", { cron: event.cron, scheduledTime: event.scheduledTime });

    // Auto-approval expiry (existing — always runs)
    ctx.waitUntil(handleAutoApprovalExpiry(env).catch(e =>
      staticLog.error("Auto-approval expiry failed", { error: e.message })
    ));

    // Manager daily digest (10:00 AM IST = 04:30 UTC)
    if (event.cron === "30 4 * * *") {
      const { sendManagerDigests } = await import("./email/sender.js").catch(() => ({ sendManagerDigests: null }));
      if (sendManagerDigests) {
        ctx.waitUntil(sendManagerDigests(env).catch(e =>
          staticLog.error("Manager digest failed", { error: e.message })
        ));
      }
    }

    // Daily report generation (11:30 PM IST = 18:00 UTC)
    if (event.cron === "0 18 * * *") {
      const { generateDailyReport } = await import("./queues/reportGenerator.js").catch(() => ({ generateDailyReport: null }));
      if (generateDailyReport) {
        ctx.waitUntil(generateDailyReport(env).catch(e =>
          staticLog.error("Daily report failed", { error: e.message })
        ));
      }
    }
  },

  // ─── Queue Handler (Cloudflare Queues) ──────────────────────────────────────
  async queue(batch, env) {
    const { staticLog } = await import("./utils/logger.js");
    const queueName = batch.queue;

    staticLog.info("Queue batch received", { queue: queueName, messageCount: batch.messages.length });

    try {
      if (queueName.includes("upload")) {
        const { processUploadBatch } = await import("./queues/uploadProcessor.js").catch(() => ({ processUploadBatch: null }));
        if (processUploadBatch) await processUploadBatch(batch, env);
        else batch.ackAll();
      } else if (queueName.includes("email")) {
        // Import directly from email/sender.js — no separate emailProcessor file needed
        const { processEmailBatch } = await import("./email/sender.js").catch(() => ({ processEmailBatch: null }));
        if (processEmailBatch) await processEmailBatch(batch, env);
        else batch.ackAll();
      } else if (queueName.includes("analytics")) {
        const { processAnalyticsBatch } = await import("./queues/analyticsProcessor.js").catch(() => ({ processAnalyticsBatch: null }));
        if (processAnalyticsBatch) await processAnalyticsBatch(batch, env);
        else batch.ackAll();
      } else {
        batch.ackAll();
      }
    } catch (e) {
      staticLog.error("Queue processing failed", { queue: queueName, error: e.message });
      batch.retryAll();
    }
  },
};

// ─── Response Header Injection ────────────────────────────────────────────────
/**
 * Inject security + request ID headers into an existing Response.
 * Called on every final response — ensures headers are always present.
 */
function injectResponseHeaders(response, requestId, origin) {
  const newHeaders = new Headers(response.headers);

  // Always inject security headers
  const secHeaders = securityHeaders();
  for (const [key, value] of Object.entries(secHeaders)) {
    newHeaders.set(key, value);
  }

  // Inject CORS headers (origin-aware)
  const cors = corsHeaders(origin);
  for (const [key, value] of Object.entries(cors)) {
    newHeaders.set(key, value);
  }

  // Request correlation ID
  newHeaders.set("X-Request-ID", requestId);
  newHeaders.set("X-Worker-Version", "2.1.0");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
