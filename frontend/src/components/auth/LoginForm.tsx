import React, { useState } from "react";
import { User, Lock, Eye, EyeOff, AlertTriangle, X, Fingerprint, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/authService";
import { useBiometricLogin } from "../../hooks/useBiometricLogin";
import { isNativeApp, biometricAuth } from "../../utils/capacitor";
import { nativeConfig } from "../../utils/persistence";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

// ─── Props ────────────────────────────────────────────────────────────────────
interface LoginFormProps {
  onForgotPassword: () => void;
  onUnlockAccount: () => void;
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
const Spinner = () => (
  <span
    className="inline-block shrink-0"
    style={{
      width: 14, height: 14,
      border: "2px solid rgba(255,255,255,0.30)",
      borderTopColor: "#ffffff",
      borderRadius: "50%",
      animation: "spin 0.6s linear infinite",
    }}
  />
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginForm({ onForgotPassword, onUnlockAccount }: LoginFormProps) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Authenticating...");
  const isSubmitting = React.useRef(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAlreadyLoggedInModal, setShowAlreadyLoggedInModal] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isHumanVerified, setIsHumanVerified] = useState(false);
  const [verifyingHuman, setVerifyingHuman] = useState(false);
  const [diagData, setDiagData] = useState<any>({
    localStorageToken: "",
    localStorageUser: "",
    prefToken: "",
    prefUser: "",
    fileDataToken: "",
    fileExternalToken: "",
    writeTestResult: ""
  });

  // ── Show account lock message if redirected after session termination ──────
  React.useEffect(() => {
    try {
      const lockMsg = sessionStorage.getItem("account_lock_msg");
      if (lockMsg) {
        setStatusMessage({ type: "error", text: lockMsg });
        sessionStorage.removeItem("account_lock_msg");
      }
    } catch (_) {}
  }, []);

  // ── Diagnostics — UNTOUCHED logic ─────────────────────────────────────────
  const runDiagnostics = async () => {
    try {
      const lsToken = localStorage.getItem("access_token");
      const lsUser = localStorage.getItem("user");
      let pToken = "N/A";
      let pUser = "N/A";
      try {
        const { value: t } = await Preferences.get({ key: "access_token" });
        pToken = t || "null";
        const { value: u } = await Preferences.get({ key: "user" });
        pUser = u || "null";
      } catch (e: any) {
        pToken = `Error: ${e.message}`;
      }
      let fdToken = "N/A";
      try {
        const result = await Filesystem.readFile({ path: "CyrixField/session.json", directory: Directory.Data, encoding: Encoding.UTF8 });
        fdToken = result?.data ? "Exists (Read success)" : "Empty";
      } catch (e: any) {
        fdToken = `Error: ${e.message || 'File not found'}`;
      }
      let feToken = "N/A";
      try {
        const result = await Filesystem.readFile({ path: "CyrixField/session.json", directory: Directory.External, encoding: Encoding.UTF8 });
        feToken = result?.data ? "Exists (Read success)" : "Empty";
      } catch (e: any) {
        feToken = `Error: ${e.message || 'File not found'}`;
      }
      setDiagData((prev: any) => ({
        ...prev,
        localStorageToken: lsToken || "null",
        localStorageUser: lsUser || "null",
        prefToken: pToken,
        prefUser: pUser,
        fileDataToken: fdToken,
        fileExternalToken: feToken
      }));
    } catch (e: any) {
      console.error(e);
    }
  };

  const testWrite = async () => {
    try {
      setDiagData((prev: any) => ({ ...prev, writeTestResult: "Writing..." }));
      localStorage.setItem("test_write", "success");
      await Preferences.set({ key: "test_write", value: "success" });
      await Filesystem.writeFile({ path: "CyrixField/test_write.txt", data: "success", directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
      let extStatus = "success";
      try {
        await Filesystem.writeFile({ path: "CyrixField/test_write.txt", data: "success", directory: Directory.External, encoding: Encoding.UTF8, recursive: true });
      } catch (e: any) {
        extStatus = `Failed: ${e.message}`;
      }
      setDiagData((prev: any) => ({ ...prev, writeTestResult: `localStorage: OK, Preferences: OK, DataFS: OK, ExternalFS: ${extStatus}` }));
      await runDiagnostics();
    } catch (e: any) {
      setDiagData((prev: any) => ({ ...prev, writeTestResult: `Error: ${e.message}` }));
    }
  };

  const { biometricAvailable, biometryType, biometricEnabled, loginWithBiometric, enableBiometricLogin } = useBiometricLogin();

  // ── Submit — UNTOUCHED logic ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setStatusMessage(null);
    if (!userId.trim() || !password) {
      setStatusMessage({ type: "error", text: "Please fill in all fields." });
      isSubmitting.current = false;
      return;
    }
    if (!isNativeApp() && !isHumanVerified) {
      setStatusMessage({ type: "error", text: "Please verify that you are human to proceed." });
      isSubmitting.current = false;
      return;
    }
    setLoading(true);
    setLoadingMessage("Authenticating...");
    try {
      await authService.login({ user_id: userId, password, force: true });
      if (isNativeApp()) {
        try {
          const available = await biometricAuth.isAvailable();
          const enabled = (await nativeConfig.get('biometric_login_enabled')) === 'true';
          if (available && !enabled) {
            setShowBiometricPrompt(true);
            isSubmitting.current = false;
            setLoading(false);
            return;
          }
        } catch (_) {}
      }
      navigate("/home");
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.detail === "ALREADY_LOGGED_IN") {
        setShowAlreadyLoggedInModal(true);
        isSubmitting.current = false;
        setLoading(false);
        return;
      }
      let errorMsg = "Invalid User ID or Password";
      if (!err.response) {
        errorMsg = "Unable to connect to the server. Please check your internet connection or try again.";
      } else if (err.response.data?.detail) {
        errorMsg = err.response.data.detail;
      }
      setStatusMessage({ type: "error", text: errorMsg });
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  // ── Force login — UNTOUCHED logic ─────────────────────────────────────────
  const handleForceLogin = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setShowAlreadyLoggedInModal(false);
    if (!isNativeApp() && !isHumanVerified) {
      setStatusMessage({ type: "error", text: "Please verify that you are human to proceed." });
      isSubmitting.current = false;
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      await authService.login({ user_id: userId, password, force: true });
      if (isNativeApp()) {
        try {
          const available = await biometricAuth.isAvailable();
          const enabled = (await nativeConfig.get('biometric_login_enabled')) === 'true';
          if (available && !enabled) {
            setShowBiometricPrompt(true);
            isSubmitting.current = false;
            setLoading(false);
            return;
          }
        } catch (_) {}
      }
      navigate("/home");
    } catch (err: any) {
      let errorMsg = "Invalid User ID or Password";
      if (!err.response) {
        errorMsg = "Unable to connect to the server. Please check your internet connection or try again.";
      } else if (err.response.data?.detail) {
        errorMsg = err.response.data.detail;
      }
      setStatusMessage({ type: "error", text: errorMsg });
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (showDiagnostics) runDiagnostics();
  }, [showDiagnostics]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-7 sm:p-8">

      {/* ── Logo + Title ────────────────────────────────────────────────── */}
      <div className="text-center mb-6">
        <div
          className="inline-flex items-center justify-center mb-4 cursor-pointer"
          onClick={() => {
            const clicks = logoClicks + 1;
            setLogoClicks(clicks);
            if (clicks >= 5) { setShowDiagnostics(true); setLogoClicks(0); }
          }}
        >
          <img
            src="/logo-fieldconnect.png"
            alt="Cyrix Field Connect Logo"
            className="h-10 sm:h-11 w-auto object-contain drop-shadow-xs"
            height="44"
          />
        </div>
        <h1
          className="m-0 text-2xl font-bold text-slate-900 tracking-tight"
          style={{ fontFamily: "'Inter Tight', 'Inter', sans-serif" }}
        >
          Sign in
        </h1>
        <p className="mt-1.5 m-0 text-sm text-slate-500 font-normal">
          Enter your Employee ID to access your account.
        </p>
      </div>

      {/* ── Status Message ──────────────────────────────────────────────── */}
      {statusMessage && (
        <div
          className="mb-5 flex items-start gap-2.5 rounded-lg p-3 border-l-4"
          style={{
            backgroundColor: statusMessage.type === "error" ? "#fef2f2" : "#ecfdf5",
            borderColor: statusMessage.type === "error" ? "#fca5a5" : "#6ee7b7",
            borderLeftColor: statusMessage.type === "error" ? "#dc2626" : "#059669",
          }}
        >
          <AlertTriangle
            style={{
              width: 15, height: 15, marginTop: 1, flexShrink: 0,
              color: statusMessage.type === "error" ? "#dc2626" : "#059669",
            }}
          />
          <span style={{ fontSize: 12, color: statusMessage.type === "error" ? "#991b1b" : "#065f46", fontWeight: 600, lineHeight: "18px" }}>
            {statusMessage.text}
          </span>
        </div>
      )}

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Employee ID Field */}
        <div>
          <label
            htmlFor="userId"
            className="block mb-1.5 text-xs font-semibold text-slate-700"
          >
            Employee ID
          </label>
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <User size={17} />
            </span>
            <input
              id="userId"
              type="text"
              placeholder="e.g. E1704"
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setStatusMessage(null); }}
              disabled={loading}
              required
              className="w-full h-11 pl-10 pr-3.5 text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block mb-1.5 text-xs font-semibold text-slate-700"
          >
            Password
          </label>
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <Lock size={17} />
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setStatusMessage(null); }}
              disabled={loading}
              required
              className="w-full h-11 pl-10 pr-10 text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 border-0 bg-transparent text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs text-slate-600 font-medium">Remember me</span>
          </label>
        </div>

        {/* Cloudflare Turnstile Box */}
        <div
          onClick={() => {
            if (!isHumanVerified && !verifyingHuman) {
              setVerifyingHuman(true);
              setStatusMessage(null);
              setTimeout(() => {
                setVerifyingHuman(false);
                setIsHumanVerified(true);
              }, 600);
            }
          }}
          className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all select-none ${
            isHumanVerified
              ? "bg-emerald-50/40 border-emerald-300"
              : statusMessage?.text?.toLowerCase().includes("human")
              ? "bg-rose-50/50 border-rose-400 ring-2 ring-rose-200"
              : "bg-slate-50/60 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${
                isHumanVerified
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : verifyingHuman
                  ? "border-indigo-500 bg-white"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              {isHumanVerified ? (
                <Check size={16} className="stroke-[3]" />
              ) : verifyingHuman ? (
                <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : null}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-700">
                {isHumanVerified ? "Human verification complete" : "Verify you are human"}
              </span>
              <span className="text-[10px] text-slate-400">
                {isHumanVerified ? "Session verified" : "Click to verify your session"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <svg className="w-5 h-5 text-[#F38020]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.42 9.22a5.5 5.5 0 0 0-10.4-1.74A4.5 4.5 0 0 0 3 11.5a4.5 4.5 0 0 0 4.5 4.5h11a3.5 3.5 0 0 0 .92-6.78z" />
              </svg>
              <span className="text-[11px] font-bold text-slate-700 tracking-tight">Cloudflare</span>
            </div>
            <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Privacy</span>
              <span>•</span>
              <span>Terms</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 mt-1 bg-[#4338ca] hover:bg-[#3730a3] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 border-0 shadow-sm transition-colors cursor-pointer active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <><Spinner /><span className="normal-case font-normal text-xs">{loadingMessage}</span></>
          ) : (
            <span>Sign In</span>
          )}
        </button>

        {/* Biometric Login — native app only */}
        {biometricAvailable && biometricEnabled && (
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              const success = await loginWithBiometric();
              setLoading(false);
              if (success) navigate("/home");
            }}
            disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            <Fingerprint size={16} className="text-indigo-600" />
            <span>{biometryType === 'face' ? 'Login with Face ID' : 'Login with Fingerprint'}</span>
          </button>
        )}
      </form>

      {/* ── Footer links ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 mt-5 text-xs text-slate-500 font-medium">
        <button
          type="button"
          onClick={onForgotPassword}
          className="border-0 bg-transparent cursor-pointer text-indigo-600 hover:text-indigo-800 hover:underline transition-colors font-medium p-0"
        >
          Forgot password?
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={onUnlockAccount}
          className="border-0 bg-transparent cursor-pointer text-indigo-600 hover:text-indigo-800 hover:underline transition-colors font-medium p-0"
        >
          Unlock account
        </button>
      </div>

      <p className="text-center mt-6 mb-0 text-xs text-slate-400 font-medium">
        Designed &amp; Developed by{" "}
        <a
          href="https://sunilbishnoi.co.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline font-semibold"
        >
          Sunil Bishnoi
        </a>
      </p>

      {/* ══════════════════════════════════════════════════════════════════
          MODALS — all logic UNTOUCHED, only visual rebuilt
      ══════════════════════════════════════════════════════════════════ */}

      {/* Already Logged In Modal */}
      {showAlreadyLoggedInModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ backgroundColor: "rgba(18,21,26,0.60)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full animate-scale-up"
            style={{
              maxWidth: 380, backgroundColor: "var(--surface)",
              border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden",
              boxShadow: "0 8px 24px -4px rgba(18,21,26,0.14)",
            }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: "12px 16px",
                backgroundColor: "var(--pending-bg)",
                borderBottom: "1px solid var(--pending-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle style={{ width: 15, height: 15, color: "var(--pending-text)" }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--pending-text)" }}>
                  Active Session Detected
                </span>
              </div>
              <button
                onClick={() => setShowAlreadyLoggedInModal(false)}
                className="flex items-center justify-center rounded border-0 bg-transparent cursor-pointer"
                style={{ width: 28, height: 28, color: "var(--ink-500)" }}
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <p className="m-0" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>
                You are currently logged in on another device or browser tab.
              </p>
              <p className="m-0" style={{ fontSize: 13, color: "var(--ink-500)", lineHeight: "20px" }}>
                Logging in here will automatically terminate your session on the other device. Do you want to proceed?
              </p>
            </div>

            {/* Modal footer */}
            <div
              className="flex items-center justify-end gap-2"
              style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", backgroundColor: "var(--surface-sunken)" }}
            >
              <button
                type="button"
                onClick={() => setShowAlreadyLoggedInModal(false)}
                className="btn-lte-outline"
                style={{ height: 36, fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForceLogin}
                className="btn-lte-primary"
                style={{ height: 36, fontSize: 12 }}
              >
                Yes, Log In Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Biometric Enable Prompt */}
      {showBiometricPrompt && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ backgroundColor: "rgba(18,21,26,0.70)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full animate-scale-up"
            style={{
              maxWidth: 380,
              backgroundColor: "var(--accent-900)",
              border: "1px solid rgba(99,102,241,0.20)",
              borderRadius: 10, overflow: "hidden",
              boxShadow: "0 8px 24px -4px rgba(18,21,26,0.30)",
            }}
          >
            <div
              className="flex items-center gap-2"
              style={{ padding: "12px 16px", borderBottom: "1px solid rgba(99,102,241,0.15)" }}
            >
              <Fingerprint style={{ width: 15, height: 15, color: "var(--accent-400)" }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--accent-400)" }}>
                Enable {biometryType === 'face' ? 'Face ID' : 'Fingerprint'} Login
              </span>
            </div>
            <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <p className="m-0" style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.90)" }}>
                Would you like to use {biometryType === 'face' ? 'Face ID' : 'Fingerprint'} for faster login next time?
              </p>
              <p className="m-0" style={{ fontSize: 13, color: "rgba(255,255,255,0.50)" }}>
                You can disable this anytime from Profile settings.
              </p>
            </div>
            <div
              className="flex items-center justify-end gap-2"
              style={{ padding: "12px 16px", borderTop: "1px solid rgba(99,102,241,0.12)" }}
            >
              <button
                type="button"
                onClick={() => { setShowBiometricPrompt(false); navigate("/home"); }}
                className="flex items-center justify-center gap-1.5 rounded-lg border-0 cursor-pointer transition-all"
                style={{ height: 36, padding: "0 14px", fontSize: 12, fontWeight: 600, backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.60)" }}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={async () => { await enableBiometricLogin(userId, password); setShowBiometricPrompt(false); navigate("/home"); }}
                className="btn-lte-primary flex items-center gap-1.5"
                style={{ height: 36, fontSize: 12 }}
              >
                <Fingerprint size={13} /> Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Diagnostic Modal */}
      {showDiagnostics && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto"
          style={{ backgroundColor: "rgba(18,21,26,0.80)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full my-8"
            style={{
              maxWidth: 440,
              backgroundColor: "#0D1117",
              border: "1px solid rgba(99,102,241,0.20)",
              borderRadius: 10, overflow: "hidden",
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--accent-400)", fontFamily: "'IBM Plex Mono', monospace" }}>
                Developer Diagnostic Panel
              </span>
              <button
                type="button"
                onClick={() => setShowDiagnostics(false)}
                className="flex items-center justify-center border-0 bg-transparent cursor-pointer text-lg font-bold"
                style={{ color: "rgba(255,255,255,0.40)" }}
              >
                &times;
              </button>
            </div>
            <div
              className="space-y-4"
              style={{ padding: "16px", maxHeight: "55vh", overflowY: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}
            >
              {[
                { label: "[LocalStorage Token]", value: diagData.localStorageToken, color: "#3FB950" },
                { label: "[Preferences Token]", value: diagData.prefToken, color: "#3FB950" },
                { label: "[Directory.Data Session File]", value: diagData.fileDataToken, color: "#E3B341" },
                { label: "[Directory.External Session File]", value: diagData.fileExternalToken, color: "#E3B341" },
                { label: "[Test Write Status]", value: diagData.writeTestResult || "Click Test Write to start", color: "#58A6FF" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>{label}</span>
                  <span
                    style={{
                      color, wordBreak: "break-all",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      padding: "8px 10px", borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="flex items-center justify-between gap-2"
              style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}
            >
              <button
                type="button"
                onClick={testWrite}
                className="flex items-center justify-center rounded-lg border-0 cursor-pointer transition-all"
                style={{ height: 36, padding: "0 14px", fontSize: 12, fontWeight: 600, backgroundColor: "#0E7490", color: "#ffffff" }}
              >
                Run Write Test
              </button>
              <button
                type="button"
                onClick={runDiagnostics}
                className="flex items-center justify-center rounded-lg border-0 cursor-pointer transition-all"
                style={{ height: 36, padding: "0 14px", fontSize: 12, fontWeight: 600, backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.70)" }}
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
