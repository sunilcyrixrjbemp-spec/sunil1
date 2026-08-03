import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { tokenPersistence } from "../utils/persistence";
import LoginForm from "../components/auth/LoginForm";
import ForgotPassword from "../components/auth/ForgotPassword";
import UnlockAccount from "../components/auth/UnlockAccount";

type AuthMode = "login" | "forgot" | "unlock";

// ─── Decorative orb for brand panel ─────────────────────────────────────────
const BrandOrb = ({ size, x, y, opacity }: { size: number; x: string; y: string; opacity: number }) => (
  <div
    style={{
      position: "absolute",
      width: size, height: size,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(99,102,241,0.40) 0%, rgba(67,56,202,0.10) 70%, transparent 100%)",
      left: x, top: y,
      opacity,
      pointerEvents: "none",
      filter: "blur(40px)",
    }}
  />
);

// ─── Stats shown on brand panel ──────────────────────────────────────────────
const BRAND_STATS = [
  { label: "DISTRICT COVERAGE", value: "33+", sub: "Rajasthan & North India" },
  { label: "POLICY AUTOMATION", value: "100%", sub: "automated TA/DA rules" },
  { label: "MANAGER APPROVALS", value: "Real-Time", sub: "multi-level hierarchy" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");

  // ── UNTOUCHED logic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (tokenPersistence.isAuthenticated()) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row antialiased"
      style={{ backgroundColor: "var(--canvas)" }}
    >

      {/* ══════════════════════════════════════════════════════════════════
          LEFT PANEL — Brand / Marketing (desktop only)
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col relative overflow-hidden"
        style={{
          flex: "0 0 50%",
          backgroundColor: "#1e3a8a",
          padding: "48px 52px",
        }}
      >
        {/* Decorative ambient orbs */}
        <BrandOrb size={400} x="-80px" y="-80px" opacity={0.6} />
        <BrandOrb size={300} x="60%" y="55%" opacity={0.4} />
        <BrandOrb size={200} x="20%" y="70%" opacity={0.3} />

        {/* Subtle grid overlay */}
        <div
          style={{
            position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Brand mark */}
        <div className="relative z-10 flex items-center gap-3 mb-auto">
          <div className="p-2 bg-white rounded-md border border-white/20 shadow-xs flex items-center justify-center shrink-0">
            <img
              src="/brand.png"
              alt="Cyrix HealthCare"
              className="object-contain"
              style={{ height: 32, width: "auto" }}
            />
          </div>
          <div>
            <p
              className="m-0"
              style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}
            >
              Cyrix Field Ops
            </p>
            <p
              className="m-0"
              style={{ fontSize: 10, color: "rgba(255,255,255,0.60)", letterSpacing: "0.06em", fontWeight: 700, textTransform: "uppercase" }}
            >
              Enterprise Expense & Field Service Platform
            </p>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 mt-12 mb-auto">
          <div
            className="inline-flex items-center gap-2 rounded-full mb-5"
            style={{
              padding: "4px 12px 4px 8px",
              backgroundColor: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.20)",
            }}
          >
            <span
              className="rounded-full bg-emerald-400"
              style={{ width: 6, height: 6, animation: "pulse 2s ease-in-out infinite" }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em" }}>
              Live — Cyrix HealthCare Production System
            </span>
          </div>

          <h2
            className="m-0 mb-4"
            style={{
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em",
              color: "#ffffff", lineHeight: "1.15",
            }}
          >
            Biomedical Field Ops<br />
            <span style={{ color: "#93c5fd" }}>& Expense Management.</span>
          </h2>

          <p
            className="m-0 mb-8"
            style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: "22px", maxWidth: 360 }}
          >
            Empowering Cyrix Healthcare field engineers to log hospital service visits, submit TA/DA claims, and track manager approvals in real time.
          </p>

          {/* Stats grid */}
          <div
            className="grid grid-cols-3 gap-3"
            style={{ maxWidth: 420 }}
          >
            {BRAND_STATS.map(({ label, value, sub }) => (
              <div
                key={label}
                className="rounded-none"
                style={{
                  padding: "12px 10px",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <p
                  className="m-0 mb-0.5 tabular-mono"
                  style={{
                    fontFamily: "'Inter Tight', sans-serif",
                    fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em",
                    color: "#ffffff",
                  }}
                >
                  {value}
                </p>
                <p className="m-0" style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label}
                </p>
                <p className="m-0" style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                  {sub}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom line */}
        <div className="relative z-10 mt-auto" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24 }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", margin: 0 }}>
            © 2025 Cyrix Healthcare · All rights reserved
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RIGHT PANEL — Auth Form
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col items-center justify-center min-h-screen lg:min-h-0 relative"
        style={{ backgroundColor: "var(--surface)", padding: "32px 20px" }}
      >
        {/* Mobile: compact brand row */}
        <div
          className="flex lg:hidden items-center gap-2.5 mb-8"
          style={{ borderBottom: "1px solid var(--line)", paddingBottom: 20, width: "100%", maxWidth: 400 }}
        >
          <img
            src="/brand.png"
            alt="Cyrix"
            className="rounded-md object-contain"
            style={{ height: 36, width: 36, background: "var(--accent-900)", padding: 5 }}
          />
          <div>
            <p className="m-0" style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
              Cyrix Field Ops
            </p>
            <p className="m-0" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-300)" }}>
              Enterprise Platform
            </p>
          </div>
        </div>

        {/* Form card */}
        <div
          className="w-full animate-fade-in"
          style={{
            maxWidth: 400,
            backgroundColor: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            overflow: "hidden",
          }}
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

        {/* Version badge */}
        <p
          className="mt-6 text-center"
          style={{ fontSize: 11, color: "var(--ink-300)" }}
        >
          v2.0 · Secure · Enterprise-grade
        </p>
      </div>
    </div>
  );
}
