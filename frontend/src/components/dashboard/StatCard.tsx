import React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "increase" | "decrease" | "neutral";
  subtitle?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = "neutral",
  subtitle,
  icon,
  iconBgColor = "bg-accent-50 text-accent-700",
  onClick,
  className = "",
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-line rounded-[10px] p-5 transition-colors duration-150 relative ${
        onClick ? "cursor-pointer hover:border-[#D4D1CB] active:scale-[0.99]" : "hover:border-[#D4D1CB]"
      } shadow-none ${className}`}
      style={{
        boxShadow: "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-mono font-medium text-ink-500 tracking-[0.03em] uppercase truncate m-0">
            {title}
          </p>
          <h3 className="text-2xl sm:text-[28px] lg:text-[30px] font-bold font-display text-ink-900 mt-1.5 tracking-tight tabular-nums leading-none m-0">
            {value}
          </h3>
        </div>
        {icon && (
          <div className={`p-2.5 rounded-lg ${iconBgColor} shrink-0 border border-line/50`}>
            {icon}
          </div>
        )}
      </div>

      {(change || subtitle) && (
        <div className="mt-3.5 pt-3 flex items-center gap-2 border-t border-line/60 text-xs">
          {change && (
            <span
              className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                changeType === "increase"
                  ? "bg-emerald-50 text-[#0F7A4C] border border-emerald-200/60"
                  : changeType === "decrease"
                  ? "bg-rose-50 text-[#B3261E] border border-rose-200/60"
                  : "bg-surface-sunken text-ink-600 border border-line"
              }`}
            >
              {changeType === "increase" && <ArrowUp className="w-3 h-3 stroke-[2.5]" />}
              {changeType === "decrease" && <ArrowDown className="w-3 h-3 stroke-[2.5]" />}
              {changeType === "neutral" && <Minus className="w-3 h-3" />}
              <span>{change}</span>
            </span>
          )}
          {subtitle && (
            <span className="text-ink-500 truncate text-[11px] font-sans">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
