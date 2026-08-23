/**
 * Cloudflare Queue Consumer for Bulk PDF Generation
 */
import { generateSinglePdf } from "../routes/pdfExport.js";
import { Logger } from "../utils/logger.js";

export async function processPdfBatch(batch, env) {
  const log = new Logger(env, "pdf-queue-consumer");
  log.info(`Processing PDF generation batch of ${batch.messages.length} items`);

  for (const message of batch.messages) {
    const { batchId, employeeCode, month, year } = message.body || {};
    if (!employeeCode || !month) {
      message.ack();
      continue;
    }

    try {
      await generateSinglePdf(env, employeeCode, month, year);
    } catch (err) {
      console.error(`PDF generation failed for ${employeeCode}:`, err.message);
      log.error(`PDF generation error for ${employeeCode}`, { error: err.message });
    }

    // Update batch progress in KV
    if (env.PDF_PROGRESS_KV && batchId) {
      try {
        const raw = await env.PDF_PROGRESS_KV.get(`pdf_batch:${batchId}`);
        if (raw) {
          const progress = JSON.parse(raw);
          progress.done = (progress.done || 0) + 1;
          if (progress.done >= progress.total) {
            progress.status = "complete";
            progress.completeTime = Date.now();
          }
          await env.PDF_PROGRESS_KV.put(`pdf_batch:${batchId}`, JSON.stringify(progress), { expirationTtl: 86400 });
        }
      } catch (kvErr) {
        console.warn("Failed to update PDF batch progress in KV:", kvErr.message);
      }
    }

    message.ack();
  }
}
