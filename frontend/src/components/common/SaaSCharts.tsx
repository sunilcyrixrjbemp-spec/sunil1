import React, { useState } from "react";

// ==========================================
// 1. SAAS SMOOTH BEZIER LINE & AREA CHART
// ==========================================
interface LineChartPoint {
  x: string | number;
  y: number;
  [key: string]: any;
}

interface SaaSLineChartProps {
  data: LineChartPoint[];
  height?: number;
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  valueFormatter?: (val: number) => string;
}

export const SaaSLineChart: React.FC<SaaSLineChartProps> = ({
  data,
  height = 280,
  color = "#4f46e5",
  gradientFrom = "#6366f1",
  gradientTo = "#818cf8",
  valueFormatter = (v) => `₹${v.toLocaleString()}`
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
        No trend data recorded
      </div>
    );
  }

  const padding = { top: 25, right: 25, bottom: 35, left: 55 };
  const width = 800; // SVG viewBox width
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const yValues = data.map((d) => d.y);
  const maxY = Math.max(...yValues, 1);
  const minY = 0;

  // Calculate points
  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(1, data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.y - minY) / (maxY - minY || 1)) * chartH;
    return { x, y, data: d, index: i };
  });

  // Build Smooth Bezier Path
  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const linePath = buildSmoothPath(points);
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
    : "";

  // Grid Y Ticks
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = minY + pct * (maxY - minY);
    const yPos = padding.top + chartH - pct * chartH;
    return { val, yPos };
  });

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative w-full h-full select-none" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="saasAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} stopOpacity={0.25} />
            <stop offset="100%" stopColor={gradientTo} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Horizontal Grid Lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.yPos}
              x2={width - padding.right}
              y2={tick.yPos}
              stroke="#e2e8f0"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={tick.yPos + 3}
              textAnchor="end"
              className="text-[10px] font-bold fill-slate-500 font-mono"
            >
              {tick.val >= 1000 ? `₹${(tick.val / 1000).toFixed(0)}k` : `₹${Math.round(tick.val)}`}
            </text>
          </g>
        ))}

        {/* Gradient Area */}
        <path d={areaPath} fill="url(#saasAreaGradient)" />

        {/* Smooth Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X Axis Labels */}
        {points.map((pt, i) => {
          if (data.length > 15 && i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={pt.x}
              y={height - 8}
              textAnchor="middle"
              className="text-[10px] font-bold fill-slate-500 font-sans"
            >
              {String(pt.data.x)}
            </text>
          );
        })}

        {/* Interactive Hover Crosshair */}
        {points.map((pt, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoverIndex(i)}
            className="cursor-pointer"
          >
            <rect
              x={pt.x - chartW / (data.length * 2)}
              y={padding.top}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
            />
            {hoverIndex === i && (
              <>
                <line
                  x1={pt.x}
                  y1={padding.top}
                  x2={pt.x}
                  y2={padding.top + chartH}
                  stroke={color}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="6"
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth="3"
                  className="transition-all shadow-md"
                />
              </>
            )}
          </g>
        ))}
      </svg>

      {/* Clean 100% Pure Sharp Square Floating Tooltip */}
      {activePoint && (
        <div
          className="absolute z-50 pointer-events-none bg-white border border-slate-300 shadow-2xl rounded-none p-2 px-2.5 text-xs font-bold min-w-[135px] backdrop-blur-md"
          style={{
            left: `${Math.min(80, Math.max(10, (activePoint.x / width) * 100))}%`,
            top: `${Math.max(10, (activePoint.y / height) * 100 - 65)}%`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="font-extrabold text-[9px] uppercase text-slate-400 tracking-wider leading-none mb-1">
            {String(activePoint.data.x)}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-600 text-[10px]">
              <span className="w-2 h-2 rounded-none" style={{ backgroundColor: color }} />
              Daily Spend:
            </span>
            <span className="font-mono font-black text-slate-900 text-[12.5px]">
              {valueFormatter(activePoint.data.y)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 1.5 HIGH-DENSITY 3D HYBRID TREND CHART (3D COLUMNS + LINE CURVE OVERLAY)
// ==========================================
interface SaaS3DHybridTrendChartProps {
  data: { x: string; y: number; [key: string]: any }[];
  height?: number;
  mode?: "expense" | "asset";
  showPeakLimit?: boolean;
  valueFormatter?: (val: number) => string;
}

export const SaaS3DHybridTrendChart: React.FC<SaaS3DHybridTrendChartProps> = ({
  data,
  height = 250,
  mode = "expense",
  showPeakLimit = false,
  valueFormatter = (v) => `₹${v.toLocaleString()}`
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
        No daily trend data available
      </div>
    );
  }

  const values = data.map(d => d.y || 0);
  const maxVal = Math.max(...values, 100);

  const width = 800;
  const padding = { top: 35, right: 30, bottom: 40, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const numItems = data.length;
  const barGap = 6;
  const barWidth = Math.max(8, Math.min(22, (chartW - (numItems - 1) * barGap) / numItems));
  const depthX = Math.min(8, barWidth * 0.45);
  const depthY = -6;

  // Y-axis Ticks
  const yTicks = [0, 0.33, 0.66, 1].map(pct => {
    const val = pct * maxVal;
    const yPos = padding.top + chartH - pct * chartH;
    return { val, yPos };
  });

  // Calculate points for 3D pillars & connecting line curve
  const points = data.map((item, i) => {
    const val = item.y || 0;
    const barH = Math.max(4, (val / maxVal) * chartH);
    const x = padding.left + i * (barWidth + barGap) + (chartW - (numItems * barWidth + (numItems - 1) * barGap)) / 2;
    const y = padding.top + chartH - barH;
    return {
      x,
      y,
      barH,
      val,
      name: item.x,
      centerX: x + barWidth / 2 + depthX / 2,
      centerY: y + depthY / 2,
      rawItem: item
    };
  });

  // Construct smooth Bezier spline line curve
  let linePathD = "";
  let areaPathD = "";
  if (points.length > 0) {
    linePathD = `M ${points[0].centerX} ${points[0].centerY}`;
    areaPathD = `M ${points[0].centerX} ${padding.top + chartH} L ${points[0].centerX} ${points[0].centerY}`;

    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cp1x = curr.centerX + (next.centerX - curr.centerX) / 2;
      const cp1y = curr.centerY;
      const cp2x = curr.centerX + (next.centerX - curr.centerX) / 2;
      const cp2y = next.centerY;
      const segment = ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.centerX} ${next.centerY}`;
      linePathD += segment;
      areaPathD += segment;
    }

    const lastPt = points[points.length - 1];
    areaPathD += ` L ${lastPt.centerX} ${padding.top + chartH} Z`;
  }

  return (
    <div className="relative w-full h-full select-none" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="hybridAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={mode === "asset" ? "#059669" : "#4f46e5"} stopOpacity="0.25" />
            <stop offset="100%" stopColor={mode === "asset" ? "#059669" : "#4f46e5"} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y Axis Grid Lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.yPos}
              x2={width - padding.right}
              y2={tick.yPos}
              stroke="#e2e8f0"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={tick.yPos + 3}
              textAnchor="end"
              className="text-[10px] font-bold fill-slate-500 font-mono"
            >
              {tick.val >= 1000 ? `₹${(tick.val / 1000).toFixed(0)}k` : `₹${Math.round(tick.val)}`}
            </text>
          </g>
        ))}

        {/* Optional Peak Limit Threshold Line */}
        {showPeakLimit && maxVal > 0 && (() => {
          const peakYPos = padding.top + chartH - (maxVal / maxVal) * chartH;
          return (
            <g className="pointer-events-none">
              <line
                x1={padding.left}
                y1={peakYPos}
                x2={width - padding.right}
                y2={peakYPos}
                stroke="#e11d48"
                strokeWidth="1.2"
                strokeDasharray="5 3"
                opacity="0.8"
              />
              <text
                x={width - padding.right}
                y={peakYPos - 4}
                textAnchor="end"
                className="text-[8.5px] font-mono font-extrabold fill-rose-600 tracking-wider uppercase"
              >
                PEAK LIMIT
              </text>
            </g>
          );
        })()}

        {/* Soft Background Gradient Fill under curve */}
        {areaPathD && (
          <path d={areaPathD} fill="url(#hybridAreaGrad)" className="pointer-events-none" />
        )}

        {/* 3D Vertical Daily Pillars */}
        {points.map((pt, i) => {
          const isHovered = hoverIndex === i;

          let baseColor = "#3b82f6";
          if (mode === "asset") {
            // Asset Mode: High value = GREEN (#059669) -> Business Growth!
            baseColor = pt.val >= maxVal * 0.7
              ? "#059669" // High Asset Added -> Emerald Green
              : pt.val >= maxVal * 0.4
              ? "#3b82f6" // Medium Asset -> Blue
              : "#6366f1"; // Base Asset -> Indigo
          } else {
            // Expense Mode: High value = RED (#e11d48) -> Spend Alert!
            baseColor = pt.val >= maxVal * 0.7
              ? "#e11d48" // High Spend -> RED
              : pt.val >= maxVal * 0.4
              ? "#3b82f6" // Medium Spend -> BLUE
              : "#10b981"; // Low Spend -> GREEN
          }

          const color = isHovered ? getDarkenedColor(baseColor, 15) : baseColor;
          const sideColor = getDarkenedColor(baseColor, -35);
          const topColor = getDarkenedColor(baseColor, 20);

          const frontPath = `M ${pt.x} ${pt.y} L ${pt.x + barWidth} ${pt.y} L ${pt.x + barWidth} ${pt.y + pt.barH} L ${pt.x} ${pt.y + pt.barH} Z`;
          const sidePath = `M ${pt.x + barWidth} ${pt.y} L ${pt.x + barWidth + depthX} ${pt.y + depthY} L ${pt.x + barWidth + depthX} ${pt.y + pt.barH + depthY} L ${pt.x + barWidth} ${pt.y + pt.barH} Z`;
          const topCapPath = `M ${pt.x} ${pt.y} L ${pt.x + depthX} ${pt.y + depthY} L ${pt.x + barWidth + depthX} ${pt.y + depthY} L ${pt.x + barWidth} ${pt.y} Z`;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoverIndex(i)}
              className="cursor-pointer transition-all duration-200"
            >
              {/* 3D Right Side Wall */}
              <path d={sidePath} fill={sideColor} opacity={isHovered ? 1 : 0.85} />
              {/* 3D Top Cap Lid */}
              <path d={topCapPath} fill={topColor} opacity={isHovered ? 1 : 0.95} />
              {/* 3D Front Face */}
              <path
                d={frontPath}
                fill={color}
                opacity={isHovered ? 1 : 0.88}
                stroke={isHovered ? "#ffffff" : "none"}
                strokeWidth="1"
              />

              {/* X Axis Date Label */}
              {(i === 0 || i === numItems - 1 || i % Math.max(3, Math.floor(numItems / 7)) === 0) && (
                <text
                  x={pt.x + barWidth / 2}
                  y={height - 10}
                  textAnchor="middle"
                  className="text-[9.5px] font-extrabold fill-slate-600 font-sans"
                >
                  {pt.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Connecting Smooth Line Curve (Overlaid on top of 3D Pillars) */}
        {linePathD && (
          <g className="pointer-events-none">
            {/* Outer Glow Line */}
            <path
              d={linePathD}
              fill="none"
              stroke={mode === "asset" ? "#047857" : "#4338ca"}
              strokeWidth="4"
              opacity="0.2"
              strokeLinecap="round"
            />
            {/* Main Trend Line */}
            <path
              d={linePathD}
              fill="none"
              stroke={mode === "asset" ? "#064e3b" : "#312e81"}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Glowing Node Dots */}
            {points.map((pt, i) => {
              let nodeColor = "#1d4ed8";
              if (mode === "asset") {
                nodeColor = pt.val >= maxVal * 0.7
                  ? "#047857"
                  : pt.val >= maxVal * 0.4
                  ? "#1d4ed8"
                  : "#4338ca";
              } else {
                nodeColor = pt.val >= maxVal * 0.7
                  ? "#be123c"
                  : pt.val >= maxVal * 0.4
                  ? "#1d4ed8"
                  : "#047857";
              }

              return (
                <circle
                  key={`node-${i}`}
                  cx={pt.centerX}
                  cy={pt.centerY}
                  r={hoverIndex === i ? "5" : "3"}
                  fill={hoverIndex === i ? "#ffffff" : nodeColor}
                  stroke={nodeColor}
                  strokeWidth="2"
                  className="transition-all duration-150"
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* 100% Pure Sharp Square Floating Hover Tooltip */}
      {hoverIndex !== null && points[hoverIndex] && (() => {
        const item = points[hoverIndex];
        let textColor = "text-blue-700";
        let statusTag = "Value";
        let badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";

        if (mode === "asset") {
          if (item.val >= maxVal * 0.7) {
            textColor = "text-emerald-700";
            statusTag = "High Asset Tagged";
            badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
          } else if (item.val >= maxVal * 0.4) {
            textColor = "text-blue-700";
            statusTag = "Moderate Asset";
            badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
          } else {
            textColor = "text-indigo-700";
            statusTag = "Base Asset";
            badgeStyle = "bg-indigo-50 text-indigo-700 border-indigo-200";
          }
        } else {
          if (item.val >= maxVal * 0.7) {
            textColor = "text-rose-700";
            statusTag = "High Spend";
            badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
          } else if (item.val >= maxVal * 0.4) {
            textColor = "text-blue-700";
            statusTag = "Moderate Spend";
            badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
          } else {
            textColor = "text-emerald-700";
            statusTag = "Low Spend";
            badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
          }
        }

        return (
          <div
            className="absolute z-50 pointer-events-none bg-white border border-slate-300 shadow-2xl rounded-none p-2 px-2.5 flex flex-col justify-center min-w-[155px] transition-all duration-150 backdrop-blur-md"
            style={{
              left: `${Math.min(80, Math.max(12, (item.centerX / width) * 100))}%`,
              top: `${Math.max(10, (item.centerY / height) * 100 - 65)}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-extrabold text-[9px] uppercase text-slate-400 tracking-wider leading-none">
                {item.name}
              </span>
              <span className={`text-[7.5px] font-bold px-1 py-0.5 rounded-none border leading-none ${badgeStyle}`}>
                {statusTag}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold text-slate-600">
                {mode === "asset" ? "Asset Value:" : "Daily Spend:"}
              </span>
              <span className={`font-mono font-black text-[13px] ${textColor}`}>
                {valueFormatter(item.val)}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};


// ==========================================
// 2. REAL 3D EXTRUDED COLUMN PILLAR CHART
// ==========================================
interface BarDataItem {
  name: string;
  amount?: number;
  count?: number;
  value?: number;
  [key: string]: any;
}

interface SaaSBarChartProps {
  data: BarDataItem[];
  valueKey?: string;
  nameKey?: string;
  height?: number;
  isCurrency?: boolean;
  showLineOverlay?: boolean;
  valueFormatter?: (val: number) => string;
}

export const SaaSBarChart: React.FC<SaaSBarChartProps> = ({
  data,
  valueKey = "amount",
  nameKey = "name",
  height = 290,
  isCurrency = true,
  showLineOverlay = true,
  valueFormatter = (v) => `₹${v.toLocaleString()}`
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
        No bar chart data available
      </div>
    );
  }

  const sanitizeBarVal = (d: any): number => {
    const raw = Number(d[valueKey] || d.amount || d.count || d.value || 0);
    if (isNaN(raw) || raw <= 0) return 0;
    if (!isCurrency && raw > 100000) return 1;
    return raw;
  };

  const values = data.map((d) => sanitizeBarVal(d));
  const maxVal = Math.max(...values, 1);

  const colors = [
    "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
    "#06b6d4", "#ec4899", "#14b8a6", "#6366f1", "#059669"
  ];

  const width = 800;
  const padding = { top: 35, right: 30, bottom: 45, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const numBars = data.length;
  const barGap = numBars <= 6 ? 32 : 18;
  const barWidth = Math.max(24, Math.min(72, (chartW - (numBars - 1) * barGap) / numBars));
  const depthX = 14;
  const depthY = -10;

  // Y Axis Ticks
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = pct * maxVal;
    const yPos = padding.top + chartH - pct * chartH;
    return { val, yPos };
  });

  // Calculate overlay line curve points (Connecting top centers of all 3D pillars)
  const linePoints = data.map((item, i) => {
    const val = sanitizeBarVal(item);
    const barH = Math.max(10, (val / maxVal) * chartH);
    const x = padding.left + i * (barWidth + barGap) + (chartW - (numBars * barWidth + (numBars - 1) * barGap)) / 2;
    const y = padding.top + chartH - barH;
    return {
      x: x + barWidth / 2 + depthX / 2,
      y: y + depthY / 2,
      val
    };
  });

  let linePathD = "";
  if (linePoints.length > 0) {
    linePathD = `M ${linePoints[0].x} ${linePoints[0].y}`;
    for (let i = 0; i < linePoints.length - 1; i++) {
      const curr = linePoints[i];
      const next = linePoints[i + 1];
      const cp1x = curr.x + (next.x - curr.x) / 2;
      const cp1y = curr.y;
      const cp2x = curr.x + (next.x - curr.x) / 2;
      const cp2y = next.y;
      linePathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }
  }

  return (
    <div className="relative w-full h-full select-none" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Horizontal Grid Lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.yPos}
              x2={width - padding.right}
              y2={tick.yPos}
              stroke="#e2e8f0"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={tick.yPos + 3}
              textAnchor="end"
              className="text-[10px] font-bold fill-slate-500 font-mono"
            >
              {isCurrency
                ? (tick.val >= 1000 ? `₹${(tick.val / 1000).toFixed(0)}k` : `₹${Math.round(tick.val)}`)
                : (tick.val >= 1000 ? `${(tick.val / 1000).toFixed(1)}k` : `${Math.round(tick.val)}`)
              }
            </text>
          </g>
        ))}

        {/* 3D Vertical Extruded Column Pillars */}
        {data.map((item, i) => {
          const val = sanitizeBarVal(item);
          const name = String(item[nameKey] || item.name || `Item #${i + 1}`);
          const barH = Math.max(10, (val / maxVal) * chartH);
          const x = padding.left + i * (barWidth + barGap) + (chartW - (numBars * barWidth + (numBars - 1) * barGap)) / 2;
          const y = padding.top + chartH - barH;
          const color = colors[i % colors.length];
          const sideColor = getDarkenedColor(color, -35);
          const topColor = getDarkenedColor(color, 20);
          const isHovered = hoverIndex === i;

          // 3D Geometry paths
          const frontPath = `M ${x} ${y} L ${x + barWidth} ${y} L ${x + barWidth} ${y + barH} L ${x} ${y + barH} Z`;
          const sidePath = `M ${x + barWidth} ${y} L ${x + barWidth + depthX} ${y + depthY} L ${x + barWidth + depthX} ${y + barH + depthY} L ${x + barWidth} ${y + barH} Z`;
          const topCapPath = `M ${x} ${y} L ${x + depthX} ${y + depthY} L ${x + barWidth + depthX} ${y + depthY} L ${x + barWidth} ${y} Z`;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoverIndex(i)}
              className="cursor-pointer transition-all duration-300"
            >
              {/* 3D Right Side Wall */}
              <path
                d={sidePath}
                fill={sideColor}
                opacity={isHovered ? 1 : 0.9}
                className="transition-all duration-200"
              />

              {/* 3D Top Cap Lid */}
              <path
                d={topCapPath}
                fill={topColor}
                opacity={isHovered ? 1 : 0.95}
                className="transition-all duration-200"
              />

              {/* 3D Front Face */}
              <path
                d={frontPath}
                fill={color}
                opacity={isHovered ? 1 : 0.88}
                stroke={isHovered ? "#ffffff" : "none"}
                strokeWidth="1.5"
                className="transition-all duration-200"
              />

              {/* Exact Number Label above pillar */}
              <text
                x={x + barWidth / 2 + depthX / 2}
                y={y + depthY - 10}
                textAnchor="middle"
                className={`text-[11px] font-black font-mono ${isHovered ? "fill-indigo-950" : "fill-slate-800"}`}
              >
                {val.toLocaleString("en-IN")}
              </text>

              {/* X Axis Label */}
              <text
                x={x + barWidth / 2}
                y={height - 12}
                textAnchor="middle"
                className="text-[10.5px] font-extrabold fill-slate-700 font-sans"
              >
                {name.length > 15 ? `${name.substring(0, 14)}…` : name}
              </text>
            </g>
          );
        })}

        {/* Combined Line Overlay (Bar + Line Together) */}
        {showLineOverlay && linePoints.length > 1 && (
          <g className="pointer-events-none">
            {/* Soft Outer Line Glow */}
            <path
              d={linePathD}
              fill="none"
              stroke="#6366f1"
              strokeWidth="5"
              opacity="0.35"
              strokeLinecap="round"
            />
            {/* Main Connecting Trend Line */}
            <path
              d={linePathD}
              fill="none"
              stroke="#4338ca"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Glowing Line Node Dots */}
            {linePoints.map((pt, i) => (
              <circle
                key={`node-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="4"
                fill="#ffffff"
                stroke="#4338ca"
                strokeWidth="2.2"
              />
            ))}
          </g>
        )}
      </svg>

      {/* Floating Hover Card Tooltip (Exact Reference Style) */}
      {hoverIndex !== null && data[hoverIndex] && (() => {
        const item = data[hoverIndex];
        const val = Number(item[valueKey] || item.amount || item.count || item.value || 0);
        const name = String(item[nameKey] || item.name || `Item #${hoverIndex + 1}`);
        const formattedVal = valueFormatter ? valueFormatter(val) : val.toLocaleString("en-IN");
        
        const colors = [
          "text-blue-600", "text-emerald-600", "text-amber-600", "text-purple-600", "text-rose-600",
          "text-cyan-600", "text-pink-600", "text-teal-600", "text-indigo-600", "text-emerald-700"
        ];
        const textColor = colors[hoverIndex % colors.length];

        return (
          <div
            className="absolute z-50 pointer-events-none bg-white border border-slate-300 shadow-2xl rounded-none p-2 px-2.5 flex flex-col justify-center min-w-[135px] transition-all duration-150 backdrop-blur-md"
            style={{
              left: `${Math.min(80, Math.max(15, ((padding.left + hoverIndex * (barWidth + barGap) + barWidth / 2) / width) * 100))}%`,
              top: `12%`,
              transform: 'translateX(-50%)'
            }}
          >
            <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400 leading-none mb-1 block truncate">
              {name}
            </span>
            <span className={`text-[12.5px] font-mono font-extrabold leading-none whitespace-nowrap ${textColor}`}>
              {formattedVal}
            </span>
          </div>
        );
      })()}
    </div>
  );
};


