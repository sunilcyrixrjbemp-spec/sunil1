import { runWrite, runBatchWrite } from "../utils/db.js";
import { deleteFromGoogleDrive } from "./upload.js";
import { resolveLegacyExpenseId } from "../utils/legacy-resolver.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function applyItineraryEditsAndLog(env, expense, itineraryEdits, currentUser, comments) {
  if (!itineraryEdits || itineraryEdits.length === 0) return;

  // Fetch ALL legs in a single query before the loop — eliminates N sequential SELECTs
  const allLegsRes = await env.DB.prepare(
    "SELECT * FROM expense_itineraries WHERE exp_id = ?"
  ).bind(expense.expense_code).all();
  const legsMap = {};
  for (const l of (allLegsRes.results || [])) {
    legsMap[l.leg_number] = l;
  }

  // Collect all writes to execute in a single batch
  const batchWrites = [];

  for (const edit of itineraryEdits) {
    const legNum = edit.leg_number;
    const leg = legsMap[legNum];
    if (!leg) continue;

    let isKmModified = false;
    if (edit.distance_km !== undefined && edit.distance_km !== null) {
      const oldKm = parseFloat(leg.distance_km || "0.0");
      const newKm = parseFloat(edit.distance_km || "0.0");
      if (Math.round(oldKm * 100) !== Math.round(newKm * 100)) {
        isKmModified = true;
      }
    }

    const fieldsToCheck = [
      ["travel_amount", edit.travel_amount],
      ["sub_amount", edit.sub_amount],
      ["hotel_amount", edit.hotel_amount],
      ["other_amount", edit.other_amount || edit.oth_amount],
      ["distance_km", edit.distance_km || edit.km],
      ["da_amount", edit.da_amount || edit.da],
      ["local_purchase", edit.local_purchase]
    ];

    for (const [field, newValRaw] of fieldsToCheck) {
      if (newValRaw !== undefined && newValRaw !== null) {
        const newVal = parseFloat(newValRaw);
        let skipLog = false;
        if (field === "travel_amount" && isKmModified && ["bike", "car"].includes((leg.travel_mode || "").trim().toLowerCase())) {
          skipLog = true;
        }

        const oldVal = parseFloat(leg[field] || "0.0");
        if (Math.round(oldVal * 100) !== Math.round(newVal * 100)) {
          if (!skipLog) {
            let fieldRemark = null;
            if (edit.remarks && typeof edit.remarks === "object") {
              fieldRemark = edit.remarks[field];
              if (!fieldRemark && field === "da_amount") {
                fieldRemark = edit.remarks.da || edit.remarks.da_amount;
              } else if (!fieldRemark && field === "distance_km") {
                fieldRemark = edit.remarks.km || edit.remarks.distance_km;
              }
            }

            batchWrites.push({
              sql: `INSERT INTO expense_edit_logs (expense_id, leg_number, field_name, old_value, new_value, comment, editor_name, editor_role, editor_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              params: [
                expense.id, legNum, field, String(oldVal), String(newVal),
                fieldRemark || comments || "Adjusted during approval",
                currentUser.name, currentUser.role, currentUser.id
              ]
            });
          }

          batchWrites.push({
            sql: `UPDATE expense_itineraries SET ${field} = ? WHERE id = ?`,
            params: [newVal, leg.id]
          });
        }
      }
    }
  }

  // Execute all edits in a single batch
  if (batchWrites.length > 0) {
    await runBatchWrite(env, batchWrites);
  }

  // Refetch legs to recalculate expense totals
  const legsRows = await env.DB.prepare("SELECT * FROM expense_itineraries WHERE exp_id = ?").bind(expense.expense_code).all();
  const legs = legsRows.results || [];
  
  const totalDa = legs.reduce((sum, l) => sum + parseFloat(l.da_amount || "0.0"), 0);
  const totalHotel = legs.reduce((sum, l) => sum + parseFloat(l.hotel_amount || "0.0"), 0);
  const totalOther = legs.reduce((sum, l) => sum + parseFloat(l.other_amount || "0.0"), 0);
  const totalTravel = legs.reduce((sum, l) => sum + parseFloat(l.travel_amount || "0.0"), 0);
  const totalSub = legs.reduce((sum, l) => sum + parseFloat(l.sub_amount || "0.0"), 0);
  const totalLp = legs.reduce((sum, l) => sum + parseFloat(l.local_purchase || "0.0"), 0);

  const totalAmount = totalTravel + totalSub + totalDa + totalHotel + totalOther + totalLp;

  await runWrite(env, `
    UPDATE expenses 
    SET da_amount = ?, hotel_amount = ?, other_expense_amount = ?, local_purchase_amount = ?, amount = ?
    WHERE id = ?
  `, [totalDa, totalHotel, totalOther, totalLp, totalAmount, expense.id]);
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

  // 1. Fetch pending limit requests (joining users table to avoid N+1 query loop)
  const pendingLimits = await env.DB.prepare(`
    SELECT pl.*, u.name AS submitter_name
    FROM limit_approval_requests pl
    LEFT JOIN users u ON u.user_id = pl.user_id
    WHERE pl.manager_id = ? AND pl.status = 'Pending'
  `).bind(user.user_id).all();

  for (const pl of (pendingLimits.results || [])) {
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
      employeeName: pl.submitter_name || `Employee ${pl.user_id}`,
      eCode: pl.user_id,
      purpose: `Request additional ${parseFloat(pl.requested_value).toFixed(1)} ${pl.request_type} limit for month ${pl.for_month}`,
      category: "Limit Request",
      amount: parseFloat(pl.requested_value),
      date: pl.for_month,
      itinerariesCount: 0
    });
  }

  // 2. Fetch normal approvals (joining users table to avoid N+1 query loop)
  const approvals = await env.DB.prepare(`
    SELECT a.*, e.expense_code, e.amount, e.description, e.travel_mode, e.itinerary, e.user_id as submitter_user_id,
           u.name AS submitter_name, u.user_id AS submitter_code
    FROM approvals a
    JOIN expenses e ON a.expense_id = e.id
    LEFT JOIN users u ON e.user_id = u.id
    WHERE a.approver_id = ? AND a.status = 'pending'
      AND EXISTS (
        SELECT 1 
        FROM hierarchy_requesters hr 
        JOIN hierarchy_approvers ha ON hr.hierarchy_id = ha.hierarchy_id 
        WHERE hr.user_id = e.user_id AND ha.approver_id = a.approver_id
      )
    ORDER BY a.level_number ASC, a.created_at DESC
  `).bind(user.id).all();

  const approvalsList = approvals.results || [];
  
  // Batch fetch itineraries count for all approval expense codes in a single query
  const expenseCodes = approvalsList.map(a => a.expense_code).filter(Boolean);
  const itiCounts = {};
  if (expenseCodes.length > 0) {
    const placeholders = expenseCodes.map(() => "?").join(",");
    const countQuery = `
      SELECT exp_id, COUNT(*) as cnt 
      FROM expense_itineraries 
      WHERE exp_id IN (${placeholders}) 
      GROUP BY exp_id
    `;
    const countResults = await env.DB.prepare(countQuery).bind(...expenseCodes).all();
    for (const row of (countResults.results || [])) {
      itiCounts[row.exp_id] = row.cnt;
    }
  }

  for (const app of approvalsList) {
    const itiCount = itiCounts[app.expense_code] || 0;

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
      employeeName: app.submitter_name || "Unknown Employee",
      eCode: app.submitter_code || "N/A",
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

    const legacyList = legacyRows.results || [];

    if (legacyList.length > 0) {
      // BATCH fetch itinerary counts + first travel mode — eliminates N+1 queries
      const legacyCodes = legacyList.map(r => r.exp_id);
      const placeholders = legacyCodes.map(() => "?").join(",");

      const [countResults, firstLegs] = await Promise.all([
        env.DB.prepare(`
          SELECT exp_id, COUNT(*) as cnt 
          FROM expense_itineraries 
          WHERE exp_id IN (${placeholders}) 
          GROUP BY exp_id
        `).bind(...legacyCodes).all(),
        env.DB.prepare(`
          SELECT exp_id, travel_mode 
          FROM expense_itineraries 
          WHERE exp_id IN (${placeholders}) 
          AND leg_number = (SELECT MIN(leg_number) FROM expense_itineraries ei2 WHERE ei2.exp_id = expense_itineraries.exp_id)
        `).bind(...legacyCodes).all()
      ]);

      const countMap = {};
      for (const r of (countResults.results || [])) countMap[r.exp_id] = r.cnt;
      const modeMap = {};
      for (const r of (firstLegs.results || [])) {
        if (!modeMap[r.exp_id]) modeMap[r.exp_id] = r.travel_mode;
      }

      for (const row of legacyList) {
        const mockId = await getLegacyExpenseHashId(row.exp_id);
        const levelNumber = row.status === "Pending L2" ? 2 : 1;
        const itiCount = countMap[row.exp_id] || 0;
        const category = modeMap[row.exp_id] || "Travel";

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

  const { comments, approved_value, client_timestamp, itinerary_edits, removed_attachments } = body;
  const timestamp = client_timestamp || new Date().toISOString();

  // 1. Handle Legacy Expense (expenseId < 0 and <= -200000)
  if (expenseId <= -200000) {
    const matchingExpId = await resolveLegacyExpenseId(env, expenseId);
    if (!matchingExpId) {
      return jsonResponse({ error: "Legacy expense claim not found" }, 404);
    }

    const match = await env.DB.prepare(`
      SELECT exp_id, user_id, status, level_first_approver, level_second_approver, total_amount 
      FROM expense_master WHERE exp_id = ?
    `).bind(matchingExpId).first();

    if (!match) {
      return jsonResponse({ error: "Legacy expense claim not found" }, 404);
    }

    const { exp_id, user_id: submitterId, status: currentStatus, level_first_approver: l1App, level_second_approver: l2App, total_amount: totalAmount } = match;
    const isL1 = (l1App === user.user_id);
    const isL2 = (l2App === user.user_id);

    if (submitterId && user.user_id && submitterId.toLowerCase() === user.user_id.toLowerCase()) {
      return jsonResponse({ error: "Self-approval of legacy expense claims is not permitted" }, 400);
    }

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

    if (pl.user_id && user.user_id && pl.user_id.toLowerCase() === user.user_id.toLowerCase()) {
      return jsonResponse({ error: "Self-approval of limit requests is not permitted" }, 400);
    }

    const isManager = pl.manager_id && (
      pl.manager_id.toLowerCase() === user.user_id.toLowerCase() ||
      (user.e_code && pl.manager_id.toLowerCase() === user.e_code.toLowerCase()) ||
      pl.manager_id.toLowerCase() === user.name.toLowerCase()
    );

    if (!isManager && user.role !== "Admin") {
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

  if (expense.user_id === user.id) {
    return jsonResponse({ error: "Self-approval of expense claims is not permitted" }, 400);
  }

  if (itinerary_edits && itinerary_edits.length > 0) {
    await applyItineraryEditsAndLog(env, expense, itinerary_edits, user, comments);
  }

  if (removed_attachments && Array.isArray(removed_attachments)) {
    await processRemovedAttachments(env, removed_attachments);
  }

  // Query all approvals to calculate next level before making any changes
  const allApprovals = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? ORDER BY level_number ASC").bind(expenseId).all();
  let nextApproval = null;
  for (const a of (allApprovals.results || [])) {
    if (a.level_number > activeApproval.level_number && a.status === "waiting") {
      nextApproval = a;
      break;
    }
  }

  let finalStatus = "approved";
  const statements = [
    {
      sql: "UPDATE approvals SET status = 'approved', comments = ?, updated_at = ? WHERE id = ?",
      params: [comments || "", timestamp, activeApproval.id]
    }
  ];

  if (nextApproval) {
    finalStatus = `submitted_l${nextApproval.level_number}`;
    statements.push({
      sql: "UPDATE approvals SET status = 'pending', created_at = ?, updated_at = ? WHERE id = ?",
      params: [timestamp, timestamp, nextApproval.id]
    });
  }

  statements.push({
    sql: "UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?",
    params: [finalStatus, timestamp, expenseId]
  });

  // Execute atomically in a single batch write transaction to prevent status mismatch on failure
  await runBatchWrite(env, statements);

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

  const { comments, client_timestamp, itinerary_edits, removed_attachments } = body;
  if (!comments || !comments.trim()) {
    return jsonResponse({ error: "Rejection comments/remark is mandatory" }, 400);
  }

  const timestamp = client_timestamp || new Date().toISOString();

  // 1. Handle Legacy Expense Rejection
  if (expenseId <= -200000) {
    const matchingExpId = await resolveLegacyExpenseId(env, expenseId);
    if (!matchingExpId) {
      return jsonResponse({ error: "Legacy claim not found" }, 404);
    }

    const match = await env.DB.prepare(`
      SELECT exp_id, user_id, status, level_first_approver, level_second_approver 
      FROM expense_master WHERE exp_id = ?
    `).bind(matchingExpId).first();

    if (!match) return jsonResponse({ error: "Legacy claim not found" }, 404);

    const { exp_id, user_id: submitterId, status: currentStatus, level_first_approver: l1App, level_second_approver: l2App } = match;
    const isL1 = (l1App === user.user_id);
    const isL2 = (l2App === user.user_id);

    if (submitterId && user.user_id && submitterId.toLowerCase() === user.user_id.toLowerCase()) {
      return jsonResponse({ error: "Self-rejection of legacy expense claims is not permitted" }, 400);
    }

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

    if (pl.user_id && user.user_id && pl.user_id.toLowerCase() === user.user_id.toLowerCase()) {
      return jsonResponse({ error: "Self-rejection of limit requests is not permitted" }, 400);
    }

    const isManager = pl.manager_id && (
      pl.manager_id.toLowerCase() === user.user_id.toLowerCase() ||
      (user.e_code && pl.manager_id.toLowerCase() === user.e_code.toLowerCase()) ||
      pl.manager_id.toLowerCase() === user.name.toLowerCase()
    );

    if (!isManager && user.role !== "Admin") {
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

  if (expense.user_id === user.id) {
    return jsonResponse({ error: "Self-rejection of expense claims is not permitted" }, 400);
  }

  if (itinerary_edits && itinerary_edits.length > 0) {
    await applyItineraryEditsAndLog(env, expense, itinerary_edits, user, comments);
  }

  if (removed_attachments && Array.isArray(removed_attachments)) {
    await processRemovedAttachments(env, removed_attachments);
  }

  const fallbackSettings = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'rejection_fallback_level'").first();
  const fallbackVal = fallbackSettings?.value || "creator";

  let nextStatus = "rejected";
  const statements = [
    {
      sql: "UPDATE approvals SET status = 'rejected', comments = ?, updated_at = ? WHERE id = ?",
      params: [comments, timestamp, activeApproval.id]
    }
  ];

  if (fallbackVal === "creator") {
    statements.push({
      sql: "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND level_number > ? AND status = 'waiting'",
      params: [timestamp, expenseId, activeApproval.level_number]
    });
    nextStatus = "rejected";
  } else if (fallbackVal === "level_1") {
    statements.push({
      sql: "UPDATE approvals SET status = CASE WHEN level_number = 1 THEN 'pending' ELSE 'waiting' END, comments = CASE WHEN level_number = 1 THEN '' ELSE comments END, updated_at = ? WHERE expense_id = ?",
      params: [timestamp, expenseId]
    });
    nextStatus = "submitted_l1";
  } else if (fallbackVal === "previous_level") {
    if (activeApproval.level_number > 1) {
      const prevLvl = activeApproval.level_number - 1;
      statements.push({
        sql: "UPDATE approvals SET status = CASE WHEN level_number = ? THEN 'pending' WHEN level_number >= ? THEN 'waiting' ELSE status END, comments = CASE WHEN level_number = ? THEN '' ELSE comments END, updated_at = ? WHERE expense_id = ?",
        params: [prevLvl, activeApproval.level_number, prevLvl, timestamp, expenseId]
      });
      nextStatus = `submitted_l${prevLvl}`;
    } else {
      statements.push({
        sql: "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND level_number > ? AND status = 'waiting'",
        params: [timestamp, expenseId, activeApproval.level_number]
      });
      nextStatus = "rejected";
    }
  }

  statements.push({
    sql: "UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?",
    params: [nextStatus, timestamp, expenseId]
  });

  await runBatchWrite(env, statements);

  // Send re-approval notification if returned to a level
  if (nextStatus !== "rejected") {
    const newPendingApp = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? AND status = 'pending'").bind(expenseId).first();
    if (newPendingApp) {
      const nextApproverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(newPendingApp.approver_id).first();
      if (nextApproverUser) {
        await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 Claim Returned for Re-approval', ?, 'warning', 0, '/approval-center', ?)", [
          nextApproverUser.user_id, `Claim ${expense.expense_code} has been returned to you for re-approval after rejection at a higher level.`, timestamp
        ]);
      }
    }
  }

  // Notification to submitter
  const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
  if (submitter) {
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      submitter.user_id, "❌ Expense Claim Rejected", `Your claim ${expense.expense_code} has been rejected by ${user.name}. Reason: ${comments.slice(0, 80)}`, "error", "/home", timestamp
    ]);
  }

  return jsonResponse({ status: "success", message: "Expense claim has been rejected." });
}

/**
 * POST /api/approvals/:expense_id/return-to-draft
 * Coordinator returns an expense to draft so the engineer can edit/resubmit
 */
export async function handleReturnToDraft(request, env, params, query, user) {
  // Only Coordinator role can return to draft (or Admin)
  const userRole = (user.role || "").trim();
  if (userRole !== "Coordinator" && userRole !== "Admin") {
    return jsonResponse({ error: "Only Coordinators can return expenses to draft." }, 403);
  }

  const expenseId = parseInt(params.expense_id, 10);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { comments, client_timestamp, removed_attachments } = body;
  if (!comments || !comments.trim()) {
    return jsonResponse({ error: "Comments/reason for returning is mandatory" }, 400);
  }

  const timestamp = client_timestamp || new Date().toISOString();

  // Verify coordinator has a pending approval on this expense
  const activeApproval = await env.DB.prepare(`
    SELECT * FROM approvals WHERE expense_id = ? AND approver_id = ? AND status = 'pending'
  `).bind(expenseId, user.id).first();

  if (!activeApproval) {
    return jsonResponse({ error: "No pending approval task found for you on this claim" }, 400);
  }

  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) return jsonResponse({ error: "Expense claim not found" }, 404);

  if (expense.user_id === user.id) {
    return jsonResponse({ error: "Cannot return your own expense claim" }, 400);
  }

  if (removed_attachments && Array.isArray(removed_attachments)) {
    await processRemovedAttachments(env, removed_attachments);
  }

  const statements = [
    {
      sql: "UPDATE approvals SET status = 'returned', comments = ?, updated_at = ? WHERE id = ?",
      params: [comments, timestamp, activeApproval.id]
    },
    {
      sql: "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND id != ? AND status IN ('approved', 'waiting', 'pending')",
      params: [timestamp, expenseId, activeApproval.id]
    },
    {
      sql: "UPDATE expenses SET status = 'returned_to_draft', updated_at = ? WHERE id = ?",
      params: [timestamp, expenseId]
    }
  ];

  await runBatchWrite(env, statements);

  // Notify the engineer
  const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
  if (submitter) {
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      submitter.user_id,
      "🔄 Claim Returned for Corrections",
      `Your claim ${expense.expense_code} has been returned by ${user.name} for corrections. Reason: ${comments.slice(0, 100)}`,
      "warning",
      "/submit-expense",
      timestamp
    ]);
  }

  return jsonResponse({ status: "success", message: "Expense claim has been returned to draft for corrections." });
}

async function processRemovedAttachments(env, removedAttachments) {
  if (!removedAttachments || !Array.isArray(removedAttachments) || removedAttachments.length === 0) {
    return;
  }
  for (const url of removedAttachments) {
    if (!url) continue;
    console.log("Removing attachment from DB:", url);
    await runWrite(env, "DELETE FROM expense_attachments WHERE file_url = ?", [url]);
    await deleteAttachmentFromStorage(env, url);
  }
}

async function deleteAttachmentFromStorage(env, fileUrl) {
  try {
    if (!fileUrl) return;

    // 1. Google Drive deletion
    if (fileUrl.includes("/gdrive/")) {
      const fileId = fileUrl.split("/gdrive/").pop();
      if (fileId) {
        console.log("Deleting attachment from GDrive:", fileId);
        await deleteFromGoogleDrive(env, fileId);
      }
      return;
    }

    // 2. R2 / Cloudflare bucket deletion
    let key = "";
    if (fileUrl.includes("/file/")) {
      key = fileUrl.split("/file/").pop();
    } else {
      const match = fileUrl.match(/\/expense_attachments\/[^\/]+$/);
      if (match) {
        key = match[0].substring(1);
      }
    }

    if (key) {
      if (env.BUCKET && typeof env.BUCKET.delete === "function") {
        await env.BUCKET.delete(key);
        console.log("Deleted object from R2:", key);
      } else if (env.PRIMARY_CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
        const accountId = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
        const apiToken = env.CLOUDFLARE_API_TOKEN;
        const bucketName = "fieldops-uploads";
        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;
        await fetch(url, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${apiToken}`
          }
        });
        console.log("Deleted object from R2 via REST API:", key);
      }
    }
  } catch (e) {
    console.error("Failed to delete attachment from storage:", e.message);
  }
}

