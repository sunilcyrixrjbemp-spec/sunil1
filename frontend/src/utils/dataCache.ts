/**
 * Ultra-Fast Stale-While-Revalidate (SWR) Client Caching Layer
 * Provides Amazon-grade instant page loads (<50ms) by serving memory/session-cached data
 * while revalidating fresh payloads asynchronously in the background.
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
  version: number;
}

const memoryCache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default fresh TTL
const MAX_STALE_TTL = 24 * 60 * 60 * 1000; // Up to 24 hours stale data allowed for instant renders
const CACHE_PREFIX = "cyrix_swr_";

export const dataCache = {
  /**
   * Get cached data synchronously.
   * Returns data immediately if available (even if stale), along with a `isStale` flag.
   */
  get<T = any>(key: string): { data: T | null; isStale: boolean } {
    const fullKey = `${CACHE_PREFIX}${key}`;

    // 1. Try In-Memory cache first (fastest, 0ms)
    if (memoryCache.has(fullKey)) {
      const entry = memoryCache.get(fullKey)!;
      const now = Date.now();
      const age = now - entry.timestamp;

      if (age < entry.ttl) {
        return { data: entry.data, isStale: false };
      }
      if (age < MAX_STALE_TTL) {
        return { data: entry.data, isStale: true };
      }
      memoryCache.delete(fullKey);
    }

    // 2. Try sessionStorage fallback
    try {
      const stored = sessionStorage.getItem(fullKey);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        const now = Date.now();
        const age = now - entry.timestamp;

        // Restore to memory cache
        memoryCache.set(fullKey, entry);

        if (age < entry.ttl) {
          return { data: entry.data, isStale: false };
        }
        if (age < MAX_STALE_TTL) {
          return { data: entry.data, isStale: true };
        }
        sessionStorage.removeItem(fullKey);
      }
    } catch (_) {
      // Ignore sessionStorage parsing or quota errors
    }

    return { data: null, isStale: true };
  },

  /**
   * Store data in cache
   */
  set<T = any>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    if (data === undefined || data === null) return;
    const fullKey = `${CACHE_PREFIX}${key}`;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version: 1,
    };

    // Store in memory
    memoryCache.set(fullKey, entry);

    // Store in sessionStorage safely (with size limitation safeguard)
    try {
      const serialized = JSON.stringify(entry);
      if (serialized.length < 500000) { // Keep under 500KB per item
        sessionStorage.setItem(fullKey, serialized);
      }
    } catch (e) {
      // If sessionStorage quota exceeded, clear stale entries
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(CACHE_PREFIX)) keysToRemove.push(k);
        }
        keysToRemove.forEach((k) => sessionStorage.removeItem(k));
      } catch (_) {}
    }
  },

  /**
   * Invalidate specific keys or patterns (e.g. after a mutation or approval)
   */
  invalidate(pattern?: string | RegExp): void {
    if (!pattern) {
      memoryCache.clear();
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(k);
        }
      } catch (_) {}
      return;
    }

    // Invalidate by regex or prefix match
    const reg = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    memoryCache.forEach((_, k) => {
      if (reg.test(k)) memoryCache.delete(k);
    });

    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && reg.test(k)) sessionStorage.removeItem(k);
      }
    } catch (_) {}
  },
};

/**
 * Higher-order async fetcher with Stale-While-Revalidate (SWR) support.
 * Serves cached result immediately to callback, while resolving promise with fresh network result.
 */
export async function swrFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    onCached?: (data: T) => void;
    forceRefresh?: boolean;
  } = {}
): Promise<T> {
  const { ttl = DEFAULT_TTL, onCached, forceRefresh = false } = options;

  // 1. Check cache if not forcing refresh
  if (!forceRefresh) {
    const cached = dataCache.get<T>(cacheKey);
    if (cached.data) {
      if (onCached) onCached(cached.data);
      // If data is fresh, return immediately without network call
      if (!cached.isStale) {
        return cached.data;
      }
    }
  }

  // 2. Fetch fresh from network in background / foreground
  try {
    const freshData = await fetcher();
    dataCache.set(cacheKey, freshData, ttl);
    return freshData;
  } catch (error) {
    // If network fails but we had cached data, fall back to cached data gracefully
    const cached = dataCache.get<T>(cacheKey);
    if (cached.data) {
      return cached.data;
    }
    throw error;
  }
}
