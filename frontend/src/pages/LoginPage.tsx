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
    <div className="min-h-screen bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center py-12 px-4 text-slate-200 antialiased">
      <div className="w-full max-w-[380px] space-y-6">
        {/* Content Box */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-[2rem] shadow-2xl overflow-hidden">
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
          <div className="text-center py-4 text-[10px] text-slate-550 border-t border-slate-850/60 bg-slate-950/40">
            Designed & Developed by{" "}
            <a 
              href="https://sunilbishnoi.co.in/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-indigo-400 hover:text-indigo-300 hover:underline font-bold transition-all"
            >
              Sunil Bishnoi
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
