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
  <span className="spinner-lte mr-1.5"></span>
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
    <div className="p-6 sm:p-8 space-y-5">
      <div className="text-center py-2 border-b border-gray-200">
        <img 
          src="/brand.png" 
          alt="Logo" 
          className="h-14 w-auto mx-auto object-contain cursor-pointer active:scale-95 transition-transform" 
          onClick={() => {
            const clicks = logoClicks + 1;
            setLogoClicks(clicks);
            if (clicks >= 5) {
              setShowDiagnostics(true);
              setLogoClicks(0);
            }
          }}
        />
        <p className="text-gray-500 text-xs mt-1.5 font-bold uppercase tracking-wider">Account Sign In</p>
      </div>

      {statusMessage && (
        <div className={`p-3 border rounded text-xs font-semibold ${
          statusMessage.type === "success" 
            ? "bg-green-50 border-green-200 text-green-700" 
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="userId" className="label-lte">User ID</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
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
              className="input-lte-icon !pl-11"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="label-lte">Password</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
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
              className="input-lte-icon !pl-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-lte-primary w-full h-9"
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
            className="w-full h-10 flex items-center justify-center gap-2 border-2 border-blue-500 text-blue-600 rounded font-bold text-xs hover:bg-blue-50 transition-all"
          >
            <Fingerprint size={18} />
            <span>{biometryType === 'face' ? 'Login with Face ID' : 'Login with Fingerprint'}</span>
          </button>
        )}
      </form>

      <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-100 text-gray-500">
        <button
          onClick={onForgotPassword}
          className="hover:text-blue-600 transition-all font-semibold hover:underline"
        >
          Forgot Password?
        </button>
        <button
          onClick={onUnlockAccount}
          className="hover:text-blue-600 transition-all font-semibold hover:underline"
        >
          Unlock Account
        </button>
      </div>

      {/* Already Logged In Overlay Modal */}
      {showAlreadyLoggedInModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 animate-fadeIn text-gray-800">
          <div className="bg-white border border-gray-300 rounded shadow-xl w-full max-w-sm overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Active Session Detected
              </h3>
              <button 
                onClick={() => setShowAlreadyLoggedInModal(false)}
                className="p-1 hover:bg-amber-100 rounded text-amber-600 hover:text-amber-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 text-xs space-y-3">
              <p className="font-semibold text-gray-700 leading-relaxed">
                You are currently logged in on another device or browser tab. 
              </p>
              <p className="text-gray-500 font-medium">
                Logging in here will automatically terminate your session on the other device. Do you want to proceed?
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAlreadyLoggedInModal(false)}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[11px] font-bold border-0 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForceLogin}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold border-0 cursor-pointer shadow-sm transition-all"
              >
                Yes, Log In Here
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Biometric Enable Prompt */}
      {showBiometricPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-gray-300 rounded shadow-xl w-full max-w-sm overflow-hidden animate-scaleIn">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4" />
                Enable {biometryType === 'face' ? 'Face ID' : 'Fingerprint'} Login
              </h3>
            </div>
            <div className="p-4 text-xs space-y-3">
              <p className="font-semibold text-gray-700">
                Would you like to use {biometryType === 'face' ? 'Face ID' : 'Fingerprint'} for faster login next time?
              </p>
              <p className="text-gray-500">You can disable this anytime from Profile settings.</p>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowBiometricPrompt(false); navigate("/home"); }}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[11px] font-bold border-0 cursor-pointer transition-all"
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
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold border-0 cursor-pointer shadow-sm transition-all flex items-center gap-1"
              >
                <Fingerprint size={12} /> Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Storage Diagnostic Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 text-slate-100 rounded-lg shadow-2xl w-full max-w-md overflow-hidden my-8">
            <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                Developer Diagnostic Panel
              </h3>
              <button 
                type="button" 
                onClick={() => setShowDiagnostics(false)} 
                className="text-slate-400 hover:text-slate-100 bg-transparent border-0 cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 text-xs space-y-4 font-mono max-h-[60vh] overflow-y-auto">
              <div className="space-y-1">
                <span className="text-gray-400 block font-semibold">[LocalStorage Token]</span>
                <span className="text-green-400 break-all bg-slate-950 p-1.5 rounded block">{diagData.localStorageToken}</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 block font-semibold">[Preferences Token]</span>
                <span className="text-green-400 break-all bg-slate-950 p-1.5 rounded block">{diagData.prefToken}</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 block font-semibold">[Directory.Data Session File]</span>
                <span className="text-yellow-400 break-all bg-slate-950 p-1.5 rounded block">{diagData.fileDataToken}</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 block font-semibold">[Directory.External Session File]</span>
                <span className="text-yellow-400 break-all bg-slate-950 p-1.5 rounded block">{diagData.fileExternalToken}</span>
              </div>
              <div className="space-y-1 border-t border-slate-700 pt-3">
                <span className="text-gray-400 block font-semibold">[Test Write Status]</span>
                <span className="text-cyan-400 break-all bg-slate-950 p-1.5 rounded block">{diagData.writeTestResult || "Click Test Write to start"}</span>
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-800 border-t border-slate-700 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={testWrite}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-[11px] font-bold border-0 cursor-pointer transition-all"
              >
                Run Write Test
              </button>
              <button
                type="button"
                onClick={runDiagnostics}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-[11px] font-bold border-0 cursor-pointer transition-all"
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
