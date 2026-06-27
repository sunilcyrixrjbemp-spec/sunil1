import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Unlock, CheckCircle2 } from "lucide-react";
import { authService } from "../../services/authService";

const PremiumSpinner = () => (
  <div className="relative flex items-center justify-center w-4 h-4 shrink-0 mr-2">
    <span className="absolute w-full h-full border-2 border-blue-500/30 border-t-blue-600 rounded-full animate-spin"></span>
  </div>
);

interface UnlockAccountProps {
  onBackToLogin: () => void;
}

export default function UnlockAccount({ onBackToLogin }: UnlockAccountProps) {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState("");
  const [doj, setDoj] = useState("");
  const [dob, setDob] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes OTP validity
  const [resendCooldown, setResendCooldown] = useState(30); // 30 seconds resend cooldown
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isAlreadyActive, setIsAlreadyActive] = useState(false);

  const otpInputsRef = useRef<HTMLInputElement[]>([]);

  // Countdowns for Validity & Resend Cooldown
  useEffect(() => {
    if (step !== 2) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  // Format HTML date picker value (YYYY-MM-DD) to API expected (DD-MM-YYYY)
  const formatDateForApi = (dateStr: string): string => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  };

  // Step 1: Send Identity Verification
  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    if (!userId.trim() || !doj || !dob) {
      setStatusMessage({ type: "error", text: "Please fill in all verification fields." });
      return;
    }

    const apiDoj = formatDateForApi(doj);
    const apiDob = formatDateForApi(dob);

    setLoading(true);
    try {
      const data = await authService.unlockAccount(userId, apiDoj, apiDob);
      setMaskedEmail(data.masked_email);
      setStep(2);
      setStatusMessage(null);
      setTimeLeft(600);
      setResendCooldown(30);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Verification failed";
      if (errMsg.toLowerCase().includes("already active")) {
        setIsAlreadyActive(true);
        setStep(3);
      } else {
        setStatusMessage({ type: "error", text: errMsg });
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and Unlock
  const handleVerifyOtpAndUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const otpString = otp.join("");
    if (otpString.length < 6) {
      setStatusMessage({ type: "error", text: "Please enter a valid 6-digit OTP." });
      return;
    }

    setLoading(true);
    try {
      await authService.unlockVerifyOtp(userId, otpString);
      setStep(3);
      setStatusMessage(null);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.response?.data?.detail || "OTP verification failed"
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

    // Focus next
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
    
    const apiDoj = formatDateForApi(doj);
    const apiDob = formatDateForApi(dob);

    setLoading(true);
    try {
      await authService.unlockAccount(userId, apiDoj, apiDob);
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="p-6 sm:p-8 space-y-5">
      {/* Header Back Button */}
      <div className="text-center pb-2 border-b border-gray-200 flex justify-between items-center">
        <button
          onClick={onBackToLogin}
          className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-xs cursor-pointer font-bold uppercase tracking-wider bg-transparent border-0 outline-none"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Unlock Account</span>
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

      {/* STEP 1 - VERIFY IDENTITY */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2.5 border border-blue-200 text-blue-600">
              <Unlock size={20} />
            </div>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Identity Check</h3>
            <p className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-wider font-semibold">Provide your details to unlock</p>
          </div>

          <form onSubmit={handleVerifyIdentity} className="space-y-3.5">
            <div>
              <label htmlFor="unlockUserId" className="label-lte">User ID</label>
              <input
                id="unlockUserId"
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
              <label htmlFor="doj" className="label-lte">Date of Joining</label>
              <input
                id="doj"
                type="date"
                value={doj}
                onChange={(e) => {
                  setDoj(e.target.value);
                  setStatusMessage(null);
                }}
                disabled={loading}
                className="input-lte [color-scheme:light]"
                required
              />
            </div>

            <div>
              <label htmlFor="dob" className="label-lte">Date of Birth</label>
              <input
                id="dob"
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
                    <span>Verifying identity...</span>
                  </>
                ) : (
                  <span>Verify & Send OTP</span>
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

          <form onSubmit={handleVerifyOtpAndUnlock} className="space-y-4">
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
                    className="text-blue-600 hover:underline font-bold uppercase tracking-wider bg-transparent border-0 outline-none"
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
                    <span>Unlocking...</span>
                  </>
                ) : (
                  <span>Verify & Unlock Account</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3 - SUCCESS */}
      {step === 3 && (
        <div className="space-y-4 text-center py-4">
          <div className={`h-12 w-12 rounded-full border flex items-center justify-center mx-auto ${
            isAlreadyActive 
              ? "bg-blue-50 border-blue-200 text-blue-600"
              : "bg-green-50 border-green-200 text-green-600"
          }`}>
            {isAlreadyActive ? (
              <Unlock size={20} className="animate-pulse" />
            ) : (
              <CheckCircle2 size={20} className="animate-pulse" />
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              {isAlreadyActive ? "Account Already Active" : "Account Unlocked Successfully"}
            </h3>
            <p className="text-gray-500 text-xs px-2">
              {isAlreadyActive 
                ? "Your account is already active and unlocked. You can sign in directly."
                : "Your Expense Management Account has been unlocked. You can now sign in using your credentials."}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onBackToLogin}
              className="btn-lte-primary px-6 mx-auto h-9"
            >
              {isAlreadyActive ? "Go to Sign In" : "Back to Sign In"}
            </button>
          </div>
        </div>
      )}    </div>
  );
}
