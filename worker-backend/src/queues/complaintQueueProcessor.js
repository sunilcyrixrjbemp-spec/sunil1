/**
 * ============================================================
 * Complaint Queue Processor (Cloudflare Queues & Background)
 * Cyrix Field Connect — Cloudflare Worker Backend
 * ============================================================
 * Streams large CSV/XLSX files directly from R2, processes in bounded batches,
 * updates complaint_upload_jobs live progress, and executes locked upsert statements.
 */

import { staticLog } from "../utils/logger.js";
import { LOCKED_COMPLAINT_UPSERT_SQL, mapRowToComplaintParams } from "../routes/complaints.js";

// Helper: Parse CSV text into arrays of columns
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Process a single complaint upload job directly or from queue message
 */
export async function processComplaintJobDirectly(jobId, fileKey, uploaderId, env) {
  staticLog.info("Starting complaint upload job processing", { jobId, fileKey });

  if (!env.R2_BUCKET || !env.DB) {
    staticLog.error("Missing R2_BUCKET or DB binding in complaint queue processor", { jobId });
    return;
  }

  const r2Object = await env.R2_BUCKET.get(fileKey);
  if (!r2Object) {
    staticLog.error("Complaint file not found in R2", { fileKey });
    await env.DB.prepare(`
      UPDATE complaint_upload_jobs 
      SET status = 'failed', error_message = 'File not found in R2 storage', updated_at = datetime('now')
      WHERE job_id = ?
    `).bind(jobId).run();
    return;
  }

  try {
    const text = await r2Object.text();
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    if (rawLines.length <= 1) {
      await env.DB.prepare(`
        UPDATE complaint_upload_jobs 
        SET status = 'completed', total_rows = 0, processed_rows = 0, updated_at = datetime('now')
        WHERE job_id = ?
      `).bind(jobId).run();
      return;
    }

    // First line is headers
    const headerLine = rawLines[0];
    const headers = parseCsvLine(headerLine);
    const dataLines = rawLines.slice(1);
    const totalRows = dataLines.length;

    await env.DB.prepare(`
      UPDATE complaint_upload_jobs 
      SET total_rows = ?, status = 'processing', updated_at = datetime('now')
      WHERE job_id = ?
    `).bind(totalRows, jobId).run();

    const BATCH_SIZE = 1000;
    let totalProcessed = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkippedFinalClosed = 0;
    let totalSkippedInvalid = 0;

    const stmtTemplate = env.DB.prepare(LOCKED_COMPLAINT_UPSERT_SQL);

    for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
      const slice = dataLines.slice(i, i + BATCH_SIZE);
      const batchRowParams = [];
      const batchComplaintIds = [];

      for (const line of slice) {
        const cols = parseCsvLine(line);
        // Build row object
        const rowObj = {};
        headers.forEach((h, idx) => {
          rowObj[h] = cols[idx] !== undefined ? cols[idx] : "";
        });

        const params = mapRowToComplaintParams(rowObj, uploaderId);
        if (!params) {
          totalSkippedInvalid++;
        } else {
          batchRowParams.push(params);
          batchComplaintIds.push(params[0]);
        }
      }

      if (batchRowParams.length > 0) {
        // Query existing status in slices of 500 for stats
        const existingMap = new Map();
        for (let j = 0; j < batchComplaintIds.length; j += 500) {
          const idSlice = batchComplaintIds.slice(j, j + 500);
          const placeholders = idSlice.map(() => "?").join(",");
          const existingRows = await env.DB.prepare(`
            SELECT complaint_id, complaint_status FROM complaints WHERE complaint_id IN (${placeholders})
          `).bind(...idSlice).all();

          for (const er of (existingRows.results || [])) {
            existingMap.set(String(er.complaint_id), String(er.complaint_status || "").trim());
          }
        }

        for (const params of batchRowParams) {
          const cId = params[0];
          if (existingMap.has(cId)) {
            const currentDbStatus = existingMap.get(cId);
            if (currentDbStatus === "Final Closed") {
              totalSkippedFinalClosed++;
            } else {
              totalUpdated++;
            }
          } else {
            totalInserted++;
          }
        }

        // Execute batch D1 statements (chunk into 500 statements per D1 batch)
        for (let k = 0; k < batchRowParams.length; k += 500) {
          const subSlice = batchRowParams.slice(k, k + 500);
          const stmts = subSlice.map(p => stmtTemplate.bind(...p));
          await env.DB.batch(stmts);
        }
      }

      totalProcessed += slice.length;

      // Update progress in database
      await env.DB.prepare(`
        UPDATE complaint_upload_jobs 
        SET processed_rows = ?, inserted_rows = ?, updated_rows = ?,
            skipped_final_closed = ?, skipped_invalid = ?, updated_at = datetime('now')
        WHERE job_id = ?
      `).bind(
        totalProcessed, totalInserted, totalUpdated,
        totalSkippedFinalClosed, totalSkippedInvalid, jobId
      ).run();
    }

    // Mark job as completed
    await env.DB.prepare(`
      UPDATE complaint_upload_jobs 
      SET status = 'completed', processed_rows = total_rows, updated_at = datetime('now')
      WHERE job_id = ?
    `).bind(jobId).run();

    staticLog.info("Complaint upload job completed successfully", {
      jobId, totalRows, totalInserted, totalUpdated, totalSkippedFinalClosed, totalSkippedInvalid
    });
  } catch (err) {
    staticLog.error("Error processing complaint upload job", { jobId, error: err.message });
    await env.DB.prepare(`
      UPDATE complaint_upload_jobs 
      SET status = 'failed', error_message = ?, updated_at = datetime('now')
      WHERE job_id = ?
    `).bind(err.message || "Unknown processing error", jobId).run().catch(() => {});
  }
}

/**
 * Queue Batch Processor for Cloudflare Queues
 */
export async function processComplaintQueueBatch(batch, env) {
  for (const message of batch.messages) {
    try {
      const job = message.body;
      if (job && job.type === "complaint_upload_job") {
        await processComplaintJobDirectly(job.job_id, job.file_key, job.uploaded_by, env);
      }
      message.ack();
    } catch (e) {
      staticLog.error("Complaint queue message retry", { error: e.message });
      message.retry();
    }
  }
}
