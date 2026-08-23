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
    <div className="min-h-screen w-full flex flex-col justify-center items-center relative overflow-hidden bg-[#FAFAF9] px-4 py-8 selection:bg-accent-100 selection:text-accent-900">
      {/* ══════════════════════════════════════════════════════════════════
          CLEAN SUBTLE AMBIENT CANVAS (Minimalist, Distraction-Free)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
        <div
          className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] rounded-full animate-mesh-blob-1"
          style={{
            background: "radial-gradient(circle, #4338CA 0%, rgba(67, 56, 202, 0) 70%)",
            filter: "blur(120px)",
          }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[600px] h-[600px] rounded-full animate-mesh-blob-2"
          style={{
            background: "radial-gradient(circle, #6366F1 0%, rgba(99, 102, 241, 0) 70%)",
            filter: "blur(130px)",
          }}
        />
      </div>

      {/* Delicate Architectural Grid */}
      <div
        className="absolute inset-0 pointer-events-none animate-grid-drift opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#12151A 1px, transparent 1px), linear-gradient(90deg, #12151A 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════
          CENTERED AUTHENTICATION CARD (Clean, Professional, Focused)
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="w-full max-w-[400px] bg-white rounded-2xl border border-line p-6 sm:p-7 relative z-10 animate-form-card"
        style={{
          boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.06), 0 4px 12px -2px rgba(30, 27, 75, 0.03)",
        }}
      >
        {/* Form View (Login / Forgot / Unlock) */}
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