// Helper function for 3D side wall shading
function getDarkenedColor(hex: string, percent: number = -30): string {
  if (!hex || !hex.startsWith("#")) return "#334155";
  let num = parseInt(hex.replace("#", ""), 16);
  if (isNaN(num)) return "#334155";
  let amt = Math.round(2.55 * percent);
  let R = (num >> 16) + amt;
  let G = ((num >> 8) & 0x00ff) + amt;
  let B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

// ==========================================
// 2.5 3D / MODERN HORIZONTAL BAR CHART
// ==========================================
interface SaaSHorizontalBarChartProps {
  data: BarDataItem[];
  valueKey?: string;
  nameKey?: string;
  height?: number;
  isCurrency?: boolean;
  valueFormatter?: (val: number) => string;
}

export const SaaSHorizontalBarChart: React.FC<SaaSHorizontalBarChartProps> = ({
  data,
  valueKey = "amount",
  nameKey = "name",
  height = 270,
  isCurrency = true,
  valueFormatter = (v) => `₹${v.toLocaleString()}`
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
        No bar chart data available
      </div>
    );
  }

  const values = data.map((d) => Number(d[valueKey] || d.amount || d.count || d.value || 0));
  const maxVal = Math.max(...values, 1);
  const totalVal = values.reduce((a, b) => a + b, 0);

  const barColors = [
    "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
    "#06b6d4", "#ec4899", "#14b8a6", "#6366f1", "#059669"
  ];

  return (
    <div className="w-full flex flex-col justify-start space-y-2.5 select-none overflow-y-auto pr-1" style={{ height }}>
      {data.slice(0, 6).map((item, i) => {
        const val = Number(item[valueKey] || item.amount || item.count || item.value || 0);
        const name = String(item[nameKey] || item.name || `Item #${i + 1}`);
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const totalPct = totalVal > 0 ? Math.round((val / totalVal) * 100) : 0;
        const color = barColors[i % barColors.length];
        const formattedVal = valueFormatter ? valueFormatter(val) : (isCurrency ? `₹${val.toLocaleString("en-IN")}` : val.toLocaleString("en-IN"));

        return (
          <div key={i} className="bg-slate-50 border border-slate-200/70 rounded-none p-1.5 px-2 flex flex-col justify-center space-y-1 hover:bg-slate-100/70 transition-all">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-900 truncate max-w-[170px] leading-tight">
                {name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {totalPct}%
                </span>
                <span className="font-mono font-black text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded-none text-[11px]">
                  {formattedVal}
                </span>
              </div>
            </div>
            {/* Horizontal Bar Track */}
            <div className="w-full bg-slate-200/80 h-2 rounded-none overflow-hidden relative">
              <div
                className="h-full transition-all duration-500 rounded-none"
                style={{
                  width: `${Math.max(3, pct)}%`,
                  backgroundColor: color
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 3. MODERN 2D DONUT RING CHART (EXPANDED SIZE, ZERO 3D)
// ==========================================
interface DonutDataItem {
  name: string;
  value: number;
  color?: string;
  count?: number;
  [key: string]: any;
}

interface SaaSDonutChartProps {
  data: DonutDataItem[];
  height?: number;
  centerTitle?: string;
  valueFormatter?: (val: number) => string;
}

export const SaaSDonutChart: React.FC<SaaSDonutChartProps> = ({
  data,
  height = 290,
  centerTitle = "TOTAL CLAIMS",
  valueFormatter = (v) => `₹${v.toLocaleString("en-IN")}`
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
        No distribution data
      </div>
    );
  }

  const totalVal = data.reduce((sum, item) => sum + (item.value || 0), 0);
  const totalCount = data.reduce((sum, item) => sum + (item.count || 0), 0);

  const defaultColors = [
    "#4f46e5", // Vibrant Royal Indigo
    "#059669", // Emerald Green
    "#d97706", // Amber
    "#e11d48", // Rose Red
    "#0891b2", // Cyan
    "#7c3aed"  // Violet
  ];

  const width = 600;
  const viewBoxHeight = 350;
  const cx = 300;
  const cy = 175;
  const R = 168; // Giant Outer Donut Radius for maximum scale
  const r = 98;  // Giant Inner Donut Hole Radius

  let currentAngle = -Math.PI / 2; // Start top center

  const slices = data.map((item, i) => {
    const rawPct = totalVal > 0 ? item.value / totalVal : 0;
    const angleSize = rawPct * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSize;
    const midAngle = startAngle + angleSize / 2;
    currentAngle = endAngle;

    const color = item.color || defaultColors[i % defaultColors.length];

    // Outer Arc points
    const x1_out = cx + R * Math.cos(startAngle);
    const y1_out = cy + R * Math.sin(startAngle);
    const x2_out = cx + R * Math.cos(endAngle);
    const y2_out = cy + R * Math.sin(endAngle);

    // Inner Arc points
    const x1_in = cx + r * Math.cos(startAngle);
    const y1_in = cy + r * Math.sin(startAngle);
    const x2_in = cx + r * Math.cos(endAngle);
    const y2_in = cy + r * Math.sin(endAngle);

    // Label position (Outside donut ring)
    const labelR = R + 22;
    const labelX = cx + labelR * Math.cos(midAngle);
    const labelY = cy + labelR * Math.sin(midAngle);
    const sliceMidX = cx + ((R + r) / 2) * Math.cos(midAngle);
    const sliceMidY = cy + ((R + r) / 2) * Math.sin(midAngle);

    const largeArcFlag = angleSize > Math.PI ? 1 : 0;
    const isFullCircle = angleSize >= 2 * Math.PI - 0.001;

    // 2D Donut Slice SVG Path (Handles 100% full circle slices gracefully)
    const pathD = isFullCircle
      ? `
        M ${cx} ${cy - R}
        A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R}
        L ${cx - 0.01} ${cy - r}
        A ${r} ${r} 0 1 0 ${cx} ${cy - r}
        Z
      `
      : `
        M ${x1_out} ${y1_out}
        A ${R} ${R} 0 ${largeArcFlag} 1 ${x2_out} ${y2_out}
        L ${x2_in} ${y2_in}
        A ${r} ${r} 0 ${largeArcFlag} 0 ${x1_in} ${y1_in}
        Z
      `;

    return {
      ...item,
      pct: rawPct,
      pctLabel: `${Math.round(rawPct * 100)}%`,
      color,
      pathD,
      labelX,
      labelY,
      sliceMidX,
      sliceMidY,
      midAngle,
      index: i
    };
  });

  // Minimum percentage threshold to render callout line & text label to avoid text collisions
  const minPctThreshold = slices.length > 8 ? 0.04 : 0.02;

  return (
    <div className="w-full flex flex-col items-center justify-between select-none" style={{ height }}>
      {/* 2D Donut SVG Canvas (Expanded size filling card) */}
      <div className="relative w-full h-full flex items-center justify-center">
        <svg viewBox={`0 0 ${width} ${viewBoxHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMid meet">
          {/* Render 2D Donut Slices */}
          {slices.map((slice) => {
            const isHovered = hoverIndex === slice.index;

            return (
              <g
                key={`slice-${slice.index}`}
                onMouseEnter={() => setHoverIndex(slice.index)}
                onMouseLeave={() => setHoverIndex(null)}
                className="cursor-pointer"
              >
                <path
                  d={slice.pathD}
                  fill={slice.color}
                  opacity={hoverIndex === null || isHovered ? 1 : 0.7}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  style={{
                    filter: isHovered ? "brightness(1.15) drop-shadow(0 4px 8px rgba(0,0,0,0.18))" : "none",
                    transition: "all 0.15s ease-out"
                  }}
                />
              </g>
            );
          })}

          {/* Render Callout Lines and Outer Percentage Labels */}
          {slices.map((slice) => {
            if (slice.pct < minPctThreshold) return null;
            const isHovered = hoverIndex === slice.index;
            const textAnchor = Math.cos(slice.midAngle) >= 0 ? "start" : "end";

            return (
              <g key={`label-${slice.index}`} className="pointer-events-none">
                <line
                  x1={slice.sliceMidX}
                  y1={slice.sliceMidY}
                  x2={slice.labelX}
                  y2={slice.labelY}
                  stroke="#64748b"
                  strokeWidth="1.3"
                  strokeDasharray="2 2"
                  opacity={isHovered ? 1 : 0.8}
                />
                <text
                  x={slice.labelX + (Math.cos(slice.midAngle) >= 0 ? 4 : -4)}
                  y={slice.labelY - 4}
                  textAnchor={textAnchor}
                  className={`text-[12px] font-black font-sans ${isHovered ? "fill-indigo-950" : "fill-slate-900"}`}
                >
                  {slice.name}
                </text>
                <text
                  x={slice.labelX + (Math.cos(slice.midAngle) >= 0 ? 4 : -4)}
                  y={slice.labelY + 11}
                  textAnchor={textAnchor}
                  className={`text-[13px] font-mono font-black ${isHovered ? "fill-blue-700" : "fill-slate-700"}`}
                >
                  {slice.pctLabel}
                </text>
              </g>
            );
          })}

          {/* Center Donut Hole Summary */}
          <g className="pointer-events-none">
            <circle cx={cx} cy={cy} r={r - 3} fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              className="text-[17px] font-mono font-black fill-slate-900 leading-none"
            >
              {(totalCount || totalVal).toLocaleString("en-IN")}
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              className="text-[9px] font-bold fill-slate-400 uppercase tracking-widest leading-none"
            >
              {centerTitle.toUpperCase()}
            </text>
          </g>
        </svg>

        {/* Floating Pure Hover Datacard */}
        {hoverIndex !== null && slices[hoverIndex] && (() => {
          const item = slices[hoverIndex];
          return (
            <div
              className="absolute z-50 pointer-events-none bg-white border border-slate-300 shadow-2xl rounded-none p-1.5 px-2 flex items-center gap-1.5 transition-all duration-150 backdrop-blur-md min-w-[130px]"
              style={{
                left: `50%`,
                top: `78%`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="w-4 h-4 rounded-none shrink-0 shadow-2xs" style={{ backgroundColor: item.color }} />

              <div className="flex flex-col justify-center min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-[8px] font-extrabold uppercase tracking-wide text-slate-500 leading-none truncate max-w-[100px]">
                    {item.name}
                  </span>
                  <span className="text-[7.5px] font-mono font-extrabold px-1 py-0.5 rounded-none bg-slate-100 text-slate-800 border border-slate-200 leading-none shrink-0">
                    {item.pctLabel}
                  </span>
                </div>
                <div className="text-[10px] font-mono font-black leading-none mt-1 text-slate-900 whitespace-nowrap">
                  {valueFormatter ? valueFormatter(item.value) : `${item.value} Users`}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

