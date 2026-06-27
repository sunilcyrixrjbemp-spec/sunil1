import { useState } from "react";

interface BarChart3DDataItem {
  label: string;
  amount: number; // Represents ticket count or value
  color: string;
}

interface BarChart3DProps {
  data: BarChart3DDataItem[];
  height?: number;
}

export default function BarChart3D({ data, height = 120 }: BarChart3DProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(...data.map(item => item.amount), 1);

  // Helper to adjust color shade for 3D sides
  function adjustColor(hex: string, percent: number) {
    const cleanHex = hex.startsWith("#") ? hex.substring(1) : hex;
    let R = parseInt(cleanHex.substring(0, 2), 16);
    let G = parseInt(cleanHex.substring(2, 4), 16);
    let B = parseInt(cleanHex.substring(4, 6), 16);
    if (isNaN(R) || isNaN(G) || isNaN(B)) return hex;
    R = Math.max(0, Math.min(255, R + percent));
    G = Math.max(0, Math.min(255, G + percent));
    B = Math.max(0, Math.min(255, B + percent));
    return `#${R.toString(16).padStart(2, "0")}${G.toString(16).padStart(2, "0")}${B.toString(16).padStart(2, "0")}`;
  }

  return (
    <div className="w-full flex flex-col items-center select-none font-sans">
      <div className="relative w-full flex items-center justify-center" style={{ height: `${height}px` }}>
        <svg viewBox="0 0 300 130" className="w-full h-full overflow-visible">
          {/* Bottom Grid Base Shadow Line */}
          <line x1="15" y1="110" x2="285" y2="110" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="15" y1="30" x2="285" y2="30" stroke="#f1f5f9" strokeWidth="0.8" />
          <line x1="15" y1="70" x2="285" y2="70" stroke="#f1f5f9" strokeWidth="0.8" />

          {data.map((item, idx) => {
            const barCount = data.length;
            const spacing = 270 / barCount;
            const x = 15 + idx * spacing + (spacing - 24) / 2; // Center bar inside spacing
            const rx = 12; // Cylinder horizontal radius
            const ry = 5;  // Cylinder vertical radius
            const cylinderWidth = rx * 2;

            // Height mapping
            const activeHeight = (item.amount / maxVal) * 75; // Max height 75px
            const bottomY = 110;
            const topY = bottomY - activeHeight;
            const isHovered = hoveredIdx === idx;

            // Excel Cylinder Colors
            const baseColor = item.color;
            const lightColor = adjustColor(baseColor, 35);
            const shadowColor = adjustColor(baseColor, -25);
            const sideShadow = adjustColor(baseColor, -40);

            // Shading definitions inside map to prevent duplication issues
            const cylinderGradientId = `cylGrad-${idx}`;
            const lidGradientId = `lidGrad-${idx}`;

            return (
              <g 
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <defs>
                  {/* Cylinder Front Curved Wall Gradient */}
                  <linearGradient id={cylinderGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={shadowColor} />
                    <stop offset="35%" stopColor={lightColor} />
                    <stop offset="70%" stopColor={baseColor} />
                    <stop offset="100%" stopColor={sideShadow} />
                  </linearGradient>
                  {/* Cylinder Top Ellipse Lid Gradient */}
                  <linearGradient id={lidGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={lightColor} />
                    <stop offset="100%" stopColor={shadowColor} />
                  </linearGradient>
                </defs>

                {/* Ambient drop shadow below bar cylinder */}
                <ellipse 
                  cx={x + rx} 
                  cy={bottomY + 1} 
                  rx={rx + 1} 
                  ry={ry + 0.5} 
                  fill="rgba(0,0,0,0.1)" 
                />

                {/* 3D Cylinder front face body */}
                <path
                  d={`
                    M ${x} ${topY}
                    A ${rx} ${ry} 0 0 1 ${x + cylinderWidth} ${topY}
                    L ${x + cylinderWidth} ${bottomY}
                    A ${rx} ${ry} 0 0 1 ${x} ${bottomY}
                    Z
                  `}
                  fill={`url(#${cylinderGradientId})`}
                  className="transition-all duration-200"
                  style={{ filter: isHovered ? "brightness(1.05)" : "none" }}
                />

                {/* 3D Cylinder Top cap ellipse */}
                <ellipse
                  cx={x + rx}
                  cy={topY}
                  rx={rx}
                  ry={ry}
                  fill={`url(#${lidGradientId})`}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                  className="transition-all duration-200"
                />

                {/* Top Label (Value text) */}
                <text
                  x={x + rx}
                  y={topY - 8}
                  textAnchor="middle"
                  fill={isHovered ? baseColor : "#475569"}
                  className="text-[9px] font-black font-mono select-none"
                >
                  {item.amount}
                </text>

                {/* Bottom X-axis label with rotate transform to prevent overlap */}
                <text
                  x={x + rx}
                  y={120}
                  textAnchor="middle"
                  fill="#475569"
                  transform={`rotate(-12, ${x + rx}, 120)`}
                  className="text-[7.5px] font-black uppercase select-none tracking-tighter"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
