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
  const base = (submitterBaseDistrict || "").trim().toLowerCase();

  if (legs && Array.isArray(legs) && legs.length > 0) {
    for (const leg of legs) {
      const fromDist = (leg.from_district || leg.fromDistrict || "").trim().toLowerCase();
      const toDist = (leg.to_district || leg.toDistrict || "").trim().toLowerCase();

      // If either leg district is explicitly set and doesn't match base district
      if (fromDist && base && fromDist !== base) return "OUT_DISTRICT";
      if (toDist && base && toDist !== base) return "OUT_DISTRICT";

      // If inter-district travel (from != to and both non-empty)
      if (fromDist && toDist && fromDist !== toDist) return "OUT_DISTRICT";
    }
    return "IN_DISTRICT";
  }

  // Fallback if no legs: check expense-level district
  const expDist = (expDistrict || "").trim().toLowerCase();
  if (expDist && base && expDist !== base) {
    return "OUT_DISTRICT";
  }

  return "IN_DISTRICT";
}
