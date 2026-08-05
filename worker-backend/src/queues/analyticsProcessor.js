/**
 * ============================================================
 * Analytics Queue Processor
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Processes analytics events in batches:
 *   - Batch insert into analytics_events table
 *   - Aggregate into system_metrics
 *   - Forward high-priority events to GA Measurement Protocol
 * ============================================================
 */

import { staticLog } from "../utils/logger.js";
import { nowISO } from "../utils/timestamp.js";

/**
 * Process a batch of analytics queue messages.
 * Each message: { type: "event"|"error_log"|"metric", payload: {...} }
 */
export async function processAnalyticsBatch(batch, env) {
  const events = [];
  const metrics = [];
  const errorLogs = [];

  for (const message of batch.messages) {
    try {
      const msg = message.body;

      if (msg.type === "event") {
        events.push(msg.payload);
      } else if (msg.type === "metric") {
        metrics.push(msg.payload);
      } else if (msg.type === "error_log") {
        errorLogs.push(msg.payload);
        // Escalate to analytics_events too
        events.push({
          eventType: "error",
          eventName: "server_error",
          userId: msg.payload.userId,
          durationMs: msg.payload.elapsedMs,
          metadataJson: JSON.stringify({
            message: msg.payload.message,
            requestId: msg.payload.requestId,
          }),
        });
      }
    } catch (e) {
      staticLog.error("Failed to parse analytics queue message", { error: e.message });
    }
  }

  // Batch insert analytics events
  if (events.length > 0 && env.DB) {
    await batchInsertEvents(env.DB, events);
  }

  // Batch insert metrics
  if (metrics.length > 0 && env.DB) {
    await batchInsertMetrics(env.DB, metrics);
  }

  batch.ackAll();
  staticLog.info("Analytics batch processed", {
    events: events.length,
    metrics: metrics.length,
    errors: errorLogs.length,
  });
}

async function batchInsertEvents(db, events) {
  const now = nowISO();
  const stmts = events.map(e =>
    db.prepare(`
      INSERT INTO analytics_events (
        event_type, event_name, user_id, session_id,
        page_url, device_type, country, ip_hash,
        duration_ms, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      e.eventType || "unknown",
      e.eventName || "unknown",
      e.userId || null,
      e.sessionId || null,
      e.pageUrl || null,
      e.deviceType || null,
      e.country || null,
      e.ipHash || null,
      e.durationMs || null,
      e.metadataJson || null,
      e.createdAt || now,
    )
  );

  try {
    // D1 batch — max 100 statements
    const chunks = [];
    for (let i = 0; i < stmts.length; i += 100) chunks.push(stmts.slice(i, i + 100));
    for (const chunk of chunks) await db.batch(chunk);
  } catch (e) {
    staticLog.error("Batch insert analytics_events failed", { error: e.message, count: events.length });
  }
}

async function batchInsertMetrics(db, metrics) {
  const now = nowISO();
  const stmts = metrics.map(m =>
    db.prepare(`
      INSERT INTO system_metrics (metric_type, metric_name, metric_value, unit, tags_json, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      m.metricType || "custom",
      m.metricName || "unknown",
      m.metricValue || 0,
      m.unit || "count",
      m.tagsJson || null,
      m.recordedAt || now,
    )
  );
  try {
    const chunks = [];
    for (let i = 0; i < stmts.length; i += 100) chunks.push(stmts.slice(i, i + 100));
    for (const chunk of chunks) await db.batch(chunk);
  } catch (e) {
    staticLog.error("Batch insert system_metrics failed", { error: e.message });
  }
}

// ─── Event Tracking Utility ───────────────────────────────────────────────────

/**
 * Track an analytics event.
 * Non-blocking — fires into queue and continues.
 *
 * @param {Object} env - Worker env (needs ANALYTICS_QUEUE)
 * @param {Object} eventData - { eventType, eventName, userId, sessionId, metadata }
 */
export function trackEvent(env, eventData) {
  if (!env.ANALYTICS_QUEUE) return;
  if (env.ENABLE_ANALYTICS_TRACKING === "false") return;

  // Fire and forget — never blocks request
  env.ANALYTICS_QUEUE.send({
    type: "event",
    payload: {
      eventType: eventData.eventType || "app",
      eventName: eventData.eventName || "unknown",
      userId: eventData.userId || null,
      sessionId: eventData.sessionId || null,
      pageUrl: eventData.pageUrl || null,
      deviceType: eventData.deviceType || null,
      country: eventData.country || null,
      ipHash: eventData.ipHash || null,
      durationMs: eventData.durationMs || null,
      metadataJson: eventData.metadata ? JSON.stringify(eventData.metadata) : null,
      createdAt: nowISO(),
    },
  }).catch(() => {/* swallow — analytics must never crash the app */});
}

/**
 * Track a system metric.
 * @param {Object} env
 * @param {string} metricType
 * @param {string} metricName
 * @param {number} metricValue
 * @param {string} unit
 */
export function trackMetric(env, metricType, metricName, metricValue, unit = "count") {
  if (!env.ANALYTICS_QUEUE) return;

  env.ANALYTICS_QUEUE.send({
    type: "metric",
    payload: { metricType, metricName, metricValue, unit, recordedAt: nowISO() },
  }).catch(() => {});
}
