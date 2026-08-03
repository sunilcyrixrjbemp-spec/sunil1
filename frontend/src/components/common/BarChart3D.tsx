import { useState } from "react";

interface BarChart3DDataItem {
  label: string;
  amount: number;
  color?: string;
}

interface BarChart3DProps {
  data: BarChart3DDataItem[];
  height?: number;
}

export default function BarChart3D({ data, height = 140 }: BarChart3DProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(...data.map((item) => item.amount), 1);

  return (
    <div className="w-full flex flex-col items-center select-none font-sans">
      <div className="relative w-full flex items-end justify-between gap-2 px-2" style={{ height: `${height}px` }}>
        {data.map((item, idx) => {
          const heightPercent = Math.max((item.amount / maxVal) * 100, 4);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute -top-10 z-20 px-2.5 py-1 bg-ink-900 text-white text-xs font-semibold rounded-md shadow-md whitespace-nowrap animate-fade-in pointer-events-none">
                  {item.label}: <span className="font-mono text-accent-400">₹{item.amount.toLocaleString("en-IN")}</span>
                </div>
              )}

              {/* Bar container */}
              <div className="w-full max-w-[28px] bg-slate-100 rounded-t-md overflow-hidden flex flex-col justify-end h-full">
                <div
                  className="w-full transition-all duration-300 ease-out rounded-t-md"
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: item.color || "var(--accent-600)",
                    opacity: isHovered ? 1 : 0.85,
                  }}
                />
              </div>

              {/* Label below */}
              <span className="text-[11px] font-medium text-ink-500 truncate w-full text-center mt-2">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
