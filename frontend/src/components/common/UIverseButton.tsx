import React from "react";
import { Loader2 } from "lucide-react";

export interface UIverseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "glow" | "cyber" | "glass" | "gradient" | "neon";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const UIverseButton: React.FC<UIverseButtonProps> = ({
  children,
  variant = "glow",
  size = "md",
  isLoading = false,
  iconLeft,
  iconRight,
  className = "",
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5 min-h-[32px]",
    md: "px-5 py-2.5 text-sm gap-2 min-h-[42px]",
    lg: "px-7 py-3 text-base gap-2.5 min-h-[50px]",
  };

  const variantClasses = {
    // UIverse Glow Button
    glow: "relative inline-flex items-center justify-center font-semibold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer overflow-hidden border border-white/20",
    
    // UIverse Cyber Shimmer
    cyber: "relative inline-flex items-center justify-center font-bold text-indigo-900 bg-indigo-50 border-2 border-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-[0.98] transition-all duration-200 cursor-pointer",
    
    // UIverse Glassmorphism
    glass: "relative inline-flex items-center justify-center font-semibold text-slate-800 bg-white/70 backdrop-blur-md border border-white/50 shadow-sm hover:bg-white/90 hover:border-slate-300 hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer",
    
    // UIverse Gradient Pill
    gradient: "relative inline-flex items-center justify-center font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full shadow-md hover:from-emerald-600 hover:to-teal-700 hover:shadow-lg active:scale-[0.98] transition-all duration-200 cursor-pointer",
    
    // UIverse Neon Dark
    neon: "relative inline-flex items-center justify-center font-semibold text-emerald-400 bg-slate-900 border border-emerald-500/40 rounded-xl shadow-[0_0_12px_rgba(16,185,129,0.2)] hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all duration-200 cursor-pointer",
  };

  const disabledClasses = disabled || isLoading ? "opacity-50 pointer-events-none cursor-not-allowed shadow-none" : "";

  return (
    <button
      disabled={disabled || isLoading}
      className={`${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        <>
          {iconLeft && <span className="inline-flex shrink-0">{iconLeft}</span>}
          {children && <span>{children}</span>}
          {iconRight && <span className="inline-flex shrink-0">{iconRight}</span>}
        </>
      )}
    </button>
  );
};

export default UIverseButton;
