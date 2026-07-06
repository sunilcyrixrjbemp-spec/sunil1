import { runWrite, runBatchWrite } from "../utils/db.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function getLegacyExpenseHashId(expId) {
  const msgUint8 = new TextEncoder().encode(String(expId));
  const hashBuffer = await crypto.subtle.digest("MD5", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  const val = parseInt(hashHex.substring(0, 7), 16);
  return -200000 - val;
}

export async function fetchPendingApprovals(env, user) {
  const result = [];

  // 1. Fetch pending limit requests
  const pendingLimits = await env.DB.prepare(`
    SELECT * FROM limit_approval_requests
    WHERE manager_id = ? AND status = 'Pending'
  `).bind(user.user_id).all();

  for (const pl of (pendingLimits.results || [])) {
    const submitter = await env.DB.prepare("SELECT name FROM users WHERE user_id = ?").bind(pl.user_id).first();
    result.push({
      id: -pl.id,
      expense_id: -pl.id,
      approver_id: user.id,
      level_number: 1,
      status: "pending",
      comments: "",
      created_at: pl.created_at,
      updated_at: pl.updated_at,
      expense_code: `LIMIT-${pl.request_type}-${pl.id}`,
      employeeName: submitter?.name || `Employee ${pl.user_id}`,
      eCode: pl.user_id,
      purpose: `Request additional ${parseFloat(pl.requested_value).toFixed(1)} ${pl.request_type} limit for month ${pl.for_month}`,
      category: "Limit Request",
      amount: parseFloat(pl.requested_value),
      date: pl.for_month,
      itinerariesCount: 0
    });
  }

  // 2. Fetch normal approvals
  const approvals = await env.DB.prepare(`
    SELECT a.*, e.expense_code, e.amount, e.description, e.travel_mode, e.itinerary, e.user_id as submitter_user_id
    FROM approvals a
    JOIN expenses e ON a.expense_id = e.id
    WHERE a.approver_id = ? AND a.status = 'pending'
    ORDER BY a.level_number ASC, a.created_at DESC
  `).bind(user.id).all();

  for (const app of (approvals.results || [])) {
    const submitter = await env.DB.prepare("SELECT name, user_id FROM users WHERE id = ?").bind(app.submitter_user_id).first();
    
    // Count itineraries
    const countResult = await env.DB.prepare("SELECT COUNT(*) as cnt FROM expense_itineraries WHERE exp_id = ?").bind(app.expense_code).first();
    const itiCount = countResult?.cnt || 0;

    result.push({
      id: app.id,
      expense_id: app.expense_id,
      approver_id: app.approver_id,
      level_number: app.level_number,
      status: app.status,
      comments: app.comments || "",
      created_at: app.created_at,
      updated_at: app.updated_at,
      expense_code: app.expense_code,
      employeeName: submitter?.name || "Unknown Employee",
      eCode: submitter?.user_id || "N/A",
      purpose: app.description || "",
      category: app.travel_mode || "Travel",
      amount: parseFloat(app.amount || 0),
      date: app.itinerary,
      itinerariesCount: itiCount
    });
  }

  // 3. Fetch legacy pending claims
  try {
    const legacyRows = await env.DB.prepare(`
      SELECT m.exp_id, m.user_id, m.expense_date, m.total_amount, m.status, m.visit_purpose, u.name as full_name, u.e_code
      FROM expense_master m
      JOIN users u ON LOWER(m.user_id) = LOWER(u.user_id)
      WHERE 
        ((m.status = 'Pending L1' OR m.status = 'Pending') AND LOWER(m.level_first_approver) = LOWER(?))
        OR
        (m.status = 'Pending L2' AND LOWER(m.level_second_approver) = LOWER(?))
    `).bind(user.user_id, user.user_id).all();

    for (const row of (legacyRows.results || [])) {
      const mockId = await getLegacyExpenseHashId(row.exp_id);
      const levelNumber = row.status === "Pending L2" ? 2 : 1;

      // Fetch count of itineraries for this legacy claim
      let itiCount = 0;
      try {
        const countResult = await env.DB.prepare("SELECT COUNT(*) as cnt FROM expense_itinerary WHERE exp_id = ?").bind(row.exp_id).first();
        itiCount = countResult?.cnt || 0;
      } catch (e) {}

      // Fetch first travel mode
      let category = "Travel";
      try {
        const firstLeg = await env.DB.prepare(`
          SELECT travel_mode FROM expense_itinerary WHERE exp_id = ? ORDER BY leg_number ASC LIMIT 1
        `).bind(row.exp_id).first();
        category = firstLeg?.travel_mode || "Travel";
      } catch (e) {}

      result.push({
        id: mockId,
        expense_id: mockId,
        approver_id: user.id,
        level_number: levelNumber,
        status: "pending",
        comments: "",
        created_at: row.expense_date,
        updated_at: row.expense_date,
        expense_code: row.exp_id,
        employeeName: row.full_name || "Unknown Employee",
        eCode: row.e_code || row.user_id,
        purpose: row.visit_purpose || "",
        category: category,
        amount: parseFloat(row.total_amount || 0),
        date: row.expense_date,
        itinerariesCount: itiCount
      });
    }
  } catch (error) {
    console.warn("Legacy table expense_master not found or query failed, skipping legacy pending claims:", error.message);
  }

  return result;
}

