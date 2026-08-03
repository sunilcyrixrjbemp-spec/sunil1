import { useState } from "react";

interface PieChart3DDataItem {
  label: string;
  amount: number;
  color?: string;
}

interface PieChart3DProps {
  data: PieChart3DDataItem[];
  height?: number | string;
}

const SaaSColors = [
  "#2563EB", // Royal Blue accent
  "#16A34A", // Green
  "#D97706", // Amber
  "#7C3AED", // Violet
  "#0EA5E9", // Cyan
  "#DC2626", // Red
  "#475569", // Slate
];

export default function PieChart3D({ data, height = 180 }: PieChart3DProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const activeData = data.filter((item) => item.amount > 0);
  const total = activeData.reduce((sum, item) => sum + item.amount, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-ink-500 text-xs font-medium">
        No allocations to display
      </div>
    );
  }

  let cumulativePercent = 0;

  // Compute SVG doughnut slices
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const slices = activeData.map((item, idx) => {
    const startPercent = cumulativePercent;
    const slicePercent = item.amount / total;
    cumulativePercent += slicePercent;
    const endPercent = cumulativePercent;

    const [startX, startY] = getCoordinatesForPercent(startPercent);
    const [endX, endY] = getCoordinatesForPercent(endPercent);

    const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

    const pathData = [
      `M ${startX} ${startY}`,
      `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      `L 0 0`,
    ].join(" ");

    const color = item.color && item.color.startsWith("#") ? item.color : SaaSColors[idx % SaaSColors.length];

    return {
      item,
      idx,
      slicePercent,
      color,
      pathData,
    };
  });

  return (
    <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 py-2" style={{ minHeight: height }}>
      {/* SVG Doughnut */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: 140, height: 140 }}>
        <svg viewBox="-1.15 -1.15 2.3 2.3" className="w-full h-full -rotate-90">
          {slices.map((slice) => {
            const isHovered = hoveredIdx === slice.idx;
            return (
              <path
                key={slice.idx}
                d={slice.pathData}
                fill={slice.color}
                className="transition-all duration-200 cursor-pointer"
                style={{
                  transform: isHovered ? "scale(1.04)" : "scale(1)",
                  transformOrigin: "0 0",
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.65,
                }}
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
          {/* Inner cutout for donut */}
          <circle cx="0" cy="0" r="0.65" fill="#FFFFFF" />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[10px] uppercase font-semibold text-ink-500 tracking-wider">Total</span>
          <span className="text-sm font-bold text-ink-900 font-mono">
            ₹{total >= 100000 ? `${(total / 100000).toFixed(1)}L` : total.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="flex-1 w-full space-y-2">
        {slices.map((slice) => {
          const isHovered = hoveredIdx === slice.idx;
          return (
            <div
              key={slice.idx}
              className={`flex items-center justify-between p-1.5 rounded-md transition-colors cursor-pointer text-xs ${
                isHovered ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
              onMouseEnter={() => setHoveredIdx(slice.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-medium text-ink-700 truncate">{slice.item.label}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-ink-500 text-[11px]">
                  {(slice.slicePercent * 100).toFixed(1)}%
                </span>
                <span className="font-mono font-semibold text-ink-900">
                  ₹{slice.item.amount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
