import React from "react";

export interface ButtonGroupProps {
  children: React.ReactNode;
  variant?: "attached" | "spaced" | "segmented";
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  variant = "spaced",
  className = "",
}) => {
  if (variant === "attached") {
    return (
      <div className={`inline-flex rounded-lg shadow-xs overflow-hidden ${className}`}>
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return child;
          const isFirst = index === 0;
          const isLast = index === React.Children.count(children) - 1;

          return React.cloneElement(child as React.ReactElement<any>, {
            className: `${(child.props as any).className || ""} rounded-none ${
              !isFirst ? "border-l-0" : "rounded-l-lg"
            } ${isLast ? "rounded-r-lg" : ""}`,
          });
        })}
      </div>
    );
  }

  if (variant === "segmented") {
    return (
      <div className={`inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 md:gap-3 ${className}`}>
      {children}
    </div>
  );
};

export interface ActionToolbarProps {
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
  title?: React.ReactNode;
  className?: string;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  leftActions,
  rightActions,
  title,
  className = "",
}) => {
  return (
    <div className={`w-full bg-white p-3 md:p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${className}`}>
      {title && <div className="text-sm font-semibold text-slate-800">{title}</div>}
      {leftActions && <div className="flex flex-wrap items-center gap-2">{leftActions}</div>}
      {rightActions && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{rightActions}</div>}
    </div>
  );
};

export interface ActionGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}

export const ActionGrid: React.FC<ActionGridProps> = ({
  children,
  columns = 4,
  className = "",
}) => {
  const colStyles = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  };

  return (
    <div className={`grid ${colStyles[columns]} gap-3 ${className}`}>
      {children}
    </div>
  );
};
