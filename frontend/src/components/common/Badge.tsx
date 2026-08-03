import React from "react";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple"
  | "approved"
  | "pending"
  | "rejected"
  | "escalated";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "md",
  dot = true,
  children,
  className = "",
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string }> = {
    success: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dotColor: "bg-emerald-500",
    },
    approved: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dotColor: "bg-emerald-500",
    },
    warning: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      dotColor: "bg-amber-500",
    },
    pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      dotColor: "bg-amber-500",
    },
    danger: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      dotColor: "bg-red-500",
    },
    rejected: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      dotColor: "bg-red-500",
    },
    info: {
      bg: "bg-sky-50",
      text: "text-sky-700",
      border: "border-sky-200",
      dotColor: "bg-sky-500",
    },
    neutral: {
      bg: "bg-slate-100",
      text: "text-slate-700",
      border: "border-slate-200",
      dotColor: "bg-slate-400",
    },
    purple: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
      dotColor: "bg-purple-500",
    },
    escalated: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
      dotColor: "bg-purple-500",
    },
  };

  const style = variantStyles[variant] || variantStyles.neutral;
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses} gap-1.5 ${className}`}
      {...props}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dotColor}`} />
      )}
      {children}
    </span>
  );
};

export default Badge;
