/**
 * safeStorage.ts
 * Safe wrapper around browser localStorage to prevent QuotaExceededError crashes.
 */

export const safeStorageSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    console.warn(`[safeStorage] QuotaExceeded error when setting key "${key}". Purging old caches...`);
    try {
      // Purge stale cache keys to free up space in browser localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("cache_") || k.startsWith("analysis_"))) {
          if (k !== key) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      
      // Retry setItem after clearing space
      localStorage.setItem(key, value);
    } catch (retryErr) {
      console.warn(`[safeStorage] Could not set "${key}" even after purging cache:`, retryErr);
    }
  }
};
