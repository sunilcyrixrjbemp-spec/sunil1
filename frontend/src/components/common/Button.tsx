import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
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
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 active:scale-[0.98] select-none";

    // Size variants
    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
    };

    // Variant styles
    const variantStyles = {
      primary:
        "bg-accent-600 text-white shadow-xs hover:bg-accent-700 hover:-translate-y-[0.5px] active:translate-y-0",
      secondary:
        "bg-slate-100 text-ink-900 border border-border hover:bg-slate-200 hover:border-slate-300",
      ghost:
        "bg-transparent text-ink-700 hover:bg-slate-100 hover:text-ink-900",
      danger:
        "bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800",
      outline:
        "bg-surface-0 border border-border text-ink-900 shadow-xs hover:bg-surface-50 hover:border-slate-300",
    };

    // Disabled state
    const disabledStyles = (disabled || isLoading) ? "opacity-40 pointer-events-none cursor-not-allowed shadow-none" : "cursor-pointer";
    const widthStyle = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${disabledStyles} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
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
