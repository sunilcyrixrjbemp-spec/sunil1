const COOKIE_EXPIRY_DAYS = 365;

export const tokenPersistence = {
  save: (accessToken: string, refreshToken: string, user: any) => {
    try {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
    } catch (e) {
      console.warn("localStorage write failed:", e);
    }

    try {
      const expires = new Date();
      expires.setTime(expires.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const expiresStr = "; expires=" + expires.toUTCString();
      
      document.cookie = "fallback_access_token=" + encodeURIComponent(accessToken) + expiresStr + "; path=/; SameSite=Lax";
      document.cookie = "fallback_refresh_token=" + encodeURIComponent(refreshToken) + expiresStr + "; path=/; SameSite=Lax";
      document.cookie = "fallback_user=" + encodeURIComponent(JSON.stringify(user)) + expiresStr + "; path=/; SameSite=Lax";
    } catch (e) {
      console.warn("document.cookie write failed:", e);
    }
  },
  
  clear: () => {
    try {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
    } catch (e) {
      console.warn("localStorage clear failed:", e);
    }

    try {
      document.cookie = "fallback_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "fallback_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "fallback_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch (e) {
      console.warn("document.cookie clear failed:", e);
    }
  },
  
  restore: () => {
    try {
      if (localStorage.getItem("access_token") && localStorage.getItem("user")) {
        return;
      }
      
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
      }
    } catch (e) {
      console.error("Session restore error:", e);
    }
  }
};
