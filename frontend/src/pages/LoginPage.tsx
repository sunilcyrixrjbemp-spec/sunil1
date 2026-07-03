import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { tokenPersistence } from "../utils/persistence";
import LoginForm from "../components/auth/LoginForm";
import ForgotPassword from "../components/auth/ForgotPassword";
import UnlockAccount from "../components/auth/UnlockAccount";

type AuthMode = "login" | "forgot" | "unlock";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");

  useEffect(() => {
    if (tokenPersistence.isAuthenticated()) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#e9ecef] flex flex-col items-center justify-center py-8 px-4 text-gray-800">
      <div className="w-full max-w-[360px] space-y-4">
        {/* Content Box */}
        <div className="bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden">
          {mode === "login" && (
            <LoginForm 
              onForgotPassword={() => setMode("forgot")} 
              onUnlockAccount={() => setMode("unlock")} 
            />
          )}
          
          {mode === "forgot" && (
            <ForgotPassword 
              onBackToLogin={() => setMode("login")} 
            />
          )}
          
          {mode === "unlock" && (
            <UnlockAccount 
              onBackToLogin={() => setMode("login")} 
            />
          )}

          {/* Footer info inside the card */}
          <div className="text-center pb-5 pt-3.5 text-xs text-gray-400 border-t border-gray-100 bg-gray-50/50">
            Designed & Developed by{" "}
            <a 
              href="https://sunilbishnoi.co.in/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-500 hover:text-blue-700 hover:underline font-semibold transition-all"
            >
              Sunil Bishnoi
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
