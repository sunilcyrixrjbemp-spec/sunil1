/**
 * ============================================================
 * KPI Module — Route Handlers
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Handles:
 *   - KPI Assignments (KRA setup, approval workflow)
 *   - Monthly Submissions (self-assessment)
 *   - Manager Scoring (score, finalize, return)
 *   - Team Management (scoring queue, team list)
 *   - Analytics (year averages, KRA attainment, peer benchmark)
 *   - Deletion Requests
 *   - Score Queries
 *   - Notifications
 * ============================================================
 */

import { jsonResponse, errorResponse, forbiddenResponse } from "../utils/http.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowIST() {
  return new Date().toISOString();
}

/**
 * Derive financial year string from a date.
 * FY runs Apr–Mar. "2026" means Apr 2025 – Mar 2026.
 */
function getFY(date = new Date()) {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  return month >= 3 ? String(year + 1) : String(year);
}

/**
 * Get the ordered months for a financial year.
 * FY 2026 → ["Apr-2025","May-2025",...,"Mar-2026"]
 */
function getFYMonths(fy) {
  const endYear = parseInt(fy);
  const startYear = endYear - 1;
  const months = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
  return months.map((m, i) => {
    const y = i < 9 ? startYear : endYear;
    return `${m}-${y}`;
  });
}

/**
 * Get current reporting month (previous month for submission).
 */
