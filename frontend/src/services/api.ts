import axios, { AxiosInstance, AxiosError } from "axios";
import { tokenPersistence } from "../utils/persistence";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

// Primary Cloudflare Worker URL — matches `name = "fieldops-api"` in worker-backend/wrangler.toml
// Updated 2026-08-06: fixed from stale fieldops-secondary-api URL
const WORKER_BACKEND_URL = "https://fieldops-api.sunilbishnoi.workers.dev";
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
// Prefer env var; fallback to primary worker URL. Reject old render.com/sunnybishnoi URLs.
const API_BASE_URL = (rawBaseUrl && !rawBaseUrl.includes("onrender.com") && !rawBaseUrl.includes("sunnybishnoi") && !rawBaseUrl.includes("secondary")) ? rawBaseUrl : `${WORKER_BACKEND_URL}/api`;

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let activeBaseURL = API_BASE_URL;

export function getActiveBaseURL() {
  return activeBaseURL;
}

// Inject bearer token into request headers if exists
api.interceptors.request.use(
  async (config) => {
    // Route all requests directly to active backend by default, unless this is a failover retry
    if (!(config as any)._failoverRetry) {
      config.baseURL = activeBaseURL;
    }

    // Do not inject tokens or restore them for public auth endpoints
    const isPublicEndpoint = config.url?.includes("/auth/login") || 
                             config.url?.includes("/auth/forgot-password") || 
                             config.url?.includes("/auth/verify-otp") || 
                             config.url?.includes("/auth/reset-password") || 
                             config.url?.includes("/auth/unlock-account") ||
                             config.url?.includes("/api/health");

    if (isPublicEndpoint) {
      return config;
    }

    let token = localStorage.getItem("access_token");
    
    // If token is missing from localStorage on a native mobile platform,
    // restore it from Preferences before sending the request to avoid 401 logouts.
    if (!token && Capacitor.isNativePlatform()) {
      try {
        const { value: capAccess } = await Preferences.get({ key: "access_token" });
        if (capAccess) {
          token = capAccess;
          localStorage.setItem("access_token", capAccess);
          
          const { value: capRefresh } = await Preferences.get({ key: "refresh_token" });
          if (capRefresh) localStorage.setItem("refresh_token", capRefresh);
          
          const { value: capUser } = await Preferences.get({ key: "user" });
          if (capUser) localStorage.setItem("user", capUser);
        }
      } catch (_) {}
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // If request payload is FormData, remove static application/json Content-Type header so browser/axios sets correct multipart boundary
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Response interceptor for handling failover & token expiry
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const status = error.response?.status;
    const errorData = error.response?.data as any;
    const errorMsg = (errorData?.error || errorData?.detail || errorData?.message || "").toString().toLowerCase();

    // 1. Immediate Force Logout for Locked / Disabled / Terminated Accounts
    const isAccountLockedOrDisabled = 
      errorData?.account_status === "locked" ||
      errorData?.account_status === "disabled" ||
      errorMsg.includes("account is locked") ||
      errorMsg.includes("account is disabled") ||
      errorMsg.includes("session terminated") ||
      (status === 403 && (errorMsg.includes("account is") || errorMsg.includes("disabled") || errorMsg.includes("locked")));

    if (isAccountLockedOrDisabled) {
      tokenPersistence.clear();
      try {
        localStorage.removeItem("user");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      } catch (_) {}

      const alertMsg = errorData?.error || errorData?.detail || "Your account has been locked or disabled. Session terminated.";
      try {
        sessionStorage.setItem("account_lock_msg", alertMsg);
      } catch (_) {}

      if (!window.location.hash.includes("/login")) {
        window.location.hash = "#/login";
        window.location.reload();
      }
      return Promise.reject(error);
    }
    
    // 2. Token expiry logic (401 Unauthorized)
    if (status === 401) {
      const refreshToken = localStorage.getItem("refresh_token");
      
      // Try refreshing the token if we have a refresh token and haven't retried yet
      if (refreshToken && originalRequest && !(originalRequest as any)._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          }).catch(err => {
            return Promise.reject(err);
          });
        }
        
        (originalRequest as any)._retry = true;
        isRefreshing = true;
        
        try {
          // Use default Axios so it routes correctly based on the updated logic
          const response = await axios.post(`${activeBaseURL}/auth/refresh`, {
            refresh_token: refreshToken
          });
          
          const { access_token, refresh_token: new_refresh_token } = response.data;
          
          const currentUserStr = localStorage.getItem("user");
          const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
          await tokenPersistence.save(access_token, new_refresh_token || refreshToken, currentUser);
          
          processQueue(null, access_token);
          
          // Retry the original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return api(originalRequest);
        } catch (refreshError: any) {
          processQueue(refreshError, null);
          
          const rData = refreshError.response?.data as any;
          const rMsg = (rData?.error || rData?.detail || "").toString().toLowerCase();
          if (rData?.account_status === "locked" || rData?.account_status === "disabled" || rMsg.includes("account is") || rMsg.includes("locked") || rMsg.includes("disabled")) {
            try {
              sessionStorage.setItem("account_lock_msg", rData?.error || "Your account has been locked or disabled. Session terminated.");
            } catch (_) {}
          }

          // Refresh failed — clear credentials and redirect to login
          tokenPersistence.clear();
          window.location.hash = "#/login";
          window.location.reload();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token or retry already failed — log out
        tokenPersistence.clear();
        if (!window.location.hash.includes("/login")) {
          window.location.hash = "#/login";
          window.location.reload();
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
