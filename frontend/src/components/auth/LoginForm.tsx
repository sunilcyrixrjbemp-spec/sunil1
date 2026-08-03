import React, { useState } from "react";
import { User, Lock, Eye, EyeOff, ArrowRight, AlertTriangle, X, Fingerprint } from "lucide-react";
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
  const [diagData, setDiagData] = useState<any>({
    localStorageToken: "",
    localStorageUser: "",
    prefToken: "",
    prefUser: "",
    fileDataToken: "",
    fileExternalToken: "",
    writeTestResult: ""
  });

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
    <div style={{ padding: "40px 36px 32px" }}>

      {/* ── Logo + Title ────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <img
          src="/brand.png"
          alt="Cyrix Field Ops"
          className="mx-auto object-contain cursor-pointer"
          style={{ height: 52, width: "auto", marginBottom: 16 }}
          onClick={() => {
            const clicks = logoClicks + 1;
            setLogoClicks(clicks);
            if (clicks >= 5) { setShowDiagnostics(true); setLogoClicks(0); }
          }}
        />
        <h1
          className="m-0"
          style={{
            fontFamily: "'Inter Tight', 'Inter', sans-serif",
            fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
            color: "var(--ink-900)",
          }}
        >
          Welcome back
        </h1>
        <p className="mt-1 m-0" style={{ fontSize: 13, color: "var(--ink-500)" }}>
          Sign in to your Cyrix Field Ops account
        </p>
      </div>

      {/* ── Status Message ──────────────────────────────────────────────── */}
      {statusMessage && (
        <div
          className="mb-5 flex items-start gap-2.5 rounded-lg"
          style={{
            padding: "11px 14px",
            backgroundColor: statusMessage.type === "error" ? "var(--rejected-bg)" : "var(--approved-bg)",
            border: `1px solid ${statusMessage.type === "error" ? "var(--rejected-border)" : "var(--approved-border)"}`,
            borderLeft: `3px solid ${statusMessage.type === "error" ? "var(--rejected-text)" : "var(--approved-text)"}`,
          }}
        >
          <AlertTriangle
            style={{
              width: 14, height: 14, marginTop: 1, flexShrink: 0,
              color: statusMessage.type === "error" ? "var(--rejected-text)" : "var(--approved-text)",
            }}
          />
          <span style={{ fontSize: 13, color: statusMessage.type === "error" ? "var(--rejected-text)" : "var(--approved-text)", fontWeight: 500, lineHeight: "18px" }}>
            {statusMessage.text}
          </span>
        </div>
      )}

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* User ID Field */}
        <div>
          <label
            htmlFor="userId"
            style={{
              display: "block", marginBottom: 6,
              fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
              color: "var(--ink-500)",
            }}
          >
            User ID
          </label>
          <div className="relative">
            <span
              className="absolute inset-y-0 left-0 flex items-center pointer-events-none"
              style={{ paddingLeft: 12, color: "var(--ink-300)" }}
            >
              <User size={15} />
            </span>
            <input
              id="userId"
              type="text"
              placeholder="e.g. E1704"
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setStatusMessage(null); }}
              disabled={loading}
              required
              className="input-lte"
              style={{ paddingLeft: 40 }}
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            style={{
              display: "block", marginBottom: 6,
              fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
              color: "var(--ink-500)",
            }}
          >
            Password
          </label>
          <div className="relative">
            <span
              className="absolute inset-y-0 left-0 flex items-center pointer-events-none"
              style={{ paddingLeft: 12, color: "var(--ink-300)" }}
            >
              <Lock size={15} />
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setStatusMessage(null); }}
              disabled={loading}
              required
              className="input-lte"
              style={{ paddingLeft: 40, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center border-0 bg-transparent cursor-pointer"
              style={{ paddingRight: 12, color: "var(--ink-300)" }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-lte-primary w-full"
          style={{ height: 44, fontSize: 14, fontWeight: 600, gap: 8, marginTop: 4 }}
        >
          {loading ? (
            <><Spinner /><span>{loadingMessage}</span></>
          ) : (
            <><span>Sign In</span><ArrowRight size={15} /></>
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
            className="w-full flex items-center justify-center gap-2 border-0 cursor-pointer transition-all rounded-lg"
            style={{
              height: 44, fontSize: 13, fontWeight: 600,
              backgroundColor: "var(--surface-sunken)",
              border: "1px solid var(--line)",
              color: "var(--ink-700)",
            }}
          >
            <Fingerprint size={16} style={{ color: "var(--accent-600)" }} />
            <span>{biometryType === 'face' ? 'Login with Face ID' : 'Login with Fingerprint'}</span>
          </button>
        )}
      </form>

      {/* ── Footer links ────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between mt-6 pt-5"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <button
          onClick={onForgotPassword}
          className="border-0 bg-transparent cursor-pointer"
          style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-500)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--accent-600)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-500)")}
        >
          Forgot Password?
        </button>
        <button
          onClick={onUnlockAccount}
          className="border-0 bg-transparent cursor-pointer"
          style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-500)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--accent-600)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-500)")}
        >
          Unlock Account
        </button>
      </div>

      {/* ── Attribution ─────────────────────────────────────────────────── */}
      <p className="text-center mt-4 m-0" style={{ fontSize: 11, color: "var(--ink-300)" }}>
        Designed by{" "}
        <a
          href="https://sunilbishnoi.co.in/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent-600)", fontWeight: 600, textDecoration: "none" }}
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
