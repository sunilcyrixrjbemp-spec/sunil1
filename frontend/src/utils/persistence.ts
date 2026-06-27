const COOKIE_EXPIRY_DAYS = 365;

// ─── In-memory cache (survives React re-renders, prevents flicker) ────────────
let _cachedToken: string | null = null;

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open("CyrixAuthDB", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("session")) {
          db.createObjectStore("session");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
};

const getIDBValue = async (key: string): Promise<any> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction("session", "readonly");
      const store = transaction.objectStore("session");
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
};

const setIDBValue = async (key: string, value: any): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("session", "readwrite");
      const store = transaction.objectStore("session");
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {}
};

const deleteIDBValue = async (key: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction("session", "readwrite");
      const store = transaction.objectStore("session");
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch (e) {}
};

// ─── Cookie helpers ───────────────────────────────────────────────────────────
const getCookie = (name: string): string | null => {
  try {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop()?.split(";").shift() || "");
    }
  } catch (_) {}
  return null;
};

const setCookieVal = (name: string, value: string, days: number) => {
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  } catch (_) {}
};

const deleteCookie = (name: string) => {
  try {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  } catch (_) {}
};

// ─── Median.co Native Storage Bridge ─────────────────────────────────────────
// Median.co provides window.median.nativeStorage for persistent key-value storage
// that SURVIVES app kills — most reliable storage in Median WebView
const medianSetItem = (key: string, value: string): void => {
  try {
    const median = (window as any).median || (window as any).gonative;
    if (median?.nativeStorage?.setItem) {
      median.nativeStorage.setItem({ key, value });
    }
  } catch (_) {}
};

const medianGetItem = (key: string, callback: (value: string | null) => void): void => {
  try {
    const median = (window as any).median || (window as any).gonative;
    if (median?.nativeStorage?.getItem) {
      median.nativeStorage.getItem({ key, callback });
      return;
    }
  } catch (_) {}
  callback(null);
};

const medianRemoveItem = (key: string): void => {
  try {
    const median = (window as any).median || (window as any).gonative;
    if (median?.nativeStorage?.removeItem) {
      median.nativeStorage.removeItem({ key });
    }
  } catch (_) {}
};

import { Preferences } from '@capacitor/preferences';

// Helper to save general values natively (survives app close/clear)
export const nativeConfig = {
  set: async (key: string, value: string): Promise<void> => {
    try {
      await Preferences.set({ key, value });
      localStorage.setItem(key, value);
    } catch (_) {
      localStorage.setItem(key, value);
    }
  },
  get: async (key: string): Promise<string | null> => {
    try {
      const { value } = await Preferences.get({ key });
      if (value) {
        localStorage.setItem(key, value);
        return value;
      }
    } catch (_) {}
    return localStorage.getItem(key);
  },
  remove: async (key: string): Promise<void> => {
    try {
      await Preferences.remove({ key });
      localStorage.removeItem(key);
    } catch (_) {
      localStorage.removeItem(key);
    }
  }
};

let _restorationPromise: Promise<void> | null = null;

