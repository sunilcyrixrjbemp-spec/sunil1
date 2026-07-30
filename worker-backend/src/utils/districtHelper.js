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
 * Helper to compute derived districtType for an expense/claim.
 * Returns "IN_DISTRICT" or "OUT_DISTRICT".
 *
 * Rules:
 * 1. Compare submitter's assigned base district (from user profile) against
 *    itinerary legs' from_district & to_district, or overall expense district.
 * 2. If any leg has a district different from employee's assigned base district,
 *    or if from_district !== to_district (inter-district travel), return "OUT_DISTRICT".
 * 3. Otherwise return "IN_DISTRICT".
 */
export function computeDistrictType(submitterBaseDistrict, legs = [], expDistrict = null) {
  const base = normalizeDistrictName(submitterBaseDistrict);

  if (legs && Array.isArray(legs) && legs.length > 0) {
    for (const leg of legs) {
      const fromDist = normalizeDistrictName(leg.from_district || leg.fromDistrict || leg.district_from);
      const toDist = normalizeDistrictName(leg.to_district || leg.toDistrict || leg.district);

      // If either leg district is set and does NOT match base district
      if (fromDist && base && fromDist !== base) return "OUT_DISTRICT";
      if (toDist && base && toDist !== base) return "OUT_DISTRICT";

      // If inter-district travel (from != to and both non-empty and non-base)
      if (fromDist && toDist && fromDist !== base && toDist !== base && fromDist !== toDist) return "OUT_DISTRICT";
    }
    return "IN_DISTRICT";
  }

  // Fallback if no legs: check expense-level district
  const expDist = normalizeDistrictName(expDistrict);
  if (expDist && base && expDist !== base) {
    return "OUT_DISTRICT";
  }

  return "IN_DISTRICT";
}
