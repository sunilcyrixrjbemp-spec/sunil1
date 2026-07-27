import React from 'react';
import { Clock } from 'lucide-react';
import { useCurrentTimeIST } from '../../hooks/useCurrentTimeIST';

export interface CurrentTimeWidgetProps {
  className?: string;
  variant?: 'badge' | 'minimal' | 'card' | 'navbar';
  showIcon?: boolean;
  showBadge?: boolean;
  format?: 'default' | '12h' | 'time' | 'full' | 'short' | 'long';
}

/**
 * Reusable Live IST Clock Widget
 * Updates every second with current India Standard Time (Asia/Kolkata)
 */
export const CurrentTimeWidget: React.FC<CurrentTimeWidgetProps> = ({
  className = '',
  variant = 'navbar',
  showIcon = true,
  showBadge = true,
  format = 'default'
}) => {
  const { currentTimeIST } = useCurrentTimeIST({ format });

  if (variant === 'minimal') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold ${className}`}>
        {showIcon && <Clock className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />}
        <span>{currentTimeIST}</span>
        {showBadge && <span className="text-[9px] font-bold uppercase bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded">IST</span>}
      </span>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 text-slate-100 text-xs font-mono font-bold shadow-xs border border-slate-800 ${className}`}>
        {showIcon && <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
        <span>{currentTimeIST}</span>
        {showBadge && <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">IST</span>}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`p-3 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-900/50 shadow-md ${className}`}>
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            Live System Time
          </span>
          <span className="bg-indigo-600 text-white px-1.5 py-0.2 rounded text-[9px] font-black">Asia/Kolkata</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-black font-mono tracking-tight text-white">{currentTimeIST}</span>
          <span className="text-xs font-bold font-mono text-emerald-400">IST (+05:30)</span>
        </div>
      </div>
    );
  }

  // Default: Navbar / Header style
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-mono font-bold shadow-2xs ${className}`}>
      {showIcon && <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0 animate-pulse" />}
      <span className="tracking-tight leading-none">{currentTimeIST}</span>
      {showBadge && (
        <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded leading-none">
          IST
        </span>
      )}
    </div>
  );
};
