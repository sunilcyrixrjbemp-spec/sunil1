import React, { useState } from "react";
import { User, Lock, Eye, EyeOff, ArrowRight, AlertTriangle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/authService";

interface LoginFormProps {
  onForgotPassword: () => void;
  onUnlockAccount: () => void;
}

const PremiumSpinner = () => (
  <div className="relative flex items-center justify-center w-4 h-4 shrink-0 mr-2">
    <span className="absolute w-full h-full border-2 border-blue-500/30 border-t-blue-600 rounded-full animate-spin"></span>
  </div>
);

export default function LoginForm({ onForgotPassword, onUnlockAccount }: LoginFormProps) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAlreadyLoggedInModal, setShowAlreadyLoggedInModal] = useState(false);

  const saveBootstrapData = (response: any) => {
    const loggedUser = response.user;
    const user_id = loggedUser.user_id;
    const monthStr = new Date().toISOString().slice(0, 7);
    
    if (response.bootstrap_data) {
      const bd = response.bootstrap_data;
      localStorage.setItem("cache_dropdowns", JSON.stringify(bd.dropdowns));
      localStorage.setItem(`cache_month_limits_${user_id}_${monthStr}`, JSON.stringify(bd.expense_init));
      localStorage.setItem(`cache_my_expenses_${user_id}`, JSON.stringify(bd.my_expenses));
      localStorage.setItem(`cache_allowance_stats_${user_id}`, JSON.stringify(bd.allowance_stats));
      localStorage.setItem(`cache_team_expenses_${user_id}`, JSON.stringify(bd.team_expenses));
      localStorage.setItem(`cache_approvals_count_${user_id}`, (bd.pending_approvals_count || 0).toString());
      localStorage.setItem("cache_pending_approvals", JSON.stringify(bd.pending_approvals || []));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    
    if (!userId.trim() || !password) {
      setStatusMessage({ type: "error", text: "Please fill in all fields." });
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login({ user_id: userId, password });
      saveBootstrapData(response);
      navigate("/home");
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.detail === "ALREADY_LOGGED_IN") {
        setShowAlreadyLoggedInModal(true);
        setLoading(false);
        return;
      }
      const errorMsg = err.response?.data?.detail || "Invalid User ID or Password";
      setStatusMessage({ type: "error", text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogin = async () => {
    setShowAlreadyLoggedInModal(false);
    setLoading(true);
    setStatusMessage(null);
    try {
      const response = await authService.login({ user_id: userId, password, force: true });
      saveBootstrapData(response);
      navigate("/home");
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Invalid User ID or Password";
      setStatusMessage({ type: "error", text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="text-center py-2 border-b border-gray-200">
        <img src="/brand.png" alt="Logo" className="h-14 w-auto mx-auto object-contain" />
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
              className="input-lte-icon"
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
              className="input-lte-icon"
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
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
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

    </div>
  );
}
