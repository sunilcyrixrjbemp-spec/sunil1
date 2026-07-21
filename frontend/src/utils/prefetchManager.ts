import { expenseService } from "../services/expenseService";
import { approvalService } from "../services/approvalService";

interface CacheEntry {
  data: any;
  timestamp: number;
}

const memoryCache: Record<string, CacheEntry> = {};

// Helper to get current month key in YYYY-MM format to match selectMonth initial value
const getCurrentMonthKey = () => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const prefetchManager = {
  getOrFetch: async <T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number = 30000
  ): Promise<T> => {
    const cached = memoryCache[key];
    const now = Date.now();
    
    if (cached && (now - cached.timestamp < ttlMs)) {
      console.log(`[PrefetchManager] Cache HIT for key: ${key}`);
      return cached.data as T;
    }
    
    console.log(`[PrefetchManager] Cache MISS/STALE for key: ${key}. Fetching fresh...`);
    const data = await fetchFn();
    memoryCache[key] = { data, timestamp: now };
    return data;
  },

  prefetch: async (key: string, fetchFn: () => Promise<any>) => {
    const now = Date.now();
    try {
      const data = await fetchFn();
      memoryCache[key] = { data, timestamp: now };
      console.log(`[PrefetchManager] Prefetched key successfully: ${key}`);
    } catch (e) {
      console.warn(`[PrefetchManager] Prefetch failed for key: ${key}`, e);
    }
  },

  isFresh: (key: string, ttlMs: number = 30000): boolean => {
    const cached = memoryCache[key];
    if (!cached) return false;
    return (Date.now() - cached.timestamp) < ttlMs;
  },

  invalidate: (key: string) => {
    delete memoryCache[key];
    console.log(`[PrefetchManager] Invalidated key: ${key}`);
  },

  clearAll: () => {
    Object.keys(memoryCache).forEach((k) => delete memoryCache[k]);
    console.log("[PrefetchManager] Cleared all memory cache");
  },

  invalidateApprovals: (uId: string) => {
    delete memoryCache["pending_approvals"];
    console.log("[PrefetchManager] Invalidated key: pending_approvals");
    Object.keys(memoryCache).forEach((key) => {
      if (key.startsWith(`team_expenses_${uId}`)) {
        delete memoryCache[key];
        console.log(`[PrefetchManager] Invalidated key: ${key}`);
      }
    });
  },

  invalidateMyExpenses: (uId: string) => {
    Object.keys(memoryCache).forEach((key) => {
      if (key.startsWith(`my_expenses_${uId}`) || key.startsWith(`allowance_stats_${uId}`)) {
        delete memoryCache[key];
        console.log(`[PrefetchManager] Invalidated key: ${key}`);
      }
    });
  },

  // Fire parallel background prefetching of all critical data for the logged-in user
  triggerGlobalPrefetch: (user: any) => {
    if (!user) return;
    const uId = user.user_id;
    const month = getCurrentMonthKey();
    
    console.log(`[PrefetchManager] Starting parallel global prefetch for user: ${uId} (month: ${month})`);

    // Prefetch My Expenses
    prefetchManager.prefetch(`my_expenses_${uId}_${month}`, () => expenseService.getExpenses(month));
    
    // Prefetch Allowance Stats
    prefetchManager.prefetch(`allowance_stats_${uId}_${month}`, () => expenseService.getExpenseInit(uId, month));

    // Prefetch Pending Approvals (both for badge count and approvals page)
    const allowedWindows = user.allowed_windows ? user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase()) : [];
    const userRoleLower = (user.role || "").trim().toLowerCase();
    const isSpecialViewRole = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(userRoleLower);
    const isReviewer = allowedWindows.includes("approval") || isSpecialViewRole;

    if (isReviewer) {
      prefetchManager.prefetch("pending_approvals", () => approvalService.getPendingApprovals());
      prefetchManager.prefetch(`team_expenses_${uId}_${month}`, () => expenseService.getTeamExpenses(month));
    }
  },

  // Clear memory cache + localStorage except for biometric settings
  clearAllUserData: () => {
    // 1. Clear memory cache
    prefetchManager.clearAll();

    // 2. Clear localStorage except for biometric configuration / app state persistence keys
    const keysToKeep = [
      "biometric_login_enabled",
      "biometric_username",
      "biometric_password",
      "has_shown_biometric_setup",
      "remember_me",
      "theme"
    ];
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keysToKeep.includes(key)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      console.log(`[PrefetchManager] Cleared localStorage key: ${k}`);
    });
  }
};
