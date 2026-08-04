import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Unlock, CheckCircle2, User, Calendar, ArrowRight, ShieldCheck, AlertTriangle } from "lucide-react";
import { authService } from "../../services/authService";

const Spinner = () => (
  <span
    className="inline-block shrink-0"
    style={{
      width: 14, height: 14,
      border: "2px solid rgba(255,255,255,0.30)",
      borderTopColor: "#ffffff",
      borderRadius: "50%",
      animation: "spin 0.6s linear infinite",
    }}
  />
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
      const errMsg = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || "Verification failed";
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
        text: err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || "OTP verification failed"
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
        text: err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || "Failed to resend OTP"
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
    <div style={{ padding: "36px 36px 28px" }}>
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-slate-200">
        <button
          type="button"
          onClick={onBackToLogin}
          className="border-0 bg-transparent cursor-pointer text-xs font-bold text-[#4A6A8A] hover:text-slate-900 transition-colors flex items-center gap-1.5 p-0"
        >
          <ArrowLeft size={14} />
          <span>Back to Sign In</span>
        </button>
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
          Unlock Account
        </span>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className="mb-5 flex items-start gap-2.5 rounded-none p-3 border-l-4"
          style={{
            backgroundColor: statusMessage.type === "error" ? "#fef2f2" : "#ecfdf5",
            borderColor: statusMessage.type === "error" ? "#fca5a5" : "#6ee7b7",
            borderLeftColor: statusMessage.type === "error" ? "#dc2626" : "#059669",
          }}
        >
          <AlertTriangle
            style={{
              width: 15, height: 15, marginTop: 1, flexShrink: 0,
              color: statusMessage.type === "error" ? "#dc2626" : "#059669",
            }}
          />
          <span style={{ fontSize: 12, color: statusMessage.type === "error" ? "#991b1b" : "#065f46", fontWeight: 600, lineHeight: "18px" }}>
            {statusMessage.text}
          </span>
        </div>
      )}

      {/* STEP 1 - VERIFY IDENTITY */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div className="text-center mb-1">
            <div className="inline-flex items-center justify-center py-2 px-3.5 bg-white rounded-xl border border-slate-200/90 shadow-sm mb-4 w-fit mx-auto">
              <img
                src="/logo-fieldconnect.png"
                alt="Cyrix Field Connect Logo"
                className="h-12 sm:h-14 w-auto object-contain drop-shadow-xs"
              />
            </div>
            <h1
              className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Inter Tight', 'Inter', sans-serif" }}
            >
              Unlock Account
            </h1>
            <p className="mt-1 m-0 text-xs text-slate-500 font-medium">
              Provide your employee details to unlock your account
            </p>
          </div>

          <form onSubmit={handleVerifyIdentity} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="unlockUserId"
                className="block mb-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider"
              >
                User ID
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <User size={15} />
                </span>
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
                  required
                  className="w-full h-11 pl-10 pr-3 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-none focus:outline-none focus:border-[#4A6A8A] focus:ring-1 focus:ring-[#4A6A8A] transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="doj"
                className="block mb-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider"
              >
                Date of Joining
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Calendar size={15} />
                </span>
                <input
                  id="doj"
                  type="date"
                  value={doj}
                  onChange={(e) => {
                    setDoj(e.target.value);
                    setStatusMessage(null);
                  }}
                  disabled={loading}
                  required
                  className="w-full h-11 pl-10 pr-3 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-none focus:outline-none focus:border-[#4A6A8A] focus:ring-1 focus:ring-[#4A6A8A] transition-all [color-scheme:light]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="dob"
                className="block mb-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider"
              >
                Date of Birth
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Calendar size={15} />
                </span>
                <input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => {
                    setDob(e.target.value);
                    setStatusMessage(null);
                  }}
                  disabled={loading}
                  required
                  className="w-full h-11 pl-10 pr-3 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-none focus:outline-none focus:border-[#4A6A8A] focus:ring-1 focus:ring-[#4A6A8A] transition-all [color-scheme:light]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-1 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-bold text-xs uppercase tracking-wider rounded-none flex items-center justify-center gap-2 border border-[#4A6A8A] transition-colors shadow-2xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <><Spinner /><span className="normal-case">Verifying identity...</span></>
              ) : (
                <><span>Verify & Send OTP</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 2 - ENTER OTP */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <div className="w-12 h-12 rounded-none bg-[#4A6A8A]/10 border border-[#4A6A8A]/20 text-[#4A6A8A] flex items-center justify-center mx-auto mb-2.5">
              <ShieldCheck size={20} />
            </div>
            <h1
              className="m-0 text-lg font-extrabold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Inter Tight', 'Inter', sans-serif" }}
            >
              Enter Verification Code
            </h1>
            <p className="mt-1 m-0 text-xs text-slate-500 font-medium leading-relaxed">
              We sent a 6-digit OTP code to your registered email <strong className="text-slate-800 font-bold">{maskedEmail}</strong>
            </p>
          </div>

          <form onSubmit={handleVerifyOtpAndUnlock} className="flex flex-col gap-4">
            <div className="flex justify-between gap-1.5 max-w-xs mx-auto w-full">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  value={digit}
                  ref={(el) => (otpInputsRef.current[idx] = el as HTMLInputElement)}
                  onChange={(e) => handleOtpChange(e.target, idx)}
                  onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                  disabled={loading}
                  className="w-10 h-11 bg-white border border-slate-300 rounded-none text-center text-lg font-black text-slate-900 focus:outline-none focus:border-[#4A6A8A] focus:ring-1 focus:ring-[#4A6A8A] transition-all"
                />
              ))}
            </div>

            <div className="text-center space-y-1.5 bg-slate-50 p-3 border border-slate-200 text-xs">
              <p className="m-0 text-[11px] text-slate-600 font-bold">
                OTP Validity: <span className="font-mono font-black text-rose-600">{formatTime(timeLeft)}</span>
              </p>
              
              <div className="text-[11px]">
                {resendCooldown === 0 ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="border-0 bg-transparent cursor-pointer font-bold text-[#4A6A8A] hover:underline"
                  >
                    Resend OTP Code
                  </button>
                ) : (
                  <span className="text-slate-500 font-medium">
                    Resend in <span className="font-mono font-bold text-slate-700">{resendCooldown}s</span>
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-1 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-bold text-xs uppercase tracking-wider rounded-none flex items-center justify-center gap-2 border border-[#4A6A8A] transition-colors shadow-2xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <><Spinner /><span className="normal-case">Unlocking Account...</span></>
              ) : (
                <><span>Verify & Unlock Account</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 3 - SUCCESS */}
      {step === 3 && (
        <div className="flex flex-col gap-4 text-center py-4">
          <div className="w-12 h-12 rounded-none bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
            {isAlreadyActive ? (
              <Unlock size={24} className="animate-pulse text-[#4A6A8A]" />
            ) : (
              <CheckCircle2 size={24} className="animate-pulse text-emerald-700" />
            )}
          </div>

          <div className="space-y-1">
            <h1
              className="m-0 text-lg font-extrabold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Inter Tight', 'Inter', sans-serif" }}
            >
              {isAlreadyActive ? "Account Already Active" : "Account Unlocked Successfully"}
            </h1>
            <p className="text-xs text-slate-600 font-medium px-2">
              {isAlreadyActive 
                ? "Your account is active and unlocked. You can sign in directly using your password."
                : "Your Cyrix Field Connect account has been unlocked. You can now sign in using your credentials."}
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToLogin}
            className="w-full h-11 mt-2 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-bold text-xs uppercase tracking-wider rounded-none flex items-center justify-center gap-2 border border-[#4A6A8A] transition-colors shadow-2xs cursor-pointer"
          >
            {isAlreadyActive ? "Go to Sign In" : "Back to Sign In"}
          </button>
        </div>
      )}

      {/* Attribution */}
      <p className="text-center mt-5 m-0 text-xs text-slate-500 font-medium pt-3 border-t border-slate-200">
        Designed By{" "}
        <a
          href="https://sunilbishnoi.co.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#4A6A8A] font-bold hover:underline"
        >
          Sunil Bishnoi
        </a>
      </p>
    </div>
  );
}
