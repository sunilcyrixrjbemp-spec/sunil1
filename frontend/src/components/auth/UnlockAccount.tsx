import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Unlock, CheckCircle2 } from "lucide-react";
import { authService } from "../../services/authService";

const PremiumSpinner = () => (
  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-200 border-t-blue-600 inline-block mr-1.5 shrink-0"></span>
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
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header Back Button */}
      <div className="text-center pb-3.5 border-b border-slate-100 flex justify-between items-center">
        <button
          onClick={onBackToLogin}
          className="text-slate-500 hover:text-indigo-650 flex items-center gap-1.5 text-[10px] cursor-pointer font-black uppercase tracking-wider bg-transparent border-0 outline-none"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Unlock Account</span>
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

      {/* STEP 1 - VERIFY IDENTITY */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3 border border-indigo-100 text-indigo-600 shadow-sm">
              <Unlock size={18} />
            </div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Identity Check</h3>
            <p className="text-slate-500 text-[9px] mt-1.5 uppercase tracking-wider font-extrabold">Provide your details to unlock</p>
          </div>

          <form onSubmit={handleVerifyIdentity} className="space-y-4">
            <div>
              <label htmlFor="unlockUserId" className="text-slate-500 font-extrabold uppercase tracking-widest text-[9px] mb-1.5 block">User ID</label>
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
                className="w-full bg-white border border-slate-350 rounded-xl px-3.5 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold shadow-inner"
                required
              />
            </div>

            <div>
              <label htmlFor="doj" className="text-slate-500 font-extrabold uppercase tracking-widest text-[9px] mb-1.5 block">Date of Joining</label>
              <input
                id="doj"
                type="date"
                value={doj}
                onChange={(e) => {
                  setDoj(e.target.value);
                  setStatusMessage(null);
                }}
                disabled={loading}
                className="w-full bg-white border border-slate-350 rounded-xl px-3.5 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold shadow-inner [color-scheme:light]"
                required
              />
            </div>

            <div>
              <label htmlFor="dob" className="text-slate-500 font-extrabold uppercase tracking-widest text-[9px] mb-1.5 block">Date of Birth</label>
              <input
                id="dob"
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
        <div className="space-y-5">
          <div className="text-center">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Enter Verification Code</h3>
            <p className="text-slate-550 text-[10px] mt-1.5 leading-relaxed font-semibold">
              We sent a 6-digit OTP code to your registered email address <strong className="text-slate-800 font-bold">{maskedEmail}</strong>.
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
                    className="text-indigo-600 hover:text-indigo-750 font-extrabold uppercase tracking-wider border-0 bg-transparent cursor-pointer outline-none"
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
        <div className="space-y-5 text-center py-4">
          <div className={`h-12 w-12 rounded-xl border flex items-center justify-center mx-auto ${
            isAlreadyActive 
              ? "bg-indigo-50 border border-indigo-100 text-indigo-650"
              : "bg-emerald-50 border border-emerald-100 text-emerald-650"
          }`}>
            {isAlreadyActive ? (
              <Unlock size={18} className="animate-pulse text-indigo-600" />
            ) : (
              <CheckCircle2 size={18} className="animate-pulse text-emerald-600" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
              {isAlreadyActive ? "Account Already Active" : "Account Unlocked Successfully"}
            </h3>
            <p className="text-slate-500 text-[10px] leading-relaxed font-semibold px-2">
              {isAlreadyActive 
                ? "Your account is already active and unlocked. You can sign in directly."
                : "Your Expense Management Account has been unlocked. You can now sign in using your credentials."}
            </p>
          </div>

          <div className="pt-3">
            <button
              onClick={onBackToLogin}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase tracking-wider rounded-xl transition-all text-[10px] border-0 cursor-pointer shadow-md shadow-indigo-600/10"
            >
              {isAlreadyActive ? "Go to Sign In" : "Back to Sign In"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
