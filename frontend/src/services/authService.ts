import api from "./api";
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
    const { access_token, refresh_token, user } = response.data;
    tokenPersistence.save(access_token, refresh_token, user);
    return response.data;
  },

  logout: () => {
    tokenPersistence.clear();
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
      tokenPersistence.save(accessToken, refreshToken, response.data);
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
      tokenPersistence.save(accessToken, refreshToken, response.data);
    }
    return response.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<any> => {
    const response = await api.post("/users/change-password", data);
    return response.data;
  }
};