/**
 * GET /api/approvals
 * Retrieve pending approvals for a user
 */
export async function handleGetApprovals(request, env, params, query, user) {
  const pending = await fetchPendingApprovals(env, user);
  return jsonResponse(pending);
}

/**
 * POST /api/approvals/:expense_id/approve
 */
export async function handleApprove(request, env, params, query, user) {
  const expenseId = parseInt(params.expense_id, 10);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  const { comments, approved_value, client_timestamp } = body;
  const timestamp = client_timestamp || new Date().toISOString();

  // 1. Handle Legacy Expense (expenseId < 0 and <= -200000)
  if (expenseId <= -200000) {
    // Legacy mapping (skip hashes calculation here to keep code efficient; we lookup matches in expense_master)
    // For legacy support, we fetch all rows and find hash match
    const allRows = await env.DB.prepare("SELECT exp_id, user_id, status, level_first_approver, level_second_approver, total_amount FROM expense_master").all();
    let match = null;
    
    // We implement the Python hashing function get_legacy_expense_hash_id in JS:
    // Hashing function: -((exp_id * 73 + 19) % 800000 + 200000)
    for (const row of (allRows.results || [])) {
      const hashId = -((row.exp_id * 73 + 19) % 800000 + 200000);
      if (hashId === expenseId) {
        match = row;
        break;
      }
    }

    if (!match) {
      return jsonResponse({ error: "Legacy expense claim not found" }, 404);
    }

    const { exp_id, user_id: submitterId, status: currentStatus, level_first_approver: l1App, level_second_approver: l2App, total_amount: totalAmount } = match;
    const isL1 = (l1App === user.user_id);
    const isL2 = (l2App === user.user_id);

    if (!isL1 && !isL2 && user.role !== "Admin") {
      return jsonResponse({ error: "Access denied to approve this claim" }, 403);
    }

    let newStatus = currentStatus;
    if ((currentStatus === "Pending L1" || currentStatus === "Pending") && isL1) {
      newStatus = (l2App && l2App.trim() && l2App !== "None") ? "Pending L2" : "Approved";
      await runWrite(env, `
        UPDATE expense_master 
        SET status = ?, approved_by = ?, level_first_approver_time = ?
        WHERE exp_id = ?
      `, [newStatus, user.user_id, timestamp, exp_id]);
    } else if (currentStatus === "Pending L2" && isL2) {
      newStatus = "Approved";
      await runWrite(env, `
        UPDATE expense_master 
        SET status = 'Approved', approved_by = ?, level_second_approver_time = ?
        WHERE exp_id = ?
      `, [user.user_id, timestamp, exp_id]);
    } else {
      return jsonResponse({ error: "Cannot action this claim at this time" }, 400);
    }

    // Insert notifications
    if (newStatus === "Pending L2") {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        submitterId, "🔄 Claim Approved at Level 1", `Your claim ${exp_id} has been approved at Level 1 by ${user.name}.`, "info", "/home", timestamp
      ]);
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        l2App, "📥 Pending Approval", `New claim ${exp_id} submitted by ${submitterId} (₹${totalAmount}) is pending Level 2 approval.`, "warning", "/approval-center", timestamp
      ]);
    } else {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        submitterId, "✅ Expense Claim Approved!", `Your claim ${exp_id} has been fully approved by ${user.name}.`, "success", "/home", timestamp
      ]);
    }

    return jsonResponse({ status: "success", message: "Expense claim approved successfully." });
  }

  // 2. Handle Limit Request (expenseId < 0)
  if (expenseId < 0) {
    const limitId = -expenseId;
    const pl = await env.DB.prepare("SELECT * FROM limit_approval_requests WHERE id = ?").bind(limitId).first();
    if (!pl) return jsonResponse({ error: "Limit approval request not found" }, 404);

    if (pl.manager_id !== user.user_id && user.role !== "Admin") {
      return jsonResponse({ error: "Access denied to approve this request" }, 403);
    }

    const approvedVal = approved_value !== undefined ? approved_value : pl.requested_value;
    await runWrite(env, "UPDATE limit_approval_requests SET approved_value = ?, status = 'Approved', updated_at = ? WHERE id = ?", [
      approvedVal, timestamp, limitId
    ]);

    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      pl.user_id, `Limit Request ${pl.request_type} Approved`, `Your request for additional ${pl.requested_value} ${pl.request_type} has been approved by your manager.`, "success", "/expense", timestamp
    ]);

    return jsonResponse({ status: "success", message: "Limit request approved successfully." });
  }

  // 3. Handle Standard Expense (expenseId > 0)
  const activeApproval = await env.DB.prepare(`
    SELECT * FROM approvals WHERE expense_id = ? AND approver_id = ? AND status = 'pending'
  `).bind(expenseId, user.id).first();

  if (!activeApproval) {
    return jsonResponse({ error: "No pending approval task found for you on this claim" }, 400);
  }

  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) return jsonResponse({ error: "Expense claim not found" }, 404);

  // Update active approval
  await runWrite(env, "UPDATE approvals SET status = 'approved', comments = ?, updated_at = ? WHERE id = ?", [
    comments || "", timestamp, activeApproval.id
  ]);

  // Find next level
  const allApprovals = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? ORDER BY level_number ASC").bind(expenseId).all();
  let nextApproval = null;
  for (const a of (allApprovals.results || [])) {
    if (a.level_number > activeApproval.level_number && a.status === "waiting") {
      nextApproval = a;
      break;
    }
  }

  let finalStatus = "approved";
  if (nextApproval) {
    finalStatus = `submitted_l${nextApproval.level_number}`;
    await runWrite(env, "UPDATE approvals SET status = 'pending', created_at = ?, updated_at = ? WHERE id = ?", [
      timestamp, timestamp, nextApproval.id
    ]);
  }

  await runWrite(env, "UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?", [
    finalStatus, timestamp, expenseId
  ]);

  // Notifications
  const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
  if (submitter) {
    if (finalStatus === "approved") {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        submitter.user_id, "✅ Expense Claim Approved!", `Your claim ${expense.expense_code} has been fully approved by ${user.name}.`, "success", "/home", timestamp
      ]);
    } else {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        submitter.user_id, "🔄 Claim Forwarded", `Your claim ${expense.expense_code} has been approved by ${user.name} and forwarded to the next level.`, "info", "/home", timestamp
      ]);
    }
  }

  if (nextApproval) {
    const nextApproverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(nextApproval.approver_id).first();
    if (nextApproverUser) {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        nextApproverUser.user_id, "📥 Pending Approval Forwarded", `Claim ${expense.expense_code} has been forwarded to you for review.`, "warning", "/approval-center", timestamp
      ]);
    }
  }

  return jsonResponse({ status: "success", message: "Expense claim approved successfully.", expense_status: finalStatus === "approved" ? "Approved" : "Pending Next Level" });
}

