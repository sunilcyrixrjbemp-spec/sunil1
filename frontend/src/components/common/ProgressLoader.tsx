import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Zap } from "lucide-react";

interface ProgressLoaderProps {
  message?: string;
  onComplete?: () => void;
  fullPage?: boolean;
}

export default function ProgressLoader({ message = "Loading System Data...", fullPage = true }: ProgressLoaderProps) {
  const [progress, setProgress] = useState(15);
  const [currentStepText, setCurrentStepText] = useState("Initializing System Session...");

  useEffect(() => {
    const steps = [
      { p: 28, text: "Authenticating User Session..." },
      { p: 48, text: "Loading User Profile & Base Locations..." },
      { p: 68, text: "Syncing Monthly Allowance & Reimbursables..." },
      { p: 88, text: "Fetching Active Claims & Analytics..." },
      { p: 98, text: "Finalizing Dashboard Records..." }
    ];

    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < steps.length) {
        setProgress(steps[currentIdx].p);
        setCurrentStepText(steps[currentIdx].text);
        currentIdx++;
      } else {
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const containerClasses = fullPage
    ? "fixed inset-0 z-[99999] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 text-white animate-fadeIn"
    : "w-full min-h-[350px] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 text-white rounded-2xl border border-slate-800 shadow-xl animate-fadeIn";

  return (
    <div className={containerClasses}>
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
        
        {/* Brand Icon Badge */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shadow-2xl backdrop-blur-md">
            <Zap className="w-10 h-10 text-indigo-400 animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1 rounded-full shadow-lg">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-lg font-black tracking-wider text-white uppercase">
            Cyrix FieldOps
          </h2>
          <p className="text-[11px] text-indigo-300 font-bold tracking-widest uppercase mt-0.5">
            Healthcare Operations Portal
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full space-y-2.5">
          <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-wider text-slate-300 px-0.5">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
              {currentStepText || message}
            </span>
            <span className="font-mono text-emerald-400 text-xs font-black">{progress}%</span>
          </div>

          <div className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/60 p-0.5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 rounded-full transition-all duration-300 ease-out shadow-sm"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer Subtext */}
        <p className="text-[9px] text-slate-400 font-medium tracking-wide">
          Securing encrypted connection & syncing database...
        </p>

      </div>
    </div>
  );
}
