import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  User,
  Calendar,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Check,
} from "lucide-react";
import { authService } from "../../services/authService";

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
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

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

  // Auto redirect countdown on success
  useEffect(() => {
    if (step !== 4) return;

    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onBackToLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, onBackToLogin]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    if (!userId.trim() || !dob) {
      setStatusMessage({ type: "error", text: "Please enter both Employee ID and Date of Birth." });
      return;
    }

    const apiDob = formatDateForApi(dob);

    setLoading(true);
    try {
      const data = await authService.forgotPassword(userId.trim(), apiDob);
      setMaskedEmail(data.masked_email);
      setStep(2);
      setStatusMessage(null);
      setTimeLeft(600);
      setResendCooldown(30);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          err.response?.data?.message ||
          "Failed to request OTP code",
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
      await authService.verifyOtp(userId.trim(), otpString, "reset_password");
      setStep(3);
      setStatusMessage(null);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          err.response?.data?.message ||
          "Invalid or expired OTP",
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
      await authService.resetPassword(userId.trim(), otpString, newPassword, confirmPassword);
      setStep(4);
      setStatusMessage(null);
      setRedirectCountdown(3);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          err.response?.data?.message ||
          "Failed to reset password",
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
      await authService.forgotPassword(userId.trim(), apiDob);
      setStatusMessage({
        type: "success",
        text: "A new verification code has been sent successfully!",
      });
      setTimeLeft(600);
      setResendCooldown(30);
      setOtp(Array(6).fill(""));
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          err.response?.data?.message ||
          "Failed to resend OTP",
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
    <div className="w-full">
      {/* ── Top Navigation Bar (Hidden on Success Step 4) ───────────────── */}
      {step < 4 && (
        <div className="flex items-center justify-between pb-2.5 mb-3.5 border-b border-line">
          <button
            type="button"
            onClick={onBackToLogin}
            className="border-0 bg-transparent cursor-pointer text-xs font-semibold text-accent-600 hover:text-accent-700 transition-colors flex items-center gap-1.5 p-0"
          >
            <ArrowLeft size={14} />
            <span>Back to Sign In</span>
          </button>
          <span className="text-[10px] font-mono font-bold text-accent-700 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
            STEP {step} OF 3
          </span>
        </div>
      )}

      {/* ── Status Alert Banner ─────────────────────────────────────────── */}
      {statusMessage && (
        <div
          className={`mb-3 flex items-start gap-2 rounded-lg p-2.5 border text-xs font-medium ${
            statusMessage.type === "error"
              ? "bg-rejected-bg text-rejected-text border-rejected-border animate-shake"
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

      {/* ── STEP 1: IDENTITY CHECK ─────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div className="mb-0.5">
            <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight m-0 leading-tight">
              Reset Password
            </h2>
            <p className="mt-0.5 text-xs text-ink-500 font-sans m-0">
              Verify your employee details to receive a 6-digit code.
            </p>
          </div>

          <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
            <div>
              <label htmlFor="resetUserId" className="block mb-1 text-xs font-medium text-ink-700 tracking-normal">
                Employee ID
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-400">
                  <User size={15} />
                </span>
                <input
                  id="resetUserId"
                  type="text"
                  placeholder="e.g. E1704"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setStatusMessage(null);
                  }}
                  disabled={loading}
                  required
                  className="w-full h-[40px] pl-9 pr-3 text-sm font-medium text-ink-900 bg-white border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-600 focus:border-accent-600 transition-colors placeholder:text-ink-300 disabled:bg-surface-sunken"
                />
              </div>
            </div>

            <div>
              <label htmlFor="resetDob" className="block mb-1 text-xs font-medium text-ink-700 tracking-normal">
                Date of Birth
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-400">
                  <Calendar size={15} />
                </span>
                <input
                  id="resetDob"
                  type="date"
                  value={dob}
                  onChange={(e) => {
                    setDob(e.target.value);
                    setStatusMessage(null);
                  }}
                  disabled={loading}
                  required
                  className="w-full h-[40px] pl-9 pr-3 text-sm font-medium text-ink-900 bg-white border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-600 focus:border-accent-600 transition-colors [color-scheme:light] disabled:bg-surface-sunken"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[40px] max-sm:h-[44px] bg-accent-600 hover:bg-accent-700 active:scale-[0.98] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-none mt-0.5"
            >
              {loading ? (
                <>
                  <Spinner />
                  <span>Requesting OTP…</span>
                </>
              ) : (
                <>
                  <span>Request OTP Code</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── STEP 2: OTP VERIFICATION ────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div className="mb-0.5">
            <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight m-0 leading-tight">
              Enter Verification Code
            </h2>
            <p className="mt-0.5 text-xs text-ink-500 font-sans m-0">
              Sent to <span className="font-semibold text-ink-800">{maskedEmail || "your registered email"}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3.5">
            {/* 6 OTP Input Boxes */}
            <div className="flex justify-between gap-1.5 my-1">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpInputsRef.current[index] = el!)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target, index)}
                  onKeyDown={(e) => handleOtpKeyDown(e, index)}
                  className="w-10 h-11 text-center font-mono font-bold text-lg text-ink-900 bg-white border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-accent-600 transition-all"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {/* Timer & Resend */}
            <div className="flex items-center justify-between text-xs text-ink-500">
              <div className="flex items-center gap-1 font-mono">
                <Clock size={13} className="text-ink-400" />
                <span>Expires in: {formatTime(timeLeft)}</span>
              </div>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="text-xs font-semibold text-accent-600 hover:text-accent-700 bg-transparent border-0 cursor-pointer disabled:text-ink-300 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || otp.join("").length < 6}
              className="w-full h-[40px] max-sm:h-[44px] bg-accent-600 hover:bg-accent-700 active:scale-[0.98] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-none"
            >
              {loading ? (
                <>
                  <Spinner />
                  <span>Verifying Code…</span>
                </>
              ) : (
                <>
                  <span>Verify OTP</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── STEP 3: NEW PASSWORD CREATION ──────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <div className="mb-0.5">
            <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight m-0 leading-tight">
              Create New Password
            </h2>
            <p className="mt-0.5 text-xs text-ink-500 font-sans m-0">
              Set a strong, secure password for your account.
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
            <div>
              <label htmlFor="newPass" className="block mb-1 text-xs font-medium text-ink-700 tracking-normal">
                New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-400">
                  <Lock size={15} />
                </span>
                <input
                  id="newPass"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setStatusMessage(null);
                  }}
                  disabled={loading}
                  required
                  className="w-full h-[40px] pl-9 pr-10 text-sm font-medium text-ink-900 bg-white border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-600 focus:border-accent-600 transition-colors placeholder:text-ink-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 border-0 bg-transparent text-ink-400 hover:text-ink-700 cursor-pointer"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPass" className="block mb-1 text-xs font-medium text-ink-700 tracking-normal">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-400">
                  <Lock size={15} />
                </span>
                <input
                  id="confirmPass"
                  type={showConfirmPass ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setStatusMessage(null);
                  }}
                  disabled={loading}
                  required
                  className="w-full h-[40px] pl-9 pr-10 text-sm font-medium text-ink-900 bg-white border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-600 focus:border-accent-600 transition-colors placeholder:text-ink-300"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 border-0 bg-transparent text-ink-400 hover:text-ink-700 cursor-pointer"
                >
                  {showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Password Requirements Checklist */}
            {newPassword && (
              <div className="p-2.5 bg-surface-sunken rounded-lg border border-line flex flex-col gap-1 text-[11px]">
                <div className={`flex items-center gap-1.5 ${strength.hasMinLength ? "text-emerald-700 font-medium" : "text-ink-400"}`}>
                  <Check size={12} className={strength.hasMinLength ? "text-emerald-600" : "text-ink-300"} />
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${strength.hasUpper && strength.hasLower ? "text-emerald-700 font-medium" : "text-ink-400"}`}>
                  <Check size={12} className={strength.hasUpper && strength.hasLower ? "text-emerald-600" : "text-ink-300"} />
                  <span>Uppercase &amp; lowercase letters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${strength.hasNumber ? "text-emerald-700 font-medium" : "text-ink-400"}`}>
                  <Check size={12} className={strength.hasNumber ? "text-emerald-600" : "text-ink-300"} />
                  <span>At least one number</span>
                </div>
                <div className={`flex items-center gap-1.5 ${strength.hasSpecial ? "text-emerald-700 font-medium" : "text-ink-400"}`}>
                  <Check size={12} className={strength.hasSpecial ? "text-emerald-600" : "text-ink-300"} />
                  <span>At least one special character</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !strength.isValid || !passwordsMatch}
              className="w-full h-[40px] max-sm:h-[44px] bg-accent-600 hover:bg-accent-700 active:scale-[0.98] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-none mt-0.5"
            >
              {loading ? (
                <>
                  <Spinner />
                  <span>Updating Password…</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Reset &amp; Save Password</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── STEP 4: GORGEOUS SUCCESS CELEBRATION ─────────────────────────── */}
      {step === 4 && (
        <div className="flex flex-col items-center text-center py-4 animate-fade-in-slide-up select-none">
          {/* Multi-Layer Animated Emerald Halo */}
          <div className="relative flex items-center justify-center mb-4">
            <span className="w-16 h-16 rounded-full bg-emerald-100/70 absolute animate-ping opacity-60" />
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md relative z-10">
              <CheckCircle2 size={32} className="stroke-[2.5]" />
            </div>
          </div>

          <h2 className="text-xl font-bold font-display text-ink-900 tracking-tight m-0 leading-tight">
            Password Reset Successful!
          </h2>

          <p className="mt-1 text-xs text-ink-600 font-sans leading-relaxed max-w-[280px] m-0">
            Your credentials have been securely updated. You can now sign in with your new password.
          </p>

          {/* Security Verification Confirmation Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800 mt-4">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Encrypted &amp; Verified</span>
          </div>

          {/* Direct Action Button */}
          <button
            type="button"
            onClick={onBackToLogin}
            className="w-full h-[42px] max-sm:h-[46px] bg-accent-600 hover:bg-accent-700 active:scale-[0.98] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm mt-5"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight size={15} />
          </button>

          <p className="text-[11px] text-ink-400 font-mono mt-3 m-0">
            Auto-redirecting in {redirectCountdown}s…
          </p>
        </div>
      )}

      {/* ── In-Card Sunil Bishnoi Attribution ────────────────────────────── */}
      <div className="mt-3.5 pt-2.5 border-t border-line/60 text-center select-none">
        <p className="text-[11px] text-ink-400 font-medium m-0 flex items-center justify-center gap-1">
          <span>Designed &amp; Developed by</span>
          <span className="text-accent-700 font-bold">Sunil Bishnoi</span>
        </p>
      </div>
    </div>
  );
}