/**
 * Scheduled background job: Scan pending approvals and apply auto-expiry (approve/reject).
 * This can be run via Cloudflare Scheduled event or triggered manually by Admin.
 */
export async function handleAutoApprovalExpiry(env) {
  const timestamp = new Date().toISOString();
  
  // 1. Get auto-expiry settings
  const settingsRows = await env.DB.prepare(
    "SELECT key, value FROM system_settings WHERE key IN ('pending_auto_expiry_days', 'pending_auto_action')"
  ).all();
  
  let expiryDays = null;
  let autoAction = null;
  
  for (const row of (settingsRows.results || [])) {
    if (row.key === "pending_auto_expiry_days") expiryDays = parseInt(row.value, 10);
    if (row.key === "pending_auto_action") autoAction = row.value;
  }
  
  if (expiryDays === null || expiryDays <= 0 || !autoAction) {
    return { success: true, message: "Auto-expiry settings disabled or not configured." };
  }
  
  // 2. Fetch all pending approvals
  const pendingApprovals = await env.DB.prepare(
    "SELECT a.*, e.expense_code, e.user_id as submitter_user_id FROM approvals a JOIN expenses e ON a.expense_id = e.id WHERE a.status = 'pending'"
  ).all();
  
  const results = [];
  
  for (const app of (pendingApprovals.results || [])) {
    const updatedAt = new Date(app.updated_at || app.created_at);
    const diffTime = new Date().getTime() - updatedAt.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays >= expiryDays) {
      // Expiry threshold reached, action this approval!
      try {
        if (autoAction === "approve") {
          // AUTO-APPROVE
          // Query next level
          const allApprovals = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? ORDER BY level_number ASC").bind(app.expense_id).all();
          let nextApproval = null;
          for (const a of (allApprovals.results || [])) {
            if (a.level_number > app.level_number && a.status === "waiting") {
              nextApproval = a;
              break;
            }
          }
          
          let finalStatus = "approved";
          const statements = [
            {
              sql: "UPDATE approvals SET status = 'approved', comments = ?, updated_at = ? WHERE id = ?",
              params: [`System Auto-Approved after ${expiryDays} days`, timestamp, app.id]
            }
          ];
          
          if (nextApproval) {
            finalStatus = `submitted_l${nextApproval.level_number}`;
            statements.push({
              sql: "UPDATE approvals SET status = 'pending', created_at = ?, updated_at = ? WHERE id = ?",
              params: [timestamp, timestamp, nextApproval.id]
            });
          }
          
          statements.push({
            sql: "UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?",
            params: [finalStatus, timestamp, app.expense_id]
          });
          
          await runBatchWrite(env, statements);
          
          // Notifications
          const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(app.submitter_user_id).first();
          if (submitter) {
            if (finalStatus === "approved") {
              await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '✅ Claim Auto-Approved', ?, 'success', 0, '/home', ?)", [
                submitter.user_id, `Your claim ${app.expense_code} has been auto-approved by the system.`, timestamp
              ]);
            } else {
              await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '🔄 Claim Auto-Forwarded', ?, 'info', 0, '/home', ?)", [
                submitter.user_id, `Your claim ${app.expense_code} has been auto-approved at Level ${app.level_number} and forwarded to the next level.`, timestamp
              ]);
            }
          }
          
          if (nextApproval) {
            const nextApproverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(nextApproval.approver_id).first();
            if (nextApproverUser) {
              await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 Pending Auto-Approval', ?, 'warning', 0, '/approval-center', ?)", [
                nextApproverUser.user_id, `Claim ${app.expense_code} has been auto-forwarded to you for review.`, timestamp
              ]);
            }
          }
          results.push(`Auto-approved expense ${app.expense_id} at level ${app.level_number}`);
          
        } else if (autoAction === "reject") {
          // AUTO-REJECT
          const fallbackSettings = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'rejection_fallback_level'").first();
          const fallbackVal = fallbackSettings?.value || "creator";
          
          const statements = [
            {
              sql: "UPDATE approvals SET status = 'rejected', comments = ?, updated_at = ? WHERE id = ?",
              params: [`System Auto-Rejected after ${expiryDays} days`, timestamp, app.id]
            }
          ];
          
          let nextStatus = "rejected";
          
          if (fallbackVal === "creator") {
            statements.push({
              sql: "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND level_number > ? AND status = 'waiting'",
              params: [timestamp, app.expense_id, app.level_number]
            });
            nextStatus = "rejected";
          } else if (fallbackVal === "level_1") {
            statements.push({
              sql: "UPDATE approvals SET status = CASE WHEN level_number = 1 THEN 'pending' ELSE 'waiting' END, comments = CASE WHEN level_number = 1 THEN '' ELSE comments END, updated_at = ? WHERE expense_id = ?",
              params: [timestamp, app.expense_id]
            });
            nextStatus = "submitted_l1";
          } else if (fallbackVal === "previous_level") {
            if (app.level_number > 1) {
              const prevLvl = app.level_number - 1;
              statements.push({
                sql: "UPDATE approvals SET status = CASE WHEN level_number = ? THEN 'pending' WHEN level_number >= ? THEN 'waiting' ELSE status END, comments = CASE WHEN level_number = ? THEN '' ELSE comments END, updated_at = ? WHERE expense_id = ?",
                params: [prevLvl, app.level_number, prevLvl, timestamp, app.expense_id]
              });
              nextStatus = `submitted_l${prevLvl}`;
            } else {
              statements.push({
                sql: "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND level_number > ? AND status = 'waiting'",
                params: [timestamp, app.expense_id, app.level_number]
              });
              nextStatus = "rejected";
            }
          }
          
          statements.push({
            sql: "UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?",
            params: [nextStatus, timestamp, app.expense_id]
          });
          
          await runBatchWrite(env, statements);
          
          // Send re-approval notification if returned to a level
          if (nextStatus !== "rejected") {
            const newPendingApp = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? AND status = 'pending'").bind(app.expense_id).first();
            if (newPendingApp) {
              const nextApproverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(newPendingApp.approver_id).first();
              if (nextApproverUser) {
                await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 Claim Returned for Re-approval', ?, 'warning', 0, '/approval-center', ?)", [
                  nextApproverUser.user_id, `Claim ${app.expense_code} has been returned to you for re-approval after rejection at a higher level.`, timestamp
                ]);
              }
            }
          }
          
          // Notification to submitter
          const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(app.submitter_user_id).first();
          if (submitter) {
            await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '❌ Claim Auto-Rejected', ?, 'error', 0, '/home', ?)", [
              submitter.user_id, `Your claim ${app.expense_code} has been auto-rejected by the system.`, timestamp
            ]);
          }
          results.push(`Auto-rejected expense ${app.expense_id} at level ${app.level_number} (fallback: ${fallbackVal})`);
        }
      } catch (ex) {
        console.error(`Auto-expiry failed for approval ${app.id}:`, ex.message);
      }
    }
  }
  return { success: true, processed: results };
}


