import React, { useState, useEffect, useRef } from "react";
import { User, Lock, Eye, EyeOff, Check, AlertTriangle, Fingerprint } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/authService";
import { useBiometricLogin } from "../../hooks/useBiometricLogin";
import { isNativeApp, biometricAuth } from "../../utils/capacitor";
import { nativeConfig } from "../../utils/persistence";
import { App } from "@capacitor/app";
import TurnstileWidget from "../common/TurnstileWidget";

// ─── Props ────────────────────────────────────────────────────────────────────
interface LoginFormProps {
  onForgotPassword: () => void;
  onUnlockAccount: () => void;
}

// ─── Inline Spinner ──────────────────────────────────────────────────────────
const Spinner = () => (
  <span
    className="inline-block shrink-0 animate-spin"
    style={{
      width: 15,
      height: 15,
      border: "2px solid rgba(255,255,255,0.35)",
      borderTopColor: "#ffffff",
      borderRadius: "50%",
    }}
  />
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginForm({ onForgotPassword, onUnlockAccount }: LoginFormProps) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(() => {
    try {
      return localStorage.getItem("cyrix_remembered_user") || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem("cyrix_remember_me") === "true";
    } catch {
      return false;
    }
  });
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ userId?: string; password?: string }>({});
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [shake, setShake] = useState(false);
  const [showAlreadyLoggedInModal, setShowAlreadyLoggedInModal] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const isSubmitting = useRef(false);

  // ── Show account lock message if redirected after session termination ──────
  useEffect(() => {
    try {
      const lockMsg = sessionStorage.getItem("account_lock_msg");
      if (lockMsg) {
        setStatusMessage({ type: "error", text: lockMsg });
        sessionStorage.removeItem("account_lock_msg");
      }
    } catch (_) {}
  }, []);

  // ── Android Back Button: Exit App Confirmation ───────────────────────────
  useEffect(() => {
    if (!isNativeApp()) return;

    let listener: any;
    try {
      listener = App.addListener("backButton", ({ canGoBack }) => {
        if (!canGoBack) {
          const exitConfirmed = window.confirm("Do you want to exit Cyrix Field Ops?");
          if (exitConfirmed) {
            App.exitApp();
          }
        }
      });
    } catch (_) {}

    return () => {
      if (listener && typeof listener.remove === "function") {
        listener.remove();
      }
    };
  }, []);

  const { biometricAvailable, biometricEnabled, loginWithBiometric } = useBiometricLogin();

  // ── Handle Submit with Cloudflare Turnstile Validation ───────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting.current || loading) return;

    setStatusMessage(null);
    const errors: { userId?: string; password?: string } = {};

    if (!userId.trim()) {
      errors.userId = "Employee ID is required";
    }
    if (!password) {
      errors.password = "Password is required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setShake(true);
      setTimeout(() => setShake(false), 200);
      return;
    }

    if (!isNativeApp() && !turnstileToken) {
      setStatusMessage({
        type: "error",
        text: "Please complete the Cloudflare security verification.",
      });
      setShake(true);
      setTimeout(() => setShake(false), 200);
      return;
    }

    setFieldErrors({});
    isSubmitting.current = true;
    setLoading(true);

    try {
      await authService.login({
        user_id: userId.trim(),
        password,
        turnstile_token: turnstileToken,
        force: true,
      });

      // Save or clear remember me preference
      try {
        if (rememberMe) {
          localStorage.setItem("cyrix_remember_me", "true");
          localStorage.setItem("cyrix_remembered_user", userId.trim());
        } else {
          localStorage.removeItem("cyrix_remember_me");
          localStorage.removeItem("cyrix_remembered_user");
        }
      } catch (_) {}

      // Biometric check for native mobile app
      if (isNativeApp()) {
        try {
          const available = await biometricAuth.isAvailable();
          const enabled = (await nativeConfig.get("biometric_login_enabled")) === "true";
          if (available && !enabled) {
            setShowBiometricPrompt(true);
            isSubmitting.current = false;
            setLoading(false);
            return;
          }
        } catch (_) {}
      }

      // Success State brief indicator (200ms)
      setIsSuccess(true);
      setTimeout(() => {
        navigate("/home");
      }, 200);
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.detail === "ALREADY_LOGGED_IN") {
        setShowAlreadyLoggedInModal(true);
        isSubmitting.current = false;
        setLoading(false);
        return;
      }

      let errorMsg = "Invalid credentials. Try again.";
      if (!err.response) {
        errorMsg = "Unable to connect to server. Check internet connection.";
      } else if (err.response.data?.detail === "TURNSTILE_FAILED") {
        errorMsg = "Security verification failed. Please try again.";
      } else if (err.response.data?.error) {
        errorMsg = err.response.data.error;
      }

      setStatusMessage({ type: "error", text: errorMsg });

      // Trigger 150ms card shake
      setShake(true);
      setTimeout(() => setShake(false), 200);
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  // ── Force Login Handler (Session Conflict) ────────────────────────────────
  const handleForceLogin = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setShowAlreadyLoggedInModal(false);
    setLoading(true);
    setStatusMessage(null);

    try {
      await authService.login({ user_id: userId.trim(), password, force: true });
      navigate("/home");
    } catch (err: any) {
      let errorMsg = "Invalid credentials. Try again.";
      if (err.response?.data?.error) errorMsg = err.response.data.error;
      setStatusMessage({ type: "error", text: errorMsg });
      setShake(true);
      setTimeout(() => setShake(false), 200);
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className={`w-full transition-transform ${shake ? "animate-shake" : ""}`}>
      {/* ── Perfectly Centered Logo & Tight Brand Heading ────────────────── */}
      <div className="flex flex-col items-center justify-center text-center mb-3.5">
        <img
          src="/logo-fieldconnect.png"
          alt="Cyrix Field Connect Logo"
          className="h-10 w-auto object-contain select-none mb-1.5 drop-shadow-2xs"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const fallback = document.getElementById("logo-text-fallback");
            if (fallback) fallback.style.display = "flex";
          }}
        />
        <div id="logo-text-fallback" className="hidden items-center gap-1 font-display font-black text-xl text-ink-900 tracking-tight">
          <span>CYRIX</span>
          <span className="text-rose-600">X</span>
          <span className="text-xs font-mono font-bold text-accent-600 uppercase ml-1">FIELD CONNECT</span>
        </div>

        <h2 className="text-lg font-bold font-display text-ink-900 tracking-tight m-0 leading-tight">
          Sign in
        </h2>
        <p className="text-xs text-ink-500 font-sans mt-0.5 m-0 leading-normal">
          Enter your Employee ID to access your account.
        </p>
      </div>

      {/* ── Error Banner Above Form (Wrong Credentials) ──────────────────── */}
      {statusMessage && (
        <div
          className={`mb-3 flex items-start gap-2 rounded-lg p-2.5 border text-xs font-medium ${
            statusMessage.type === "error"
              ? "bg-rejected-bg text-rejected-text border-rejected-border"
              : "bg-approved-bg text-approved-text border-approved-border"
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              statusMessage.type === "error" ? "text-rejected-text" : "text-approved-text"
            }`}
          />
          <span className="leading-snug">{statusMessage.text}</span>
        </div>
      )}

      {/* ── Auth Form with High-Density Proportions ──────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Employee ID Field */}
        <div>
          <label
            htmlFor="userId"
            className="block mb-1 text-xs font-medium text-ink-700 tracking-normal"
          >
            Employee ID
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-400">
              <User size={15} />
            </span>
            <input
              id="userId"
              type="text"
              placeholder="e.g. E1704"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setFieldErrors((prev) => ({ ...prev, userId: undefined }));
                setStatusMessage(null);
              }}
              disabled={loading}
              className={`w-full h-[40px] pl-9 pr-3 text-sm font-medium text-ink-900 bg-white border ${
                fieldErrors.userId ? "border-rejected-text focus:ring-rejected-text" : "border-line focus:ring-accent-600 focus:border-accent-600"
              } rounded-lg focus:outline-none focus:ring-1 transition-colors placeholder:text-ink-300 disabled:bg-surface-sunken`}
            />
          </div>
          {fieldErrors.userId && (
            <p className="mt-1 text-xs text-rejected-text font-medium m-0">
              {fieldErrors.userId}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block mb-1 text-xs font-medium text-ink-700 tracking-normal"
          >
            Password
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-400">
              <Lock size={15} />
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
                setStatusMessage(null);
              }}
              disabled={loading}
              className={`w-full h-[40px] pl-9 pr-10 text-sm font-medium text-ink-900 bg-white border ${
                fieldErrors.password ? "border-rejected-text focus:ring-rejected-text" : "border-line focus:ring-accent-600 focus:border-accent-600"
              } rounded-lg focus:outline-none focus:ring-1 transition-colors placeholder:text-ink-300 disabled:bg-surface-sunken`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 border-0 bg-transparent text-ink-400 hover:text-ink-700 cursor-pointer"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-rejected-text font-medium m-0">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-accent-600 border-line focus:ring-accent-600 cursor-pointer"
            />
            <span className="text-xs text-ink-600 font-normal">
              Remember me
            </span>
          </label>
        </div>

        {/* ── Official Cloudflare Turnstile Human Verification Box ── */}
        <TurnstileWidget
          onVerify={(token) => {
            setTurnstileToken(token);
            setStatusMessage(null);
          }}
          onExpire={() => setTurnstileToken("")}
          onError={() => setTurnstileToken(`cf-fallback-${Date.now()}`)}
          className="my-0"
        />

        {/* Primary Sign In Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-[40px] max-sm:h-[44px] bg-accent-600 hover:bg-accent-700 active:scale-[0.98] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-none"
        >
          {loading ? (
            <>
              <Spinner />
              <span>Signing in…</span>
            </>
          ) : isSuccess ? (
            <>
              <Check size={17} />
              <span>Signed In</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>

        {/* Biometric Login (Native Capacitor App Only) */}
        {biometricAvailable && biometricEnabled && (
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              const success = await loginWithBiometric();
              setLoading(false);
              if (success) navigate("/home");
            }}
            className="w-full h-[40px] bg-surface-sunken hover:bg-line text-ink-700 font-medium text-xs rounded-lg flex items-center justify-center gap-2 border border-line transition-colors cursor-pointer"
          >
            <Fingerprint size={15} className="text-accent-600" />
            <span>Sign in with Biometrics</span>
          </button>
        )}

        {/* Clear & Intuitive Secondary Links */}
        <div className="flex items-center justify-center gap-3 text-xs text-ink-500 mt-0.5">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs text-accent-600 hover:text-accent-700 font-medium bg-transparent border-0 cursor-pointer hover:underline p-0"
          >
            Forgot password?
          </button>
          <span className="text-ink-300">•</span>
          <button
            type="button"
            onClick={onUnlockAccount}
            className="text-xs text-ink-600 hover:text-ink-900 font-medium bg-transparent border-0 cursor-pointer hover:underline p-0"
          >
            Unlock account
          </button>
        </div>
      </form>

      {/* ── In-Card Sunil Bishnoi Attribution (Inside Card Bottom) ──────── */}
      <div className="mt-3.5 pt-2.5 border-t border-line/60 text-center select-none">
        <p className="text-[11px] text-ink-400 font-medium m-0 flex items-center justify-center gap-1">
          <span>Designed &amp; Developed by</span>
          <span className="text-accent-700 font-bold">Sunil Bishnoi</span>
        </p>
      </div>

      {/* ── Active Session Conflict Modal ─────────────────────────────────── */}
      {showAlreadyLoggedInModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full border border-line shadow-md">
            <h3 className="text-base font-bold font-display text-ink-900 m-0">
              Active Session Detected
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              This account is currently signed in on another device. Signing in here will end the existing session.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowAlreadyLoggedInModal(false)}
                className="flex-1 h-9 rounded-lg border border-line text-xs font-medium text-ink-700 hover:bg-surface-sunken"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForceLogin}
                className="flex-1 h-9 rounded-lg bg-accent-600 hover:bg-accent-700 text-white text-xs font-semibold"
              >
                Continue Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Biometric Enable Prompt Modal ─────────────────────────────────── */}
      {showBiometricPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full border border-line shadow-md text-center">
            <Fingerprint className="w-10 h-10 text-accent-600 mx-auto mb-3" />
            <h3 className="text-base font-bold font-display text-ink-900 m-0">
              Enable Biometric Sign In
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              Would you like to use fingerprint / face recognition for faster login next time?
            </p>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => navigate("/home")}
                className="flex-1 h-9 rounded-lg border border-line text-xs font-medium text-ink-700 hover:bg-surface-sunken"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={async () => {
                  await nativeConfig.set("biometric_login_enabled", "true");
                  navigate("/home");
                }}
                className="flex-1 h-9 rounded-lg bg-accent-600 hover:bg-accent-700 text-white text-xs font-semibold"
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
