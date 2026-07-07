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
    <div className="auth-page-container min-h-screen bg-slate-50 flex flex-col items-center justify-center py-12 px-4 text-slate-800 antialiased relative overflow-hidden">
      {/* Subtle light background light blobs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[350px] h-[300px] sm:h-[350px] bg-indigo-100/50 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[300px] sm:w-[350px] h-[300px] sm:h-[350px] bg-blue-100/50 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="w-full max-w-[380px] space-y-6 relative z-10">
        {/* Content Box */}
        <div className="bg-white border border-slate-200/80 rounded-[2rem] shadow-xl overflow-hidden">
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
          <div className="text-center py-4 text-[10px] text-slate-500 border-t border-slate-100 bg-slate-50">
            Designed & Developed by{" "}
            <a 
              href="https://sunilbishnoi.co.in/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-indigo-600 hover:text-indigo-700 hover:underline font-bold transition-all"
            >
              Sunil Bishnoi
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
