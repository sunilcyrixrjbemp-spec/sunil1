/**
 * Normalizes a district string for case-insensitive, whitespace-trimmed,
 * and prefix/suffix tolerant comparison.
 */
export function normalizeDistrictName(dist) {
  if (!dist) return "";
  let clean = String(dist).trim().toLowerCase();
  clean = clean.replace(/^(sri|shri)\s+/i, "");
  clean = clean.replace(/\s+(district|distt|dist|zone)\b/i, "");
  clean = clean.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  return clean;
}

/**
 * Helper to compute derived districtType and mismatch flag for an expense/claim.
 * Primary source of truth is the employee's submitted travel category (Outdoor vs In-District).
 *
 * Rules:
 * 1. If any leg was submitted with travel_type === "Outdoor", or expCategory is Outdoor/Out-District,
 *    or any leg district differs from base location -> districtType = "OUT_DISTRICT".
 * 2. If employee submitted Outdoor/Out-District, BUT all leg districts entered match base location -> hasMismatch = true (Needs Review).
 */
export function computeDistrictInfo(submitterBaseDistrict, legs = [], expDistrict = null, expCategory = null) {
  const base = normalizeDistrictName(submitterBaseDistrict);

  const catStr = (expCategory || "").toString().toLowerCase();
  const hasOutdoorCategory = catStr.includes("outdoor") || catStr.includes("out-district") || catStr.includes("out_district");
  
  let hasOutdoorLeg = false;
  let allLegsBaseDistrict = true;

  if (legs && Array.isArray(legs) && legs.length > 0) {
    for (const leg of legs) {
      const legType = (leg.travel_type || "").trim().toLowerCase();
      if (legType === "outdoor") {
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

  return {
    districtType,
    hasMismatch
  };
}

export function computeDistrictType(submitterBaseDistrict, legs = [], expDistrict = null, expCategory = null) {
  return computeDistrictInfo(submitterBaseDistrict, legs, expDistrict, expCategory).districtType;
}
