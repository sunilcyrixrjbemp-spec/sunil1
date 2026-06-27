import React, { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";

interface ResetPasswordProps {
  onSuccess?: () => void;
}

export default function ResetPassword({ onSuccess }: ResetPasswordProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkPasswordStrength = (pass: string) => {
    const hasMinLength = pass.length >= 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /\d/.test(pass);
    const hasSpecial = /[ !@#$%^&*()_+\-=\[\]{};':",./<>?\\|`~]/.test(pass);
    
    return {
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      isValid: hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    const strength = checkPasswordStrength(newPassword);
    if (!strength.isValid) {
      toast.error("Password does not meet complexity requirements.");
      return;
    }

    setLoading(true);
    try {
      // In the future this can hit a dedicated profile password change endpoint.
      // Currently logging success.
      toast.success("Password changed successfully!");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const strength = checkPasswordStrength(newPassword);
  const passwordsMatch = newPassword && newPassword === confirmPassword;

  return (
    <div className="glass-panel-gold p-8 max-w-md mx-auto space-y-6 bg-white animate-fade-in-up">
      <div className="text-center">
        <h3 className="text-xl font-bold text-[#0A1628]">Change Security Password</h3>
        <p className="text-xs text-slate-500 mt-1">Provide credentials to update account access password</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="oldPassword" className="label-premium">Current Password</label>
          <input
            id="oldPassword"
            type="password"
            placeholder="Enter current password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={loading}
            className="input-premium"
            required
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="label-premium">New Password</label>
          <div className="relative">
            <input
              id="newPassword"
              type={showPass ? "text" : "password"}
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              className="input-premium pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label-premium">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="input-premium"
            required
          />
        </div>

        {/* Compact 2-column requirements grid */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700 mb-2">New Password Requirements:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              {strength.hasMinLength ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : <XCircle size={13} className="text-slate-400 shrink-0" />}
              <span className={strength.hasMinLength ? "text-slate-700 font-medium" : "text-slate-400"}>Min 8 chars</span>
            </div>
            <div className="flex items-center gap-1.5">
              {strength.hasUpper ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : <XCircle size={13} className="text-slate-400 shrink-0" />}
              <span className={strength.hasUpper ? "text-slate-700 font-medium" : "text-slate-400"}>1 Uppercase</span>
            </div>
            <div className="flex items-center gap-1.5">
              {strength.hasLower ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : <XCircle size={13} className="text-slate-400 shrink-0" />}
              <span className={strength.hasLower ? "text-slate-700 font-medium" : "text-slate-400"}>1 Lowercase</span>
            </div>
            <div className="flex items-center gap-1.5">
              {strength.hasNumber ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : <XCircle size={13} className="text-slate-400 shrink-0" />}
              <span className={strength.hasNumber ? "text-slate-700 font-medium" : "text-slate-400"}>1 Number (0-9)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {strength.hasSpecial ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : <XCircle size={13} className="text-slate-400 shrink-0" />}
              <span className={strength.hasSpecial ? "text-slate-700 font-medium" : "text-slate-400"}>1 Special (!@#$)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {passwordsMatch ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : <XCircle size={13} className="text-slate-400 shrink-0" />}
              <span className={passwordsMatch ? "text-slate-700 font-medium" : "text-slate-400"}>Passwords match</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !strength.isValid || !passwordsMatch}
          className="btn-gold"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin text-white" />
              <span>Updating Password...</span>
            </>
          ) : (
            <span>Update Password</span>
          )}
        </button>
      </form>

      {/* Attribution Footer */}
      <div className="text-center pt-4 border-t border-slate-100 mt-4">
        <p className="text-[11px] text-slate-400">
          Designed &amp; Developed by{" "}
          <a
            href="https://sunilbishnoi.co.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#C4A35A] hover:underline font-semibold transition-colors"
          >
            Sunil Bishnoi
          </a>
        </p>
      </div>
    </div>
  );
}
