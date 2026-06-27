import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Key, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { authService } from "../../services/authService";

const PremiumSpinner = () => (
  <div className="relative flex items-center justify-center w-4 h-4 shrink-0 mr-2">
    <span className="absolute w-full h-full border-2 border-blue-500/30 border-t-blue-600 rounded-full animate-spin"></span>
  </div>
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
        text: err.response?.data?.detail || "Failed to request OTP code"
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
        text: err.response?.data?.detail || "Invalid or expired OTP"
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
        text: err.response?.data?.detail || "Failed to reset password"
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
        text: err.response?.data?.detail || "Failed to resend OTP"
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
    <div className="p-6 sm:p-8 space-y-5">
      {/* Header Logo */}
      <div className="text-center pb-2 border-b border-gray-200 flex justify-between items-center">
        <button
          onClick={onBackToLogin}
          className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-xs cursor-pointer font-bold uppercase tracking-wider"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Reset Credentials</span>
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

      {/* STEP 1 - ENTER USER ID */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2.5 border border-blue-200 text-blue-600">
              <Key size={20} />
            </div>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Identity Check</h3>
            <p className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-wider font-semibold">Verify details to receive verification code</p>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-3.5">
            <div>
              <label htmlFor="resetUserId" className="label-lte">User ID</label>
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
                className="input-lte"
                required
              />
            </div>

            <div>
              <label htmlFor="resetDob" className="label-lte">Date of Birth</label>
              <input
                id="resetDob"
                type="date"
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  setStatusMessage(null);
                }}
                disabled={loading}
                className="input-lte [color-scheme:light]"
                required
              />
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
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Enter Verification Code</h3>
            <p className="text-gray-500 text-xs mt-1">
              We sent a 6-digit OTP code to your registered email address <strong className="text-gray-700">{maskedEmail}</strong>.
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
                  className="w-10 h-10 bg-white border border-gray-300 rounded text-center text-lg text-gray-800 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                  disabled={loading}
                />
              ))}
            </div>

            <div className="text-center space-y-2 bg-gray-50 p-2.5 rounded border border-gray-200">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                OTP Expiration: <span className="font-bold text-red-500">{formatTime(timeLeft)}</span>
              </p>
              
              <div className="text-[10px]">
                {resendCooldown === 0 ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-blue-600 hover:underline font-bold uppercase tracking-wider"
                    disabled={loading}
                  >
                    Resend Code
                  </button>
                ) : (
                  <span className="text-gray-400 font-semibold uppercase tracking-wider">
                    Resend in <span className="font-bold text-gray-600">{resendCooldown}s</span>
                  </span>
                )}
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
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Create New Password</h3>
            <p className="text-gray-500 text-xs mt-1">Set a highly secure password that you have not used recently</p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <div>
              <label htmlFor="newPassword" className="label-lte">New Password</label>
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
                  className="input-lte pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label-lte">Confirm Password</label>
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
                className="input-lte"
                required
              />
            </div>

            {/* Password security constraints block */}
            <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-[10px] space-y-1.5 font-semibold text-gray-600">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1 mb-1">Constraints Checklist</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                  {strength.hasMinLength ? <span className="text-green-500 font-bold">✓</span> : <span className="text-gray-400">✗</span>}
                  <span>Min 8 characters</span>
                </div>
                <div className="flex items-center gap-1">
                  {strength.hasUpper ? <span className="text-green-500 font-bold">✓</span> : <span className="text-gray-400">✗</span>}
                  <span>1 Uppercase</span>
                </div>
                <div className="flex items-center gap-1">
                  {strength.hasLower ? <span className="text-green-500 font-bold">✓</span> : <span className="text-gray-400">✗</span>}
                  <span>1 Lowercase</span>
                </div>
                <div className="flex items-center gap-1">
                  {strength.hasNumber ? <span className="text-green-500 font-bold">✓</span> : <span className="text-gray-400">✗</span>}
                  <span>1 Number</span>
                </div>
                <div className="flex items-center gap-1">
                  {strength.hasSpecial ? <span className="text-green-500 font-bold">✓</span> : <span className="text-gray-400">✗</span>}
                  <span>1 Special character</span>
                </div>
                <div className="flex items-center gap-1">
                  {passwordsMatch ? <span className="text-green-500 font-bold">✓</span> : <span className="text-gray-400">✗</span>}
                  <span>Passwords match</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !strength.isValid || !passwordsMatch}
                className="btn-lte-primary w-full h-9 disabled:opacity-50"
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
        <div className="space-y-4 text-center py-4">
          <div className="h-12 w-12 rounded-full bg-green-50 border border-green-200 text-green-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 animate-pulse text-green-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Password Reset Successfully</h3>
            <p className="text-gray-500 text-xs">Your credential configuration has been updated. Redirecting to login in 3 seconds...</p>
          </div>
          <div className="pt-2">
            <button
              onClick={onBackToLogin}
              className="btn-lte-primary px-6 mx-auto h-9"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
