/**
 * Timezone Utility for India Standard Time (IST - Asia/Kolkata)
 * Pure TypeScript / JavaScript - Zero external dependencies
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Safely parses any date string, timestamp, or Date object into a valid Date object.
 */
function parseDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // Handle epoch numeric string or number
  if (typeof input === 'number' || (typeof input === 'string' && /^\d+$/.test(input))) {
    const num = Number(input);
    const date = new Date(num < 1e11 ? num * 1000 : num);
    return isNaN(date.getTime()) ? null : date;
  }

  let str = String(input).trim();
  
  // If format is YYYY-MM-DD HH:mm:ss without T or Z, replace space with T and append Z if needed
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(str)) {
    str = str + 'Z';
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 1. Formats a UTC date string or Date object into IST string (DD/MM/YYYY HH:mm:ss)
 * @example formatToIST("2026-07-28T15:30:22.000Z") => "28/07/2026 21:00:22"
 */
export function formatToIST(utcInput: string | number | Date | null | undefined): string {
  const date = parseDate(utcInput);
  if (!date) return 'N/A';

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    parts.forEach(p => { partMap[p.type] = p.value; });

    return `${partMap.day}/${partMap.month}/${partMap.year} ${partMap.hour}:${partMap.minute}:${partMap.second}`;
  } catch (err) {
    return 'N/A';
  }
}

/**
 * 2. Gets the current live time in IST format (DD/MM/YYYY HH:mm:ss)
 */
export function getCurrentTimeIST(): string {
  return formatToIST(new Date());
}

/**
 * 3. Gets current time in UTC ISO format (for sending to backend API)
 * @example getCurrentTimeUTC() => "2026-07-28T15:30:22.000Z"
 */
export function getCurrentTimeUTC(): string {
  return new Date().toISOString();
}

/**
 * 4. Formats date into custom IST representation
 * Modes:
 * - 'short': "28 Jul 21:00"
 * - 'long': "28 July 2026 21:00:22"
 * - 'full': "Monday, 28 July 2026 09:00:22 PM IST"
 * - 'time': "21:00:22 IST"
 * - '12h': "28/07/2026 09:00:22 PM"
 * - 'default': "28/07/2026 21:00:22"
 */
export function formatCustomIST(
  utcInput: string | number | Date | null | undefined,
  formatType: 'short' | 'long' | 'full' | 'time' | '12h' | 'default' = 'default'
): string {
  const date = parseDate(utcInput);
  if (!date) return 'N/A';

  try {
    if (formatType === 'short') {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIMEZONE,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);
    }

    if (formatType === 'long') {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIMEZONE,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
    }

    if (formatType === 'full') {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIMEZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(date) + ' IST';
    }

    if (formatType === 'time') {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date) + ' IST';
    }

    if (formatType === '12h') {
      const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      return formatter.format(date);
    }

    return formatToIST(date);
  } catch (err) {
    return 'N/A';
  }
}

/**
 * 5. Returns human-readable relative time (e.g. "2 hours ago", "3 days ago")
 */
export function getTimeAgoIST(utcInput: string | number | Date | null | undefined): string {
  const date = parseDate(utcInput);
  if (!date) return 'N/A';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} mo ago`;

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}
