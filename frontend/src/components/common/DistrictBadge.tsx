import React from "react";
import { Tag, Tooltip } from "antd";

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
 * Computes derived districtType and mismatch flag for an expense/claim.
 * Primary source of truth is the employee's submitted travel category (Outdoor vs In-District).
 */
export function computeDistrictInfo(
  submitterBaseDistrict?: string | null,
  legs: any[] = [],
  expDistrict?: string | null,
  expCategory?: string | null
): { districtType: "IN_DISTRICT" | "OUT_DISTRICT"; hasMismatch: boolean } {
  const base = normalizeDistrictName(submitterBaseDistrict);
  const catStr = (expCategory || "").toString().toLowerCase();
  const hasOutdoorCategory = catStr.includes("outdoor") || catStr.includes("out-district") || catStr.includes("out_district");

  let hasOutdoorLeg = false;
  let allLegsBaseDistrict = true;

  if (legs && Array.isArray(legs) && legs.length > 0) {
    for (const leg of legs) {
      const legType = (leg.travel_type || "").trim().toLowerCase();
      if (legType === "outdoor" || legType === "out of state" || legType === "out_of_state") {
        hasOutdoorLeg = true;
      }
      const fromDist = normalizeDistrictName(leg.district_from || leg.from_district || leg.fromDistrict);
      const toDist = normalizeDistrictName(leg.district || leg.to_district || leg.toDistrict);

      if ((fromDist && base && fromDist !== base) || (toDist && base && toDist !== base) || (fromDist && toDist && fromDist !== toDist)) {
        allLegsBaseDistrict = false;
      }
    }
  } else {
    const expDist = normalizeDistrictName(expDistrict);
    if (expDist && base && expDist !== base) {
      allLegsBaseDistrict = false;
    }
  }

  const isOutDistrict = hasOutdoorCategory || hasOutdoorLeg || !allLegsBaseDistrict;
  const districtType = isOutDistrict ? "OUT_DISTRICT" : "IN_DISTRICT";
  const hasMismatch = (hasOutdoorCategory || hasOutdoorLeg) && allLegsBaseDistrict;

  return { districtType, hasMismatch };
}

export function computeDistrictType(
  submitterBaseDistrict?: string | null,
  legs: any[] = [],
  expDistrict?: string | null,
  expCategory?: string | null
): "IN_DISTRICT" | "OUT_DISTRICT" {
  return computeDistrictInfo(submitterBaseDistrict, legs, expDistrict, expCategory).districtType;
}

export interface DistrictBadgeProps {
  districtType?: "IN_DISTRICT" | "OUT_DISTRICT" | string | null;
  hasMismatch?: boolean;
  baseDistrict?: string | null;
  legs?: any[];
  expDistrict?: string | null;
  expCategory?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

export const DistrictBadge: React.FC<DistrictBadgeProps> = ({
  districtType,
  hasMismatch,
  baseDistrict,
  legs,
  expDistrict,
  expCategory,
  className = "",
  style = {}
}) => {
  let resolvedType = districtType;
  let resolvedMismatch = hasMismatch;

  if (!resolvedType && (baseDistrict || (legs && legs.length > 0) || expDistrict || expCategory)) {
    const info = computeDistrictInfo(baseDistrict, legs, expDistrict, expCategory);
    resolvedType = info.districtType;
    if (resolvedMismatch === undefined) {
      resolvedMismatch = info.hasMismatch;
    }
  }

  const normalized = (resolvedType || "").trim().toUpperCase();
  const isOutState = normalized === "OUT_OF_STATE" || normalized === "OUT_STATE";
  const isOut = normalized === "OUT_DISTRICT" || normalized === "OUTDOOR" || normalized === "OUT_STATION";
  const label = isOutState ? "Out of State" : (isOut ? "Out-District" : "In-District");

  const badgeStyle: React.CSSProperties = isOutState
    ? {
        backgroundColor: "#F3E8FF",
        color: "#6B21A8",
        borderColor: "#E9D5FF",
        fontSize: "12px",
        fontWeight: 600,
        padding: "2px 10px",
        borderRadius: "9999px",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: "1.3",
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...style
      }
    : (isOut
    ? {
        backgroundColor: "#EFF6FF",
        color: "#1D4ED8",
        borderColor: "#DBEAFE",
        fontSize: "12px",
        fontWeight: 600,
        padding: "2px 10px",
        borderRadius: "9999px",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: "1.3",
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...style
      }
    : {
        backgroundColor: "#F8FAFC",
        color: "#475569",
        borderColor: "#E2E8F0",
        fontSize: "12px",
        fontWeight: 600,
        padding: "2px 10px",
        borderRadius: "9999px",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: "1.3",
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...style
      });

  return (
    <div className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <Tag className="district-badge" style={badgeStyle}>
        {label}
      </Tag>
      {resolvedMismatch && (
        <Tooltip title="Submitted as Out-District, but travel district matches base location. Admin review recommended.">
          <Tag color="warning" style={{ fontSize: "11px", fontWeight: 700, margin: 0, borderRadius: "6px" }}>
            ⚠️ Needs Review
          </Tag>
        </Tooltip>
      )}
    </div>
  );
};

export default DistrictBadge;
