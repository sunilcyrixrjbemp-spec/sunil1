import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import Card from "../common/Card";

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "increase" | "decrease" | "neutral";
  subtitle?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = "neutral",
  subtitle,
  icon,
  iconBgColor = "bg-accent-50 text-accent-600",
  onClick,
}) => {
  return (
    <Card
      interactive={Boolean(onClick)}
      onClick={onClick}
      className="relative overflow-hidden"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-ink-500 tracking-wide uppercase">{title}</p>
          <h3 className="text-2xl md:text-3xl font-extrabold text-ink-900 mt-1 tracking-tight">
            {value}
          </h3>
        </div>
        {icon && (
          <div className={`p-3 rounded-xl ${iconBgColor} shrink-0 shadow-xs`}>
            {icon}
          </div>
        )}
      </div>

      {(change || subtitle) && (
        <div className="mt-4 flex items-center gap-2 text-xs font-medium border-t border-border pt-3">
          {change && (
            <span
              className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded-sm ${
                changeType === "increase"
                  ? "bg-emerald-50 text-emerald-700"
                  : changeType === "decrease"
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {changeType === "increase" && <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 inline" />}
              {changeType === "decrease" && <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 inline" />}
              {changeType === "neutral" && <Minus className="w-3.5 h-3.5 mr-0.5 inline" />}
              {change}
            </span>
          )}
          {subtitle && <span className="text-ink-500 truncate">{subtitle}</span>}
        </div>
      )}
    </Card>
  );
};

export default StatCard;
