import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Key, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { authService } from "../../services/authService";

const PremiumSpinner = () => (
  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-200 border-t-blue-600 inline-block mr-1.5 shrink-0"></span>
);

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export default function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState("");
  const [dob, setDob] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes OTP validity
  const [resendCooldown, setResendCooldown] = useState(30); // 30 seconds resend cooldown
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const otpInputsRef = useRef<HTMLInputElement[]>([]);

  // Format HTML date picker value (YYYY-MM-DD) to API expected (DD-MM-YYYY)
  const formatDateForApi = (dateStr: string): string => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  };

  // Countdowns for Validity & Resend
  useEffect(() => {
    if (step !== 2) return;
    
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  // Auto redirect on success
  useEffect(() => {
    if (step !== 4) return;
    const timeout = setTimeout(() => {
      onBackToLogin();
    }, 4000);
    return () => clearTimeout(timeout);
  }, [step, onBackToLogin]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    if (!userId.trim() || !dob) {
      setStatusMessage({ type: "error", text: "Please enter both User ID and Date of Birth." });
      return;
    }

    const apiDob = formatDateForApi(dob);

    setLoading(true);
    try {
      const data = await authService.forgotPassword(userId, apiDob);
      setMaskedEmail(data.masked_email);
      setStep(2);
      setStatusMessage(null);
      setTimeLeft(600);
      setResendCooldown(30);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || "Failed to request OTP code"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const otpString = otp.join("");
    if (otpString.length < 6) {
      setStatusMessage({ type: "error", text: "Please enter a valid 6-digit OTP." });
      return;
    }

    setLoading(true);
    try {
      await authService.verifyOtp(userId, otpString, "reset_password");
      setStep(3);
      setStatusMessage(null);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || "Invalid or expired OTP"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    const strength = checkPasswordStrength(newPassword);
    if (!strength.isValid) {
      setStatusMessage({ type: "error", text: "Password does not meet the security requirements." });
      return;
    }

    setLoading(true);
    try {
      const otpString = otp.join("");
      await authService.resetPassword(userId, otpString, newPassword, confirmPassword);
      setStep(4);
      setStatusMessage(null);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || "Failed to reset password"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (element: HTMLInputElement, index: number) => {
    setStatusMessage(null);
    const value = element.value.replace(/[^0-9]/g, "");
    if (!value) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (index < 5 && element.value) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    setStatusMessage(null);
    if (e.key === "Backspace") {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      
      if (index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setStatusMessage(null);
    setLoading(true);
    try {
      const apiDob = formatDateForApi(dob);
      await authService.forgotPassword(userId, apiDob);
      setStatusMessage({
        type: "success",
        text: "A new verification code has been sent successfully!"
      });
      setTimeLeft(600);
      setResendCooldown(30);
      setOtp(Array(6).fill(""));
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || "Failed to resend OTP"
      });
    } finally {
      setLoading(false);
    }
  };

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const strength = checkPasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header Logo */}
      <div className="text-center pb-3.5 border-b border-slate-100 flex justify-between items-center">
        <button
          onClick={onBackToLogin}
          className="text-slate-500 hover:text-indigo-650 flex items-center gap-1.5 text-[10px] cursor-pointer font-black uppercase tracking-wider border-0 bg-transparent"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Reset Credentials</span>
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

      {/* STEP 1 - ENTER USER ID */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3 border border-indigo-100 text-indigo-600 shadow-sm">
              <Key size={18} />
            </div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Identity Check</h3>
            <p className="text-slate-500 text-[9px] mt-1.5 uppercase tracking-wider font-extrabold">Verify details to receive verification code</p>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="resetUserId" className="text-slate-500 font-extrabold uppercase tracking-widest text-[9px] mb-1.5 block">User ID</label>
              <input
                id="resetUserId"
                type="text"
                placeholder="Enter User ID (e.g. E1704)"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setStatusMessage(null);
                }}
                disabled={loading}
                className="w-full bg-white border border-slate-350 rounded-xl px-3.5 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold shadow-inner"
                required
              />
            </div>

            <div>
              <label htmlFor="resetDob" className="text-slate-500 font-extrabold uppercase tracking-widest text-[9px] mb-1.5 block">Date of Birth</label>
              <input
                id="resetDob"
                type="date"
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  setStatusMessage(null);
                }}
                disabled={loading}
                className="w-full bg-white border border-slate-350 rounded-xl px-3.5 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold shadow-inner [color-scheme:light]"
                required
              />
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
                    <span>Requesting OTP...</span>
                  </>
                ) : (
                  <span>Request OTP Code</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2 - ENTER OTP */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="text-center">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Enter Verification Code</h3>
            <p className="text-slate-500 text-[10px] mt-1.5 leading-relaxed font-semibold">
              We sent a 6-digit OTP code to your registered email address <strong className="text-slate-800 font-bold">{maskedEmail}</strong>.
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex justify-between gap-2 max-w-xs mx-auto">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  value={digit}
                  ref={(el) => (otpInputsRef.current[idx] = el as HTMLInputElement)}
                  onChange={(e) => handleOtpChange(e.target, idx)}
                  onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                  className="w-10 h-10 bg-white border border-slate-350 rounded-xl text-center text-lg text-slate-800 font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                  disabled={loading}
                />
              ))}
            </div>

            <div className="text-center space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                OTP Expiration: <span className="font-black text-rose-600">{formatTime(timeLeft)}</span>
              </p>
              
              <div className="text-[10px]">
                {resendCooldown === 0 ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-indigo-600 hover:text-indigo-750 font-extrabold uppercase tracking-wider border-0 bg-transparent cursor-pointer"
                    disabled={loading}
                  >
                    Resend Code
                  </button>
                ) : (
                  <span className="text-slate-500 font-extrabold uppercase tracking-wider">
                    Resend in <span className="font-black text-slate-600">{resendCooldown}s</span>
                  </span>
                )}
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
                    <span>Validating...</span>
                  </>
                ) : (
                  <span>Verify OTP Code</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3 - ENTER NEW PASSWORD */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="text-center">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Create New Password</h3>
            <p className="text-slate-500 text-[10px] mt-1.5 font-semibold">Set a highly secure password that you have not used recently</p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="text-slate-550 font-extrabold uppercase tracking-widest text-[9px] mb-1.5 block">New Password</label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => {
                     setNewPassword(e.target.value);
                     setStatusMessage(null);
                  }}
                  disabled={loading}
                  className="w-full bg-white border border-slate-350 rounded-xl pr-10 pl-3.5 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold shadow-inner"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 transition-colors border-0 bg-transparent cursor-pointer"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="text-slate-550 font-extrabold uppercase tracking-widest text-[9px] mb-1.5 block">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setStatusMessage(null);
                }}
                disabled={loading}
                className="w-full bg-white border border-slate-350 rounded-xl px-3.5 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold shadow-inner"
                required
              />
            </div>

            {/* Password security constraints block */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] space-y-2 text-slate-500 font-semibold">
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-1.5">Constraints Checklist</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  {strength.hasMinLength ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-400">✗</span>}
                  <span>Min 8 characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {strength.hasUpper ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-400">✗</span>}
                  <span>1 Uppercase</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {strength.hasLower ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-400">✗</span>}
                  <span>1 Lowercase</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {strength.hasNumber ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-400">✗</span>}
                  <span>1 Number</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {strength.hasSpecial ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-400">✗</span>}
                  <span>1 Special char</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {passwordsMatch ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-400">✗</span>}
                  <span>Passwords match</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !strength.isValid || !passwordsMatch}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 flex items-center justify-center gap-2 border-0 cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <PremiumSpinner />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Reset Password</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 4 - SUCCESS */}
      {step === 4 && (
        <div className="space-y-5 text-center py-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-650 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 animate-pulse text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Password Reset Successfully</h3>
            <p className="text-slate-500 text-[10px] leading-relaxed font-semibold">Your credential configuration has been updated. Redirecting to login shortly...</p>
          </div>
          <div className="pt-3">
            <button
              onClick={onBackToLogin}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase tracking-wider rounded-xl transition-all text-[10px] border-0 cursor-pointer shadow-md shadow-indigo-600/10"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
