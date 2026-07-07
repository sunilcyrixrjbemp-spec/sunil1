import React, { useState } from "react";
import { User, Lock, Eye, EyeOff, ArrowRight, AlertTriangle, X, Fingerprint } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/authService";
import { useBiometricLogin } from "../../hooks/useBiometricLogin";
import { isNativeApp, biometricAuth } from "../../utils/capacitor";
import { nativeConfig } from "../../utils/persistence";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

interface LoginFormProps {
  onForgotPassword: () => void;
  onUnlockAccount: () => void;
}

const PremiumSpinner = () => (
  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-200 border-t-blue-600 inline-block mr-1.5 shrink-0"></span>
);

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
        const result = await Filesystem.readFile({
          path: "CyrixField/session.json",
          directory: Directory.Data,
          encoding: Encoding.UTF8
        });
        fdToken = result?.data ? "Exists (Read success)" : "Empty";
      } catch (e: any) {
        fdToken = `Error: ${e.message || 'File not found'}`;
      }

      let feToken = "N/A";
      try {
        const result = await Filesystem.readFile({
          path: "CyrixField/session.json",
          directory: Directory.External,
          encoding: Encoding.UTF8
        });
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
      
      // Test localStorage
      localStorage.setItem("test_write", "success");
      
      // Test Preferences
      await Preferences.set({ key: "test_write", value: "success" });
      
      // Test Filesystem Data
      await Filesystem.writeFile({
        path: "CyrixField/test_write.txt",
        data: "success",
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true
      });

      // Test Filesystem External
      let extStatus = "success";
      try {
        await Filesystem.writeFile({
          path: "CyrixField/test_write.txt",
          data: "success",
          directory: Directory.External,
          encoding: Encoding.UTF8,
          recursive: true
        });
      } catch (e: any) {
        extStatus = `Failed: ${e.message}`;
      }

      setDiagData((prev: any) => ({ 
        ...prev, 
        writeTestResult: `localStorage: OK, Preferences: OK, DataFS: OK, ExternalFS: ${extStatus}` 
      }));
      await runDiagnostics();
    } catch (e: any) {
      setDiagData((prev: any) => ({ ...prev, writeTestResult: `Error: ${e.message}` }));
    }
  };

  const { biometricAvailable, biometryType, biometricEnabled, loginWithBiometric, enableBiometricLogin } = useBiometricLogin();



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
      // Force: true is always passed so other sessions are terminated automatically
      await authService.login({ user_id: userId, password, force: true });
      
      // If running as native app, check if biometric login is available but not enabled yet
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

  const handleForceLogin = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setShowAlreadyLoggedInModal(false);
    setLoading(true);
    setStatusMessage(null);
    try {
      await authService.login({ user_id: userId, password, force: true });
      
      // Check biometric for force login as well
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
    if (showDiagnostics) {
      runDiagnostics();
    }
  }, [showDiagnostics]);

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="text-center py-2 border-b border-slate-100">
        <img 
          src="/brand.png" 
          alt="Logo" 
          className="h-14 w-auto mx-auto object-contain cursor-pointer active:scale-95 transition-transform bg-white rounded-lg p-1.5 shadow-sm" 
          onClick={() => {
            const clicks = logoClicks + 1;
            setLogoClicks(clicks);
            if (clicks >= 5) {
              setShowDiagnostics(true);
              setLogoClicks(0);
            }
          }}
        />
        <p className="text-slate-500 text-[10px] mt-2 font-black uppercase tracking-widest">Account Sign In</p>
      </div>

      {statusMessage && (
        <div className={`p-3.5 border rounded-xl text-xs font-bold leading-relaxed ${
          statusMessage.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
            : "bg-rose-50 border-rose-200 text-rose-700"
        }`}>
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="userId" className="text-slate-500 font-extrabold uppercase tracking-widest text-[9px] mb-1.5 block">User ID</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <User size={14} />
            </span>
            <input
              id="userId"
              type="text"
              placeholder="Enter User ID (e.g. E1704)"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setStatusMessage(null);
              }}
              disabled={loading}
              className="w-full bg-white border border-slate-350 rounded-xl pr-3.5 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold shadow-inner"
              style={{ paddingLeft: '2.75rem' }}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="text-slate-500 font-extrabold uppercase tracking-widest text-[9px] mb-1.5 block">Password</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <Lock size={14} />
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setStatusMessage(null);
              }}
              disabled={loading}
              className="w-full bg-white border border-slate-350 rounded-xl pr-10 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold shadow-inner"
              style={{ paddingLeft: '2.75rem' }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 transition-colors border-0 bg-transparent cursor-pointer"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 flex items-center justify-center gap-2 border-0 cursor-pointer text-xs"
          >
            {loading ? (
              <>
                <PremiumSpinner />
                <span>{loadingMessage}</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>

        {/* Biometric Login Button — only shown in native app when enabled */}
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
            className="w-full h-11 flex items-center justify-center gap-2 border border-slate-250 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-extrabold uppercase tracking-wider text-[10px] transition-all cursor-pointer"
          >
            <Fingerprint size={16} className="text-indigo-600" />
            <span>{biometryType === 'face' ? 'Login with Face ID' : 'Login with Fingerprint'}</span>
          </button>
        )}
      </form>

      <div className="flex items-center justify-between text-[11px] pt-4 border-t border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
        <button
          onClick={onForgotPassword}
          className="hover:text-indigo-600 text-slate-500 transition-all border-0 bg-transparent cursor-pointer"
        >
          Forgot Password?
        </button>
        <button
          onClick={onUnlockAccount}
          className="hover:text-indigo-600 text-slate-500 transition-all border-0 bg-transparent cursor-pointer"
        >
          Unlock Account
        </button>
      </div>

      {/* Already Logged In Overlay Modal */}
      {showAlreadyLoggedInModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn text-slate-800">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-650" />
                Active Session Detected
              </h3>
              <button 
                onClick={() => setShowAlreadyLoggedInModal(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 text-xs space-y-3 leading-relaxed">
              <p className="font-bold text-slate-700">
                You are currently logged in on another device or browser tab. 
              </p>
              <p className="text-slate-500">
                Logging in here will automatically terminate your session on the other device. Do you want to proceed?
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAlreadyLoggedInModal(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border-0 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForceLogin}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider border-0 cursor-pointer shadow-md shadow-indigo-600/10 transition-all"
              >
                Yes, Log In Here
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Biometric Enable Prompt */}
      {showBiometricPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn">
            <div className="px-4 py-3 bg-indigo-500/10 border-b border-indigo-500/20">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Fingerprint className="w-4 h-4" />
                Enable {biometryType === 'face' ? 'Face ID' : 'Fingerprint'} Login
              </h3>
            </div>
            <div className="p-5 text-xs space-y-3 leading-relaxed text-slate-300">
              <p className="font-bold text-slate-200">
                Would you like to use {biometryType === 'face' ? 'Face ID' : 'Fingerprint'} for faster login next time?
              </p>
              <p className="text-slate-400">You can disable this anytime from Profile settings.</p>
            </div>
            <div className="px-4 py-3 bg-slate-950/40 border-t border-slate-850/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowBiometricPrompt(false); navigate("/home"); }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border-0 cursor-pointer transition-all"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={async () => {
                  await enableBiometricLogin(userId, password);
                  setShowBiometricPrompt(false);
                  navigate("/home");
                }}
                className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider border-0 cursor-pointer shadow-md shadow-indigo-600/10 transition-all flex items-center gap-1"
              >
                <Fingerprint size={12} /> Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Storage Diagnostic Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-955 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-8">
            <div className="px-4 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                Developer Diagnostic Panel
              </h3>
              <button 
                type="button" 
                onClick={() => setShowDiagnostics(false)} 
                className="text-slate-400 hover:text-white bg-transparent border-0 cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-5 text-[11px] space-y-4 font-mono max-h-[60vh] overflow-y-auto bg-slate-950 text-slate-300">
              <div className="space-y-1">
                <span className="text-slate-500 block font-bold">[LocalStorage Token]</span>
                <span className="text-emerald-400 break-all bg-slate-900 p-2.5 rounded-lg block border border-slate-850 shadow-inner">{diagData.localStorageToken}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block font-bold">[Preferences Token]</span>
                <span className="text-emerald-400 break-all bg-slate-900 p-2.5 rounded-lg block border border-slate-850 shadow-inner">{diagData.prefToken}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block font-bold">[Directory.Data Session File]</span>
                <span className="text-amber-450 break-all bg-slate-900 p-2.5 rounded-lg block border border-slate-850 shadow-inner">{diagData.fileDataToken}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block font-bold">[Directory.External Session File]</span>
                <span className="text-amber-450 break-all bg-slate-900 p-2.5 rounded-lg block border border-slate-850 shadow-inner">{diagData.fileExternalToken}</span>
              </div>
              <div className="space-y-1 border-t border-slate-800 pt-3">
                <span className="text-slate-500 block font-bold">[Test Write Status]</span>
                <span className="text-cyan-400 break-all bg-slate-900 p-2.5 rounded-lg block border border-slate-850 shadow-inner">{diagData.writeTestResult || "Click Test Write to start"}</span>
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={testWrite}
                className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider border-0 cursor-pointer transition-all shadow-md shadow-cyan-600/10"
              >
                Run Write Test
              </button>
              <button
                type="button"
                onClick={runDiagnostics}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border-0 cursor-pointer transition-all"
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
