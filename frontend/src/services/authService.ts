import api, { getActiveBaseURL } from "./api";
import { 
  LoginCredentials, 
  AuthResponse, 
  OTPResponse, 
  DropdownData,
  ProfileUpdateRequest,
  ChangePasswordRequest
} from "../types/auth";

import { tokenPersistence } from "../utils/persistence";

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post("/auth/login", credentials);
    const { access_token, refresh_token, user, bootstrap_data } = response.data;
    await tokenPersistence.save(access_token, refresh_token, user);
    
    // Save bootstrap data to cache immediately if present!
    if (bootstrap_data) {
      try {
        const user_id = user?.user_id || user?.userId || "";
        const monthStr = new Date().toISOString().slice(0, 7);
        localStorage.setItem("cache_dropdowns", JSON.stringify(bootstrap_data.dropdowns || {}));
        localStorage.setItem(`cache_month_limits_${user_id}_${monthStr}`, JSON.stringify(bootstrap_data.expense_init || {}));
        localStorage.setItem(`cache_my_expenses_${user_id}`, JSON.stringify(bootstrap_data.my_expenses || []));
        localStorage.setItem(`cache_allowance_stats_${user_id}`, JSON.stringify(bootstrap_data.allowance_stats || {}));
        localStorage.setItem(`cache_team_expenses_${user_id}`, JSON.stringify(bootstrap_data.team_expenses || []));
        localStorage.setItem(`cache_approvals_count_${user_id}`, (bootstrap_data.pending_approvals_count || 0).toString());
        localStorage.setItem("cache_pending_approvals", JSON.stringify(bootstrap_data.pending_approvals || []));
      } catch (cacheError) {
        console.warn("Failed to write bootstrap cache to localStorage:", cacheError);
      }
    }

    // Sync FCM Push Token to backend
    import("../utils/capacitor").then(({ syncFCMToken }) => {
      syncFCMToken();
    }).catch(() => {});
    
    return response.data;
  },

  logout: async () => {
    tokenPersistence.clear();
    try {
      await api.post("/auth/logout");
    } catch (e) {
      console.warn("Backend logout failed", e);
    }
  },

  bootstrap: async (): Promise<any> => {
    const response = await api.get("/auth/bootstrap");
    return response.data;
  },

  forgotPassword: async (user_id: string, date_of_birth: string): Promise<OTPResponse> => {
    const response = await api.post("/auth/forgot-password", { user_id, date_of_birth });
    return response.data;
  },

  verifyOtp: async (user_id: string, otp: string, otp_type: string): Promise<any> => {
    const response = await api.post("/auth/verify-otp", { user_id, otp, otp_type });
    return response.data;
  },

  resetPassword: async (
    user_id: string, 
    otp: string, 
    new_password: string, 
    confirm_password: string
  ): Promise<any> => {
    const response = await api.post("/auth/reset-password", { 
      user_id, 
      otp, 
      new_password, 
      confirm_password 
    });
    return response.data;
  },

  unlockAccount: async (
    user_id: string, 
    date_of_joining: string, 
    date_of_birth: string
  ): Promise<OTPResponse> => {
    const response = await api.post("/auth/unlock-account", { 
      user_id, 
      date_of_joining, 
      date_of_birth 
    });
    return response.data;
  },

  unlockVerifyOtp: async (user_id: string, otp: string): Promise<any> => {
    const response = await api.post("/auth/unlock-verify-otp", { 
      user_id, 
      otp, 
      otp_type: "unlock_account" 
    });
    return response.data;
  },

  getDropdowns: async (): Promise<DropdownData> => {
    const response = await api.get("/auth/dropdowns");
    return response.data;
  },

  getCurrentUser: () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated: (): boolean => {
    // Check localStorage first (primary store)
    if (localStorage.getItem("access_token")) return true;
    // Fallback: check cookie (mobile WebView may wipe localStorage on process kill)
    const cookieToken = document.cookie
      .split("; ")
      .find(row => row.startsWith("fallback_access_token="))
      ?.split("=")[1];
    if (cookieToken) {
      // Restore from cookie back to localStorage to ensure isAuthenticated works next time
      const decoded = decodeURIComponent(cookieToken);
      if (decoded) {
        localStorage.setItem("access_token", decoded);
        return true;
      }
    }
    return false;
  },

  getProfile: async (): Promise<any> => {
    const response = await api.get("/users/profile");
    // Use existing token from localStorage/cookie rather than potentially reading empty string
    const accessToken = localStorage.getItem("access_token") 
      || document.cookie.split("; ").find(r => r.startsWith("fallback_access_token="))?.split("=")[1]?.replace(/%[0-9A-F]{2}/gi, c => decodeURIComponent(c))
      || "";
    const refreshToken = localStorage.getItem("refresh_token")
      || document.cookie.split("; ").find(r => r.startsWith("fallback_refresh_token="))?.split("=")[1]?.replace(/%[0-9A-F]{2}/gi, c => decodeURIComponent(c))
      || "";
    if (accessToken) {
      await tokenPersistence.save(accessToken, refreshToken, response.data);
    }
    return response.data;
  },

  updateProfile: async (data: ProfileUpdateRequest): Promise<any> => {
    const response = await api.put("/users/profile", data);
    const accessToken = localStorage.getItem("access_token")
      || document.cookie.split("; ").find(r => r.startsWith("fallback_access_token="))?.split("=")[1]?.replace(/%[0-9A-F]{2}/gi, c => decodeURIComponent(c))
      || "";
    const refreshToken = localStorage.getItem("refresh_token")
      || document.cookie.split("; ").find(r => r.startsWith("fallback_refresh_token="))?.split("=")[1]?.replace(/%[0-9A-F]{2}/gi, c => decodeURIComponent(c))
      || "";
    if (accessToken) {
      await tokenPersistence.save(accessToken, refreshToken, response.data);
    }
    return response.data;
  },

  updateProfilePhoto: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/users/profile/photo", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    const accessToken = localStorage.getItem("access_token")
      || document.cookie.split("; ").find(r => r.startsWith("fallback_access_token="))?.split("=")[1]?.replace(/%[0-9A-F]{2}/gi, c => decodeURIComponent(c))
      || "";
    const refreshToken = localStorage.getItem("refresh_token")
      || document.cookie.split("; ").find(r => r.startsWith("fallback_refresh_token="))?.split("=")[1]?.replace(/%[0-9A-F]{2}/gi, c => decodeURIComponent(c))
      || "";
    if (accessToken) {
      await tokenPersistence.save(accessToken, refreshToken, response.data);
    }
    return response.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<any> => {
    const response = await api.post("/users/change-password", data);
    return response.data;
  },

  deleteProfilePhoto: async (): Promise<any> => {
    const response = await api.delete("/users/profile/photo");
    const accessToken = localStorage.getItem("access_token")
      || document.cookie.split("; ").find(r => r.startsWith("fallback_access_token="))?.split("=")[1]?.replace(/%[0-9A-F]{2}/gi, c => decodeURIComponent(c))
      || "";
    const refreshToken = localStorage.getItem("refresh_token")
      || document.cookie.split("; ").find(r => r.startsWith("fallback_refresh_token="))?.split("=")[1]?.replace(/%[0-9A-F]{2}/gi, c => decodeURIComponent(c))
      || "";
    if (accessToken) {
      await tokenPersistence.save(accessToken, refreshToken, response.data);
    }
    return response.data;
  },

  getAbsoluteImageUrl: (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return url;
    }
    const baseUrl = getActiveBaseURL();
    const host = baseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
    const relative = url.startsWith("/") ? url : `/${url}`;
    return `${host}${relative}`;
  }
};
