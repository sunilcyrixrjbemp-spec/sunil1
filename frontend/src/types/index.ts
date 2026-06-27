export type UserRole = "employee" | "manager" | "admin" | "approver";

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  zone?: string;
  is_active: boolean;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export interface NotificationContextType {
  showNotification: (message: string, type: "success" | "error" | "info" | "warning") => void;
}
