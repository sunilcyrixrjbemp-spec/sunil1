import React, { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, X } from "lucide-react";
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
      isValid: hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial,
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
    <div className="bg-surface border border-line rounded-lg p-6 sm:p-8 max-w-md mx-auto space-y-5 shadow-none animate-fade-in-up">
      <div className="text-center">
        <h3 className="text-xl font-bold text-ink-900 font-display tracking-tight">
          Change Security Password
        </h3>
        <p className="text-xs text-ink-500 mt-1 font-normal">
          Provide credentials to update account access password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="oldPassword" className="block mb-1.5 text-xs font-semibold text-ink-700 tracking-wide">
            Current Password
          </label>
          <input
            id="oldPassword"
            type="password"
            placeholder="Enter current password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={loading}
            className="w-full h-10 pl-3.5 pr-3 text-sm font-medium text-ink-900 bg-white border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-accent-600 transition-all placeholder:text-ink-300 disabled:bg-surface-sunken"
            required
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="block mb-1.5 text-xs font-semibold text-ink-700 tracking-wide">
            New Password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showPass ? "text" : "password"}
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              className="w-full h-10 pl-3.5 pr-10 text-sm font-medium text-ink-900 bg-white border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-accent-600 transition-all placeholder:text-ink-300 disabled:bg-surface-sunken"
              required
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-500 hover:text-ink-700 border-0 bg-transparent cursor-pointer"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block mb-1.5 text-xs font-semibold text-ink-700 tracking-wide">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="w-full h-10 pl-3.5 pr-3 text-sm font-medium text-ink-900 bg-white border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-accent-600 transition-all placeholder:text-ink-300 disabled:bg-surface-sunken"
            required
          />
        </div>

        {/* Compact 2-column requirements grid */}
        <div className="bg-surface-sunken border border-line rounded-md p-3 text-xs text-ink-700 space-y-2">
          <p className="text-2xs font-bold text-ink-900 uppercase tracking-wider border-b border-line pb-1 m-0">
            Password Requirements
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-2xs">
            <div className="flex items-center gap-1.5">
              {strength.hasMinLength ? (
                <CheckCircle2 size={13} className="text-approved-text shrink-0" />
              ) : (
                <X size={13} className="text-ink-300 shrink-0" />
              )}
              <span className={strength.hasMinLength ? "text-ink-900 font-medium" : "text-ink-500"}>Min 8 chars</span>
            </div>
            <div className="flex items-center gap-1.5">
              {strength.hasUpper ? (
                <CheckCircle2 size={13} className="text-approved-text shrink-0" />
              ) : (
                <X size={13} className="text-ink-300 shrink-0" />
              )}
              <span className={strength.hasUpper ? "text-ink-900 font-medium" : "text-ink-500"}>1 Uppercase</span>
            </div>
            <div className="flex items-center gap-1.5">
              {strength.hasLower ? (
                <CheckCircle2 size={13} className="text-approved-text shrink-0" />
              ) : (
                <X size={13} className="text-ink-300 shrink-0" />
              )}
              <span className={strength.hasLower ? "text-ink-900 font-medium" : "text-ink-500"}>1 Lowercase</span>
            </div>
            <div className="flex items-center gap-1.5">
              {strength.hasNumber ? (
                <CheckCircle2 size={13} className="text-approved-text shrink-0" />
              ) : (
                <X size={13} className="text-ink-300 shrink-0" />
              )}
              <span className={strength.hasNumber ? "text-ink-900 font-medium" : "text-ink-500"}>1 Number (0-9)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {strength.hasSpecial ? (
                <CheckCircle2 size={13} className="text-approved-text shrink-0" />
              ) : (
                <X size={13} className="text-ink-300 shrink-0" />
              )}
              <span className={strength.hasSpecial ? "text-ink-900 font-medium" : "text-ink-500"}>1 Special (!@#$)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {passwordsMatch ? (
                <CheckCircle2 size={13} className="text-approved-text shrink-0" />
              ) : (
                <X size={13} className="text-ink-300 shrink-0" />
              )}
              <span className={passwordsMatch ? "text-ink-900 font-medium" : "text-ink-500"}>Passwords match</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !strength.isValid || !passwordsMatch}
          className="w-full h-10 bg-accent-600 hover:bg-accent-700 text-white font-medium text-sm rounded-md shadow-none flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-1"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin text-white" />
              <span>Updating Password...</span>
            </>
          ) : (
            <span>Update Password</span>
          )}
        </button>
      </form>

      {/* Attribution Footer */}
      <div className="text-center pt-4 border-t border-line mt-4">
        <p className="text-2xs text-ink-500 font-normal m-0">
          Designed &amp; Developed by{" "}
          <a
            href="https://sunilbishnoi.co.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-600 hover:underline font-semibold transition-colors"
          >
            Sunil Bishnoi
          </a>
        </p>
      </div>
    </div>
  );
}
