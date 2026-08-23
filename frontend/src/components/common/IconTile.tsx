import React from "react";

interface IconTileProps {
  icon: React.ElementType;
  gradientFrom: string;
  gradientTo: string;
  shadowColor?: string;
  className?: string;
}

export const IconTile: React.FC<IconTileProps> = ({
  icon: Icon,
  gradientFrom,
  gradientTo,
  shadowColor = "rgba(0, 0, 0, 0.12)",
  className = "",
}) => (
  <div
    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-white shrink-0 ${className}`}
    style={{ boxShadow: `0 2px 6px -1px ${shadowColor}` }}
  >
    <Icon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
  </div>
);
