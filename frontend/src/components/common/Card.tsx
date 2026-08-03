import React from "react";

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  extra?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      interactive = false,
      padding = "md",
      title,
      subtitle,
      extra,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles = "bg-surface-0 border border-border rounded-lg shadow-xs overflow-hidden";
    const interactiveStyles = interactive
      ? "hover:border-slate-300 hover:shadow-sm transition-all duration-150 cursor-pointer hover:-translate-y-[1px]"
      : "";

    const paddingStyles = {
      none: "p-0",
      sm: "p-3 md:p-4",
      md: "p-5 md:p-6",
      lg: "p-6 md:p-8",
    };

    const hasHeader = Boolean(title || subtitle || extra);

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${interactiveStyles} ${className}`}
        {...props}
      >
        {hasHeader && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <div>
              {title && typeof title === "string" ? (
                <h3 className="text-base font-semibold text-ink-900">{title}</h3>
              ) : (
                title
              )}
              {subtitle && (
                <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            {extra && <div className="shrink-0">{extra}</div>}
          </div>
        )}
        <div className={hasHeader && padding !== "none" ? "p-5 md:p-6" : paddingStyles[padding]}>
          {children}
        </div>
      </div>
    );
  }
);

Card.displayName = "Card";
export default Card;
