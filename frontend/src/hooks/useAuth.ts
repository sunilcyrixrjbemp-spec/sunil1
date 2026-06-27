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

  const logout = () => {
    authService.logout();
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
