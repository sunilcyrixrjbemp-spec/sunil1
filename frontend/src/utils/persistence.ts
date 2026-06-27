const COOKIE_EXPIRY_DAYS = 365;

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

export const tokenPersistence = {
  save: (accessToken: string, refreshToken: string, user: any) => {
    try {
      // 1. Save to localStorage
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
    } catch (e) {
      console.warn("localStorage write failed:", e);
    }

    try {
      // 2. Save to Cookies as fallback (1 year expiry)
      const expires = new Date();
      expires.setTime(expires.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const expiresStr = "; expires=" + expires.toUTCString();
      
      document.cookie = "fallback_access_token=" + encodeURIComponent(accessToken) + expiresStr + "; path=/; SameSite=Lax";
      document.cookie = "fallback_refresh_token=" + encodeURIComponent(refreshToken) + expiresStr + "; path=/; SameSite=Lax";
      document.cookie = "fallback_user=" + encodeURIComponent(JSON.stringify(user)) + expiresStr + "; path=/; SameSite=Lax";
    } catch (e) {
      console.warn("document.cookie write failed:", e);
    }

    // 3. Save to IndexedDB (asynchronous background task)
    setIDBValue("access_token", accessToken);
    setIDBValue("refresh_token", refreshToken);
    setIDBValue("user", user);
  },
  
  clear: () => {
    try {
      // 1. Clear localStorage
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
    } catch (e) {
      console.warn("localStorage clear failed:", e);
    }

    try {
      // 2. Clear fallback Cookies
      document.cookie = "fallback_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "fallback_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "fallback_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch (e) {
      console.warn("document.cookie clear failed:", e);
    }

    // 3. Clear IndexedDB
    deleteIDBValue("access_token");
    deleteIDBValue("refresh_token");
    deleteIDBValue("user");
  },
  
  restore: async (): Promise<void> => {
    try {
      // If localStorage is already populated, do nothing
      if (localStorage.getItem("access_token") && localStorage.getItem("user")) {
        return;
      }
      
      // Try restoring from Cookies first
      const getCookie = (name: string): string | null => {
        const value = "; " + document.cookie;
        const parts = value.split("; " + name + "=");
        if (parts.length === 2) {
          return decodeURIComponent(parts.pop()?.split(";").shift() || "");
        }
        return null;
      };
      
      const fallbackAccess = getCookie("fallback_access_token");
      const fallbackRefresh = getCookie("fallback_refresh_token");
      const fallbackUser = getCookie("fallback_user");
      
      if (fallbackAccess && fallbackUser) {
        localStorage.setItem("access_token", fallbackAccess);
        if (fallbackRefresh) {
          localStorage.setItem("refresh_token", fallbackRefresh);
        }
        localStorage.setItem("user", fallbackUser);
        console.log("Session restored from persistent cookie fallback.");
        return;
      }

      // If Cookies failed (or null origin), try restoring from IndexedDB fallback
      const idbAccess = await getIDBValue("access_token");
      const idbUser = await getIDBValue("user");
      const idbRefresh = await getIDBValue("refresh_token");
      
      if (idbAccess && idbUser) {
        localStorage.setItem("access_token", idbAccess);
        if (idbRefresh) {
          localStorage.setItem("refresh_token", idbRefresh);
        }
        localStorage.setItem("user", JSON.stringify(idbUser));
        console.log("Session restored from persistent IndexedDB fallback.");
      }
    } catch (e) {
      console.error("Session restore error:", e);
    }
  }
};
