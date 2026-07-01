import { useNavigate } from "react-router-dom";
import { authService } from "@/services/authService";

export const useAuth = () => {
  const navigate = useNavigate();

  const login = async (user_id: string, password: string) => {
    try {
      await authService.login({ user_id, password });
      navigate("/home");
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    navigate("/login");
  };

  const user = authService.getCurrentUser();

  return {
    user,
    isAuthenticated: !!user,
    login,
    logout,
  };
};
