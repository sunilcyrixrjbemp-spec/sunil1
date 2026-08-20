const fs = require('fs');
const path = require('path');

function simplifyDeductionReasons(categoryTexts, comments) {
  const parts = [];

  // 1. Add the clean mathematical deduction breakdown if present
  if (categoryTexts && categoryTexts.length > 0) {
    parts.push(...categoryTexts);
  }

  // 2. Process and summarize comments
  const baseCommuteHospitals = new Set();
  let hasBaseCommuteTA = false;
  let hasBaseDA = false;
  let hasKmAdjustment = false;
  let hasWrongAmount = false;
  const otherCleanComments = new Set();

  for (const rawComment of (comments || [])) {
    if (!rawComment) continue;
    const c = rawComment.trim();
    const cLower = c.toLowerCase();

    // Ignore junk / boilerplate
    if (cLower === "na" || cLower === "n/a" || cLower === "nil" || cLower === "none" || cLower === "ok" || cLower === ".") continue;
    if (cLower.startsWith("[policyrestoration]")) continue;

    // Detect Base Location Commute TA
    if (cLower.includes("commute ta") || cLower.includes("base location commute")) {
      hasBaseCommuteTA = true;
      const match = c.match(/Base:\s*([^—–-]+)/i);
      if (match && match[1]) {
        const hosp = match[1].trim()
          .replace(/Hospital\s+/i, "Hosp ")
          .replace(/Medical College And Hospital/i, "MC")
          .replace(/Medical College/i, "MC");
        if (hosp.length < 35) baseCommuteHospitals.add(hosp);
      }
      continue;
    }

    // Detect Base Location DA
    if (cLower.includes("da not applicable at base") || cLower.includes("da not allowed at base") || cLower.includes("base location da")) {
      hasBaseDA = true;
      continue;
    }

    // Detect KM Adjustments (Actual Xkm, wrong km, shortest path, google map)
    if (
      cLower.startsWith("actual ") ||
      cLower.startsWith("actual km") ||
      cLower.includes("wrong km") ||
      cLower.includes("km update") ||
      cLower.includes("shortest path") ||
      cLower.includes("distance was incorrect") ||
      cLower === "km"
    ) {
      hasKmAdjustment = true;
      continue;
    }

    if (cLower.includes("wrong amount")) {
      hasWrongAmount = true;
      continue;
    }

    // Clean other custom manager comments
    let cleaned = c
      .replace(/\[Retroactive\]\s*/gi, "")
      .replace(/\[Policy\]\s*/gi, "")
      .replace(/\s*Applied:\s*\d{4}-\d{2}-\d{2}\.?/gi, "")
      .trim();

    if (cleaned.length > 0 && cleaned.length < 60) {
      otherCleanComments.add(cleaned);
    }
  }

  // Build concise summary tags
  const policyTags = [];
  if (hasBaseCommuteTA && hasBaseDA) {
    const hospStr = baseCommuteHospitals.size > 0 ? ` (${Array.from(baseCommuteHospitals)[0]})` : "";
    policyTags.push(`Base Commute TA & DA not eligible${hospStr}`);
  } else if (hasBaseCommuteTA) {
    const hospStr = baseCommuteHospitals.size > 0 ? ` (${Array.from(baseCommuteHospitals)[0]})` : "";
    policyTags.push(`Base Commute TA not eligible${hospStr}`);
  } else if (hasBaseDA) {
    policyTags.push("Base DA not eligible");
  }

  if (hasKmAdjustment && !categoryTexts.some(t => t.startsWith("KM:"))) {
    policyTags.push("Route KM adjusted");
  }
  if (hasWrongAmount) {
    policyTags.push("Amount adjusted");
  }

  for (const c of otherCleanComments) {
    // Only add if not redundant
    if (!policyTags.some(t => t.toLowerCase() === c.toLowerCase())) {
      policyTags.push(c);
    }
  }

  // Combine categoryTexts and policyTags
  const allFinalParts = [...parts, ...policyTags];

  // If empty, return ""
  if (allFinalParts.length === 0) return "";

  return allFinalParts.join("; ");
}

// Test with the user's exact example
const sampleCategoryTexts = ["KM: 59km (6 days: 6,9,10,13,18,21)"];
const sampleComments = [
  "[Retroactive] [Policy] Base: Mahatma Gandhi Hospital Jodhpur — Commute TA ₹86 not eligible. Applied: 2026-07-08.",
  "[Retroactive] Base Location commute TA not eligible",
  "Actual 18km",
  "Actual 12km",
  "[Retroactive] [Policy] Base: Mahatma Gandhi Hospital Jodhpur — Commute TA ₹108 not eligible; DA ₹200 not applicable at base location. Applied: 2026-07-09.",
  "[Retroactive] DA not applicable at base location",
  "[Retroactive] [Policy] Base: Mahatma Gandhi Hospital Jodhpur — Commute TA ₹171 not eligible; DA ₹200 not applicable at base location. Applied: 2026-07-04.",
  "Actual 11 km",
  "Actual km 11",
  "[Retroactive] [Policy] Base: Mahatma Gandhi Hospital Jodhpur — Commute TA ₹99 not eligible; DA ₹200 not applicable at base location. Applied: 2026-07-10.",
  "[Retroactive] [Policy] Base: Mahatma Gandhi Hospital Jodhpur — Commute TA ₹86 not eligible. Applied: 2026-07-11.",
  "[Retroactive] [Policy] Base: Mahatma Gandhi Hospital Jodhpur — Commute TA ₹216 not eligible; DA ₹200 not applicable at base location. Applied: 2026-07-12.",
  "Actual 20km"
];

console.log("=== BEFORE (User's Example) ===");
console.log(sampleCategoryTexts.concat(sampleComments).join("; "));

console.log("\n=== AFTER (Clean & Short) ===");
console.log(simplifyDeductionReasons(sampleCategoryTexts, sampleComments));
