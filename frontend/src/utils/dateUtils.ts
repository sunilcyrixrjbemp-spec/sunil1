/**
 * 🔒 STRICT IST TIMEZONE (Asia/Kolkata, UTC+5:30) DATE UTILITIES
 * Enforces that all dates generated on the frontend use Indian Standard Time (IST),
 * preventing device UTC off-by-one errors during late-night or early-morning claims.
 */

/**
 * Returns current date in YYYY-MM-DD format strictly in IST (Asia/Kolkata) timezone.
 */
export function getISTDate(dateObj: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(dateObj); // YYYY-MM-DD
  } catch (err) {
    // Fallback if Intl fails
    const offsetMs = 5.5 * 60 * 60 * 1000; // +5:30 IST offset
    const istDate = new Date(dateObj.getTime() + offsetMs);
    return istDate.toISOString().slice(0, 10);
  }
}

/**
 * Returns current month in YYYY-MM format strictly in IST (Asia/Kolkata) timezone.
 */
export function getISTMonth(dateObj: Date = new Date()): string {
  return getISTDate(dateObj).slice(0, 7); // YYYY-MM
}

/**
 * Returns current timestamp in YYYY-MM-DD HH:mm:ss format strictly in IST (Asia/Kolkata) timezone.
 */
export function getISTTimestamp(dateObj: Date = new Date()): string {
  try {
    const dateStr = getISTDate(dateObj);
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return `${dateStr} ${timeFormatter.format(dateObj)}`;
  } catch (err) {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
}
