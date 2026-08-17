import React from "react";

export interface GridContainerProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12 | "auto";
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const GridContainer: React.FC<GridContainerProps> = ({
  children,
  cols = 3,
  gap = "md",
  className = "",
}) => {
  const gapStyles = {
    xs: "gap-2",
    sm: "gap-3 md:gap-4",
    md: "gap-4 md:gap-6",
    lg: "gap-6 md:gap-8",
    xl: "gap-8 md:gap-10",
  };

  const colStyles = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
    12: "grid-cols-12",
    auto: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
  };

  return (
    <div className={`grid ${colStyles[cols]} ${gapStyles[gap]} ${className}`}>
      {children}
    </div>
  );
};

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "increase" | "decrease" | "neutral";
  icon?: React.ReactNode;
  description?: string;
  badge?: string;
  accentColor?: "indigo" | "emerald" | "amber" | "rose" | "sky" | "purple";
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = "increase",
  icon,
  description,
  badge,
  accentColor = "indigo",
  className = "",
}) => {
  const colorMap = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
    sky: { bg: "bg-sky-50", text: "text-sky-600", border: "border-sky-100" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" },
  };

  const changeColors = {
    increase: "text-emerald-700 bg-emerald-50 border-emerald-200",
    decrease: "text-rose-700 bg-rose-50 border-rose-200",
    neutral: "text-slate-700 bg-slate-100 border-slate-200",
  };

  const colors = colorMap[accentColor];

  return (
    <div className={`bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
          {icon && (
            <div className={`p-2.5 rounded-xl ${colors.bg} ${colors.text} ${colors.border} border shrink-0`}>
              {icon}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</span>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {badge}
            </span>
          )}
        </div>
      </div>
      {(change || description) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {change && (
            <span className={`px-2 py-0.5 rounded-md font-semibold border ${changeColors[changeType]}`}>
              {change}
            </span>
          )}
          {description && <span className="text-slate-500 font-medium ml-auto">{description}</span>}
        </div>
      )}
    </div>
  );
};

export interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ children, className = "" }) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 ${className}`}>
      {children}
    </div>
  );
};
