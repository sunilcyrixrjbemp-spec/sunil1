import axios, { AxiosInstance, AxiosError } from "axios";
import { tokenPersistence } from "../utils/persistence";
import { Capacitor } from "@capacitor/core";

// Define the production fallback URL for mobile apps
const PROD_BACKEND_URL = "https://sunil1.sunilbishnoi.workers.dev";

let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// If no VITE_API_BASE_URL is set, or if it is a relative path '/api',
// and we are running inside a native mobile app, force it to the production URL.
if (Capacitor.isNativePlatform()) {
  API_BASE_URL = `${PROD_BACKEND_URL}/api`;
} else if (!API_BASE_URL || API_BASE_URL === "/api") {
  API_BASE_URL = "/api";
}

if (API_BASE_URL !== "/api") {
  API_BASE_URL = API_BASE_URL.replace(/\/$/, "");
  if (!API_BASE_URL.endsWith("/api")) {
    API_BASE_URL = `${API_BASE_URL}/api`;
  }
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Inject bearer token into request headers if exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

// Response interceptor for handling token expiry
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // Only handle 401 Unauthorized status codes
    if (error.response?.status === 401) {
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
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken
          });
          
          const { access_token, refresh_token: new_refresh_token } = response.data;
          
          const currentUserStr = localStorage.getItem("user");
          const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
          tokenPersistence.save(access_token, new_refresh_token || refreshToken, currentUser);
          
          processQueue(null, access_token);
          
          // Retry the original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          
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
