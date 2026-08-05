/**
 * ============================================================
 * Enterprise Timestamp Utilities
 * Cyrix Field Connect — Worker Backend
 * ============================================================
 * Single source of truth for all timestamp/date operations.
 * Import from here — do NOT define local parseClientTimestamp().
 * ============================================================
 */

/**
 * Parse a client-submitted timestamp string to a valid ISO 8601 UTC string.
 * Handles multiple formats including IST (+05:30), UTC (Z), and space-separated.
 *
 * @param {string|null} raw - Raw timestamp string from client
 * @returns {string} - Valid ISO 8601 UTC timestamp
 */
export function parseClientTimestamp(raw) {
  if (!raw) return new Date().toISOString();
  let str = String(raw).trim();

  // Already has timezone info — parse directly
  if (str.endsWith("Z") || str.includes("+") || /T\d{2}:\d{2}:\d{2}.*-/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Space-separated datetime without timezone — assume IST
  if (str.includes(" ") && !str.includes("T")) {
    str = str.replace(" ", "T") + "+05:30";
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Fallback — try direct parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();

  // Last resort — use server time
  return new Date().toISOString();
}

/**
 * Get current time as ISO 8601 UTC string.
 * @returns {string}
 */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * Get current time in IST (UTC+5:30) as ISO string.
 * @returns {string}
 */
export function nowIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().replace("Z", "+05:30");
}

/**
 * Format a date as a human-readable IST string.
 * Example: "05 Aug 2026 10:30 AM IST"
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDateIST(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Date";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) + " IST";
}

/**
 * Format date as YYYYMMDD for filenames.
 * @param {Date|string} date
 * @returns {string} e.g. "20260805"
 */
export function formatDateCompact(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Format time as HHmmss for filenames.
 * @param {Date|string} date
 * @returns {string} e.g. "104520"
 */
export function formatTimeCompact(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "000000";
  return d.toISOString().slice(11, 19).replace(/:/g, "");
}

/**
 * Get the IST-adjusted date/time components for R2 folder path generation.
 * Returns { year, monthNum (1-12), monthName, monthPadded ("01"..."12") }
 * @param {Date|string|null} date - date to use (default: now)
 */
export function getISTDateComponents(date = null) {
  const d = date ? (typeof date === "string" ? new Date(date) : date) : new Date();
  // Shift to IST
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const monthNum = ist.getUTCMonth() + 1;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthName = monthNames[monthNum - 1];
  const monthPadded = String(monthNum).padStart(2, "0");
  return { year, monthNum, monthName, monthPadded };
}

/**
 * Check if a timestamp is expired (older than maxAgeMs milliseconds).
 * @param {string} timestamp - ISO timestamp to check
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {boolean}
 */
export function isExpired(timestamp, maxAgeMs) {
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return true;
  return Date.now() - then > maxAgeMs;
}

/**
 * Add seconds to a date and return ISO string.
 * @param {Date|string|null} from - Start date (default: now)
 * @param {number} seconds
 * @returns {string} ISO timestamp
 */
export function addSeconds(from, seconds) {
  const d = from ? new Date(from) : new Date();
  return new Date(d.getTime() + seconds * 1000).toISOString();
}

/**
 * Add hours to a date and return ISO string.
 * @param {Date|string|null} from - Start date (default: now)
 * @param {number} hours
 * @returns {string} ISO timestamp
 */
export function addHours(from, hours) {
  return addSeconds(from, hours * 3600);
}

/**
 * Add days to a date and return ISO string.
 * @param {Date|string|null} from - Start date (default: now)
 * @param {number} days
 * @returns {string} ISO timestamp
 */
export function addDays(from, days) {
  return addSeconds(from, days * 86400);
}
