import { useState, useRef } from "react";

interface PieChart3DDataItem {
  label: string;
  amount: number;
  color: string;
  colorDark?: string;
}

interface PieChart3DProps {
  data: PieChart3DDataItem[];
  height?: number | string;
}

// Professional SaaS palettes: HSL-derived soft harmonized colors (Sleek design system)
const SaaSColors = [
  "#3b82f6", // Royal Blue
  "#10b981", // Emerald Green
  "#f59e0b", // Warm Amber
  "#6366f1", // Indigo
  "#ec4899", // Rose Pink
  "#14b8a6", // Teal
  "#8b5cf6", // Violet
  "#f97316"  // Coral Orange
];

function adjustColor(hex: string, percent: number) {
  const cleanHex = hex.startsWith("#") ? hex.substring(1) : hex;
  let R = parseInt(cleanHex.substring(0, 2), 16);
  let G = parseInt(cleanHex.substring(2, 4), 16);
  let B = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(R) || isNaN(G) || isNaN(B)) return hex;

  R = Math.max(0, Math.min(255, R + percent));
  G = Math.max(0, Math.min(255, G + percent));
  B = Math.max(0, Math.min(255, B + percent));

  const rHex = R.toString(16).padStart(2, "0");
  const gHex = G.toString(16).padStart(2, "0");
  const bHex = B.toString(16).padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`;
}

export default function PieChart3D({ data, height = 145 }: PieChart3DProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter non-zero items
  const activeData = data.filter(item => item.amount > 0);
  const total = activeData.reduce((sum, item) => sum + item.amount, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
        No allocations to display
      </div>
    );
  }

  // Modern isometric tilted 3D layout parameters:
  const cx = 150;
  const cy = 72;
  const rx = 85;  // Extended radius
  const ry = 32;  // Tighter isometric ratio (3D disk perspective)
  const depth = 16; // Low profile premium SaaS 3D depth

  let currentAngle = 0;

  const slices = activeData.map((item, idx) => {
    const pct = item.amount / total;
    const angleDelta = pct * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleDelta;
    currentAngle = endAngle;

    const midAngle = startAngle + angleDelta / 2;

    // Apply SaaS Color Scheme if color is default or generic
    const baseColor = item.color.startsWith("#") ? item.color : SaaSColors[idx % SaaSColors.length];
    
    // Low-contrast elegant metallic shading values
    const highlightColor = adjustColor(baseColor, 20);
    const shadowColor = adjustColor(baseColor, -15);
    const darkWallStart = adjustColor(baseColor, -12);
    const darkWallEnd = adjustColor(baseColor, -35);

    return {
      item,
      idx,
      startAngle,
      endAngle,
      midAngle,
      pct,
      baseColor,
      highlightColor,
      shadowColor,
      darkWallStart,
      darkWallEnd
    };
  });

  const sortedSlices = [...slices].sort((a, b) => Math.sin(a.midAngle) - Math.sin(b.midAngle));
  const isSingleSegment = activeData.length === 1;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const svgX = (x / rect.width) * 360;
    const svgY = (y / rect.height) * 180;

    const dx = svgX - cx;
    const dy = (svgY - cy) * (rx / ry);
    let mouseAngle = Math.atan2(dy, dx);
    if (mouseAngle < 0) mouseAngle += 2 * Math.PI;

    let foundIdx = null;
    for (let s of slices) {
      if (mouseAngle >= s.startAngle && mouseAngle <= s.endAngle) {
        foundIdx = s.idx;
        break;
      }
    }
    setHoveredIdx(foundIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center w-full py-1 select-none overflow-visible">
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: "320px", height: `${height}px` }}>
        <svg 
          viewBox="-20 0 340 180" 
          className="w-full h-full overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Flat SaaS drop shadows */}
            <filter id="saasFlatShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
              <feOffset dx="0" dy="10" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.08" />
              </feComponentTransfer>
              <feMerge> 
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            {slices.map((s, idx) => (
              <g key={`grads-${idx}`}>
                <linearGradient id={`lidGrad-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={s.highlightColor} />
                  <stop offset="100%" stopColor={s.shadowColor} />
                </linearGradient>
                <linearGradient id={`wallGrad-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={s.darkWallStart} />
                  <stop offset="100%" stopColor={s.darkWallEnd} />
                </linearGradient>
              </g>
            ))}
          </defs>

          {/* Premium Base Soft shadow */}
          <ellipse 
            cx={cx} 
            cy={cy + depth + 4} 
            rx={rx + 4} 
            ry={ry + 2} 
            fill="rgba(15, 23, 42, 0.08)" 
            className="blur-[4px]"
          />

          {/* Render Wall Extrusions (Isometric side edge) */}
          {sortedSlices.map(({ idx, startAngle, endAngle, midAngle }) => {
            const isHovered = hoveredIdx === idx;
            const explodeDist = isHovered ? 8 : 0;
            const ox = Math.cos(midAngle) * explodeDist;
            const oy = Math.sin(midAngle) * explodeDist;

            const x1 = cx + ox + rx * Math.cos(startAngle);
            const y1 = cy + oy + ry * Math.sin(startAngle);
            const x2 = cx + ox + rx * Math.cos(endAngle);
            const y2 = cy + oy + ry * Math.sin(endAngle);

            const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

            let wallPath = "";
            if (isSingleSegment) {
              wallPath = `
                M ${cx + ox - rx} ${cy + oy}
                A ${rx} ${ry} 0 0 0 ${cx + ox + rx} ${cy + oy}
                L ${cx + ox + rx} ${cy + oy + depth}
                A ${rx} ${ry} 0 0 1 ${cx + ox - rx} ${cy + oy + depth}
                Z
              `;
            } else {
              wallPath = `
                M ${x1} ${y1} 
                A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2} 
                L ${x2} ${y2 + depth} 
                A ${rx} ${ry} 0 ${largeArc} 0 ${x1} ${y1 + depth} 
                Z
              `;
            }

            return (
              <path
                key={`wall-${idx}`}
                d={wallPath}
                fill={`url(#wallGrad-${idx})`}
                stroke={adjustColor(slices[idx].baseColor, -25)}
                strokeWidth="0.3"
                className="transition-all duration-300 ease-out"
              />
            );
          })}

          {/* Render Top Slices (Lids) */}
          {sortedSlices.map(({ idx, startAngle, endAngle, midAngle }) => {
            const isHovered = hoveredIdx === idx;
            const explodeDist = isHovered ? 8 : 0;
            const ox = Math.cos(midAngle) * explodeDist;
            const oy = Math.sin(midAngle) * explodeDist;

            let lidPath = "";
            if (isSingleSegment) {
              return (
                <ellipse
                  key={`lid-${idx}`}
                  cx={cx + ox}
                  cy={cy + oy}
                  rx={rx}
                  ry={ry}
                  fill={`url(#lidGrad-${idx})`}
                  stroke="#ffffff"
                  strokeWidth="1.0"
                  filter="url(#saasFlatShadow)"
                  className="transition-all duration-300 ease-out"
                />
              );
            } else {
              const tx1 = cx + ox + rx * Math.cos(startAngle);
              const ty1 = cy + oy + ry * Math.sin(startAngle);
              const tx2 = cx + ox + rx * Math.cos(endAngle);
              const ty2 = cy + oy + ry * Math.sin(endAngle);
              const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
              lidPath = `
                M ${cx + ox} ${cy + oy} 
                L ${tx1} ${ty1} 
                A ${rx} ${ry} 0 ${largeArc} 1 ${tx2} ${ty2} 
                Z
              `;
            }

            return (
              <path
                key={`lid-${idx}`}
                d={lidPath}
                fill={`url(#lidGrad-${idx})`}
                stroke="#ffffff"
                strokeWidth="1.0"
                filter={isHovered ? "url(#saasFlatShadow)" : "none"}
                className="transition-all duration-300 ease-out"
              />
            );
          })}

          {/* SaaS labels with clean pointer lines */}
          {slices.map(({ idx, midAngle, item }) => {
            const isHovered = hoveredIdx === idx;
            const explodeDist = isHovered ? 8 : 0;

            const sx = cx + (rx + explodeDist) * Math.cos(midAngle);
            const sy = cy + (ry + explodeDist) * Math.sin(midAngle);

            const labelDist = 22;
            const tx = cx + (rx + labelDist) * Math.cos(midAngle);
            const ty = cy + (ry + labelDist) * Math.sin(midAngle);

            const textAnchor = Math.cos(midAngle) >= 0 ? "start" : "end";
            const textOffset = Math.cos(midAngle) >= 0 ? 5 : -5;
            const labelColor = item.color;

            return (
              <g key={`label-${idx}`} className="select-none pointer-events-none">
                <line
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke="#cbd5e1"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                />
                <line
                  x1={tx}
                  y1={ty}
                  x2={tx + textOffset}
                  y2={ty}
                  stroke="#cbd5e1"
                  strokeWidth="0.8"
                />
                <text
                  x={tx + textOffset + (textOffset > 0 ? 2 : -2)}
                  y={ty + 3}
                  textAnchor={textAnchor}
                  fill={labelColor}
                  className="text-[9px] font-black uppercase tracking-wider"
                  style={{
                    fontFamily: "'Aptos', sans-serif",
                    filter: "drop-shadow(0px 1px 1px rgba(255,255,255,0.9))"
                  }}
                >
                  {item.label}
                </text>
                <text
                  x={tx + textOffset + (textOffset > 0 ? 2 : -2)}
                  y={ty + 13}
                  textAnchor={textAnchor}
                  fill="#475569"
                  className="text-[8px] font-bold font-mono"
                >
                  ₹{item.amount.toLocaleString()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
