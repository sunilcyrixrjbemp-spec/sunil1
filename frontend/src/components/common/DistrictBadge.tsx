import React from "react";
import { Tag } from "antd";

/**
 * Normalizes a district string for case-insensitive, whitespace-trimmed,
 * and prefix/suffix tolerant comparison.
 */
export function normalizeDistrictName(dist?: string | null): string {
  if (!dist) return "";
  let clean = String(dist).trim().toLowerCase();
  clean = clean.replace(/^(sri|shri)\s+/i, "");
  clean = clean.replace(/\s+(district|distt|dist|zone)\b/i, "");
  clean = clean.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  return clean;
}

/**
 * Computes derived districtType ("IN_DISTRICT" | "OUT_DISTRICT") from submitter's
 * base district and legs / expense district.
 */
export function computeDistrictType(
  submitterBaseDistrict?: string | null,
  legs: any[] = [],
  expDistrict?: string | null
): "IN_DISTRICT" | "OUT_DISTRICT" {
  const base = normalizeDistrictName(submitterBaseDistrict);

  if (legs && Array.isArray(legs) && legs.length > 0) {
    for (const leg of legs) {
      const fromDist = normalizeDistrictName(leg.district_from || leg.from_district || leg.fromDistrict);
      const toDist = normalizeDistrictName(leg.district || leg.to_district || leg.toDistrict);

      if (fromDist && base && fromDist !== base) return "OUT_DISTRICT";
      if (toDist && base && toDist !== base) return "OUT_DISTRICT";
      if (fromDist && toDist && fromDist !== base && toDist !== base && fromDist !== toDist) return "OUT_DISTRICT";
    }
    return "IN_DISTRICT";
  }

  const expDist = normalizeDistrictName(expDistrict);
  if (expDist && base && expDist !== base) {
    return "OUT_DISTRICT";
  }

  return "IN_DISTRICT";
}

export interface DistrictBadgeProps {
  districtType?: "IN_DISTRICT" | "OUT_DISTRICT" | string | null;
  baseDistrict?: string | null;
  legs?: any[];
  expDistrict?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

export const DistrictBadge: React.FC<DistrictBadgeProps> = ({
  districtType,
  baseDistrict,
  legs,
  expDistrict,
  className = "",
  style = {}
}) => {
  let resolvedType = districtType;
  if (!resolvedType && (baseDistrict || (legs && legs.length > 0) || expDistrict)) {
    resolvedType = computeDistrictType(baseDistrict, legs, expDistrict);
  }

  const normalized = (resolvedType || "").trim().toUpperCase();
  const isOut = normalized === "OUT_DISTRICT" || normalized === "OUTDOOR" || normalized === "OUT_STATION";
  const label = isOut ? "Out-District" : "In-District";

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
        flexShrink: 0,
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
        flexShrink: 0,
        ...style
      };

  return (
    <Tag className={`district-badge ${className}`} style={badgeStyle}>
      {label}
    </Tag>
  );
};

export default DistrictBadge;
