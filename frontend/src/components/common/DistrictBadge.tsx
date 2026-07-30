import React from "react";
import { Tag } from "antd";

export interface DistrictBadgeProps {
  districtType?: "IN_DISTRICT" | "OUT_DISTRICT" | string | null;
  className?: string;
  style?: React.CSSProperties;
}

export const DistrictBadge: React.FC<DistrictBadgeProps> = ({
  districtType,
  className = "",
  style = {}
}) => {
  const normalized = (districtType || "").trim().toUpperCase();

  const isOut = normalized === "OUT_DISTRICT" || normalized === "OUTDOOR" || normalized === "OUT_STATION";

  const label = isOut ? "Out-District" : "In-District";

  // Design Tokens consistent with Cyrix Blue & status palette
  // min fontSize 13px as required
  const badgeStyle: React.CSSProperties = isOut
    ? {
        backgroundColor: "#eff6ff",
        color: "#1d4ed8",
        borderColor: "#bfdbfe",
        fontSize: "13px",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: "6px",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: "1.2",
        whiteSpace: "nowrap",
        ...style
      }
    : {
        backgroundColor: "#f0fdf4",
        color: "#15803d",
        borderColor: "#bbf7d0",
        fontSize: "13px",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: "6px",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: "1.2",
        whiteSpace: "nowrap",
        ...style
      };

  return (
    <Tag className={`district-badge ${className}`} style={badgeStyle}>
      {label}
    </Tag>
  );
};

export default DistrictBadge;
