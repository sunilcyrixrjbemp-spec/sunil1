import React from "react";

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: "default" | "glass" | "gradient" | "metric" | "flat" | "bordered";
  interactive?: boolean;
  padding?: "none" | "xs" | "sm" | "md" | "lg";
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  extra?: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = "default",
      interactive = false,
      padding = "md",
      title,
      subtitle,
      extra,
      footer,
      icon,
      badge,
      className = "",
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles = "rounded-xl overflow-hidden transition-all duration-200";

    // Variant styles
    const variantStyles = {
      default: "bg-white border border-slate-200/80 shadow-xs hover:shadow-md",
      glass: "bg-white/70 backdrop-blur-md border border-white/50 shadow-sm hover:shadow-lg",
      gradient: "bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 border border-indigo-100 shadow-xs hover:shadow-md hover:border-indigo-200",
      metric: "bg-white border border-slate-100 shadow-xs hover:shadow-md hover:-translate-y-0.5",
      flat: "bg-slate-50 border border-slate-200/60 shadow-none",
      bordered: "bg-white border-2 border-slate-200 shadow-none hover:border-indigo-500/40",
    };

    const interactiveStyles = interactive
      ? "cursor-pointer active:scale-[0.99] hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5"
      : "";

    const paddingStyles = {
      none: "p-0",
      xs: "p-2.5 md:p-3",
      sm: "p-3.5 md:p-4",
      md: "p-5 md:p-6",
      lg: "p-6 md:p-8",
    };

    const hasHeader = Boolean(title || subtitle || extra || icon || badge);

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${interactiveStyles} ${className}`}
        {...props}
      >
        {hasHeader && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100/80">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  {title && typeof title === "string" ? (
                    <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
                  ) : (
                    title
                  )}
                  {badge && <span className="inline-flex">{badge}</span>}
                </div>
                {subtitle && typeof subtitle === "string" ? (
                  <p className="text-xs text-slate-500 mt-0.5 font-normal">{subtitle}</p>
                ) : (
                  subtitle
                )}
              </div>
            </div>
            {extra && <div className="shrink-0">{extra}</div>}
          </div>
        )}
        <div className={hasHeader && padding !== "none" ? paddingStyles[padding] : paddingStyles[padding]}>
          {children}
        </div>
        {footer && (
          <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = "Card";
export default Card;