function getCurrentReportingMonth() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[now.getMonth()]}-${now.getFullYear()}`;
}

/**
 * Calculate score bands.
 */
function getBand(score) {
  if (score === null || score === undefined) return null;
  if (score >= 90) return "excellent";
  if (score >= 80) return "veryGood";
  if (score >= 60) return "good";
  if (score >= 40) return "satisfactory";
  return "poor";
}

/**
 * Calculate total score from section scores.
 */
function calcTotalScore(jobScore, esmsScore, coreScore, jobWeight, esmsWeight, coreWeight) {
  let total = 0;
  if (jobScore !== null && jobWeight > 0) total += (jobScore / jobWeight) * jobWeight;
  if (esmsWeight > 0 && esmsScore !== null) total += (esmsScore / esmsWeight) * esmsWeight;
  if (coreScore !== null && coreWeight > 0) total += (coreScore / coreWeight) * coreWeight;
  return Math.round(total * 10) / 10;
}

/**
 * Check if user is a manager of the target user.
 */
async function isManagerOf(db, managerId, userId) {
  const row = await db.prepare(
    `SELECT user_id FROM users WHERE user_id = ? AND manager = ?`
  ).bind(userId, managerId).first();
  return !!row;
}

/**
 * Get list of direct reports for a manager.
 */
async function getDirectReports(db, managerId) {
  const { results } = await db.prepare(
    `SELECT user_id, name, role, district FROM users WHERE manager = ? AND user_status = 'active' ORDER BY name`
  ).bind(managerId).all();
  return results || [];
}

// ─── KPI Assignment Handlers ──────────────────────────────────────────────────

/**
 * GET /api/kpi/assignment
 * Get current user's KPI assignment for a financial year.
 * Query: ?fy=2026 (optional, defaults to current FY)
 */
export async function handleGetKpiAssignment(req, env, params, query, user) {
  try {
    const fy = query.get("fy") || getFY();
    const userId = query.get("user_id") || user.user_id;

    // Only managers and admins can view others
    if (userId !== user.user_id && user.role !== "Admin") {
      const isMgr = await isManagerOf(env.DB, user.user_id, userId);
      if (!isMgr) return forbiddenResponse("Not your report");
    }

    const assignment = await env.DB.prepare(
      `SELECT * FROM kpi_assignments WHERE user_id = ? AND financial_year = ?`
    ).bind(userId, fy).first();

    return jsonResponse({ assignment: assignment || null, fy });
  } catch (e) {
    return errorResponse("Failed to load KPI assignment: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/assignment
 * Create or update a KPI assignment (KRA definitions).
 * Body: { financial_year, kras: [...], starts_from? }
 */
export async function handleSaveKpiAssignment(req, env, params, query, user) {
  try {
    const body = await req.json();
    const { financial_year, kras, starts_from } = body;

    if (!financial_year) return errorResponse("financial_year is required", 400);
    if (!kras || !Array.isArray(kras) || kras.length === 0) {
      return errorResponse("At least one KRA is required", 400);
    }

    const fy = financial_year;
    const now = nowIST();

    // Check if assignment exists
    const existing = await env.DB.prepare(
      `SELECT id, status FROM kpi_assignments WHERE user_id = ? AND financial_year = ?`
    ).bind(user.user_id, fy).first();

    if (existing) {
      // Cannot edit an active/approved assignment unless it was rejected
      if (existing.status === "active") {
        return errorResponse("Cannot edit an active KPI assignment. Request deletion first.", 400);
      }
      await env.DB.prepare(
        `UPDATE kpi_assignments SET kras = ?, starts_from = ?, status = 'draft', updated_at = ?, rejection_reason = NULL
         WHERE user_id = ? AND financial_year = ?`
      ).bind(JSON.stringify(kras), starts_from || null, now, user.user_id, fy).run();
      const updated = await env.DB.prepare(
        `SELECT * FROM kpi_assignments WHERE user_id = ? AND financial_year = ?`
      ).bind(user.user_id, fy).first();
      return jsonResponse({ assignment: updated, message: "KPI assignment updated" });
    } else {
      await env.DB.prepare(
        `INSERT INTO kpi_assignments (user_id, financial_year, kras, starts_from, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'draft', ?, ?)`
      ).bind(user.user_id, fy, JSON.stringify(kras), starts_from || null, now, now).run();
      const created = await env.DB.prepare(
        `SELECT * FROM kpi_assignments WHERE user_id = ? AND financial_year = ?`
      ).bind(user.user_id, fy).first();
      return jsonResponse({ assignment: created, message: "KPI assignment created" });
    }
  } catch (e) {
    return errorResponse("Failed to save KPI assignment: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/assignment/:id/submit
 * Employee submits KPI setup for manager approval.
 */
export async function handleSubmitKpiAssignment(req, env, params, query, user) {
  try {
    const { id } = params;
    const assignment = await env.DB.prepare(
      `SELECT * FROM kpi_assignments WHERE id = ? AND user_id = ?`
    ).bind(id, user.user_id).first();

    if (!assignment) return errorResponse("Assignment not found", 404);
    if (assignment.status === "active") return errorResponse("Already active", 400);
    if (assignment.status === "pending_approval") return errorResponse("Already submitted for approval", 400);

    await env.DB.prepare(
      `UPDATE kpi_assignments SET status = 'pending_approval', submitted_at = ?, updated_at = ? WHERE id = ?`
    ).bind(nowIST(), nowIST(), id).run();

    return jsonResponse({ message: "KPI submitted for manager approval" });
  } catch (e) {
    return errorResponse("Failed to submit KPI: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/assignment/:id/approve
 * Manager approves a pending KPI setup.
 */
export async function handleApproveKpiAssignment(req, env, params, query, user) {
  try {
    const { id } = params;
    const assignment = await env.DB.prepare(
      `SELECT ka.*, u.manager FROM kpi_assignments ka
       JOIN users u ON u.user_id = ka.user_id
       WHERE ka.id = ?`
    ).bind(id).first();

    if (!assignment) return errorResponse("Assignment not found", 404);
    if (assignment.status !== "pending_approval") return errorResponse("Not pending approval", 400);

    // Only the assigned manager or Admin can approve
    if (user.role !== "Admin" && assignment.manager !== user.user_id) {
      return forbiddenResponse("Not this employee's manager");
    }

    await env.DB.prepare(
      `UPDATE kpi_assignments SET status = 'active', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`
    ).bind(user.user_id, nowIST(), nowIST(), id).run();

    return jsonResponse({ message: "KPI assignment approved" });
  } catch (e) {
    return errorResponse("Failed to approve KPI: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/assignment/:id/reject
 * Manager rejects a pending KPI setup with a reason.
 * Body: { reason }
 */
export async function handleRejectKpiAssignment(req, env, params, query, user) {
  try {
    const { id } = params;
    const body = await req.json();
    const { reason } = body;

    if (!reason || !reason.trim()) return errorResponse("Rejection reason is required", 400);

    const assignment = await env.DB.prepare(
      `SELECT ka.*, u.manager FROM kpi_assignments ka
       JOIN users u ON u.user_id = ka.user_id
       WHERE ka.id = ?`
    ).bind(id).first();

    if (!assignment) return errorResponse("Assignment not found", 404);
    if (assignment.status !== "pending_approval") return errorResponse("Not pending approval", 400);
    if (user.role !== "Admin" && assignment.manager !== user.user_id) {
      return forbiddenResponse("Not this employee's manager");
    }

    await env.DB.prepare(
      `UPDATE kpi_assignments SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?`
    ).bind(reason.trim(), nowIST(), id).run();

    return jsonResponse({ message: "KPI assignment returned to employee" });
  } catch (e) {
    return errorResponse("Failed to reject KPI: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/assignment/:id/starts-from
 * Set the starts_from month for an assignment.
 * Body: { month }
 */
export async function handleSetKpiStartsFrom(req, env, params, query, user) {
  try {
    const { id } = params;
    const body = await req.json();
    const { month } = body;
    if (!month) return errorResponse("month is required", 400);

    const assignment = await env.DB.prepare(
      `SELECT * FROM kpi_assignments WHERE id = ?`
    ).bind(id).first();
    if (!assignment) return errorResponse("Assignment not found", 404);

    // Manager or admin sets it
    if (user.role !== "Admin") {
      const isMgr = await isManagerOf(env.DB, user.user_id, assignment.user_id);
      if (!isMgr && assignment.user_id !== user.user_id) {
        return forbiddenResponse("Not authorized");
      }
    }

    await env.DB.prepare(
      `UPDATE kpi_assignments SET starts_from = ?, updated_at = ? WHERE id = ?`
    ).bind(month, nowIST(), id).run();

    return jsonResponse({ message: "Starts from month updated" });
  } catch (e) {
    return errorResponse("Failed to update starts_from: " + e.message, 500);
  }
}

// ─── KPI Submission Handlers ─────────────────────────────────────────────────

/**
 * GET /api/kpi/submission
 * Get a submission for a specific user and month.
 * Query: ?user_id=&month=Apr-2026
 */
export async function handleGetKpiSubmission(req, env, params, query, user) {
  try {
    const userId = query.get("user_id") || user.user_id;
    const month = query.get("month") || getCurrentReportingMonth();
    const fy = query.get("fy") || getFY();

    if (userId !== user.user_id && user.role !== "Admin") {
      const isMgr = await isManagerOf(env.DB, user.user_id, userId);
      if (!isMgr) return forbiddenResponse("Not your report");
    }

    const submission = await env.DB.prepare(
      `SELECT s.*, a.kras, a.job_role_weight, a.esms_weight, a.core_values_weight, a.starts_from
       FROM kpi_submissions s
       JOIN kpi_assignments a ON a.id = s.assignment_id
       WHERE s.user_id = ? AND s.period_month = ? AND s.financial_year = ?`
    ).bind(userId, month, fy).first();

    return jsonResponse({ submission: submission || null });
  } catch (e) {
    return errorResponse("Failed to load submission: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/submission
 * Create or update a monthly self-assessment (draft).
 * Body: { user_id, period_month, financial_year, self_data, core_values_ratings, anything_to_add }
 */
export async function handleSaveKpiSubmission(req, env, params, query, user) {
  try {
    const body = await req.json();
    const { period_month, financial_year, self_data, core_values_ratings, anything_to_add } = body;
    const userId = body.user_id || user.user_id;
    const now = nowIST();

    if (!period_month || !financial_year) {
      return errorResponse("period_month and financial_year are required", 400);
    }

    // Get the active assignment
    const assignment = await env.DB.prepare(
      `SELECT * FROM kpi_assignments WHERE user_id = ? AND financial_year = ? AND status = 'active'`
    ).bind(userId, financial_year).first();
    if (!assignment) return errorResponse("No active KPI assignment found for this year", 400);

    // Check existing submission
    const existing = await env.DB.prepare(
      `SELECT id, status FROM kpi_submissions WHERE user_id = ? AND period_month = ? AND financial_year = ?`
    ).bind(userId, period_month, financial_year).first();

    if (existing) {
      if (existing.status === "finalized") {
        return errorResponse("This month is finalized and cannot be edited", 400);
      }
      await env.DB.prepare(
        `UPDATE kpi_submissions
         SET self_data = ?, core_values_ratings = ?, anything_to_add = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        JSON.stringify(self_data || {}),
        JSON.stringify(core_values_ratings || {}),
        anything_to_add || null,
        now, existing.id
      ).run();
      const updated = await env.DB.prepare(`SELECT * FROM kpi_submissions WHERE id = ?`).bind(existing.id).first();
      return jsonResponse({ submission: updated, message: "Submission saved" });
    } else {
      await env.DB.prepare(
        `INSERT INTO kpi_submissions
         (assignment_id, user_id, period_month, financial_year, status, self_data, core_values_ratings, anything_to_add, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
      ).bind(
        assignment.id, userId, period_month, financial_year,
        JSON.stringify(self_data || {}),
        JSON.stringify(core_values_ratings || {}),
        anything_to_add || null, now, now
      ).run();
      const created = await env.DB.prepare(
        `SELECT * FROM kpi_submissions WHERE user_id = ? AND period_month = ? AND financial_year = ?`
      ).bind(userId, period_month, financial_year).first();
      return jsonResponse({ submission: created, message: "Submission created" });
    }
  } catch (e) {
    return errorResponse("Failed to save submission: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/submission/:id/submit
 * Employee submits a monthly submission for manager scoring.
 */
export async function handleSubmitKpiSubmission(req, env, params, query, user) {
  try {
    const { id } = params;
    const submission = await env.DB.prepare(
      `SELECT * FROM kpi_submissions WHERE id = ? AND user_id = ?`
    ).bind(id, user.user_id).first();

    if (!submission) return errorResponse("Submission not found", 404);
    if (submission.status === "submitted") return errorResponse("Already submitted", 400);
    if (submission.status === "finalized") return errorResponse("Already finalized", 400);

    await env.DB.prepare(
      `UPDATE kpi_submissions SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?`
    ).bind(nowIST(), nowIST(), id).run();

    return jsonResponse({ message: "Submitted for manager scoring" });
  } catch (e) {
    return errorResponse("Failed to submit: " + e.message, 500);
  }
}

// ─── Manager Scoring Handlers ─────────────────────────────────────────────────

/**
 * POST /api/kpi/submission/:id/score
 * Manager saves scores for a submission.
 * Body: { manager_scores: {...}, core_values_ratings?: {...} }
 */
export async function handleScoreKpiSubmission(req, env, params, query, user) {
  try {
    const { id } = params;
    const body = await req.json();
    const { manager_scores, core_values_ratings } = body;

    const submission = await env.DB.prepare(
      `SELECT s.*, a.job_role_weight, a.esms_weight, a.core_values_weight, u.manager
       FROM kpi_submissions s
       JOIN kpi_assignments a ON a.id = s.assignment_id
       JOIN users u ON u.user_id = s.user_id
       WHERE s.id = ?`
    ).bind(id).first();

    if (!submission) return errorResponse("Submission not found", 404);
    if (submission.status === "finalized") return errorResponse("Already finalized", 400);
    if (user.role !== "Admin" && submission.manager !== user.user_id) {
      return forbiddenResponse("Not this employee's manager");
    }

    await env.DB.prepare(
      `UPDATE kpi_submissions
       SET manager_scores = ?, core_values_ratings = ?, status = 'scored',
           scored_by = ?, scored_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      JSON.stringify(manager_scores || {}),
      core_values_ratings ? JSON.stringify(core_values_ratings) : submission.core_values_ratings,
      user.user_id, nowIST(), nowIST(), id
    ).run();

    return jsonResponse({ message: "Scores saved" });
  } catch (e) {
    return errorResponse("Failed to score submission: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/submission/:id/finalize
 * Manager finalizes scores — calculates and stores final scores.
 * Body: { final_job_score, final_esms_score?, final_core_score, manager_scores }
 */
export async function handleFinalizeKpiSubmission(req, env, params, query, user) {
  try {
    const { id } = params;
    const body = await req.json();
    const { final_job_score, final_esms_score, final_core_score, manager_scores, core_values_ratings } = body;

    const submission = await env.DB.prepare(
      `SELECT s.*, a.job_role_weight, a.esms_weight, a.core_values_weight, u.manager
       FROM kpi_submissions s
       JOIN kpi_assignments a ON a.id = s.assignment_id
       JOIN users u ON u.user_id = s.user_id
       WHERE s.id = ?`
    ).bind(id).first();

    if (!submission) return errorResponse("Submission not found", 404);
    if (submission.status === "finalized") return errorResponse("Already finalized", 400);
    if (user.role !== "Admin" && submission.manager !== user.user_id) {
      return forbiddenResponse("Not this employee's manager");
    }

    // Calculate total score
    const jw = submission.job_role_weight || 80;
    const ew = submission.esms_weight || 0;
    const cw = submission.core_values_weight || 20;

    let total = 0;
    if (final_job_score !== null && final_job_score !== undefined) total += final_job_score;
    if (ew > 0 && final_esms_score !== null && final_esms_score !== undefined) total += final_esms_score;
    if (final_core_score !== null && final_core_score !== undefined) total += final_core_score;
    const finalTotal = Math.round(total * 10) / 10;

    await env.DB.prepare(
      `UPDATE kpi_submissions
       SET status = 'finalized',
           manager_scores = ?,
           core_values_ratings = ?,
           final_job_score = ?,
           final_esms_score = ?,
           final_core_score = ?,
           final_total_score = ?,
           scored_by = ?,
           scored_at = ?,
           finalized_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(
      JSON.stringify(manager_scores || {}),
      core_values_ratings ? JSON.stringify(core_values_ratings) : submission.core_values_ratings,
      final_job_score || null,
      final_esms_score || null,
      final_core_score || null,
      finalTotal,
      user.user_id, nowIST(), nowIST(), nowIST(), id
    ).run();

    return jsonResponse({ message: "Scores finalized", final_total_score: finalTotal });
  } catch (e) {
    return errorResponse("Failed to finalize: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/submission/:id/return
 * Manager returns a submission to employee with a reason.
 * Body: { reason }
 */
export async function handleReturnKpiSubmission(req, env, params, query, user) {
  try {
    const { id } = params;
    const body = await req.json();
    const { reason } = body;
    if (!reason || !reason.trim()) return errorResponse("Return reason is required", 400);

    const submission = await env.DB.prepare(
      `SELECT s.*, u.manager FROM kpi_submissions s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.id = ?`
    ).bind(id).first();

    if (!submission) return errorResponse("Submission not found", 404);
    if (user.role !== "Admin" && submission.manager !== user.user_id) {
      return forbiddenResponse("Not this employee's manager");
    }

    await env.DB.prepare(
      `UPDATE kpi_submissions SET status = 'returned', return_reason = ?, updated_at = ? WHERE id = ?`
    ).bind(reason.trim(), nowIST(), id).run();

    return jsonResponse({ message: "Submission returned to employee" });
  } catch (e) {
    return errorResponse("Failed to return submission: " + e.message, 500);
  }
}

// ─── History Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/kpi/history
 * Get all submissions for a user in a financial year.
 * Query: ?user_id=&fy=2026
 */
export async function handleGetKpiHistory(req, env, params, query, user) {
  try {
    const userId = query.get("user_id") || user.user_id;
    const fy = query.get("fy") || getFY();

    if (userId !== user.user_id && user.role !== "Admin") {
      const isMgr = await isManagerOf(env.DB, user.user_id, userId);
      if (!isMgr) return forbiddenResponse("Not your report");
    }

    const { results } = await env.DB.prepare(
      `SELECT s.*, a.job_role_weight, a.esms_weight, a.core_values_weight, a.kras, a.starts_from
       FROM kpi_submissions s
       JOIN kpi_assignments a ON a.id = s.assignment_id
       WHERE s.user_id = ? AND s.financial_year = ?
       ORDER BY s.period_month ASC`
    ).bind(userId, fy).all();

    return jsonResponse({ submissions: results || [], fy });
  } catch (e) {
    return errorResponse("Failed to load history: " + e.message, 500);
  }
}

// ─── Analytics Handlers ───────────────────────────────────────────────────────

/**
 * GET /api/kpi/analytics/year
 * Year average scores for a user.
 * Query: ?user_id=&fy=2026
 */
export async function handleGetKpiYearAnalytics(req, env, params, query, user) {
  try {
    const userId = query.get("user_id") || user.user_id;
    const fy = query.get("fy") || getFY();

    if (userId !== user.user_id && user.role !== "Admin") {
      const isMgr = await isManagerOf(env.DB, user.user_id, userId);
      if (!isMgr) return forbiddenResponse("Not your report");
    }

    const { results } = await env.DB.prepare(
      `SELECT final_total_score, final_job_score, final_esms_score, final_core_score, period_month
       FROM kpi_submissions
       WHERE user_id = ? AND financial_year = ? AND status IN ('scored','finalized') AND final_total_score IS NOT NULL
       ORDER BY period_month ASC`
    ).bind(userId, fy).all();

    if (!results || results.length === 0) {
      return jsonResponse({ avg_total_score: null, avg_job_role_score: null, avg_esms_score: null, avg_core_values_score: null, months_scored: 0 });
    }

    const avg = (arr) => arr.filter(v => v !== null).reduce((a, b) => a + b, 0) / arr.filter(v => v !== null).length;

    return jsonResponse({
      avg_total_score: Math.round(avg(results.map(r => r.final_total_score)) * 10) / 10,
      avg_job_role_score: Math.round(avg(results.map(r => r.final_job_score)) * 10) / 10,
      avg_esms_score: Math.round(avg(results.map(r => r.final_esms_score)) * 10) / 10,
      avg_core_values_score: Math.round(avg(results.map(r => r.final_core_score)) * 10) / 10,
      months_scored: results.length,
      monthly_scores: results.map(r => ({ month: r.period_month, score: r.final_total_score }))
    });
  } catch (e) {
    return errorResponse("Failed to load year analytics: " + e.message, 500);
  }
}

/**
 * GET /api/kpi/analytics/attainment
 * Per-KRA attainment percentages for a user.
 * Query: ?user_id=&fy=2026
 */
export async function handleGetKpiAttainment(req, env, params, query, user) {
  try {
    const userId = query.get("user_id") || user.user_id;
    const fy = query.get("fy") || getFY();

    if (userId !== user.user_id && user.role !== "Admin") {
      const isMgr = await isManagerOf(env.DB, user.user_id, userId);
      if (!isMgr) return forbiddenResponse("Not your report");
    }

    // Get all finalized submissions
    const { results: submissions } = await env.DB.prepare(
      `SELECT s.manager_scores, s.self_data, s.period_month, a.kras, a.job_role_weight
       FROM kpi_submissions s
       JOIN kpi_assignments a ON a.id = s.assignment_id
       WHERE s.user_id = ? AND s.financial_year = ? AND s.status IN ('scored','finalized')
       ORDER BY s.period_month ASC`
    ).bind(userId, fy).all();

    // Build per-KRA attainment rows
    const rows = [];
    for (const sub of submissions || []) {
      const kras = JSON.parse(sub.kras || "[]");
      const scores = JSON.parse(sub.manager_scores || "{}");

      for (const kra of kras) {
        const kraKey = kra.name || kra.kra_name;
        const section = kra.section || "job_role";
        const weight = kra.weight || 0;
        const score = scores[kraKey] !== undefined ? scores[kraKey] : null;
        const attainmentPct = score !== null && weight > 0 ? (score / weight) * 100 : null;

        rows.push({
          kra: kraKey,
          section,
          weight,
          score,
          attainment_pct: attainmentPct !== null ? Math.round(attainmentPct * 10) / 10 : null,
          period_month: sub.period_month,
          status: score !== null ? "scored" : "pending"
        });
      }
    }

    return jsonResponse({ attainment: rows });
  } catch (e) {
    return errorResponse("Failed to load attainment: " + e.message, 500);
  }
}

// ─── Team Handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/kpi/team
 * Manager's team submissions for a given month.
 * Query: ?fy=2026&month=Apr-2026
 */
export async function handleGetKpiTeam(req, env, params, query, user) {
  try {
    const fy = query.get("fy") || getFY();
    const month = query.get("month") || getCurrentReportingMonth();

    if (user.role !== "Admin") {
      const reports = await getDirectReports(env.DB, user.user_id);
      if (reports.length === 0) return jsonResponse({ team: [], submissions: [], scoring: 0, approvals: 0 });
    }

    // Get team members
    const { results: team } = await env.DB.prepare(
      user.role === "Admin"
        ? `SELECT user_id, name, role, district FROM users WHERE user_status = 'active' ORDER BY name`
        : `SELECT user_id, name, role, district FROM users WHERE manager = ? AND user_status = 'active' ORDER BY name`
    ).bind(user.role === "Admin" ? undefined : user.user_id).all();

    const teamIds = (team || []).map(t => t.user_id);
    if (teamIds.length === 0) return jsonResponse({ team: [], submissions: [], scoring: 0, approvals: 0 });

    // Get submissions for the month
    const placeholders = teamIds.map(() => "?").join(",");
    const { results: submissions } = await env.DB.prepare(
      `SELECT s.id, s.user_id, s.period_month, s.status, s.final_total_score, s.submitted_at
       FROM kpi_submissions s
       WHERE s.user_id IN (${placeholders}) AND s.period_month = ? AND s.financial_year = ?`
    ).bind(...teamIds, month, fy).all();

    // Get pending KPI approvals
    const { results: pendingApprovals } = await env.DB.prepare(
      `SELECT id, user_id FROM kpi_assignments
       WHERE user_id IN (${placeholders}) AND status = 'pending_approval'`
    ).bind(...teamIds).all();

    const scoringCount = (submissions || []).filter(s => s.status === "submitted").length;

    return jsonResponse({
      team: team || [],
      submissions: submissions || [],
      scoring: scoringCount,
      approvals: (pendingApprovals || []).length,
      month,
      fy
    });
  } catch (e) {
    return errorResponse("Failed to load team data: " + e.message, 500);
  }
}

/**
 * GET /api/kpi/team/members
 * Get list of direct reports for current manager.
 */
export async function handleGetKpiTeamMembers(req, env, params, query, user) {
  try {
    const reports = await getDirectReports(env.DB, user.user_id);
    return jsonResponse({ members: reports });
  } catch (e) {
    return errorResponse("Failed to load team members: " + e.message, 500);
  }
}

/**
 * GET /api/kpi/team/:employeeId/summary
 * Get a team member's KPI summary for a FY.
 * Query: ?fy=2026
 */
export async function handleGetTeamMemberSummary(req, env, params, query, user) {
  try {
    const { employeeId } = params;
    const fy = query.get("fy") || getFY();

    if (user.role !== "Admin") {
      const isMgr = await isManagerOf(env.DB, user.user_id, employeeId);
      if (!isMgr) return forbiddenResponse("Not your report");
    }

    const employee = await env.DB.prepare(
      `SELECT user_id, name, role, district FROM users WHERE user_id = ?`
    ).bind(employeeId).first();
    if (!employee) return errorResponse("Employee not found", 404);

    const assignment = await env.DB.prepare(
      `SELECT * FROM kpi_assignments WHERE user_id = ? AND financial_year = ?`
    ).bind(employeeId, fy).first();

    const { results: submissions } = await env.DB.prepare(
      `SELECT * FROM kpi_submissions WHERE user_id = ? AND financial_year = ? ORDER BY period_month ASC`
    ).bind(employeeId, fy).all();

    return jsonResponse({ employee, assignment: assignment || null, submissions: submissions || [], fy });
  } catch (e) {
    return errorResponse("Failed to load member summary: " + e.message, 500);
  }
}

// ─── Pending Approvals Handler ────────────────────────────────────────────────

/**
 * GET /api/kpi/approvals/pending
 * Get all pending KPI setups for manager to approve.
 */
export async function handleGetPendingApprovals(req, env, params, query, user) {
  try {
    const fy = query.get("fy") || getFY();

    let pending;
    if (user.role === "Admin") {
      const { results } = await env.DB.prepare(
        `SELECT ka.*, u.name, u.role, u.district
         FROM kpi_assignments ka
         JOIN users u ON u.user_id = ka.user_id
         WHERE ka.status = 'pending_approval' AND ka.financial_year = ?
         ORDER BY ka.submitted_at ASC`
      ).bind(fy).all();
      pending = results || [];
    } else {
      const { results } = await env.DB.prepare(
        `SELECT ka.*, u.name, u.role, u.district
         FROM kpi_assignments ka
         JOIN users u ON u.user_id = ka.user_id
         WHERE ka.status = 'pending_approval' AND ka.financial_year = ?
           AND u.manager = ?
         ORDER BY ka.submitted_at ASC`
      ).bind(fy, user.user_id).all();
      pending = results || [];
    }

    return jsonResponse({ pending, count: pending.length });
  } catch (e) {
    return errorResponse("Failed to load pending approvals: " + e.message, 500);
  }
}

// ─── Deletion Request Handlers ────────────────────────────────────────────────

/**
 * GET /api/kpi/deletions
 * Get deletion requests — employee sees their own, manager sees team.
 */
export async function handleGetKpiDeletions(req, env, params, query, user) {
  try {
    let deletions;
    if (user.role === "Admin") {
      const { results } = await env.DB.prepare(
        `SELECT dr.*, u.name
         FROM kpi_deletion_requests dr
         JOIN users u ON u.user_id = dr.user_id
         ORDER BY dr.created_at DESC`
      ).all();
      deletions = results || [];
    } else {
      // Check if manager
      const reports = await getDirectReports(env.DB, user.user_id);
      if (reports.length > 0) {
        const ids = reports.map(r => r.user_id);
        const placeholders = ids.map(() => "?").join(",");
        const { results } = await env.DB.prepare(
          `SELECT dr.*, u.name
           FROM kpi_deletion_requests dr
           JOIN users u ON u.user_id = dr.user_id
           WHERE dr.user_id IN (${placeholders}) OR dr.user_id = ?
           ORDER BY dr.created_at DESC`
        ).bind(...ids, user.user_id).all();
        deletions = results || [];
      } else {
        const { results } = await env.DB.prepare(
          `SELECT dr.* FROM kpi_deletion_requests dr WHERE dr.user_id = ? ORDER BY dr.created_at DESC`
        ).bind(user.user_id).all();
        deletions = results || [];
      }
    }

    return jsonResponse({ deletions });
  } catch (e) {
    return errorResponse("Failed to load deletion requests: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/deletions
 * Employee raises a deletion request for a finalized submission.
 * Body: { submission_id, reason }
 */
export async function handleRaiseKpiDeletion(req, env, params, query, user) {
  try {
    const body = await req.json();
    const { submission_id, reason } = body;
    if (!submission_id || !reason?.trim()) return errorResponse("submission_id and reason required", 400);

    const submission = await env.DB.prepare(
      `SELECT * FROM kpi_submissions WHERE id = ? AND user_id = ?`
    ).bind(submission_id, user.user_id).first();
    if (!submission) return errorResponse("Submission not found", 404);

    // Check for existing open request
    const existing = await env.DB.prepare(
      `SELECT id FROM kpi_deletion_requests WHERE submission_id = ? AND status = 'pending'`
    ).bind(submission_id).first();
    if (existing) return errorResponse("A deletion request for this month is already pending", 400);

    await env.DB.prepare(
      `INSERT INTO kpi_deletion_requests (submission_id, user_id, period_month, financial_year, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(submission_id, user.user_id, submission.period_month, submission.financial_year, reason.trim(), nowIST()).run();

    return jsonResponse({ message: "Deletion request raised" });
  } catch (e) {
    return errorResponse("Failed to raise deletion request: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/deletions/:id/approve
 * Manager approves a deletion request — resets submission to draft.
 */
export async function handleApproveDeletion(req, env, params, query, user) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { note } = body;

    const deletion = await env.DB.prepare(
      `SELECT dr.*, u.manager FROM kpi_deletion_requests dr
       JOIN users u ON u.user_id = dr.user_id
       WHERE dr.id = ?`
    ).bind(id).first();

    if (!deletion) return errorResponse("Deletion request not found", 404);
    if (deletion.status !== "pending") return errorResponse("Not pending", 400);
    if (user.role !== "Admin" && deletion.manager !== user.user_id) {
      return forbiddenResponse("Not this employee's manager");
    }

    // Reset submission to draft and clear scores
    await env.DB.prepare(
      `UPDATE kpi_submissions
       SET status = 'draft', manager_scores = NULL, final_job_score = NULL, final_esms_score = NULL,
           final_core_score = NULL, final_total_score = NULL, scored_by = NULL, scored_at = NULL,
           finalized_at = NULL, updated_at = ?
       WHERE id = ?`
    ).bind(nowIST(), deletion.submission_id).run();

    await env.DB.prepare(
      `UPDATE kpi_deletion_requests
       SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ?
       WHERE id = ?`
    ).bind(user.user_id, nowIST(), note || null, id).run();

    return jsonResponse({ message: "Deletion approved — submission reset to draft" });
  } catch (e) {
    return errorResponse("Failed to approve deletion: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/deletions/:id/reject
 * Manager rejects a deletion request.
 * Body: { note }
 */
export async function handleRejectDeletion(req, env, params, query, user) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { note } = body;

    const deletion = await env.DB.prepare(
      `SELECT dr.*, u.manager FROM kpi_deletion_requests dr
       JOIN users u ON u.user_id = dr.user_id
       WHERE dr.id = ?`
    ).bind(id).first();

    if (!deletion) return errorResponse("Deletion request not found", 404);
    if (deletion.status !== "pending") return errorResponse("Not pending", 400);
    if (user.role !== "Admin" && deletion.manager !== user.user_id) {
      return forbiddenResponse("Not this employee's manager");
    }

    await env.DB.prepare(
      `UPDATE kpi_deletion_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?`
    ).bind(user.user_id, nowIST(), note || null, id).run();

    return jsonResponse({ message: "Deletion request rejected" });
  } catch (e) {
    return errorResponse("Failed to reject deletion: " + e.message, 500);
  }
}

// ─── Score Query Handlers ─────────────────────────────────────────────────────

/**
 * GET /api/kpi/queries
 * Get score queries — employee sees own, manager sees team.
 */
export async function handleGetKpiQueries(req, env, params, query, user) {
  try {
    let queries;
    if (user.role === "Admin") {
      const { results } = await env.DB.prepare(
        `SELECT q.*, u.name FROM kpi_queries q
         JOIN users u ON u.user_id = q.user_id
         ORDER BY q.created_at DESC`
      ).all();
      queries = results || [];
    } else {
      const reports = await getDirectReports(env.DB, user.user_id);
      if (reports.length > 0) {
        const ids = reports.map(r => r.user_id);
        const placeholders = ids.map(() => "?").join(",");
        const { results } = await env.DB.prepare(
          `SELECT q.*, u.name FROM kpi_queries q
           JOIN users u ON u.user_id = q.user_id
           WHERE q.user_id IN (${placeholders}) OR q.user_id = ?
           ORDER BY q.created_at DESC`
        ).bind(...ids, user.user_id).all();
        queries = results || [];
      } else {
        const { results } = await env.DB.prepare(
          `SELECT * FROM kpi_queries WHERE user_id = ? ORDER BY created_at DESC`
        ).bind(user.user_id).all();
        queries = results || [];
      }
    }

    return jsonResponse({ queries });
  } catch (e) {
    return errorResponse("Failed to load queries: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/queries
 * Employee raises a score query.
 * Body: { submission_id, query_text }
 */
export async function handleRaiseKpiQuery(req, env, params, query, user) {
  try {
    const body = await req.json();
    const { submission_id, query_text } = body;
    if (!submission_id || !query_text?.trim()) return errorResponse("submission_id and query_text required", 400);

    const submission = await env.DB.prepare(
      `SELECT * FROM kpi_submissions WHERE id = ?`
    ).bind(submission_id).first();
    if (!submission) return errorResponse("Submission not found", 404);

    await env.DB.prepare(
      `INSERT INTO kpi_queries (submission_id, user_id, period_month, financial_year, query_text, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`
    ).bind(submission_id, user.user_id, submission.period_month, submission.financial_year, query_text.trim(), nowIST()).run();

    return jsonResponse({ message: "Query raised" });
  } catch (e) {
    return errorResponse("Failed to raise query: " + e.message, 500);
  }
}

/**
 * POST /api/kpi/queries/:id/respond
 * Manager responds to a score query.
 * Body: { response_text }
 */
export async function handleRespondToQuery(req, env, params, query, user) {
  try {
    const { id } = params;
    const body = await req.json();
    const { response_text } = body;
    if (!response_text?.trim()) return errorResponse("response_text required", 400);

    const q = await env.DB.prepare(
      `SELECT kq.*, u.manager FROM kpi_queries kq
       JOIN users u ON u.user_id = kq.user_id
       WHERE kq.id = ?`
    ).bind(id).first();
    if (!q) return errorResponse("Query not found", 404);
    if (user.role !== "Admin" && q.manager !== user.user_id) {
      return forbiddenResponse("Not this employee's manager");
    }

    await env.DB.prepare(
      `UPDATE kpi_queries SET status = 'closed', response_text = ?, responded_by = ?, responded_at = ? WHERE id = ?`
    ).bind(response_text.trim(), user.user_id, nowIST(), id).run();

    return jsonResponse({ message: "Response saved" });
  } catch (e) {
    return errorResponse("Failed to respond: " + e.message, 500);
  }
}

// ─── Notifications Handler ────────────────────────────────────────────────────

/**
 * GET /api/kpi/notifications
 * Get relevant notifications/alerts for the current user.
 */
export async function handleGetKpiNotifications(req, env, params, query, user) {
  try {
    const fy = getFY();
    const month = getCurrentReportingMonth();
    const notifications = [];

    // Check if assignment exists and is active
    const assignment = await env.DB.prepare(
      `SELECT status FROM kpi_assignments WHERE user_id = ? AND financial_year = ?`
    ).bind(user.user_id, fy).first();

    if (!assignment) {
      notifications.push({ kind: "kpi_not_setup", n: 1 });
    } else if (assignment.status === "rejected") {
      notifications.push({ kind: "kpi_rejected", n: 1 });
    } else if (assignment.status === "active") {
      // Check if current month submission is pending
      const submission = await env.DB.prepare(
        `SELECT status FROM kpi_submissions WHERE user_id = ? AND period_month = ? AND financial_year = ?`
      ).bind(user.user_id, month, fy).first();
      if (!submission || submission.status === "draft") {
        notifications.push({ kind: "submission_due", n: 1 });
      } else if (submission.status === "returned") {
        notifications.push({ kind: "submission_returned", n: 1 });
      }
    }

    // Manager notifications
    const reports = await getDirectReports(env.DB, user.user_id);
    if (reports.length > 0) {
      const teamIds = reports.map(r => r.user_id);
      const placeholders = teamIds.map(() => "?").join(",");

      // Pending approvals count
      const { results: pending } = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM kpi_assignments WHERE user_id IN (${placeholders}) AND status = 'pending_approval'`
      ).bind(...teamIds).all();
      const pendingCount = pending?.[0]?.cnt || 0;
      if (pendingCount > 0) notifications.push({ kind: "kpi_approvals", n: pendingCount });

      // Submissions to score
      const { results: toScore } = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM kpi_submissions WHERE user_id IN (${placeholders}) AND period_month = ? AND status = 'submitted'`
      ).bind(...teamIds, month).all();
      const scoreCount = toScore?.[0]?.cnt || 0;
      if (scoreCount > 0) notifications.push({ kind: "submissions_to_score", n: scoreCount });

      // Pending deletion requests
      const { results: deletions } = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM kpi_deletion_requests WHERE user_id IN (${placeholders}) AND status = 'pending'`
      ).bind(...teamIds).all();
      const delCount = deletions?.[0]?.cnt || 0;
      if (delCount > 0) notifications.push({ kind: "deletion_requests", n: delCount });

      // Open queries
      const { results: queries } = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM kpi_queries WHERE user_id IN (${placeholders}) AND status = 'open'`
      ).bind(...teamIds).all();
      const queryCount = queries?.[0]?.cnt || 0;
      if (queryCount > 0) notifications.push({ kind: "score_queries", n: queryCount });
    }

    return jsonResponse({ notifications });
  } catch (e) {
    return errorResponse("Failed to load notifications: " + e.message, 500);
  }
}
