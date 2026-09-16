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

  // ── UNTOUCHED auth navigation ──────────────────────────────────────────────
  useEffect(() => {
    if (tokenPersistence.isAuthenticated()) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 antialiased relative overflow-y-auto"
      style={{
        backgroundColor: "#f8f9fc",
        backgroundImage: `
          linear-gradient(to right, rgba(226, 232, 240, 0.7) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(226, 232, 240, 0.7) 1px, transparent 1px)
        `,
        backgroundSize: "28px 28px",
      }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 40%, rgba(99, 102, 241, 0.04) 0%, transparent 65%)",
        }}
      />

      {/* Main Auth Form Card Container */}
      <div
        className="relative z-10 w-full max-w-[420px] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden my-auto"
      >
        {mode === "login" && (
          <LoginForm
            onForgotPassword={() => setMode("forgot")}
            onUnlockAccount={() => setMode("unlock")}
          />
        )}
        {mode === "forgot" && (
          <ForgotPassword onBackToLogin={() => setMode("login")} />
        )}
        {mode === "unlock" && (
          <UnlockAccount onBackToLogin={() => setMode("login")} />
        )}
      </div>
    </div>
  );
}