/**
 * POST /api/approvals/:expense_id/reject
 */
export async function handleReject(request, env, params, query, user) {
  const expenseId = parseInt(params.expense_id, 10);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { comments, client_timestamp } = body;
  if (!comments || !comments.trim()) {
    return jsonResponse({ error: "Rejection comments/remark is mandatory" }, 400);
  }

  const timestamp = client_timestamp || new Date().toISOString();

  // 1. Handle Legacy Expense Rejection
  if (expenseId <= -200000) {
    const allRows = await env.DB.prepare("SELECT exp_id, user_id, status, level_first_approver, level_second_approver FROM expense_master").all();
    let match = null;
    for (const row of (allRows.results || [])) {
      const hashId = -((row.exp_id * 73 + 19) % 800000 + 200000);
      if (hashId === expenseId) {
        match = row;
        break;
      }
    }

    if (!match) return jsonResponse({ error: "Legacy claim not found" }, 404);

    const { exp_id, user_id: submitterId, status: currentStatus, level_first_approver: l1App, level_second_approver: l2App } = match;
    const isL1 = (l1App === user.user_id);
    const isL2 = (l2App === user.user_id);

    if (!isL1 && !isL2 && user.role !== "Admin") {
      return jsonResponse({ error: "Access denied to reject this claim" }, 403);
    }

    if ((currentStatus === "Pending L1" || currentStatus === "Pending") && isL1) {
      await runWrite(env, "UPDATE expense_master SET status = 'Rejected', reject_reason = ?, approved_by = 'L1', level_first_approver_time = ? WHERE exp_id = ?", [
        comments, timestamp, exp_id
      ]);
    } else if (currentStatus === "Pending L2" && isL2) {
      await runWrite(env, "UPDATE expense_master SET status = 'Rejected', reject_reason = ?, approved_by = 'L2', level_second_approver_time = ? WHERE exp_id = ?", [
        comments, timestamp, exp_id
      ]);
    } else {
      return jsonResponse({ error: "Cannot reject this claim at this time" }, 400);
    }

    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      submitterId, "❌ Expense Claim Rejected", `Your claim ${exp_id} has been rejected by ${user.name}. Reason: ${comments.slice(0, 80)}`, "error", "/home", timestamp
    ]);

    return jsonResponse({ status: "success", message: "Expense claim has been rejected." });
  }

  // 2. Handle Limit Request Rejection
  if (expenseId < 0) {
    const limitId = -expenseId;
    const pl = await env.DB.prepare("SELECT * FROM limit_approval_requests WHERE id = ?").bind(limitId).first();
    if (!pl) return jsonResponse({ error: "Limit approval request not found" }, 404);

    if (pl.manager_id !== user.user_id && user.role !== "Admin") {
      return jsonResponse({ error: "Access denied to reject this request" }, 403);
    }

    await runWrite(env, "UPDATE limit_approval_requests SET status = 'Rejected', updated_at = ? WHERE id = ?", [
      timestamp, limitId
    ]);

    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      pl.user_id, `Limit Request ${pl.request_type} Rejected`, `Your request for additional ${pl.requested_value} ${pl.request_type} has been rejected by your manager.`, "danger", "/expense", timestamp
    ]);

    return jsonResponse({ status: "success", message: "Limit request rejected successfully." });
  }

  // 3. Handle Standard Expense Rejection
  const activeApproval = await env.DB.prepare(`
    SELECT * FROM approvals WHERE expense_id = ? AND approver_id = ? AND status = 'pending'
  `).bind(expenseId, user.id).first();

  if (!activeApproval) {
    return jsonResponse({ error: "No pending approval task found for you on this claim" }, 400);
  }

  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) return jsonResponse({ error: "Expense claim not found" }, 404);

  // Update current approval
  await runWrite(env, "UPDATE approvals SET status = 'rejected', comments = ?, updated_at = ? WHERE id = ?", [
    comments, timestamp, activeApproval.id
  ]);

  // Cancel waiting levels
  await runWrite(env, "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND level_number > ? AND status = 'waiting'", [
    timestamp, expenseId, activeApproval.level_number
  ]);

  // Set expense to rejected
  await runWrite(env, "UPDATE expenses SET status = 'rejected', updated_at = ? WHERE id = ?", [
    "rejected", timestamp, expenseId
  ]);

  // Notification to submitter
  const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
  if (submitter) {
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      submitter.user_id, "❌ Expense Claim Rejected", `Your claim ${expense.expense_code} has been rejected by ${user.name}. Reason: ${comments.slice(0, 80)}`, "error", "/home", timestamp
    ]);
  }

  return jsonResponse({ status: "success", message: "Expense claim has been rejected." });
}