// ─── Main persistence API ─────────────────────────────────────────────────────
export const tokenPersistence = {
  /**
   * Save tokens to all 5 storage layers:
   * 1. localStorage (fastest)
   * 2. Cookies (survives some WebView kills)
   * 3. IndexedDB (survives localStorage clear)
   * 4. Median.co Native Storage (most persistent — WebView)
   * 5. Capacitor Preferences (most persistent — Native App)
   */
  save: (accessToken: string, refreshToken: string, user: any) => {
    _cachedToken = accessToken;

    try {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
    } catch (e) {
      console.warn("localStorage write failed:", e);
    }

    setCookieVal("fallback_access_token", accessToken, COOKIE_EXPIRY_DAYS);
    setCookieVal("fallback_refresh_token", refreshToken, COOKIE_EXPIRY_DAYS);
    setCookieVal("fallback_user", JSON.stringify(user), COOKIE_EXPIRY_DAYS);

    setIDBValue("access_token", accessToken);
    setIDBValue("refresh_token", refreshToken);
    setIDBValue("user", user);

    medianSetItem("access_token", accessToken);
    medianSetItem("refresh_token", refreshToken);
    medianSetItem("user", JSON.stringify(user));

    try {
      Preferences.set({ key: "access_token", value: accessToken });
      Preferences.set({ key: "refresh_token", value: refreshToken });
      Preferences.set({ key: "user", value: JSON.stringify(user) });
    } catch (_) {}
  },

  clear: () => {
    _cachedToken = null;
    _restorationPromise = null;

    try {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
    } catch (e) {}

    deleteCookie("fallback_access_token");
    deleteCookie("fallback_refresh_token");
    deleteCookie("fallback_user");

    deleteIDBValue("access_token");
    deleteIDBValue("refresh_token");
    deleteIDBValue("user");

    medianRemoveItem("access_token");
    medianRemoveItem("refresh_token");
    medianRemoveItem("user");

    try {
      Preferences.remove({ key: "access_token" });
      Preferences.remove({ key: "refresh_token" });
      Preferences.remove({ key: "user" });
    } catch (_) {}
  },

  /**
   * Synchronous auth check — uses in-memory cache first, then cookie.
   * No async needed — prevents ProtectedRoute from redirecting to login incorrectly.
   */
  isAuthenticated: (): boolean => {
    if (_cachedToken) return true;
    const token = localStorage.getItem("access_token");
    if (token) {
      _cachedToken = token;
      return true;
    }
    // Quick synchronous cookie check as last resort
    const cookieToken = getCookie("fallback_access_token");
    if (cookieToken) {
      _cachedToken = cookieToken;
      localStorage.setItem("access_token", cookieToken);
      return true;
    }
    return false;
  },

  /**
   * Helper to check if the app is currently restoring the token natively.
   */
  isRestoring: (): boolean => {
    return _restorationPromise !== null && _cachedToken === null;
  },

  /**
   * Async restore — tries all 5 storage layers in priority order.
   * Called on app startup and on resume from background.
   */
  restore: async (): Promise<void> => {
    if (_restorationPromise) return _restorationPromise;

    _restorationPromise = (async () => {
      try {
        if (localStorage.getItem("access_token") && localStorage.getItem("user")) {
          _cachedToken = localStorage.getItem("access_token");
          return;
        }

        // Layer 1: Capacitor Preferences (NATIVE APP - most reliable)
        try {
          const { value: capAccess } = await Preferences.get({ key: "access_token" });
          const { value: capUser } = await Preferences.get({ key: "user" });
          const { value: capRefresh } = await Preferences.get({ key: "refresh_token" });

          if (capAccess && capUser) {
            localStorage.setItem("access_token", capAccess);
            if (capRefresh) localStorage.setItem("refresh_token", capRefresh);
            localStorage.setItem("user", capUser);
            _cachedToken = capAccess;
            console.log("[Session] Restored from Capacitor Preferences");
            return;
          }
        } catch (_) {}

        // Layer 2: Cookies (fast, synchronous)
        const fallbackAccess = getCookie("fallback_access_token");
        const fallbackRefresh = getCookie("fallback_refresh_token");
        const fallbackUser = getCookie("fallback_user");

        if (fallbackAccess && fallbackUser) {
          localStorage.setItem("access_token", fallbackAccess);
          if (fallbackRefresh) localStorage.setItem("refresh_token", fallbackRefresh);
          localStorage.setItem("user", fallbackUser);
          _cachedToken = fallbackAccess;
          console.log("[Session] Restored from cookie");
          return;
        }

        // Layer 3: IndexedDB
        const idbAccess = await getIDBValue("access_token");
        const idbUser = await getIDBValue("user");
        const idbRefresh = await getIDBValue("refresh_token");

        if (idbAccess && idbUser) {
          localStorage.setItem("access_token", idbAccess);
          if (idbRefresh) localStorage.setItem("refresh_token", idbRefresh);
          localStorage.setItem("user", JSON.stringify(idbUser));
          _cachedToken = idbAccess;
          setCookieVal("fallback_access_token", idbAccess, COOKIE_EXPIRY_DAYS);
          setCookieVal("fallback_refresh_token", idbRefresh || "", COOKIE_EXPIRY_DAYS);
          setCookieVal("fallback_user", JSON.stringify(idbUser), COOKIE_EXPIRY_DAYS);
          console.log("[Session] Restored from IndexedDB");
          return;
        }

        // Layer 4: Median.co Native Storage (async callback-based)
        await new Promise<void>((resolve) => {
          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) { resolved = true; resolve(); }
          }, 1500);

          medianGetItem("access_token", (token) => {
            if (resolved) return;
            if (!token) { resolved = true; clearTimeout(timeout); resolve(); return; }

            medianGetItem("user", (userStr) => {
              if (!userStr) { resolved = true; clearTimeout(timeout); resolve(); return; }

              medianGetItem("refresh_token", (refreshToken) => {
                localStorage.setItem("access_token", token);
                if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
                localStorage.setItem("user", userStr);
                _cachedToken = token;
                setCookieVal("fallback_access_token", token, COOKIE_EXPIRY_DAYS);
                setCookieVal("fallback_user", userStr, COOKIE_EXPIRY_DAYS);
                setIDBValue("access_token", token);
                try { setIDBValue("user", JSON.parse(userStr)); } catch (_) {}
                console.log("[Session] Restored from Median.co Native Storage");
                resolved = true;
                clearTimeout(timeout);
                resolve();
              });
            });
          });
        });

      } catch (e) {
        console.error("[Session] Restore error:", e);
      }
    })();

    return _restorationPromise;
  }
};


