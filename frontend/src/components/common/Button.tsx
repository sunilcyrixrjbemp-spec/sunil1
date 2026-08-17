import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "gradient" | "glow" | "glass";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  shimmer?: boolean;
  htmlType?: "button" | "submit" | "reset";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      shimmer = false,
      htmlType,
      disabled,
      className = "",
      type,
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles =
      "relative inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[0.97] select-none overflow-hidden cursor-pointer";

    // Size variants
    const sizeStyles = {
      xs: "h-7 px-2.5 text-xs gap-1",
      sm: "h-8 px-3 text-xs gap-1.5 font-medium",
      md: "h-10 px-4 text-sm gap-2 font-medium",
      lg: "h-11 px-5 text-base gap-2.5 font-semibold",
      xl: "h-12 px-6 text-base gap-3 font-semibold rounded-xl",
    };

    // Variant styles
    const variantStyles = {
      primary:
        "bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 hover:shadow-indigo-200 hover:shadow-md hover:-translate-y-[0.5px] active:translate-y-0",
      secondary:
        "bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200 hover:border-slate-300",
      ghost:
        "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900",
      danger:
        "bg-red-600 text-white shadow-xs hover:bg-red-700 hover:shadow-red-200 hover:shadow-md active:bg-red-800",
      outline:
        "bg-white border border-slate-300 text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900",
      gradient:
        "bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-sm hover:opacity-95 hover:shadow-indigo-300 hover:shadow-md hover:-translate-y-[0.5px]",
      glow:
        "bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:shadow-[0_0_22px_rgba(79,70,229,0.6)] hover:bg-indigo-500 hover:-translate-y-[0.5px]",
      glass:
        "bg-white/80 backdrop-blur-md border border-slate-200/80 text-slate-800 shadow-xs hover:bg-white hover:border-slate-300",
    };

    // Disabled state
    const disabledStyles = (disabled || isLoading) ? "opacity-50 pointer-events-none cursor-not-allowed shadow-none active:scale-100 translate-y-0" : "";
    const widthStyle = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        type={htmlType || type || "button"}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${disabledStyles} ${widthStyle} ${className}`}
        {...props}
      >
        {shimmer && !isLoading && (
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        )}
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
  }
);

Button.displayName = "Button";
export default Button;
