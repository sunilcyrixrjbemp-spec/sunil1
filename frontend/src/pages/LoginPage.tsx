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
  { label: "Field Engineers", value: "500+", sub: "across Rajasthan" },
  { label: "Claims Processed", value: "₹12Cr+", sub: "last fiscal year" },
  { label: "Avg. Approval Time", value: "4 hrs", sub: "end-to-end" },
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
          backgroundColor: "var(--accent-900)",
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
          <img
            src="/brand.png"
            alt="Cyrix Field Ops"
            className="object-contain rounded-lg"
            style={{ height: 44, width: "auto", background: "rgba(255,255,255,0.10)", padding: 8 }}
          />
          <div>
            <p
              className="m-0"
              style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em" }}
            >
              Cyrix Field Ops
            </p>
            <p
              className="m-0"
              style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", letterSpacing: "0.06em", fontWeight: 600, textTransform: "uppercase" }}
            >
              Enterprise Expense Platform
            </p>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 mt-16 mb-auto">
          <div
            className="inline-flex items-center gap-2 rounded-full mb-6"
            style={{
              padding: "4px 12px 4px 6px",
              backgroundColor: "rgba(99,102,241,0.18)",
              border: "1px solid rgba(99,102,241,0.30)",
            }}
          >
            <span
              className="rounded-full"
              style={{ width: 6, height: 6, backgroundColor: "var(--approved-text)", animation: "pulse 2s ease-in-out infinite" }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.70)", letterSpacing: "0.04em" }}>
              Live — Production System
            </span>
          </div>

          <h2
            className="m-0 mb-4"
            style={{
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 36, fontWeight: 800, letterSpacing: "-0.025em",
              color: "#ffffff", lineHeight: "1.1",
            }}
          >
            Field expense<br />
            <span style={{ color: "var(--accent-400)" }}>made simple.</span>
          </h2>

          <p
            className="m-0 mb-10"
            style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: "24px", maxWidth: 340 }}
          >
            Submit TA/DA claims, track approvals, and access real-time reports — all in one place.
          </p>

          {/* Stats grid */}
          <div
            className="grid grid-cols-3 gap-3"
            style={{ maxWidth: 400 }}
          >
            {BRAND_STATS.map(({ label, value, sub }) => (
              <div
                key={label}
                className="rounded-lg"
                style={{
                  padding: "14px 12px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <p
                  className="m-0 mb-0.5 tabular-mono"
                  style={{
                    fontFamily: "'Inter Tight', sans-serif",
                    fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em",
                    color: "#ffffff",
                  }}
                >
                  {value}
                </p>
                <p className="m-0" style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label}
                </p>
                <p className="m-0" style={{ fontSize: 10, color: "rgba(255,255,255,0.30)", marginTop: 2 }}>
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
