import { runWrite, runBatchWrite, runRead } from "../utils/db.js";
import { getLegacyExpenseHashId } from "./approval.js";
import { resolveLegacyExpenseId } from "../utils/legacy-resolver.js";
import { uploadFileWithFallback, handleServeFile } from "./upload.js";
import { MONTH_NAMES } from "../utils/constants.js";
import { computeDistrictType, computeDistrictInfo } from "../utils/districtHelper.js";

// ─── FULL ACCESS ROLES ────────────────────────────────────────────────────────
// Roles that see ALL data (all users, all zones, all records) across every report.
// To add/remove full access for a role: edit ONLY this list — no other changes needed.
// NOTE: stored in lowercase for case-insensitive .includes() checks.
const FULL_ACCESS_ROLES = [
  "admin",
  "project head",
  "mis",
  "travel desk",
  "travel tesk",  // legacy typo variant kept for backward compat
  "vp",
  "accountant",
  "hr",
];
// Helper: returns true if the given role string (any case) has full data access.
function hasFullAccess(roleString) {
  return FULL_ACCESS_ROLES.includes((roleString || "").trim().toLowerCase());
}

function parseClientTimestamp(raw) {
  if (!raw) return new Date().toISOString();
  let str = String(raw).trim();
  
  if (str.endsWith("Z") || str.includes("+") || /T\d{2}:\d{2}:\d{2}.*-/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  if (str.includes(" ") && !str.includes("T")) {
    str = str.replace(" ", "T") + "+05:30";
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  return new Date().toISOString();
}
// ─────────────────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export function getActualZone(zone, district) {
  const knownZones = ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Udaipur"];
  const zoneMapping = {
    "Ajmer":   ["ajmer", "beawer", "bhilwara", "nagaur", "tonk"],
    "Bikaner": ["bikaner", "churu", "ganganar", "ganganagar", "hanumangarh"],
    "Jaipur":  ["jaipur"],
    "Jodhpur": ["barmer", "balotra", "jaisalmer", "jalore", "jodhpur", "pali", "phalodi", "sirohi"],
    "Udaipur": ["banswara", "chittorgarh", "dungarpur", "rajsamand", "pratapgarh", "udaipur"]
  };
  // PRIORITY 1: Use user zone field from DB directly (strip trailing "Zone" word if any)
  const zoneRaw = (zone || "").trim();
  const zoneStripped = zoneRaw.replace(/\s*zone\s*$/i, "").trim();
  for (const zName of knownZones) {
    if (zName.toLowerCase() === zoneStripped.toLowerCase()) return zName;
  }
  // PRIORITY 2: Infer from district field
  const dClean = (district || "").trim().replace(/\s*zone\s*$/i, "").toLowerCase();
  for (const [zName, districts] of Object.entries(zoneMapping)) {
    if (districts.includes(dClean)) return zName;
  }
  // PRIORITY 3: Return raw zone value (never default to Bikaner)
  return zoneStripped || "";
}

async function queryInChunks(db, queryTemplate, ids, chunkSize = 50) {
  if (!ids || ids.length === 0) return [];
  const promises = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const sql = queryTemplate.replace("?", placeholders);
    promises.push(db.prepare(sql).bind(...chunk).all());
  }
  const responses = await Promise.all(promises);
  let allResults = [];
  for (const res of responses) {
    if (res.results) {
      allResults = allResults.concat(res.results);
    }
  }
  return allResults;
}

// ─── Base Location Policy Shared Utilities ──────────────────────────────────
// Keywords used across all policy checks
const MARKET_WORDS = ["market", "bazaar", "bazar", "mandi", "haat"];
const STATION_WORDS = [
  "station", "railway", "rly", "bus stand", "busstand", "bus-stand",
  "bus stop", "busstop", "bus-stop", "bus depot", "busdepot", "bus adda",
  "busadda", "bus-adda", "stand", "depot"
];
const DA_ALLOWED_BASES = ["pbm", "mathura das mathur", "mdm"];
const RESIDENCE_SKIP_WORDS = [...MARKET_WORDS, ...STATION_WORDS];

export function isStationLocation(locText) {
  if (!locText) return false;
  const clean = locText.trim().toLowerCase();
  const normalized = clean.replace(/[-_]/g, " ");
  return STATION_WORDS.some(w => clean.includes(w) || normalized.includes(w));
}

function normalizeLoc(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/[,._-]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parses base_reporting_location string safely from database.
 */
export function parseBaseLocations(baseReportingLocation) {
  if (!baseReportingLocation) return [];
  const raw = String(baseReportingLocation).trim();
  if (!raw) return [];

  // The primary base location is the normalized full string
  const fullNorm = normalizeLoc(raw);
  const bases = [fullNorm];

  // Only split if multiple distinct locations are separated by semicolon, pipe, or newlines
  if (raw.includes(";") || raw.includes("|") || raw.includes("\n")) {
    const parts = raw.split(/[;|\n]/).map(x => normalizeLoc(x)).filter(Boolean);
    for (const p of parts) {
      if (p && !bases.includes(p)) bases.push(p);
    }
  }

  return bases;
}

/**
 * Checks if a typed location matches the employee's mapped base location from DB.
 * Strictly uses the employee's mapped DB base location string.
 */
export function matchesBase(locText, baseLocations) {
  const normText = normalizeLoc(locText);
  if (!normText) return false;

  const bases = Array.isArray(baseLocations) ? baseLocations : parseBaseLocations(baseLocations);

  return bases.some(base => {
    const normBase = normalizeLoc(base);
    if (!normBase) return false;

    // 1. Exact match
    if (normText === normBase) return true;

    // 2. Substring match on normalized strings
    if (normText.includes(normBase) || normBase.includes(normText)) return true;

    // 3. Known specific hospital abbreviation logic
    if (normBase.includes("mathura das mathur") || normBase.includes("mdm")) {
      if (normText.includes("mdm") || normText.includes("mathura das")) return true;
      if (normText === "jodhpur" || normText === "jodhpur base" || normText === "mdm hospital") return true;
    }
    if (normBase.includes("pbm") || normBase.includes("bikaner")) {
      if (normText.includes("pbm")) return true;
      if (normText === "bikaner" || normText === "bikaner base" || normText === "pbm hospital") return true;
    }
    if (normBase.includes("jln") || normBase.includes("ajmer")) {
      if (normText.includes("jln")) return true;
      if (normText === "ajmer" || normText === "ajmer base" || normText === "jln hospital") return true;
    }
    return false;
  });
}

/**
 * Determines whether a day's itinerary qualifies as base-location-only travel.
 * Returns { isBaseLocOnly, isDaAllowed, baseLocations }
 */
export function computeBaseLocPolicy(baseReportingLocation, itineraries) {
  const baseLocations = parseBaseLocations(baseReportingLocation);

  if (baseLocations.length === 0) return { isBaseLocOnly: false, isDaAllowed: true, baseLocations: [] };

  // EXCLUSION: If any leg in the day has travel_type === "Outdoor", policy is completely disabled
  const hasOutdoorLeg = itineraries.some(leg => (leg.travel_type || "").trim().toLowerCase() === "outdoor");
  if (hasOutdoorLeg) {
    return { isBaseLocOnly: false, isDaAllowed: true, baseLocations };
  }

  // Must have visited at least one base location (dropdown or manual match)
  const hasVisitedBase = itineraries.some(leg =>
    matchesBase(leg.from, baseLocations) ||
    matchesBase(leg.to, baseLocations)
  );

  // Healthcare facility keywords matched at word boundaries to avoid matching substrings like "gandhi" (dh)
  const HEALTHCARE_FACILITY_REGEX = /\b(chc|uchc|phc|sdh|dh|hospital|hosp|college|collage|dispensary|subcenter|sub-center|sub center|ddw|warehouse|uphc|up-hc|up hc)\b/i;

  // List of Rajasthan Districts for Out-Station travel validation
  const RAJASTHAN_DISTRICTS = [
    "ajmer", "alwar", "banswara", "baran", "barmer", "bharatpur", "bhilwara", "bikaner",
    "bundi", "chittorgarh", "churu", "dausa", "dholpur", "dungarpur", "ganganagar", "sri ganganagar",
    "hanumangarh", "jaipur", "jaisalmer", "jalore", "jhalawar", "jhunjhunu", "jodhpur", "karauli",
    "kota", "nagaur", "pali", "pratapgarh", "rajsamand", "sawai madhopur", "sikar",
    "sirohi", "tonk", "udaipur", "anupgarh", "balotra", "beawar", "deeg", "didwana", "kuchaman",
    "dudu", "gangapur", "jaipur rural", "jodhpur rural", "kekri", "kotputli", "behror",
    "khairthal", "tijara", "neem ka thana", "phalodi", "salumbar", "sanchore", "shahpura"
  ];

  const isOfficialNonBaseFacility = (locText, leg) => {
    if (!locText) return false;
    const clean = locText.trim().toLowerCase();
    const normalized = clean.replace(/[-_]/g, " ");

    // If it matches base location → it is base, NOT a non-base facility
    if (matchesBase(clean, baseLocations)) return false;

    // 1. Must match an official healthcare facility keyword at word boundaries
    if (HEALTHCARE_FACILITY_REGEX.test(clean) || HEALTHCARE_FACILITY_REGEX.test(normalized)) {
      return true;
    }

    // 2. Activity = "Other": ONLY allow DA if location contains a non-base Rajasthan district name OR bus/train ticket is present
    if (leg) {
      const act = (leg.activity || leg.activity_type || "").trim().toLowerCase();
      const isOther = act.includes("other");
      const mode = (leg.mode || "").trim().toLowerCase();
      const subMode = (leg.sub_mode || "").trim().toLowerCase();
      const isBusOrTrain = mode.includes("bus") || mode.includes("train") || subMode.includes("bus") || subMode.includes("train");
      const hasTicketOrFare = parseFloat(leg.train_bus_amount || leg.sub_amount || leg.hotel || "0") > 0;

      const fromText = (leg.from || "").trim().toLowerCase();
      const toText = (leg.to || "").trim().toLowerCase();

      const hasNonBaseRajasthanDistrict = RAJASTHAN_DISTRICTS.some(dist =>
        (fromText.includes(dist) || toText.includes(dist)) && !matchesBase(dist, baseLocations)
      );

      // STRICT RULE: If Activity is "Other", ONLY allow DA if Rajasthan District name is written OR Bus/Train ticket is attached. Otherwise DENY DA.
      if (isOther) {
        return hasNonBaseRajasthanDistrict || isBusOrTrain || hasTicketOrFare;
      }

      // Non-"Other" legs with Bus/Train ticket
      if ((isBusOrTrain || hasTicketOrFare) && hasNonBaseRajasthanDistrict) {
        return true;
      }
    }

    return false;
  };

  const visitedNonBase = itineraries.some(leg => {
    const f = leg.from || "";
    const t = leg.to || "";
    return isOfficialNonBaseFacility(f, leg) || isOfficialNonBaseFacility(t, leg);
  });

  if (visitedNonBase) return { isBaseLocOnly: false, isDaAllowed: true, baseLocations };

  const hasStation = itineraries.some(leg => {
    const f = leg.from || "";
    const t = leg.to || "";
    return isStationLocation(f) || isStationLocation(t);
  });

  const isDaBase = baseLocations.some(loc => DA_ALLOWED_BASES.some(b => loc.includes(b)));

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔒 LOCKED POLICY LOGIC — DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL 🔒
  // TA/DA Base Location policy — confirmed & finalized business rule (backend
  // mirrors frontend isDailyAllowanceAllowed() in ExpensePage.tsx). AI
  // assistants / developers: do NOT alter this rule's behavior, refactor it,
  // "optimize" it, or change its conditions for ANY reason unless the user
  // EXPLICITLY asks to change THIS specific rule. If unsure, STOP and ask first.
  //
  //   1. Home → Base (direct) or Base → Home (direct), nothing else that day
  //        → TA NOT allowed on that leg (see checkIsCommuteLeg — always
  //          denies boundary residence↔base legs, no exceptions).
  //   2. Home → Base → [market/bus-stand/courier/repairing/pickup errands]
  //      → Base → Home
  //        → TA allowed ONLY on the errand legs in between. Boundary legs
  //          (Home→Base, Base→Home) still NEVER get TA.
  //        → DA NOT allowed — no real "other facility" was visited — EXCEPT
  //          for PBM (Bikaner) / MDM (Jodhpur) base locations, which ALWAYS
  //          get DA in this scenario regardless of market/courier/repairing/
  //          pickup errands (isDaBase does not depend on hasMarket).
  //        → Exception to the exception: if the errand involves a
  //          station/bus-stand (hasStation), DA is NOT allowed even for
  //          PBM/MDM — station/bus-stand travel is treated differently.
  //   3. Home → Other facility → Home (base never touched that day)
  //        → TA/DA fully allowed on all legs.
  //   4. Home → Base → Other facility → Home
  //        → TA NOT allowed only on the Home→Base leg; everything else
  //          (TA and DA) is allowed.
  //   5. Home → Other facility → Base → Home
  //        → TA NOT allowed only on the Base→Home leg; everything else
  //          (TA and DA) is allowed.
  //
  //   NOTE: An older "official activities" override (Calls/PMS/Asset Tagging/
  //   Calibration present on a leg → auto-allow DA at base location) used to
  //   sit BEFORE this block and silently bypass all 5 rules above. It was
  //   explicitly removed on user instruction because it defeated the whole
  //   point of this policy. Do NOT re-add an activity-based DA override here.
  // ═══════════════════════════════════════════════════════════════════════════
  let isDaAllowed = false;
  if (hasStation) {
    // Already verified hasOutdoorLeg is false (otherwise we would have returned early)
    isDaAllowed = false;
  } else if (isDaBase) {
    isDaAllowed = true;
  }

  // ── Determine exact Policy Case (1 to 5) ───────────────────────────────────
  let policyCase = 2;
  let policyRuleName = "Case 2: Base Location Duty";

  if (!hasVisitedBase) {
    policyCase = 3;
    policyRuleName = "Case 3: Direct Outstation / Other Facility Duty (Base untouched)";
  } else if (visitedNonBase) {
    let firstBaseIdx = -1;
    let firstNonBaseIdx = -1;
    for (let i = 0; i < itineraries.length; i++) {
      const leg = itineraries[i];
      const f = leg.from || "";
      const t = leg.to || "";
      if (firstBaseIdx === -1 && (matchesBase(f, baseLocations) || matchesBase(t, baseLocations))) {
        firstBaseIdx = i;
      }
      if (firstNonBaseIdx === -1 && (isOfficialNonBaseFacility(f, leg) || isOfficialNonBaseFacility(t, leg))) {
        firstNonBaseIdx = i;
      }
    }
    if (firstBaseIdx <= firstNonBaseIdx) {
      policyCase = 4;
      policyRuleName = "Case 4: Home → Base → Other Facility → Home";
    } else {
      policyCase = 5;
      policyRuleName = "Case 5: Home → Other Facility → Base → Home";
    }
  } else {
    const allCommute = itineraries.length > 0 && itineraries.every((leg, idx) => checkIsCommuteLeg(leg, baseLocations, idx, itineraries.length));
    if (allCommute) {
      policyCase = 1;
      policyRuleName = "Case 1: Home ↔ Base Location Commute Only";
    } else {
      policyCase = 2;
      policyRuleName = "Case 2: Home → Base → Local Errands → Home";
    }
  }

  return { isBaseLocOnly: true, isDaAllowed, baseLocations, policyCase, policyRuleName };
}

/**
 * Returns true if a leg is a commute leg (residence ↔ base location).
 */
export function checkIsCommuteLeg(leg, baseLocations, index, totalLegs) {
  const f = (leg.from || "").trim().toLowerCase();
  const t = (leg.to || "").trim().toLowerCase();

  const RESIDENCE_WORDS = ["home", "residence", "room", "quarter", "house", "flat", "pg", "stay", "village", "vill", "rent", "address", "dera", "deri", "hotel"];
  const WORK_WORDS = ["market", "bazaar", "bazar", "mandi", "haat", "station", "railway", "bus stand", "bus stop", "bus depot", "bus adda", "rly", "tower", "office", "repair", "collection", "hospital", "chc", "phc", "dh", "sdh", "clinic", "lab", "store", "shop", "vendor", "customer", "site", "service", "work"];

  const fromHasResidenceWord = RESIDENCE_WORDS.some(w => f.includes(w));
  const toHasResidenceWord   = RESIDENCE_WORDS.some(w => t.includes(w));
  const fromHasWorkWord      = WORK_WORDS.some(w => f.includes(w));
  const toHasWorkWord        = WORK_WORDS.some(w => t.includes(w));

  const isFirstLeg = index === 0;
  const isLastLeg  = (totalLegs !== undefined && index !== undefined) ? (index === totalLegs - 1) : false;

  const fromIsResidence = (fromHasResidenceWord && !fromHasWorkWord)
    || (!!leg.from_custom && !fromHasWorkWord && (fromHasResidenceWord || (isFirstLeg && !fromHasWorkWord)))
    || (isFirstLeg && !fromHasWorkWord && !matchesBase(f, baseLocations) && f.length > 0);
  const toIsResidence = (toHasResidenceWord && !toHasWorkWord)
    || (!!leg.to_custom && !toHasWorkWord && (toHasResidenceWord || (isLastLeg && !toHasWorkWord)))
    || (isLastLeg && !toHasWorkWord && !matchesBase(t, baseLocations) && t.length > 0);

  const fromIsBase = matchesBase(f, baseLocations);
  const toIsBase   = matchesBase(t, baseLocations);

  if (fromIsResidence && fromIsBase) return false;
  if (toIsResidence   && toIsBase)   return false;
  if (fromIsResidence && toIsBase)   return true;  // Home → Base
  if (fromIsBase      && toIsResidence) return true;  // Base → Home
  if (fromIsBase      && toIsBase)   return true;  // Base → Base (e.g. JLN Medical College → JLN Hospital)
  return false;
}

/**
 * Builds a human-readable system policy comment for deduction_reason.
 */
export function buildPolicyComment(baseLocations, itineraries, isDaAllowed, date, policyCase = null, policyRuleName = null) {
  const baseLabel = baseLocations.map(b => b.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")).join(", ");
  const commutedLegs = itineraries.filter((leg, idx) => checkIsCommuteLeg(leg, baseLocations, idx, itineraries.length));
  const taDeducted = commutedLegs.reduce((s, leg) => s + parseFloat(leg.amount || "0") + parseFloat(leg.sub_amount || "0"), 0);
  const daDeducted = !isDaAllowed ? itineraries.reduce((s, leg) => s + parseFloat(leg.da || "0"), 0) : 0;

  const parts = [];
  if (taDeducted > 0) parts.push(`Commute TA ₹${taDeducted.toFixed(0)} not eligible`);
  if (daDeducted > 0) parts.push(`DA ₹${daDeducted.toFixed(0)} not applicable at base location`);
  if (parts.length === 0) return "";

  const casePrefix = policyCase ? `[Case ${policyCase}${policyRuleName ? `: ${policyRuleName}` : ''}] ` : "";
  return `[Policy] ${casePrefix}Base: ${baseLabel} — ${parts.join("; ")}. Applied: ${date}.`;
}

let memoryAssetCostsMap = null;
let memoryAssetCostsExpiry = 0;

export async function getAssetCostsMap(env) {
  const now = Date.now();
  if (memoryAssetCostsMap && now < memoryAssetCostsExpiry) {
    return memoryAssetCostsMap;
  }

  const assetCosts = {};
  // 1. Primary: asset_value_master
  try {
    const res1 = await env.DB.prepare(`
      SELECT equipment_name, 
             rmsc_tender_cost,
             asset_value
      FROM asset_value_master
    `).all();
    for (const r of (res1.results || [])) {
      if (r.equipment_name) {
        const rawVal = r.rmsc_tender_cost || r.asset_value || 0;
        const parsed = parseFloat(String(rawVal).replace(/,/g, '').replace(/₹/g, '').trim()) || 0;
        if (parsed > 0) {
          assetCosts[r.equipment_name.trim().toLowerCase()] = parsed;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to load asset_value_master:", e.message);
  }

  // 2. Fallback: assets_inventory
  try {
    const res2 = await env.DB.prepare(`
      SELECT equipment_name, 
             parsed_asset_value,
             asset_value
      FROM assets_inventory 
      WHERE (parsed_asset_value IS NOT NULL AND parsed_asset_value > 0) 
         OR (asset_value IS NOT NULL AND asset_value != '' AND asset_value != '0')
    `).all();
    for (const r of (res2.results || [])) {
      if (r.equipment_name) {
        const k = r.equipment_name.trim().toLowerCase();
        if (!assetCosts[k]) {
          const rawVal = r.parsed_asset_value || r.asset_value || 0;
          const parsed = parseFloat(String(rawVal).replace(/,/g, '').replace(/₹/g, '').trim()) || 0;
          if (parsed > 0) {
            assetCosts[k] = parsed;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to load assets_inventory fallback:", e.message);
  memoryAssetCostsMap = assetCosts;
  memoryAssetCostsExpiry = Date.now() + 3600000; // 1 hour TTL in Worker isolate memory
  return assetCosts;
}

export function getEquipmentUnitCost(eqName, assetCosts) {
  if (!eqName || !assetCosts) return 0.0;
  const clean = eqName.trim().toLowerCase();
  if (assetCosts[clean]) return assetCosts[clean];

  // Substring match fallback
  for (const [k, v] of Object.entries(assetCosts)) {
    if (k.includes(clean) || clean.includes(k)) {
      return v;
    }
  }
  return 0.0;
}

export async function serializeExpenses(env, expenses, submittersMap) {
  if (!expenses || expenses.length === 0) return [];

  const expenseCodes = expenses.map(e => e.expense_code).filter(Boolean);
  
  // Batch fetch itineraries for all these expenses
  let allLegs = [];
  if (expenseCodes.length > 0) {
    allLegs = await queryInChunks(env.DB, "SELECT * FROM expense_itineraries WHERE exp_id IN (?)", expenseCodes);
  }

  // Group legs by exp_id and collect itinerary_ids
  const legsByCode = {};
  const itiIds = [];
  for (const l of allLegs) {
    if (!legsByCode[l.exp_id]) legsByCode[l.exp_id] = [];
    legsByCode[l.exp_id].push(l);
    if (l.itinerary_id) itiIds.push(l.itinerary_id);
  }

  // Batch fetch taggings for all legs and load asset costs dictionary
  let allTaggings = [];
  if (itiIds.length > 0) {
    try {
      allTaggings = await queryInChunks(env.DB, "SELECT itinerary_id, equipment_name, quantity FROM expense_asset_taggings WHERE itinerary_id IN (?)", itiIds);
    } catch (e) {
      console.warn("Failed to fetch asset taggings in serializeExpenses:", e.message);
    }
  }

  const taggingsMap = {};
  for (const t of allTaggings) {
    if (!taggingsMap[t.itinerary_id]) taggingsMap[t.itinerary_id] = [];
    taggingsMap[t.itinerary_id].push(t);
  }

  const assetCosts = await getAssetCostsMap(env);

  const result = [];
  for (const exp of expenses) {
    const submitter = submittersMap[exp.user_id] || null;
    const legs = legsByCode[exp.expense_code] || [];

    const totCallsAssigned = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.calls_assigned) || 0), 0)
      : (parseInt(exp.calls_assigned) || 0);

    const totCallsCompleted = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.calls_completed) || 0), 0)
      : (parseInt(exp.calls_completed) || 0);

    const totPmsCount = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.pms_count) || 0), 0)
      : (parseInt(exp.pms_count) || 0);

    const totAssetTagging = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.asset_tagging) || 0), 0)
      : (parseInt(exp.asset_tagging) || 0);

    const totAssetTaggingVal = legs.length > 0
      ? legs.reduce((sum, l) => {
          const taggings = taggingsMap[l.itinerary_id] || [];
          let legVal = 0;
          for (const t of taggings) {
            const qty = parseInt(t.quantity || 0, 10) || 0;
            const cost = getEquipmentUnitCost(t.equipment_name, assetCosts);
            legVal += qty * cost;
          }
          return sum + legVal;
        }, 0.0)
      : 0.0;

    const totCalibrationCount = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.calibration_count) || 0), 0)
      : (parseInt(exp.calibration_count) || 0);

    const totMobiliseCount = legs.length > 0
      ? legs.reduce((sum, l) => sum + (parseInt(l.mobilise_count) || 0), 0)
      : (parseInt(exp.mobilise_count) || 0);

    const totKm = legs
      .filter(l => ["bike", "car"].includes((l.travel_mode || "").trim().toLowerCase()))
      .reduce((sum, l) => sum + (parseFloat(l.distance_km) || 0.0), 0.0);

    const tagDetails = [];
    for (const l of legs) {
      const taggings = taggingsMap[l.itinerary_id] || [];
      for (const t of taggings) {
        const qty = parseInt(t.quantity || 0, 10) || 0;
        const cost = getEquipmentUnitCost(t.equipment_name, assetCosts);
        const val = qty * cost;
        tagDetails.push({
          equipment_name: t.equipment_name,
          quantity: qty,
          unit_cost: cost,
          total_val: val,
          itinerary_date: l.date || l.itinerary_date || exp.itinerary || exp.date || ""
        });
      }
    }

    const totAuto = legs
      .filter(l => (l.travel_mode || "").trim().toLowerCase() === "auto")
      .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0) +
      legs
      .filter(l => (l.sub_mode || "").trim().toLowerCase() === "auto")
      .reduce((sum, l) => sum + (parseFloat(l.sub_amount) || 0.0), 0.0);

    const bikeAmount = legs
      .filter(l => (l.travel_mode || "").trim().toLowerCase() === "bike")
      .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0);

    const carAmount = legs
      .filter(l => (l.travel_mode || "").trim().toLowerCase() === "car")
      .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0);

    const distInfo = computeDistrictInfo(submitter?.district, legs, exp.district, exp.category || exp.travel_mode);
    const districtType = exp.district_type || distInfo.districtType;
    const hasMismatch = (districtType === "OUT_DISTRICT") && distInfo.allLegsBaseDistrict;

    result.push({
      id: exp.id,
      expense_code: exp.expense_code,
      user_id: exp.user_id,
      districtType,
      hasMismatch,
      month: exp.month,
      year: exp.year,
      amount: parseFloat(exp.amount || 0),
      status: exp.status,
      travel_mode: exp.travel_mode,
      itinerary: exp.itinerary,
      description: exp.description || "",
      attachments: exp.attachments || "",
      da_amount: parseFloat(exp.da_amount || 0.0),
      hotel_amount: parseFloat(exp.hotel_amount || 0.0),
      other_expense_amount: parseFloat(exp.other_expense_amount || 0.0),
      local_purchase_amount: parseFloat(exp.local_purchase_amount || 0.0),
      calls_assigned: totCallsAssigned,
      calls_completed: totCallsCompleted,
      pms_count: totPmsCount,
      asset_tagging: totAssetTagging,
      asset_tagging_value: totAssetTaggingVal,
      tagging_details: tagDetails,
      calibration_count: totCalibrationCount,
      mobilise_count: totMobiliseCount,
      created_at: exp.created_at,
      updated_at: exp.updated_at,
      total_km: totKm,
      total_auto: totAuto,
      bike_amount: bikeAmount,
      car_amount: carAmount,
      auto_amount: totAuto,
      district: submitter?.district || "Ganganar",
      zone: getActualZone(submitter?.zone, submitter?.district) || submitter?.zone || "",
      coordinator: submitter?.coordinator || submitter?.zonal_manager || "",
      submitter_name: submitter?.name || "",
      submitter_code: submitter?.user_id || exp.user_id || "",
      category: exp.category || exp.travel_mode || "Travel",
      date: exp.date || exp.itinerary || "",
      purpose: exp.purpose || exp.description || "",
      itineraries: legs.map(l => ({
        leg: l.leg_number,
        from_district: l.from_district,
        to_district: l.to_district,
        from_state: l.from_state || l.state || "Rajasthan",
        to_state: l.to_state || l.dest_state || "Rajasthan",
        state: l.state || l.from_state || "Rajasthan",
        dest_state: l.dest_state || l.to_state || "Rajasthan",
        from: l.from_location || "",
        to: l.to_location || "",
        mode: l.travel_mode,
        km: parseFloat(l.distance_km || 0),
        amount: parseFloat(l.travel_amount || 0),
        sub_mode: l.sub_mode,
        sub_amount: parseFloat(l.sub_amount || 0),
        da: parseFloat(l.da_amount || 0),
        hotel: parseFloat(l.hotel_amount || 0),
        local_purchase: parseFloat(l.local_purchase || 0),
        oth_desc: l.other_desc || "",
        oth_amount: parseFloat(l.other_amount || 0),
        visit_purpose: l.visit_purpose || "",
        activity_details: l.activity_details || ""
      })),
      legs: legs.map(l => ({
        leg: l.leg_number,
        from_district: l.from_district,
        to_district: l.to_district,
        from_state: l.from_state || l.state || "Rajasthan",
        to_state: l.to_state || l.dest_state || "Rajasthan",
        state: l.state || l.from_state || "Rajasthan",
        dest_state: l.dest_state || l.to_state || "Rajasthan",
        from: l.from_location || "",
        to: l.to_location || "",
        mode: l.travel_mode,
        km: parseFloat(l.distance_km || 0),
        amount: parseFloat(l.travel_amount || 0),
        sub_mode: l.sub_mode,
        sub_amount: parseFloat(l.sub_amount || 0),
        da: parseFloat(l.da_amount || 0),
        hotel: parseFloat(l.hotel_amount || 0),
        local_purchase: parseFloat(l.local_purchase || 0),
        other_desc: l.other_desc || "",
        other_amount: parseFloat(l.other_amount || 0),
        visit_purpose: l.visit_purpose || "",
        activity_details: l.activity_details || ""
      }))
    });
  }

  return result;
}

/**
 * GET /api/expense/
 */
export async function handleListExpenses(request, env, params, query, user) {
  const month = query.get("month");

  let querySql = "SELECT * FROM expenses WHERE user_id = ?";
  const binds = [user.id];

  if (month && month.toLowerCase() !== "all" && month.toLowerCase() !== "all_time") {
    if (month.includes("-") && month.length === 7) {
      const parts = month.split("-");
      const yr = parseInt(parts[0], 10);
      const monNum = parseInt(parts[1], 10);
      const monName = MONTH_NAMES[monNum - 1];

      querySql += " AND year = ? AND month = ?";
      binds.push(yr, monName);
    } else {
      querySql += " AND LOWER(month) LIKE ?";
      binds.push(`%${month.toLowerCase()}%`);
    }
  }

  querySql += " ORDER BY created_at DESC";

  const expensesRows = await env.DB.prepare(querySql).bind(...binds).all();
  const submittersMap = { [user.id]: user };
  const serialized = await serializeExpenses(env, expensesRows.results || [], submittersMap);
  return jsonResponse(serialized);
}

/**
 * GET /api/expense/init
 */
export async function getExpenseInitData(env, targetUser, monthStr) {
  const parts = monthStr.split("-");
  const yearVal = parseInt(parts[0], 10);
  const monthInt = parseInt(parts[1], 10);
  const monthName = MONTH_NAMES[monthInt - 1];

  const gradeToLookup = (targetUser.designation || "").toLowerCase().includes("specialist") ? "O1" : targetUser.grade;

  // ── KV Cache Lookup for Facilities ────────────────────────────────────────
  const FACILITIES_KV_KEY = "cache:ref:facilities_dict:v1";
  let cachedFacilities = null;

  if (env.OTPS_KV) {
    try {
      cachedFacilities = await env.OTPS_KV.get(FACILITIES_KV_KEY, "json");
    } catch (_) {}
  }

  const facilitiesPromise = cachedFacilities
    ? Promise.resolve(null)
    : env.DB.prepare(`SELECT DISTINCT district_name, facility_name FROM facility_details`).all();

  // Run all independent DB queries in PARALLEL — reduces round trips to 1
  const [
    facilitiesRows,
    submittedRows,
    limits,
    limitReqs,
    allowance,
    gradeBikeRate,
    gradeCarRate,
    defaultBike,
    defaultCar,
    statsRes,
    settingsRows
  ] = await Promise.all([
    facilitiesPromise,
    env.DB.prepare(`SELECT itinerary FROM expenses WHERE user_id = ? AND month = ? AND year = ?`
    ).bind(targetUser.id, monthName, yearVal).all(),
    env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN request_type = 'KM' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_km,
        SUM(CASE WHEN request_type = 'AUTO' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_auto
      FROM limit_approval_requests
      WHERE user_id = ? AND LOWER(status) = 'approved' AND for_month = ?
    `).bind(targetUser.user_id, monthStr).first(),
    env.DB.prepare(`SELECT * FROM limit_approval_requests WHERE user_id = ? AND for_month = ?`
    ).bind(targetUser.user_id, monthStr).all(),
    env.DB.prepare(`SELECT * FROM allowance_master WHERE grade = ?`).bind(gradeToLookup).first(),
    // Grade-specific Bike rate (most accurate)
    env.DB.prepare(`SELECT rate_per_km FROM allowance_master WHERE grade = ? AND LOWER(TRIM(vehicle_type)) = 'bike' LIMIT 1`).bind(gradeToLookup).first(),
    // Grade-specific Car rate (most accurate)
    env.DB.prepare(`SELECT rate_per_km FROM allowance_master WHERE grade = ? AND LOWER(TRIM(vehicle_type)) = 'car' LIMIT 1`).bind(gradeToLookup).first(),
    // Fallback: any-grade Bike rate
    env.DB.prepare(`SELECT rate_per_km FROM allowance_master WHERE LOWER(TRIM(vehicle_type)) = 'bike' LIMIT 1`).first(),
    // Fallback: any-grade Car rate
    env.DB.prepare(`SELECT rate_per_km FROM allowance_master WHERE LOWER(TRIM(vehicle_type)) = 'car' LIMIT 1`).first(),
    env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) IN ('bike', 'car') THEN COALESCE(i.distance_km, 0.0) ELSE 0.0 END) as total_km,
        SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) = 'auto' THEN COALESCE(i.travel_amount, 0.0) ELSE 0.0 END) +
        SUM(CASE WHEN LOWER(TRIM(i.sub_mode)) = 'auto' THEN COALESCE(i.sub_amount, 0.0) ELSE 0.0 END) as total_auto
      FROM expense_itineraries i
      JOIN expenses e ON i.exp_id = e.expense_code
      WHERE e.user_id = ? AND e.month = ? AND e.year = ? AND e.status NOT IN ('rejected', 'returned_to_draft')
    `).bind(targetUser.id, monthName, yearVal).first(),
    env.DB.prepare(`SELECT key, value FROM system_settings WHERE key IN ('max_past_days_limit', 'monthly_cutoff_day')`).all()
  ]);

  // Build facilities map (or use cached dictionary)
  let facilities = cachedFacilities;
  if (!facilities) {
    facilities = {};
    for (const f of (facilitiesRows?.results || [])) {
      if (!facilities[f.district_name]) facilities[f.district_name] = [];
      facilities[f.district_name].push(f.facility_name);
    }
    if (env.OTPS_KV) {
      env.OTPS_KV.put(FACILITIES_KV_KEY, JSON.stringify(facilities), { expirationTtl: 86400 }).catch(() => {});
    }
  }

  const sysSettingsMap = {};
  for (const s of (settingsRows.results || [])) {
    sysSettingsMap[s.key] = s.value;
  }

  const submittedDates = (submittedRows.results || []).map(r => r.itinerary).filter(Boolean);

  const approvedKm = limits?.approved_km || 0.0;
  const approvedAuto = limits?.approved_auto || 0.0;

  const kmReqs = (limitReqs.results || []).filter(r => r.request_type === "KM").sort((a, b) => b.id - a.id);
  const autoReqs = (limitReqs.results || []).filter(r => r.request_type === "AUTO").sort((a, b) => b.id - a.id);
  const existingKmReq = kmReqs.length > 0 ? { status: kmReqs[0].status, requested_value: kmReqs[0].requested_value } : null;
  const existingAutoReq = autoReqs.length > 0 ? { status: autoReqs[0].status, requested_value: autoReqs[0].requested_value } : null;

  // BUG2A FIX: Use grade-specific rates first; fallback to any-grade only if missing
  const resolvedBikeRate = gradeBikeRate?.rate_per_km ?? defaultBike?.rate_per_km ?? 4.5;
  const resolvedCarRate  = gradeCarRate?.rate_per_km  ?? defaultCar?.rate_per_km  ?? 9.0;

  const allowanceDict = {
    policy_missing: !allowance,
    daily_in_district: allowance ? allowance.daily_in_district : null,
    daily_out_district: allowance ? allowance.daily_out_district : null,
    daily_hotel: allowance ? allowance.daily_hotel : null,
    daily_out_state: allowance ? allowance.daily_out_state : null,
    hotel_in_state_s: allowance ? allowance.hotel_in_state_s : null,
    hotel_in_state_d: allowance ? allowance.hotel_in_state_d : null,
    hotel_out_state_s: allowance ? allowance.hotel_out_state_s : null,
    hotel_out_state_d: allowance ? allowance.hotel_out_state_d : null,
    max_km_per_month: allowance ? allowance.max_km_per_month : null,
    rate_bike: resolvedBikeRate,
    rate_car: resolvedCarRate,
    vehicle_type: allowance ? allowance.vehicle_type : null,
    current_month_km: statsRes?.total_km || 0.0,
    current_month_auto: statsRes?.total_auto || 0.0,
    max_auto_per_month: allowance ? 1000 : null
  };

  const mm = String(monthInt).padStart(2, "0");
  const yy = String(yearVal).substring(2);

  return {
    success: true,
    user: {
      full_name: targetUser.name,
      e_code: targetUser.user_id,
      grade: targetUser.grade,
      home_district: targetUser.district || "Jodhpur",
      level_first_approver: targetUser.manager || "Admin",
      level_second_approver: targetUser.zonal_manager || "Admin"
    },
    allowance: allowanceDict,
    facilities,
    submitted_dates: submittedDates,
    approved_km: approvedKm,
    approved_auto: approvedAuto,
    existing_km_req: existingKmReq,
    existing_auto_req: existingAutoReq,
    next_exp_id: `RJ-${mm}/${yy}-PENDING`,
    system_settings: sysSettingsMap
  };
}

/**
 * GET /api/expense/init
 */
export async function handleExpenseInit(request, env, params, query, user) {
  const targetUserId = query.get("user_id") || user.user_id;
  const monthStr = query.get("month"); // Format: YYYY-MM
  if (!monthStr) return jsonResponse({ error: "month parameter is required" }, 400);

  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(targetUserId).first();
  if (!targetUser) return jsonResponse({ error: "User not found" }, 404);

  const data = await getExpenseInitData(env, targetUser, monthStr);
  return jsonResponse(data);
}

/**
 * POST /api/expense/limit-request
 */
export async function handleCreateLimitRequest(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, type, amount, month, client_timestamp } = body;
  if (!user_id || !type || !amount || !month) {
    return jsonResponse({ error: "Missing required parameters: user_id, type, amount, month" }, 400);
  }

  const reqTypeUpper = (type || "").trim().toUpperCase();
  const reqAmount = parseFloat(amount || 0);

  // 1. MAXIMUM EXTENSION AMOUNT CAPS:
  // AUTO max extension allowed: ₹2,500
  // KM (Bike) max extension allowed: 1,500
  const maxAllowedExtension = reqTypeUpper === "AUTO" ? 2500 : 1500;
  if (reqAmount > maxAllowedExtension) {
    const typeLabel = reqTypeUpper === "AUTO" ? "Auto is ₹2,500" : "Bike (KM) is 1,500";
    return jsonResponse({ error: `Maximum limit extension allowed for ${typeLabel}. You cannot request more than this.` }, 400);
  }

  // 2. STRICT 1 REQUEST PER MONTH PER MODE (ANY STATUS: Approved, Rejected, Pending, Waiting)
  const existingReq = await env.DB.prepare(`
    SELECT * FROM limit_approval_requests 
    WHERE user_id = ? AND UPPER(request_type) = ? AND for_month = ?
  `).bind(user_id, reqTypeUpper, month).first();

  if (existingReq) {
    const typeLabel = reqTypeUpper === "AUTO" ? "Auto" : "Bike";
    return jsonResponse({ 
      error: `You have already submitted a limit extension request for ${typeLabel} in ${month} (Status: ${existingReq.status}). Only 1 request per month per travel mode is allowed.` 
    }, 400);
  }

  const timestamp = parseClientTimestamp(client_timestamp);
  
  // Find manager from user profile
  const requester = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
  if (!requester) return jsonResponse({ error: "Requester not found" }, 404);

  // We find their coordinator or zonal manager to assign
  const managerName = requester.manager || requester.zonal_manager || requester.coordinator;
  let managerId = "Admin"; // Default fallback

  if (managerName && managerName !== "None") {
    // Look up manager's user_id by name
    const mgrUser = await env.DB.prepare("SELECT user_id FROM users WHERE LOWER(TRIM(name)) = ?").bind(managerName.trim().toLowerCase()).first();
    if (mgrUser) {
      managerId = mgrUser.user_id;
    }
  }

  await runWrite(env, `
    INSERT INTO limit_approval_requests (user_id, request_type, requested_value, status, for_month, manager_id, created_at, updated_at)
    VALUES (?, ?, ?, 'Pending', ?, ?, ?, ?)
  `, [user_id, reqTypeUpper, reqAmount, month, managerId, timestamp, timestamp]);

  // Notify manager
  await runWrite(env, `
    INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
    VALUES (?, '📥 New Limit Request', ?, 'warning', 0, '/approval-center', ?)
  `, [
    managerId,
    `${requester.name} has requested extra ${reqAmount} ${reqTypeUpper} limit for ${month}.`,
    timestamp
  ]);

  return jsonResponse({ status: "success", message: "Limit request raised successfully." });
}

/**
 * GET /api/expense/team
 */
export async function handleGetTeamExpenses(request, env, params, query, user) {
  try {
    const month = query.get("month");
    console.log("DEBUG: handleGetTeamExpenses user =", JSON.stringify(user));

    const allowedWindows = user.allowed_windows ? user.allowed_windows.split(",").map(w => w.trim().toLowerCase()) : [];
    
    // 1. Fetch team users
    let teamUsers = [];
    // FULL_ACCESS_ROLES group: see top of file — single source of truth
    const userRoleClean = (user.role || "").trim().toLowerCase();
    const isAdminOrReportViewer = hasFullAccess(userRoleClean);

    if (isAdminOrReportViewer) {
      const res = await env.DB.prepare("SELECT id, user_id, name, designation, grade, district, zone, manager, zonal_manager, coordinator, role FROM users").all();
      teamUsers = res.results || [];
      console.log("DEBUG: fetched all users, count =", teamUsers.length);
    } else {
      const nameClean = (user.name || "").trim();
      const uidClean = (user.user_id || "").trim();

      // Query direct reports and hierarchy approvals in parallel
      const [directReportsRes, hierarchyApprovals] = await Promise.all([
        env.DB.prepare(`
          SELECT id, user_id, name, designation, grade, district, zone, manager, zonal_manager, coordinator, role FROM users
          WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
             OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
             OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
        `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all(),
        env.DB.prepare(`
          SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
        `).bind(user.id).all()
      ]);
      const directReports = directReportsRes.results || [];
      
      let hierarchyReports = [];
      if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
        const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
        const placeholders = hIds.map(() => "?").join(",");
        const reqsRes = await env.DB.prepare(`
          SELECT u.id, u.user_id, u.name, u.designation, u.grade, u.district, u.zone, u.manager, u.zonal_manager, u.coordinator, u.role FROM users u
          JOIN hierarchy_requesters hr ON u.id = hr.user_id
          WHERE hr.hierarchy_id IN (${placeholders})
        `).bind(...hIds).all();
        hierarchyReports = reqsRes.results || [];
      }

      // Merge and de-duplicate team users
      const reportsMap = {};
      for (const u of [...directReports, ...hierarchyReports]) {
        reportsMap[u.id] = u;
      }
      teamUsers = Object.values(reportsMap);
    }

    if (teamUsers.length === 0) return jsonResponse([]);

    const teamUserIds = isAdminOrReportViewer
      ? teamUsers.map(u => u.id)
      : teamUsers.map(u => u.id).filter(id => id !== user.id);
    console.log("DEBUG: teamUserIds =", JSON.stringify(teamUserIds));
    if (teamUserIds.length === 0) return jsonResponse([]);

    const submittersById = {};
    for (const u of teamUsers) {
      if (u.id) submittersById[String(u.id)] = u;
      if (u.user_id) submittersById[String(u.user_id)] = u;
      if (u.userId) submittersById[String(u.userId)] = u;
    }

  // 2. Fetch expenses of team members
  let querySql = "";
  let binds = [];

  const expSelectCols = "id, user_id, month, year, amount, status, travel_mode, itinerary, description, expense_code, da_amount, hotel_amount, other_expense_amount, calls_assigned, calls_completed, pms_count, asset_tagging, local_purchase_amount, calibration_count, mobilise_count, created_at";

  if (isAdminOrReportViewer) {
    querySql = `SELECT ${expSelectCols} FROM expenses WHERE 1=1`;
    // Default to current month to avoid loading entire expense history
    if (!month) {
      const now = new Date();
      querySql += " AND year = ? AND month = ?";
      binds.push(now.getFullYear(), MONTH_NAMES[now.getMonth()]);
    }
  } else {
    const placeholders = teamUserIds.map(() => "?").join(",");
    querySql = `SELECT ${expSelectCols} FROM expenses WHERE user_id IN (${placeholders})`;
    binds = [...teamUserIds];
  }

  if (month) {
    if (month.includes("-") && month.length === 7) {
      const parts = month.split("-");
      const yr = parseInt(parts[0], 10);
      const monNum = parseInt(parts[1], 10);
      const monName = MONTH_NAMES[monNum - 1];

      querySql += " AND year = ? AND month = ?";
      binds.push(yr, monName);
    } else {
      querySql += " AND LOWER(month) LIKE ?";
      binds.push(`%${month.toLowerCase()}%`);
    }
  } else if (!isAdminOrReportViewer) {
    // Non-admin without month param: default to current month
    const now = new Date();
    querySql += " AND year = ? AND month = ?";
    binds.push(now.getFullYear(), MONTH_NAMES[now.getMonth()]);
  }

  const teamUserCodes = isAdminOrReportViewer
    ? teamUsers.map(u => u.user_id)
    : teamUsers.map(u => u.user_id).filter(uc => uc !== user.user_id);

  // FIX: Use queryInChunks to prevent D1_ERROR (too many SQL variables > 256) when teamUserCodes is large
  const limitReqsPromise = teamUserCodes.length > 0
    ? queryInChunks(env.DB, "SELECT id, user_id, request_type, requested_value, approved_value, status, for_month, manager_id, created_at FROM limit_approval_requests WHERE user_id IN (?)", teamUserCodes, 50)
    : Promise.resolve([]);

  const [expensesRows, limitReqsRes] = await Promise.all([
    env.DB.prepare(querySql).bind(...binds).all(),
    limitReqsPromise
  ]);
  const expenses = expensesRows.results || [];
  console.log("DEBUG: fetched expenses count =", expenses.length);

  // Fetch legs & serialize team expenses
  const result = [];
  if (expenses.length > 0) {
    const expenseCodes = expenses.map(e => e.expense_code).filter(Boolean);
    let allLegs = [];
    if (expenseCodes.length > 0) {
      allLegs = await queryInChunks(
        env.DB,
        "SELECT exp_id, itinerary_id, leg_number, travel_mode, sub_mode, distance_km, travel_amount, sub_amount, calls_assigned, calls_completed, pms_count, asset_tagging, calibration_count, mobilise_count FROM expense_itineraries WHERE exp_id IN (?)",
        expenseCodes
      );
    }

    const legsByCode = {};
    const itiIds = [];
    for (const l of allLegs) {
      if (!legsByCode[l.exp_id]) legsByCode[l.exp_id] = [];
      legsByCode[l.exp_id].push(l);
      if (l.itinerary_id) itiIds.push(l.itinerary_id);
    }

    let allTaggings = [];
    if (itiIds.length > 0) {
      try {
        allTaggings = await queryInChunks(env.DB, "SELECT itinerary_id, equipment_name, quantity FROM expense_asset_taggings WHERE itinerary_id IN (?)", itiIds);
      } catch (e) {
        console.warn("Failed to fetch asset taggings in handleGetTeamExpenses:", e.message);
      }
    }

    const taggingsMap = {};
    for (const t of allTaggings) {
      if (!taggingsMap[t.itinerary_id]) taggingsMap[t.itinerary_id] = [];
      taggingsMap[t.itinerary_id].push(t);
    }

    const assetCosts = await getAssetCostsMap(env);

    for (const exp of expenses) {
      const submitter = submittersById[exp.user_id] || submittersById[String(exp.user_id)] || null;
      const legs = legsByCode[exp.expense_code] || [];

      const totKm = legs
        .filter(l => ["bike", "car"].includes((l.travel_mode || "").trim().toLowerCase()))
        .reduce((sum, l) => sum + (parseFloat(l.distance_km) || 0.0), 0.0);

      const totAuto = legs
        .filter(l => (l.travel_mode || "").trim().toLowerCase() === "auto")
        .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0) +
        legs
        .filter(l => (l.sub_mode || "").trim().toLowerCase() === "auto")
        .reduce((sum, l) => sum + (parseFloat(l.sub_amount) || 0.0), 0.0);

      const bikeAmount = legs
        .filter(l => (l.travel_mode || "").trim().toLowerCase() === "bike")
        .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0);

      const carAmount = legs
        .filter(l => (l.travel_mode || "").trim().toLowerCase() === "car")
        .reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0.0), 0.0);

      const totCallsAssigned = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.calls_assigned) || 0), 0)
        : (parseInt(exp.calls_assigned) || 0);

      const totCallsCompleted = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.calls_completed) || 0), 0)
        : (parseInt(exp.calls_completed) || 0);

      const totPmsCount = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.pms_count) || 0), 0)
        : (parseInt(exp.pms_count) || 0);

      const totAssetTagging = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.asset_tagging) || 0), 0)
        : (parseInt(exp.asset_tagging) || 0);

      const totAssetTaggingVal = legs.length > 0
        ? legs.reduce((sum, l) => {
            const taggings = taggingsMap[l.itinerary_id] || [];
            let legVal = 0;
            for (const t of taggings) {
              const qty = parseInt(t.quantity || 0, 10) || 0;
              const cost = getEquipmentUnitCost(t.equipment_name, assetCosts);
              legVal += qty * cost;
            }
            return sum + legVal;
          }, 0.0)
        : 0.0;

      const totCalibrationCount = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.calibration_count) || 0), 0)
        : (parseInt(exp.calibration_count) || 0);

      const totMobiliseCount = legs.length > 0
        ? legs.reduce((sum, l) => sum + (parseInt(l.mobilise_count) || 0), 0)
        : (parseInt(exp.mobilise_count) || 0);

      const sName = submitter?.name || submitter?.submitter_name || "Unknown";
      const sCode = submitter?.user_id || submitter?.userId || submitter?.submitter_code || "N/A";
      const sDesignation = submitter?.designation || submitter?.submitter_designation || "Engineer";
      const sDistrict = submitter?.district || exp.district || "Ganganar";
      const sZone = getActualZone(submitter?.zone, sDistrict) || getActualZone(exp.zone, sDistrict) || "Unassigned Zone";

      const teamTagDetails = [];
      for (const l of legs) {
        const taggings = taggingsMap[l.itinerary_id] || [];
        for (const t of taggings) {
          const qty = parseInt(t.quantity || 0, 10) || 0;
          const cost = getEquipmentUnitCost(t.equipment_name, assetCosts);
          const val = qty * cost;
          teamTagDetails.push({
            equipment_name: t.equipment_name,
            quantity: qty,
            unit_cost: cost,
            total_val: val,
            itinerary_date: l.date || l.itinerary_date || exp.itinerary || exp.date || ""
          });
        }
      }

      result.push({
        id: exp.id,
        expense_code: exp.expense_code,
        submitter_name: sName,
        submitter_code: sCode,
        submitter_designation: sDesignation,
        month: exp.month,
        year: exp.year,
        amount: parseFloat(exp.amount || 0),
        status: exp.status,
        category: exp.travel_mode,
        date: exp.itinerary,
        purpose: exp.description || "",
        created_at: exp.created_at,
        total_km: totKm,
        total_auto: totAuto,
        bike_amount: bikeAmount,
        car_amount: carAmount,
        auto_amount: totAuto,
        da_amount: parseFloat(exp.da_amount || 0.0),
        hotel_amount: parseFloat(exp.hotel_amount || 0.0),
        other_expense_amount: parseFloat(exp.other_expense_amount || 0.0),
        local_purchase_amount: parseFloat(exp.local_purchase_amount || 0.0),
        district: sDistrict,
        zone: sZone,
        coordinator: submitter?.coordinator || submitter?.zonal_manager || "",
        calls_assigned: totCallsAssigned,
        calls_completed: totCallsCompleted,
        pms_count: totPmsCount,
        asset_tagging: totAssetTagging,
        asset_tagging_value: totAssetTaggingVal,
        tagging_details: teamTagDetails,
        calibration_count: totCalibrationCount,
        mobilise_count: totMobiliseCount
      });
    }
  }

  // 3. Process pre-fetched team members' limit requests
  const limitReqsList = Array.isArray(limitReqsRes) ? limitReqsRes : (limitReqsRes?.results || []);
  if (limitReqsList.length > 0) {
    for (const pl of limitReqsList) {
      const submitter = teamUsers.find(u => u.user_id === pl.user_id);
      if (!submitter) continue;

      let monthName = "N/A";
      let yearVal = new Date().getFullYear();
      if (pl.for_month && pl.for_month.includes("-")) {
        try {
          const parts = pl.for_month.split("-");
          yearVal = parseInt(parts[0], 10);
          const monNum = parseInt(parts[1], 10);
          monthName = MONTH_NAMES[monNum - 1];
        } catch (e) {}
      }

      const reqDate = pl.created_at ? pl.created_at.substring(0, 10) : pl.for_month;

      result.push({
        id: -pl.id,
        expense_code: `LIMIT-${pl.request_type}-${pl.id}`,
        submitter_name: submitter.name,
        submitter_code: pl.user_id,
        submitter_designation: submitter.designation || "Engineer",
        month: monthName,
        year: yearVal,
        amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value || 0) : 0.0,
        status: pl.status.toLowerCase(),
        category: "Limit Request",
        travel_mode: pl.request_type,
        date: reqDate,
        purpose: `Limit Extension Request: +${parseFloat(pl.requested_value || 0).toFixed(1)} ${pl.request_type}`,
        created_at: pl.created_at,
        total_km: pl.request_type === "KM" ? parseFloat(pl.requested_value || 0) : 0.0,
        total_auto: pl.request_type === "AUTO" ? parseFloat(pl.requested_value || 0) : 0.0,
        bike_amount: 0.0,
        car_amount: 0.0,
        auto_amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value || 0) : 0.0,
        da_amount: 0.0,
        hotel_amount: 0.0,
        other_expense_amount: 0.0,
        local_purchase_amount: 0.0,
        district: submitter.district || "Ganganar",
        zone: getActualZone(submitter.zone, submitter.district || "Ganganar")
      });
    }
  }

    // Sort result by created_at desc
    result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return jsonResponse(result);
  } catch (err) {
    console.error("ERROR in handleGetTeamExpenses:", err.message, err.stack);
    return jsonResponse({ error: "Internal Server Error", detail: err.message, stack: err.stack }, 500);
  }
}

export async function handleVerifyBarcode(request, env, params, query, user) {
  const barcode = query.get("barcode");
  if (!barcode) return jsonResponse({ error: "barcode parameter is required" }, 400);

  const hospital = query.get("hospital");
  const barcode8 = barcode.length >= 8 ? barcode.slice(-8) : barcode;

  if (hospital) {
    const queryResult = await runRead(env, `
      SELECT * FROM assets_inventory 
      WHERE (LOWER(SUBSTR(qr_code, -8)) = LOWER(?) 
         OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?) 
         OR LOWER(qr_code) = LOWER(?) 
         OR LOWER(serial_no) = LOWER(?))
         AND LOWER(TRIM(hospital_name)) = LOWER(TRIM(?))
      LIMIT 1
    `, [barcode8, barcode8, barcode, barcode, hospital], request);

    const asset = queryResult && queryResult.results && queryResult.results[0] ? queryResult.results[0] : null;

    if (asset) {
      return jsonResponse({
        success: true,
        valid: true,
        asset_name: asset.equipment_name,
        hospital_name: asset.hospital_name,
        district_name: asset.district_name,
        serial_no: asset.serial_no,
        data: {
          district_name: asset.district_name,
          hospital_name: asset.hospital_name,
          equipment_name: asset.equipment_name,
          model_name: asset.model_name || "",
          qr_code: asset.qr_code,
          inventory_status: asset.inventory_status || "Active"
        }
      });
    }

    // Check if barcode exists anywhere in database
    const queryAnyResult = await runRead(env, `
      SELECT hospital_name FROM assets_inventory 
      WHERE LOWER(SUBSTR(qr_code, -8)) = LOWER(?) 
         OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?) 
         OR LOWER(qr_code) = LOWER(?) 
         OR LOWER(serial_no) = LOWER(?) 
      LIMIT 1
    `, [barcode8, barcode8, barcode, barcode], request);

    const anyAsset = queryAnyResult && queryAnyResult.results && queryAnyResult.results[0] ? queryAnyResult.results[0] : null;

    if (anyAsset) {
      return jsonResponse({ success: false, valid: false, message: "This barcode was not fetched for this hospital." });
    } else {
      return jsonResponse({ success: false, valid: false, message: "Asset QR/Serial number not found in master database." });
    }
  } else {
    const queryResult = await runRead(env, `
      SELECT * FROM assets_inventory 
      WHERE LOWER(SUBSTR(qr_code, -8)) = LOWER(?) 
         OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?) 
         OR LOWER(qr_code) = LOWER(?) 
         OR LOWER(serial_no) = LOWER(?) 
      LIMIT 1
    `, [barcode8, barcode8, barcode, barcode], request);

    const asset = queryResult && queryResult.results && queryResult.results[0] ? queryResult.results[0] : null;

    if (!asset) {
      return jsonResponse({ success: false, valid: false, message: "Asset QR/Serial number not found in master database." });
    }

    return jsonResponse({
      success: true,
      valid: true,
      asset_name: asset.equipment_name,
      hospital_name: asset.hospital_name,
      district_name: asset.district_name,
      serial_no: asset.serial_no,
      data: {
        district_name: asset.district_name,
        hospital_name: asset.hospital_name,
        equipment_name: asset.equipment_name,
        model_name: asset.model_name || "",
        qr_code: asset.qr_code,
        inventory_status: asset.inventory_status || "Active"
      }
    });
  }
}

/**
 * GET /api/expense/asset-value-master
 */
export async function handleGetAssetValueMaster(request, env, params, query, user) {
  try {
    // Try querying the dedicated asset_value_master table first
    const result = await env.DB.prepare(`
      SELECT DISTINCT equipment_name, CAST(rmsc_tender_cost AS REAL) as asset_value, CAST(rmsc_tender_cost AS REAL) as rmsc_tender_cost 
      FROM asset_value_master 
      ORDER BY equipment_name ASC
    `).all();
    if (result.results && result.results.length > 0) {
      return jsonResponse(result.results);
    }
  } catch (e) {
    console.warn("Failed to query asset_value_master table, falling back to assets_inventory:", e.message);
  }

  // Fallback 1: Query assets_inventory using parsed_asset_value
  try {
    const result = await env.DB.prepare(`
      SELECT DISTINCT equipment_name, CAST(parsed_asset_value AS REAL) as asset_value, CAST(parsed_asset_value AS REAL) as rmsc_tender_cost 
      FROM assets_inventory 
      WHERE parsed_asset_value IS NOT NULL AND parsed_asset_value > 0
      ORDER BY equipment_name ASC
    `).all();
    return jsonResponse(result.results || []);
  } catch (e) {
    console.warn("Failed to query parsed_asset_value, falling back to asset_value replacement casting:", e.message);
    
    // Fallback 2: Query assets_inventory using asset_value
    try {
      const result = await env.DB.prepare(`
        SELECT DISTINCT equipment_name, 
               CAST(REPLACE(REPLACE(asset_value, ',', ''), '₹', '') AS REAL) as asset_value,
               CAST(REPLACE(REPLACE(asset_value, ',', ''), '₹', '') AS REAL) as rmsc_tender_cost 
        FROM assets_inventory 
        WHERE asset_value IS NOT NULL AND asset_value != '' AND asset_value != '0'
        ORDER BY equipment_name ASC
      `).all();
      return jsonResponse(result.results || []);
    } catch (err) {
      console.error("All asset master queries failed:", err.message);
      return jsonResponse([]);
    }
  }
}

/**
 * GET /api/expense/:id
 */
export async function getUserMonthlyStatsHelper(env, userDbId, month, year, excludeDate = null) {
  let monthStr = String(month).trim();
  let yearVal = year ? parseInt(year, 10) : null;

  if (monthStr.includes("-")) {
    const parts = monthStr.split("-");
    if (parts.length >= 2) {
      try {
        const y = parseInt(parts[0], 10);
        const mNum = parseInt(parts[1], 10);
        monthStr = MONTH_NAMES[mNum - 1];
        yearVal = y;
      } catch (e) {}
    }
  } else if (/^\d+$/.test(monthStr)) {
    try {
      const mNum = parseInt(monthStr, 10);
      monthStr = MONTH_NAMES[mNum - 1];
    } catch (e) {}
  } else {
    monthStr = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).toLowerCase();
  }

  let querySql = `
    SELECT * FROM expenses 
    WHERE user_id = ? AND month = ? AND year = ? AND LOWER(status) NOT IN ('draft', 'rejected', 'returned_to_draft')
  `;
  const binds = [userDbId, monthStr, yearVal];

  if (excludeDate) {
    querySql += " AND itinerary < ?";
    binds.push(excludeDate);
  }

  const res = await env.DB.prepare(querySql).bind(...binds).all();
  const expenses = res.results || [];

  const approvedExpCodes = expenses
    .filter(e => e.expense_code && e.status && ["approved", "partially_approved"].includes(e.status.trim().toLowerCase()))
    .map(e => e.expense_code);

  const allExpCodes = expenses
    .filter(e => e.expense_code)
    .map(e => e.expense_code);

  let approvedLegs = [];
  if (approvedExpCodes.length > 0) {
    const placeholders = approvedExpCodes.map(() => "?").join(",");
    const legsRes = await env.DB.prepare(`
      SELECT * FROM expense_itineraries WHERE exp_id IN (${placeholders})
    `).bind(...approvedExpCodes).all();
    approvedLegs = legsRes.results || [];
  }

  let allLegs = [];
  if (allExpCodes.length > 0) {
    const placeholders = allExpCodes.map(() => "?").join(",");
    const legsRes = await env.DB.prepare(`
      SELECT * FROM expense_itineraries WHERE exp_id IN (${placeholders})
    `).bind(...allExpCodes).all();
    allLegs = legsRes.results || [];
  }

  function getLegStats(leg) {
    let legCalls = leg.calls_completed || 0;
    let legPms = leg.pms_count || 0;
    let legAsset = leg.asset_tagging || 0;
    let legMobilise = leg.mobilise_count || 0;
    let legCalibration = leg.calibration_count || 0;

    if (leg.activity_details) {
      try {
        const act = JSON.parse(leg.activity_details);
        if (act && typeof act === "object") {
          const selectedActs = act.selected_activities || [];
          if (selectedActs.includes("Calls")) {
            const list = act.calls_list || [];
            legCalls = list.filter(c => c && typeof c === "object" && c.barcode).length;
          }
          if (selectedActs.includes("PMS")) {
            const list = act.pms_list || [];
            legPms = list.filter(p => p && typeof p === "object" && p.barcode).length;
          }
          if (selectedActs.includes("Asset Tagging")) {
            const list = act.assets_list || [];
            let sumQty = 0;
            for (const item of list) {
              if (item && typeof item === "object") {
                sumQty += parseInt(item.quantity || 0, 10) || 0;
              }
            }
            legAsset = sumQty;
          }
          if (act.mobilise_asset_count !== undefined) {
            legMobilise = parseInt(act.mobilise_asset_count, 10) || 0;
          }
          if (act.calibration_count !== undefined) {
            legCalibration = parseInt(act.calibration_count, 10) || 0;
          }
        }
      } catch (e) {}
    }
    return [legCalls, legPms, legAsset, legMobilise, legCalibration];
  }

  // 1. Approved stats
  let approvedDa = 0.0;
  let approvedBikeKm = 0.0;
  let approvedAuto = 0.0;
  let approvedBus = 0.0;
  let approvedTrain = 0.0;
  let approvedHotel = 0.0;
  let approvedLocalPurchase = 0.0;
  let approvedKmUsed = 0.0;

  let approvedCalls = 0;
  let approvedPms = 0;
  let approvedAsset = 0;
  let approvedMobilise = 0;
  let approvedCalibration = 0;

  for (const leg of approvedLegs) {
    approvedDa += parseFloat(leg.da_amount || 0.0);
    approvedHotel += parseFloat(leg.hotel_amount || 0.0);
    approvedLocalPurchase += parseFloat(leg.local_purchase || 0.0);

    const mode = (leg.travel_mode || "").trim().toLowerCase();
    if (mode === "bike") {
      approvedBikeKm += parseFloat(leg.distance_km || 0.0);
      approvedKmUsed += parseFloat(leg.distance_km || 0.0);
    } else if (mode === "car") {
      approvedKmUsed += parseFloat(leg.distance_km || 0.0);
    } else if (mode === "auto") {
      approvedAuto += parseFloat(leg.travel_amount || 0.0);
    } else if (mode === "bus") {
      approvedBus += parseFloat(leg.travel_amount || 0.0);
    } else if (mode === "train") {
      approvedTrain += parseFloat(leg.travel_amount || 0.0);
    }

    const subMode = (leg.sub_mode || "").trim().toLowerCase();
    if (subMode === "auto") {
      approvedAuto += parseFloat(leg.sub_amount || 0.0);
    } else if (subMode === "bus") {
      approvedBus += parseFloat(leg.sub_amount || 0.0);
    } else if (subMode === "train") {
      approvedTrain += parseFloat(leg.sub_amount || 0.0);
    }

    const [legCalls, legPms, legAsset, legMobilise, legCalibration] = getLegStats(leg);
    approvedCalls += legCalls;
    approvedPms += legPms;
    approvedAsset += legAsset;
    approvedMobilise += legMobilise;
    approvedCalibration += legCalibration;
  }

  // 2. Claimed stats
  let claimedDa = 0.0;
  let claimedBikeKm = 0.0;
  let claimedAuto = 0.0;
  let claimedBus = 0.0;
  let claimedTrain = 0.0;
  let claimedHotel = 0.0;
  let claimedLocalPurchase = 0.0;
  let claimedKmUsed = 0.0;

  let claimedCalls = 0;
  let claimedPms = 0;
  let claimedAsset = 0;
  let claimedMobilise = 0;
  let claimedCalibration = 0;

  for (const leg of allLegs) {
    const origDa = (leg.original_da_amount !== null && leg.original_da_amount > 0) ? parseFloat(leg.original_da_amount) : parseFloat(leg.da_amount || 0.0);
    const origHotel = (leg.original_hotel_amount !== null && leg.original_hotel_amount > 0) ? parseFloat(leg.original_hotel_amount) : parseFloat(leg.hotel_amount || 0.0);
    const origLp = (leg.original_local_purchase !== null && leg.original_local_purchase > 0) ? parseFloat(leg.original_local_purchase) : parseFloat(leg.local_purchase || 0.0);

    claimedDa += origDa;
    claimedHotel += origHotel;
    claimedLocalPurchase += origLp;

    const mode = (leg.travel_mode || "").trim().toLowerCase();
    const origKm = (leg.original_distance_km !== null && leg.original_distance_km > 0) ? parseFloat(leg.original_distance_km) : parseFloat(leg.distance_km || 0.0);
    const origTravelAmt = (leg.original_travel_amount !== null && leg.original_travel_amount > 0) ? parseFloat(leg.original_travel_amount) : parseFloat(leg.travel_amount || 0.0);

    if (mode === "bike") {
      claimedBikeKm += origKm;
      claimedKmUsed += origKm;
    } else if (mode === "car") {
      claimedKmUsed += origKm;
    } else if (mode === "auto") {
      claimedAuto += origTravelAmt;
    } else if (mode === "bus") {
      claimedBus += origTravelAmt;
    } else if (mode === "train") {
      claimedTrain += origTravelAmt;
    }

    const origSubAmt = (leg.original_sub_amount !== null && leg.original_sub_amount > 0) ? parseFloat(leg.original_sub_amount) : parseFloat(leg.sub_amount || 0.0);
    const subMode = (leg.sub_mode || "").trim().toLowerCase();
    if (subMode === "auto") {
      claimedAuto += origSubAmt;
    } else if (subMode === "bus") {
      claimedBus += origSubAmt;
    } else if (subMode === "train") {
      claimedTrain += origSubAmt;
    }

    const [legCalls, legPms, legAsset, legMobilise, legCalibration] = getLegStats(leg);
    claimedCalls += legCalls;
    claimedPms += legPms;
    claimedAsset += legAsset;
    claimedMobilise += legMobilise;
    claimedCalibration += legCalibration;
  }

  return {
    km_used_so_far_approved: approvedKmUsed,
    km_used_so_far_claimed: claimedKmUsed,
    total_da_approved: approvedDa,
    total_da_claimed: claimedDa,
    total_bike_km_approved: approvedBikeKm,
    total_bike_km_claimed: claimedBikeKm,
    total_auto_approved: approvedAuto,
    total_auto_claimed: claimedAuto,
    total_bus_approved: approvedBus,
    total_bus_claimed: claimedBus,
    total_train_approved: approvedTrain,
    total_train_claimed: claimedTrain,
    total_hotel_approved: approvedHotel,
    total_hotel_claimed: claimedHotel,
    total_local_purchase_approved: approvedLocalPurchase,
    total_local_purchase_claimed: claimedLocalPurchase,
    calls_completed_approved: approvedCalls,
    calls_completed_claimed: claimedCalls,
    pms_count_approved: approvedPms,
    pms_count_claimed: claimedPms,
    asset_tagging_approved: approvedAsset,
    asset_tagging_claimed: claimedAsset,
    mobilise_count_approved: approvedMobilise,
    mobilise_count_claimed: claimedMobilise,
    calibration_count_approved: approvedCalibration,
    calibration_count_claimed: claimedCalibration,
    
    // Legacy backward-compatible keys (Includes both Approved and Pending Submitted Claims up to date)
    km_used_so_far: claimedKmUsed > 0 ? claimedKmUsed : approvedKmUsed,
    total_da: claimedDa > 0 ? claimedDa : approvedDa,
    total_bike_km: claimedBikeKm > 0 ? claimedBikeKm : approvedBikeKm,
    total_auto: claimedAuto > 0 ? claimedAuto : approvedAuto,
    total_bus: claimedBus > 0 ? claimedBus : approvedBus,
    total_train: claimedTrain > 0 ? claimedTrain : approvedTrain,
    total_hotel: claimedHotel > 0 ? claimedHotel : approvedHotel,
    total_local_purchase: claimedLocalPurchase > 0 ? claimedLocalPurchase : approvedLocalPurchase,
    calls_completed: claimedCalls > 0 ? claimedCalls : approvedCalls,
    pms_count: claimedPms > 0 ? claimedPms : approvedPms,
    asset_tagging: claimedAsset > 0 ? claimedAsset : approvedAsset,
    mobilise_count: claimedMobilise > 0 ? claimedMobilise : approvedMobilise,
    calibration_count: claimedCalibration > 0 ? claimedCalibration : approvedCalibration
  };
}

/**
 * GET /api/expense/:id
 */
export async function handleGetExpenseDetails(request, env, params, query, user) {
  const expenseId = params.id;

  try {
    if (expenseId.startsWith("-")) {
    const val = parseInt(expenseId, 10);
    if (val <= -200000) {
      // Legacy expense_master claim!
      try {
        const matchingExpId = await resolveLegacyExpenseId(env, val);
        if (!matchingExpId) return jsonResponse({ error: "Legacy claim not found" }, 404);

        const masterRow = await env.DB.prepare(`
          SELECT * FROM expense_master WHERE exp_id = ?
        `).bind(matchingExpId).first();
        if (!masterRow) return jsonResponse({ error: "Legacy claim details not found" }, 404);

        const submitter = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(masterRow.user_id).first();
        
        let rateBike = 4.5;
        let rateCar = 9.0;
        if (submitter) {
          const gradeToLookup = (submitter.designation || "").toLowerCase().includes("specialist") ? "O1" : (submitter.grade || "O1");
          const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
          const defaultBike = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1").first();
          const defaultCar = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1").first();
          const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
          const fallbackCarRate = defaultCar?.rate_per_km || 9.0;

          if (allowance) {
            rateBike = allowance.vehicle_type === "Bike" ? allowance.rate_per_km : fallbackBikeRate;
            rateCar = allowance.vehicle_type === "Car" ? allowance.rate_per_km : fallbackCarRate;
          } else {
            rateBike = fallbackBikeRate;
            rateCar = fallbackCarRate;
          }
        }

        const itiRows = await env.DB.prepare(`
          SELECT * FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number
        `).bind(matchingExpId).all();

        const itinerariesList = (itiRows.results || []).map(r => ({
          leg: r.leg_number,
          from_district: r.from_district,
          to_district: r.to_district,
          from: r.from_location || "",
          to: r.to_location || "",
          mode: r.travel_mode,
          km: parseFloat(r.distance_km || 0.0),
          amount: parseFloat(r.travel_amount || 0.0),
          sub_mode: r.sub_mode || "",
          sub_amount: parseFloat(r.sub_amount || 0.0),
          da: parseFloat(r.da_amount || 0.0),
          hotel: parseFloat(r.hotel_amount || 0.0),
          local_purchase: 0.0,
          oth_desc: r.other_desc || "",
          oth_amount: parseFloat(r.other_amount || 0.0),
          ws_assigned: r.calls_assigned || 0,
          calls_assigned: r.calls_assigned || 0,
          ws_closed: r.calls_completed || 0,
          calls_completed: r.calls_completed || 0,
          ws_pms: r.pms_count || 0,
          pms_count: r.pms_count || 0,
          ws_asset: r.asset_tagging || 0,
          asset_tagging: r.asset_tagging || 0,
          calibration_count: 0,
          mobilise_count: 0,
          mobilise_asset_count: 0,
          visit_purpose: r.visit_purpose || "",
          activity_details: "",
          original_km: parseFloat(r.distance_km || 0.0),
          original_amount: parseFloat(r.travel_amount || 0.0),
          original_sub_amount: parseFloat(r.sub_amount || 0.0),
          original_da: parseFloat(r.da_amount || 0.0),
          original_hotel: parseFloat(r.hotel_amount || 0.0),
          original_oth_amount: parseFloat(r.other_amount || 0.0),
          original_local_purchase: 0.0
        }));

        const attRows = await env.DB.prepare(`
          SELECT file_url, itinerary_id, bill_type FROM expense_attachments WHERE exp_id = ?
        `).bind(matchingExpId).all();
        const attachmentsList = (attRows.results || []).map(r => r.file_url);
        const attachmentsDetailed = (attRows.results || []).map(r => ({
          file_url: r.file_url,
          itinerary_id: r.itinerary_id,
          bill_type: r.bill_type
        }));

        // Mock approvals list
        const approvalsList = [];
        const l1App = masterRow.level_first_approver;
        const l2App = masterRow.level_second_approver;
        const statusVal = masterRow.status;
        const approvedBy = masterRow.approved_by;

        const l1User = l1App ? await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(l1App).first() : null;
        const l2User = l2App ? await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(l2App).first() : null;

        const l1Status = ["Pending L2", "Approved"].includes(statusVal) ? "approved" : ((statusVal === "Rejected" && approvedBy === "L1") ? "rejected" : "pending");
        approvalsList.push({
          id: val,
          level_number: 1,
          approver_name: l1User?.name || l1App || "N/A",
          approver_code: l1App || "",
          approver_role: l1User?.role || "Manager",
          status: l1Status,
          comments: (statusVal === "Rejected" && approvedBy === "L1") ? (masterRow.reject_reason || "") : "",
          updated_at: masterRow.created_at
        });

        if (l2App) {
          const l2Status = statusVal === "Approved" ? "approved" : ((statusVal === "Rejected" && approvedBy === "L2") ? "rejected" : (statusVal === "Pending L2" ? "pending" : "waiting"));
          approvalsList.push({
            id: val - 1,
            level_number: 2,
            approver_name: l2User?.name || l2App || "N/A",
            approver_code: l2App || "",
            approver_role: l2User?.role || "HOD",
            status: l2Status,
            comments: (statusVal === "Rejected" && approvedBy === "L2") ? (masterRow.reject_reason || "") : "",
            updated_at: masterRow.created_at
          });
        }

        const dateStr = masterRow.expense_date;
        let monthName = "January";
        let yearVal = new Date().getFullYear();
        if (dateStr) {
          try {
            const parts = dateStr.split("-");
            yearVal = parseInt(parts[0], 10);
            const monNum = parseInt(parts[1], 10);
            monthName = MONTH_NAMES[monNum - 1];
          } catch (e) {}
        }

        const monthlyStats = await getUserMonthlyStatsHelper(env, submitter?.id || 0, monthName, yearVal, dateStr);

        const distInfoLegacy = computeDistrictInfo(submitter?.district, itinerariesList, masterRow.district, masterRow.category || masterRow.travel_mode);
        const districtTypeLegacy = masterRow.district_type || distInfoLegacy.districtType;
        const hasMismatchLegacy = (districtTypeLegacy === "OUT_DISTRICT") && distInfoLegacy.allLegsBaseDistrict;

        return jsonResponse({
          id: val,
          expense_code: matchingExpId,
          districtType: districtTypeLegacy,
          hasMismatch: hasMismatchLegacy,
          user_id: submitter?.id || 0,
          submitter_name: submitter?.name || masterRow.user_id,
          submitter_code: masterRow.user_id,
          month: monthName,
          year: yearVal,
          amount: parseFloat(masterRow.total_amount || 0.0),
          status: statusVal === "Approved" ? "approved" : (statusVal === "Rejected" ? "rejected" : "submitted"),
          category: itinerariesList[0]?.mode || "Travel",
          date: dateStr,
          purpose: masterRow.visit_purpose || "",
          original_amount: parseFloat(masterRow.original_amount || masterRow.total_amount || 0.0),
          original_da_amount: parseFloat(masterRow.da_amount || 0.0),
          original_hotel_amount: parseFloat(masterRow.hotel_amount || 0.0),
          original_other_expense_amount: parseFloat(masterRow.other_expense_amount || 0.0),
          original_local_purchase_amount: parseFloat(masterRow.local_purchase_amount || 0.0),
          attachments: attachmentsList,
          attachments_detailed: attachmentsDetailed,
          itineraries: itinerariesList,
          created_at: masterRow.created_at,
          updated_at: masterRow.created_at,
          approvals: approvalsList,
          edit_history: [],
          user_monthly_stats: monthlyStats,
          rate_bike: rateBike,
          rate_car: rateCar
        });
      } catch (e) {
        return jsonResponse({ error: "Legacy table query failed: " + e.message }, 500);
      }
    }

    // Limit approval request
    const limitId = -val;
    const pl = await env.DB.prepare("SELECT * FROM limit_approval_requests WHERE id = ?").bind(limitId).first();
    if (!pl) return jsonResponse({ error: "Limit request not found" }, 404);

    const submitter = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(pl.user_id).first();
    
    let limitYear = new Date().getFullYear();
    if (pl.for_month && pl.for_month.includes("-")) {
      limitYear = parseInt(pl.for_month.split("-")[0], 10);
    }

    let rateBike = 4.5;
    let rateCar = 9.0;
    if (submitter) {
      const gradeToLookup = (submitter.designation || "").toLowerCase().includes("specialist") ? "O1" : (submitter.grade || "O1");
      const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
      const defaultBike = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1").first();
      const defaultCar = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1").first();
      const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
      const fallbackCarRate = defaultCar?.rate_per_km || 9.0;

      if (allowance) {
        rateBike = allowance.vehicle_type === "Bike" ? allowance.rate_per_km : fallbackBikeRate;
        rateCar = allowance.vehicle_type === "Car" ? allowance.rate_per_km : fallbackCarRate;
      } else {
        rateBike = fallbackBikeRate;
        rateCar = fallbackCarRate;
      }
    }

    const monthlyStats = submitter ? await getUserMonthlyStatsHelper(env, submitter.id, pl.for_month, limitYear) : null;
    const managerUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(pl.manager_id).first();

    return jsonResponse({
      id: -pl.id,
      expense_code: `LIMIT-${pl.request_type}-${pl.id}`,
      is_limit_request: true,
      limit_type: pl.request_type,
      requested_value: parseFloat(pl.requested_value),
      approved_value: pl.approved_value !== null ? parseFloat(pl.approved_value) : null,
      unit: pl.request_type === "KM" ? "KM" : "₹",
      districtType: "IN_DISTRICT",
      user_id: submitter?.id || 0,
      submitter_name: submitter?.name || `Employee ${pl.user_id}`,
      submitter_code: pl.user_id,
      month: pl.for_month,
      year: limitYear,
      amount: 0.0,
      status: pl.status,
      category: "Limit Request",
      date: pl.for_month,
      purpose: `Request additional ${parseFloat(pl.requested_value).toFixed(1)} ${pl.request_type === "KM" ? "KM" : "₹"} limit extension for month ${pl.for_month}.`,
      original_amount: 0.0,
      original_da_amount: 0.0,
      original_hotel_amount: 0.0,
      original_other_expense_amount: 0.0,
      original_local_purchase_amount: 0.0,
      attachments: [],
      attachments_detailed: [],
      user_monthly_stats: monthlyStats,
      rate_bike: rateBike,
      rate_car: rateCar,
      itineraries: [],
      created_at: pl.created_at,
      updated_at: pl.updated_at,
      approvals: [
        {
          id: -pl.id,
          level_number: 1,
          approver_name: managerUser?.name || pl.manager_id,
          approver_code: pl.manager_id,
          approver_role: managerUser?.role || "Manager",
          status: (pl.status || "pending").toLowerCase(),
          comments: pl.remark || pl.reason || pl.comments || "",
          updated_at: pl.updated_at
        }
      ],
      edit_history: []
    });
  }

  // Normal expense
  let expense = null;
  if (/^\d+$/.test(expenseId)) {
    expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ? OR expense_code = ?").bind(parseInt(expenseId, 10), expenseId).first();
  } else {
    expense = await env.DB.prepare("SELECT * FROM expenses WHERE expense_code = ?").bind(expenseId).first();
  }

  if (!expense) return jsonResponse({ error: "Expense claim not found" }, 404);

  const expCodeStr = String(expense.expense_code || "");
  const expIdStr = String(expense.id || "");

  // ⚡ FAST PARALLEL BATCH EXECUTION: Execute all 6 DB queries in 1 parallel round-trip!
  const [
    approvalsRes,
    submitter,
    itineraries,
    attachments,
    editLogs,
    monthlyStats
  ] = await Promise.all([
    env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? ORDER BY level_number").bind(expense.id).all().catch(() => ({ results: [] })),
    env.DB.prepare("SELECT * FROM users WHERE id = ? OR user_id = ? OR e_code = ?").bind(expense.user_id, String(expense.user_id), String(expense.user_id)).first().catch(() => null),
    env.DB.prepare("SELECT * FROM expense_itineraries WHERE exp_id = ? OR exp_id = ? OR LOWER(exp_id) = LOWER(?) ORDER BY leg_number ASC").bind(expCodeStr, expIdStr, expCodeStr).all().catch(() => ({ results: [] })),
    env.DB.prepare("SELECT * FROM expense_attachments WHERE exp_id = ? OR exp_id = ? OR LOWER(exp_id) = LOWER(?)").bind(expCodeStr, expIdStr, expCodeStr).all().catch(() => ({ results: [] })),
    env.DB.prepare("SELECT * FROM expense_edit_logs WHERE expense_id = ? ORDER BY created_at DESC").bind(expense.id).all().catch(() => ({ results: [] })),
    getUserMonthlyStatsHelper(env, expense.user_id, expense.month, expense.year, expense.itinerary).catch(() => ({ totalSubmitted: 0, totalApproved: 0 }))
  ]);

  const approverIds = Array.from(new Set((approvalsRes.results || []).map(a => a.approver_id).filter(Boolean)));
  const editorIds = Array.from(new Set((editLogs.results || []).map(el => el.editor_id).filter(Boolean)));
  const allUserIdsToFetch = Array.from(new Set([...approverIds, ...editorIds]));

  let userMap = {};
  if (allUserIdsToFetch.length > 0) {
    try {
      const placeholders = allUserIdsToFetch.map(() => "?").join(",");
      const usersRes = await env.DB.prepare(`SELECT id, user_id, e_code, name, role FROM users WHERE id IN (${placeholders})`).bind(...allUserIdsToFetch).all();
      for (const u of (usersRes.results || [])) {
        userMap[u.id] = u;
      }
    } catch (e) {}
  }

  const approvalsList = (approvalsRes.results || []).map(a => {
    const approverUser = userMap[a.approver_id] || null;
    return {
      id: a.id,
      level_number: a.level_number,
      approver_name: approverUser?.name || `Approver ID ${a.approver_id}`,
      approver_code: approverUser?.user_id || "",
      approver_role: approverUser?.role || "",
      status: a.status,
      comments: a.comments || "",
      updated_at: a.updated_at
    };
  });

  const rateBike = 4.5;
  const rateCar = 9.0;

  let itineraryRows = itineraries.results || [];
  if (itineraryRows.length === 0) {
    itineraryRows = [{
      leg_number: 1,
      from_district: expense.district || submitter?.district || submitter?.base_reporting_location || "Base District",
      to_district: expense.district || submitter?.district || submitter?.base_reporting_location || "Base District",
      from_location: expense.from_location || expense.district || submitter?.district || "Local Duty",
      to_location: expense.to_location || expense.district || submitter?.district || "Local Duty",
      travel_mode: expense.travel_mode || "Bike",
      distance_km: parseFloat(expense.total_km || 0),
      travel_amount: parseFloat(expense.amount || 0),
      sub_mode: "",
      sub_amount: 0,
      da_amount: parseFloat(expense.da_amount || 0),
      hotel_amount: parseFloat(expense.hotel_amount || 0),
      local_purchase: parseFloat(expense.local_purchase_amount || 0),
      local_purchase_remark: "",
      other_desc: expense.other_expense_reason || "",
      other_amount: parseFloat(expense.other_expense_amount || 0),
      calls_assigned: expense.calls_assigned || 0,
      calls_completed: expense.calls_completed || 0,
      pms_count: expense.pms_count || 0,
      asset_tagging: expense.asset_tagging || 0,
      visit_purpose: expense.description || expense.purpose || ""
    }];
  }

  const editHistoryList = (editLogs.results || []).map(el => {
    const edUser = userMap[el.editor_id];
    return {
      id: el.id,
      editor_name: el.editor_name || edUser?.name || "",
      editor_code: edUser?.user_id || edUser?.e_code || "",
      editor_role: el.editor_role || edUser?.role || "",
      leg_number: el.leg_number,
      field_name: el.field_name,
      old_value: el.old_value,
      new_value: el.new_value,
      comment: el.comment || "",
      created_at: el.created_at
    };
  });

  const distInfoStandard = computeDistrictInfo(submitter?.district, itineraries.results || [], expense.district, expense.category || expense.travel_mode);
  const districtTypeStandard = expense.district_type || distInfoStandard.districtType;
  const hasMismatchStandard = (districtTypeStandard === "OUT_DISTRICT") && distInfoStandard.allLegsBaseDistrict;

  return jsonResponse({
    id: expense.id,
    expense_code: expense.expense_code,
    districtType: districtTypeStandard,
    hasMismatch: hasMismatchStandard,
    user_id: expense.user_id,
    submitter_name: submitter?.name || "",
    submitter_code: submitter?.user_id || "",
    month: expense.month,
    year: expense.year,
    amount: parseFloat(expense.amount || 0.0),
    status: expense.status,
    category: expense.travel_mode,
    date: expense.itinerary,
    purpose: expense.description || "",
    policy_case: expense.policy_case || null,
    policy_rule_name: expense.policy_rule_name || null,
    ai_analysis: expense.ai_analysis || null,
    is_anomaly: expense.is_anomaly || 0,
    original_amount: parseFloat(expense.original_amount || expense.amount || 0.0),
    original_da_amount: parseFloat(expense.original_da_amount || expense.da_amount || 0.0),
    original_hotel_amount: parseFloat(expense.original_hotel_amount || expense.hotel_amount || 0.0),
    original_other_expense_amount: parseFloat(expense.original_other_expense_amount || expense.other_expense_amount || 0.0),
    original_local_purchase_amount: parseFloat(expense.original_local_purchase_amount || expense.local_purchase_amount || 0.0),
    attachments: (attachments.results || []).map(a => a.file_url),
    attachments_detailed: (attachments.results || []).map(a => ({
      file_url: a.file_url,
      itinerary_id: a.itinerary_id,
      bill_type: a.bill_type
    })),
    itineraries: itineraryRows.map(i => {
      const userFromLoc = (i.from_location && i.from_location.trim() !== "" && i.from_location !== "N/A" && i.from_location !== "NA") ? i.from_location : null;
      const userToLoc = (i.to_location && i.to_location.trim() !== "" && i.to_location !== "N/A" && i.to_location !== "NA") ? i.to_location : null;
      const userFromDist = (i.from_district && i.from_district.trim() !== "" && i.from_district !== "N/A" && i.from_district !== "NA") ? i.from_district : null;
      const userToDist = (i.to_district && i.to_district.trim() !== "" && i.to_district !== "N/A" && i.to_district !== "NA") ? i.to_district : null;

      const empDist = submitter?.district || expense.district || submitter?.base_reporting_location || "";

      const finalFromDist = userFromDist || empDist || "—";
      const finalToDist = userToDist || empDist || "—";
      const finalFromLoc = userFromLoc || finalFromDist;
      const finalToLoc = userToLoc || finalToDist;

      return {
        leg: i.leg_number,
        from_district: finalFromDist,
        to_district: finalToDist,
        from_state: i.from_state || i.state || submitter?.state || "Rajasthan",
        to_state: i.to_state || i.dest_state || submitter?.state || "Rajasthan",
        state: i.state || i.from_state || submitter?.state || "Rajasthan",
        dest_state: i.dest_state || i.to_state || submitter?.state || "Rajasthan",
        from: finalFromLoc,
        to: finalToLoc,
      mode: i.travel_mode,
      km: parseFloat(i.distance_km || 0.0),
      amount: parseFloat(i.travel_amount || 0.0),
      sub_mode: i.sub_mode || "",
      sub_amount: parseFloat(i.sub_amount || 0.0),
      da: parseFloat(i.da_amount || 0.0),
      hotel: parseFloat(i.hotel_amount || 0.0),
      local_purchase: parseFloat(i.local_purchase || 0.0),
      local_purchase_remark: i.local_purchase_remark || "",
      oth_desc: i.other_desc || "",
      oth_amount: parseFloat(i.other_amount || 0.0),
      ws_assigned: i.calls_assigned || 0,
      calls_assigned: i.calls_assigned || 0,
      ws_closed: i.calls_completed || 0,
      calls_completed: i.calls_completed || 0,
      ws_pms: i.pms_count || 0,
      pms_count: i.pms_count || 0,
      ws_asset: i.asset_tagging || 0,
      asset_tagging: i.asset_tagging || 0,
      calibration_count: i.calibration_count || 0,
      mobilise_count: i.mobilise_count || 0,
      mobilise_asset_count: i.mobilise_count || 0,
      visit_purpose: i.visit_purpose || "",
      activity_details: i.activity_details || "",
      original_km: parseFloat(i.original_distance_km || i.distance_km || 0.0),
      original_amount: parseFloat(i.original_travel_amount || i.travel_amount || 0.0),
      original_sub_amount: parseFloat(i.original_sub_amount || i.sub_amount || 0.0),
      original_da: parseFloat(i.original_da_amount || i.da_amount || 0.0),
      original_hotel: parseFloat(i.original_hotel_amount || i.hotel_amount || 0.0),
      original_oth_amount: parseFloat(i.original_other_amount || i.other_amount || 0.0),
      original_local_purchase: parseFloat(i.original_local_purchase || i.local_purchase || 0.0)
    }; }),
    deduction_amount: expense.deduction_amount !== undefined && expense.deduction_amount !== null
      ? parseFloat(expense.deduction_amount)
      : (expense.deduction_amt !== undefined && expense.deduction_amt !== null
          ? parseFloat(expense.deduction_amt)
          : (expense.original_amount && expense.amount && parseFloat(expense.original_amount) > parseFloat(expense.amount)
              ? parseFloat((parseFloat(expense.original_amount) - parseFloat(expense.amount)).toFixed(2))
              : 0)),
    remark: expense.remark || expense.approver_remark || expense.deduction_remark || expense.comments || (approvalsList.find(a => a.comments || a.remark)?.comments) || "",
    approver_remark: expense.approver_remark || expense.remark || expense.deduction_remark || expense.comments || (approvalsList.find(a => a.comments || a.remark)?.comments) || "",
    deduction_remark: expense.deduction_remark || expense.approver_remark || expense.remark || expense.comments || "",
    created_at: expense.created_at,
    updated_at: expense.updated_at,
    approvals: approvalsList,
    edit_history: editHistoryList,
    user_monthly_stats: monthlyStats,
    rate_bike: rateBike,
    rate_car: rateCar
  });
  } catch (err) {
    return jsonResponse({ error: "Failed to load details: " + err.message, stack: err.stack }, 500);
  }
}

/**
 * DELETE /api/expense/:id
 */
export async function handleDeleteExpense(request, env, params, query, user) {
  const expenseId = parseInt(params.id, 10);
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) return jsonResponse({ error: "Expense claim not found" }, 404);

  if (expense.user_id !== user.id && (user.role || "").trim().toLowerCase() !== "admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const itis = await env.DB.prepare("SELECT itinerary_id FROM expense_itineraries WHERE exp_id = ?").bind(expense.expense_code).all();
  const itineraryIds = (itis.results || []).map(r => r.itinerary_id);

  const statements = [];
  for (const id of itineraryIds) {
    statements.push({ sql: "DELETE FROM expense_breakdown_calls WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_pms_calls WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_asset_taggings WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_asset_mobilises WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_calibrations WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_other_activities WHERE itinerary_id = ?", params: [id] });
  }

  statements.push({ sql: "DELETE FROM approvals WHERE expense_id = ?", params: [expenseId] });
  statements.push({ sql: "DELETE FROM expense_edit_logs WHERE expense_id = ?", params: [expenseId] });
  statements.push({ sql: "DELETE FROM expense_attachments WHERE exp_id = ?", params: [expense.expense_code] });
  statements.push({ sql: "DELETE FROM expense_itineraries WHERE exp_id = ?", params: [expense.expense_code] });
  statements.push({ sql: "DELETE FROM expenses WHERE id = ?", params: [expenseId] });

  await runBatchWrite(env, statements);

  return jsonResponse({ status: "success", message: "Expense claim deleted successfully." });
}

/**
 * POST /api/expense/:id/reverse
 * Reverse an expense entry (Admin only) — does NOT delete data.
 * Marks status as "reversed", stores reversal metadata.
 */
export async function handleReverseExpense(request, env, params, query, user) {
  // Only Admin can reverse entries
  if (!user || (user.role || "").trim().toLowerCase() !== "admin") {
    return jsonResponse({ error: "Access denied. Only Admin can reverse expense entries." }, 403);
  }

  const expenseId = parseInt(params.id, 10);
  if (isNaN(expenseId)) {
    return jsonResponse({ error: "Invalid expense ID" }, 400);
  }

  // Find the expense
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) {
    return jsonResponse({ error: "Expense claim not found" }, 404);
  }

  // Don't reverse an already reversed entry
  if ((expense.status || "").toLowerCase() === "reversed") {
    return jsonResponse({ error: "This expense entry is already reversed." }, 400);
  }

  // Parse request body for reversal reason
  let reversal_reason = "";
  try {
    const body = await request.json();
    reversal_reason = (body.reason || "").trim();
  } catch (e) {
    reversal_reason = "";
  }

  const timestamp = new Date().toISOString();

  // Update status to "reversed" and store reversal metadata in description suffix
  // We store: original status (for audit), reversal reason, reversed_by, reversed_at
  const reversalNote = `[REVERSED by ${user.name || user.user_id} on ${timestamp}${reversal_reason ? ": " + reversal_reason : ""}]`;
  const updatedDescription = expense.description
    ? `${expense.description} ${reversalNote}`
    : reversalNote;

  await env.DB.prepare(`
    UPDATE expenses
    SET status = 'reversed',
        description = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(updatedDescription, timestamp, expenseId).run();

  return jsonResponse({
    status: "success",
    message: `Expense ID ${expenseId} (${expense.expense_code}) has been reversed successfully. Original data is preserved.`,
    expense_id: expenseId,
    expense_code: expense.expense_code,
    previous_status: expense.status,
    reversed_by: user.name || user.user_id,
    reversed_at: timestamp,
    reason: reversal_reason || null
  });
}



async function ensureExpenseColumnsExist(db) {
  if (!db) return;
  const columnsToAdd = [
    // expenses table additions
    "ALTER TABLE expenses ADD COLUMN district_type TEXT",
    "ALTER TABLE expenses ADD COLUMN policy_case INTEGER",
    "ALTER TABLE expenses ADD COLUMN policy_rule_name TEXT",
    "ALTER TABLE expenses ADD COLUMN queue_job_id TEXT",
    "ALTER TABLE expenses ADD COLUMN processing_status TEXT DEFAULT 'complete'",

    // expense_itineraries table additions
    "ALTER TABLE expense_itineraries ADD COLUMN from_state TEXT",
    "ALTER TABLE expense_itineraries ADD COLUMN to_state TEXT",
    "ALTER TABLE expense_itineraries ADD COLUMN state TEXT",
    "ALTER TABLE expense_itineraries ADD COLUMN dest_state TEXT",
    "ALTER TABLE expense_itineraries ADD COLUMN from_district TEXT",
    "ALTER TABLE expense_itineraries ADD COLUMN to_district TEXT",
    "ALTER TABLE expense_itineraries ADD COLUMN sub_mode TEXT",
    "ALTER TABLE expense_itineraries ADD COLUMN sub_km REAL",
    "ALTER TABLE expense_itineraries ADD COLUMN sub_amount REAL",
    "ALTER TABLE expense_itineraries ADD COLUMN original_distance_km REAL",
    "ALTER TABLE expense_itineraries ADD COLUMN original_travel_amount REAL",
    "ALTER TABLE expense_itineraries ADD COLUMN original_sub_amount REAL",
    "ALTER TABLE expense_itineraries ADD COLUMN original_da_amount REAL",
    "ALTER TABLE expense_itineraries ADD COLUMN original_hotel_amount REAL",
    "ALTER TABLE expense_itineraries ADD COLUMN original_other_amount REAL",
    "ALTER TABLE expense_itineraries ADD COLUMN original_local_purchase REAL",
    "ALTER TABLE expense_itineraries ADD COLUMN calibration_count INTEGER",
    "ALTER TABLE expense_itineraries ADD COLUMN mobilise_count INTEGER"
  ];

  for (const sql of columnsToAdd) {
    try {
      await db.prepare(sql).run();
    } catch (_) {
      // Column already exists — ignore safely
    }
  }
}

/**
 * POST /api/expense/
 * Submit itinerary expense claim
 */
export async function handleSubmitExpense(request, env, params, query, user) {
  try {
    await ensureExpenseColumnsExist(env.DB);
  } catch (e) {
    console.warn("[handleSubmitExpense] Column check error:", e.message);
  }

  let formData = null;
  let jsonBody = null;
  let payloadStr = null;
  let editExpenseId = null;
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      jsonBody = await request.json();
      payloadStr = jsonBody.payload ? (typeof jsonBody.payload === "string" ? jsonBody.payload : JSON.stringify(jsonBody.payload)) : null;
      editExpenseId = jsonBody.edit_expense_id || null;
    } else {
      formData = await request.formData();
      payloadStr = formData.get("payload");
      editExpenseId = formData.get("edit_expense_id") || null;
    }
  } catch (e) {
    console.error("Error parsing submit expense body:", e);
    return jsonResponse({ error: "Invalid form data or request body: " + e.message }, 400);
  }

  const getFormVal = (key) => {
    if (formData && typeof formData.get === "function") return formData.get(key);
    if (jsonBody && jsonBody[key] !== undefined && jsonBody[key] !== null) return jsonBody[key];
    return null;
  };

  let date, amount, itineraries, claim_month, claim_year, description = "";
  
  if (payloadStr) {
    let payload;
    try {
      payload = typeof payloadStr === "object" ? payloadStr : JSON.parse(payloadStr);
    } catch (e) {
      return jsonResponse({ error: "Invalid payload JSON" }, 400);
    }
    date = payload.date || payload.exp_date;
    amount = payload.amount || payload.total_amount;
    itineraries = payload.itinerary_legs || payload.itineraries || [];
    claim_month = payload.claim_month;
    claim_year = payload.claim_year;
    description = payload.description || "";
    if (payload.edit_expense_id) editExpenseId = payload.edit_expense_id;
  } else {
    // Read from individual form fields sent by frontend
    date = getFormVal("exp_date");
    const rawAmt = getFormVal("total_amount");
    amount = parseFloat(rawAmt || "0.0");
    const itinerariesStr = getFormVal("itineraries");
    if (!date || !itinerariesStr) {
      return jsonResponse({ error: "exp_date and itineraries are required" }, 400);
    }
    try {
      itineraries = typeof itinerariesStr === "object" ? itinerariesStr : JSON.parse(itinerariesStr);
    } catch (e) {
      return jsonResponse({ error: "Invalid itineraries JSON" }, 400);
    }
    
    // Parse claim month and year from exp_date (format YYYY-MM-DD)
    const dt = new Date(date);
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    claim_month = months[dt.getMonth()];
    claim_year = dt.getFullYear();
    description = getFormVal("description") || "";
  }

  const rawClientTs = getFormVal("client_timestamp");
  // Prefer the client-provided timestamp so all dates come from frontend action time
  const timestamp = parseClientTimestamp(rawClientTs);

  // ─── Policy Rules Checks (Allowed Past Days & Monthly Cutoff) ─────────────────
  try {
    const settingsRows = await env.DB.prepare(
      "SELECT key, value FROM system_settings WHERE key IN ('max_past_days_limit', 'monthly_cutoff_day')"
    ).all();
    
    let maxPastDays = null;
    let monthlyCutoff = null;
    for (const r of (settingsRows.results || [])) {
      if (r.key === "max_past_days_limit") maxPastDays = parseInt(r.value, 10);
      if (r.key === "monthly_cutoff_day") monthlyCutoff = parseInt(r.value, 10);
    }

    const today = new Date();
    const expenseDateObj = new Date(date);
    const d1 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const d2 = Date.UTC(expenseDateObj.getFullYear(), expenseDateObj.getMonth(), expenseDateObj.getDate());
    const diffDays = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));

    if (d2 > d1) {
      return jsonResponse({ error: "Submission policy violation: Expense date cannot be in the future." }, 400);
    }

    if (maxPastDays !== null && maxPastDays > 0) {
      if (diffDays > maxPastDays) {
        return jsonResponse({ error: `Submission policy violation: Expense date (${date}) is older than the allowed limit of ${maxPastDays} days.` }, 400);
      }
    }

    if (monthlyCutoff !== null && monthlyCutoff > 0) {
      const currentDay = today.getDate();
      if (currentDay > monthlyCutoff) {
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed
        const expenseYear = expenseDateObj.getFullYear();
        const expenseMonth = expenseDateObj.getMonth();
        
        if (expenseYear < currentYear || (expenseYear === currentYear && expenseMonth < currentMonth)) {
          return jsonResponse({ error: `Submission policy violation: Cutoff day (${monthlyCutoff}rd/th) for previous month's expenses has passed. You cannot submit expenses for past months.` }, 400);
        }
      }
    }
  } catch (err) {
    console.error("Failed to verify submission policies:", err.message);
  }

  // Duplicate Date Check (prevent submitting twice for the same date unless rejected)
  let dupQuery = "SELECT id FROM expenses WHERE user_id = ? AND itinerary = ? AND status NOT IN ('rejected', 'returned_to_draft')";
  let dupParams = [user.id, date];
  if (editExpenseId) {
    dupQuery += " AND id != ?";
    dupParams.push(editExpenseId);
  }
  const dupResult = await runRead(env, dupQuery, dupParams, request);
  const existingDup = dupResult && dupResult.results && dupResult.results[0] ? dupResult.results[0] : null;
  if (existingDup) {
    return jsonResponse({ error: `An expense claim for ${date} has already been submitted.` }, 400);
  }

  let existingExpense = null;
  let expenseCode = null;
  let newExpId = null;

  if (editExpenseId) {
    existingExpense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ? AND user_id = ?").bind(editExpenseId, user.id).first();
    if (!existingExpense) {
      return jsonResponse({ error: "Expense claim to edit not found." }, 404);
    }
    expenseCode = existingExpense.expense_code;
    newExpId = existingExpense.id;

    // Delete old sub-entries
    const oldItis = await env.DB.prepare("SELECT itinerary_id FROM expense_itineraries WHERE exp_id = ?").bind(expenseCode).all();
    if (oldItis.results && oldItis.results.length > 0) {
      for (const r of oldItis.results) {
        const id = r.itinerary_id;
        await runWrite(env, "DELETE FROM expense_breakdown_calls WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_pms_calls WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_asset_taggings WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_asset_mobilises WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_calibrations WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_other_activities WHERE itinerary_id = ?", [id]);
      }
    }
    await runWrite(env, "DELETE FROM expense_attachments WHERE exp_id = ?", [expenseCode]);
    await runWrite(env, "DELETE FROM expense_itineraries WHERE exp_id = ?", [expenseCode]);
    await runWrite(env, "DELETE FROM approvals WHERE expense_id = ?", [newExpId]);
  } else {
    // Generate expense code RJ-MM/YY-XXXXXX
    const dt = new Date(date);
    const padTwo = (n) => String(n).padStart(2, "0");
    const monthPrefix = `${padTwo(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(-2)}`;
    
    const seqRows = await env.DB.prepare("SELECT expense_code FROM expenses WHERE expense_code LIKE ?")
      .bind(`RJ-${monthPrefix}-%`).all();
    
    let maxSeq = 0;
    if (seqRows.results && seqRows.results.length > 0) {
      for (const r of seqRows.results) {
        const parts = r.expense_code.split("-");
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
    const nextSeq = maxSeq + 1;
    expenseCode = `RJ-${monthPrefix}-${String(nextSeq).padStart(6, "0")}`;
  }

  // Defensive self-healing cleanup: delete any existing orphan entries matching expenseCode
  const oldItis = await env.DB.prepare("SELECT itinerary_id FROM expense_itineraries WHERE exp_id = ?").bind(expenseCode).all();
  if (oldItis.results && oldItis.results.length > 0) {
    for (const r of oldItis.results) {
      const id = r.itinerary_id;
      await runWrite(env, "DELETE FROM expense_breakdown_calls WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_pms_calls WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_asset_taggings WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_asset_mobilises WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_calibrations WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_other_activities WHERE itinerary_id = ?", [id]);
    }
  }
  await runWrite(env, "DELETE FROM expense_attachments WHERE exp_id = ?", [expenseCode]);
  await runWrite(env, "DELETE FROM expense_itineraries WHERE exp_id = ?", [expenseCode]);

  // ── Backend safety net: re-run base-loc policy to catch any frontend miss ──
  // Frontend should have zeroed these, but backend verifies and corrects if not.
  const { isBaseLocOnly, isDaAllowed, baseLocations, policyCase, policyRuleName } = computeBaseLocPolicy(
    user.base_reporting_location || "",
    itineraries
  );

  let totalDa = 0.0;
  let totalHotel = 0.0;
  let totalOther = 0.0;
  let totalLocalPurchase = 0.0;
  let totalAssigned = 0;
  let totalCompleted = 0;
  let totalPms = 0;
  let totalAsset = 0;
  let totalCalibration = 0;
  let totalMobilise = 0;
  let firstPurpose = "";
  const allClaimActivitiesSet = new Set();

  let newKm = 0.0;
  let newAuto = 0.0;
  let calculatedTotal = 0.0;

  const hasOutdoorLeg = itineraries.some(leg => (leg.travel_type || "").trim().toLowerCase() === "outdoor");
  const submittedDistrictType = (formData ? (formData.get("district_type") || formData.get("districtCategory") || formData.get("category")) : null) || (hasOutdoorLeg ? "OUT_DISTRICT" : "IN_DISTRICT");

  const hasActualOutDistrictTravel = itineraries.some(leg => {
    const fromD = (leg.district_from || leg.from_district || "").trim().toLowerCase();
    const toD = (leg.district || leg.to_district || "").trim().toLowerCase();
    const userD = (user.district || user.home_district || "").trim().toLowerCase();
    if (fromD && userD && fromD !== userD) return true;
    if (toD && userD && toD !== userD) return true;
    return false;
  });

  for (let idx = 0; idx < itineraries.length; idx++) {
    const iti = itineraries[idx];
    const legNum = idx + 1;
    const isCommute = !hasActualOutDistrictTravel && checkIsCommuteLeg(iti, baseLocations, idx, itineraries.length);
    const travelAmt = isCommute ? 0.0 : parseFloat(iti.amount || "0.0");
    const subAmt    = isCommute ? 0.0 : parseFloat(iti.sub_amount || "0.0");
    const daAmt     = isDaAllowed ? parseFloat(iti.da || "0.0") : 0.0;
    const hotelAmt = parseFloat(iti.hotel || "0.0");
    const otherAmt = parseFloat(iti.oth_amount || "0.0");
    const lpAmt = parseFloat(iti.local_purchase || "0.0");

    // ── Server-side mandatory bill attachment validations ──
    const modeLower = (iti.mode || "").trim().toLowerCase();
    const mainBillFile = formData ? formData.get(`main_bill_${legNum}`) : null;
    const hasMainBillUpload = mainBillFile && typeof mainBillFile === "object" && mainBillFile.name;
    let hasMainAttachment = hasMainBillUpload;
    if (editExpenseId && !hasMainAttachment) {
      const existingAtt = await env.DB.prepare(
        "SELECT id FROM expense_attachments WHERE exp_id = ? AND itinerary_id = ?"
      ).bind(expenseCode, `${expenseCode}-${legNum}`).first();
      if (existingAtt) hasMainAttachment = true;
    }

    if (modeLower === "train" && travelAmt >= 1 && !hasMainAttachment) {
      return jsonResponse({ error: `Validation Error (Visit ${legNum}): Train ticket upload is mandatory for Train travel (Fare: ₹${travelAmt}).` }, 400);
    }
    if (modeLower !== "bike" && modeLower !== "car" && modeLower !== "train" && travelAmt >= 300 && !hasMainAttachment) {
      return jsonResponse({ error: `Validation Error (Visit ${legNum}): Ticket/receipt upload is mandatory for ${iti.mode} travel when fare is ₹300 or more (Fare: ₹${travelAmt}).` }, 400);
    }

    if (iti.sub_mode) {
      const subModeLower = (iti.sub_mode || "").trim().toLowerCase();
      const subBillFile = formData ? formData.get(`sub_bill_${legNum}`) : null;
      const hasSubBillUpload = subBillFile && typeof subBillFile === "object" && subBillFile.name;
      let hasSubAttachment = hasSubBillUpload;
      if (editExpenseId && !hasSubAttachment) {
        const existingSubAtt = await env.DB.prepare(
          "SELECT id FROM expense_attachments WHERE exp_id = ? AND itinerary_id = ? AND bill_type = ?"
        ).bind(expenseCode, `${expenseCode}-${legNum}`, iti.sub_mode).first();
        if (existingSubAtt) hasSubAttachment = true;
      }

      if (subModeLower === "train" && subAmt >= 1 && !hasSubAttachment) {
        return jsonResponse({ error: `Validation Error (Visit ${legNum}): Sub-connection Train ticket upload is mandatory (Fare: ₹${subAmt}).` }, 400);
      }
      if (subModeLower !== "bike" && subModeLower !== "car" && subModeLower !== "train" && subAmt >= 300 && !hasSubAttachment) {
        return jsonResponse({ error: `Validation Error (Visit ${legNum}): Sub-connection receipt is mandatory for ${iti.sub_mode} travel when fare is ₹300 or more (Fare: ₹${subAmt}).` }, 400);
      }
    }

    if (legNum === 1) {
      if (hotelAmt >= 1) {
        const hotelBillFile = formData ? formData.get("hotel_bill_1") : null;
        const hasHotelUpload = hotelBillFile && typeof hotelBillFile === "object" && hotelBillFile.name;
        let hasHotelAttachment = hasHotelUpload;
        if (editExpenseId && !hasHotelAttachment) {
          const existingHotel = await env.DB.prepare(
            "SELECT id FROM expense_attachments WHERE exp_id = ? AND bill_type = 'Hotel'"
          ).bind(expenseCode).first();
          if (existingHotel) hasHotelAttachment = true;
        }
        if (!hasHotelAttachment) {
          return jsonResponse({ error: `Validation Error (Visit 1): Hotel stay receipt is mandatory for hotel expenses (Amount: ₹${hotelAmt}).` }, 400);
        }
      }

      if (lpAmt >= 300) {
        const lpBillFile = formData ? formData.get("local_purchase_bill_1") : null;
        const hasLpUpload = lpBillFile && typeof lpBillFile === "object" && lpBillFile.name;
        let hasLpAttachment = hasLpUpload;
        if (editExpenseId && !hasLpAttachment) {
          const existingLp = await env.DB.prepare(
            "SELECT id FROM expense_attachments WHERE exp_id = ? AND bill_type = 'Local_Purchase'"
          ).bind(expenseCode).first();
          if (existingLp) hasLpAttachment = true;
        }
        if (!hasLpAttachment) {
          return jsonResponse({ error: `Validation Error (Visit 1): Local Purchase receipt is mandatory when amount is ₹300 or more (Amount: ₹${lpAmt}).` }, 400);
        }
      }
    }

    if (iti.oth_desc && iti.oth_desc.trim() && otherAmt >= 300) {
      const othBillFile = formData ? formData.get(`oth_bill_${legNum}`) : null;
      const hasOthUpload = othBillFile && typeof othBillFile === "object" && othBillFile.name;
      let hasOthAttachment = hasOthUpload;
      if (editExpenseId && !hasOthAttachment) {
        const existingOth = await env.DB.prepare(
          "SELECT id FROM expense_attachments WHERE exp_id = ? AND itinerary_id = ? AND bill_type = 'Other_Expense'"
        ).bind(expenseCode, `${expenseCode}-${legNum}`).first();
        if (existingOth) hasOthAttachment = true;
      }
      if (!hasOthAttachment) {
        return jsonResponse({ error: `Validation Error (Visit ${legNum}): Receipt for other expense "${iti.oth_desc}" is mandatory when amount is ₹300 or more (Amount: ₹${otherAmt}).` }, 400);
      }
    }

    // ── Calls Service Report Validation (Compulsory for all Calls) ──
    if (iti.activity_details) {
      try {
        const act = typeof iti.activity_details === "string" ? JSON.parse(iti.activity_details) : iti.activity_details;
        const selectedActs = act?.selected_activities || [];
        if (selectedActs.includes("Calls")) {
          const callsList = act?.calls_list || [];
          if (callsList.length === 0) {
            return jsonResponse({ error: `Validation Error (Visit ${legNum}): Calls activity selected but no call entries were added.` }, 400);
          }
          const missingPhoto = callsList.filter(c => !c.photo_url || !c.photo_url.trim());
          if (missingPhoto.length > 0) {
            return jsonResponse({ error: `Validation Error (Visit ${legNum}): Service Report photo is compulsory for all Calls. ${missingPhoto.length} call entry(s) are missing a Service Report photo.` }, 400);
          }
        }
      } catch (e) {}
    }

    totalDa += daAmt;
    totalHotel += hotelAmt;
    totalOther += otherAmt;
    totalLocalPurchase += lpAmt;

    calculatedTotal += travelAmt + subAmt + daAmt + hotelAmt + otherAmt + lpAmt;

    const mode = (iti.mode || "").trim().toLowerCase();
    if (["bike", "car"].includes(mode)) {
      newKm += parseFloat(iti.km || "0.0");
    } else if (mode === "auto") {
      newAuto += travelAmt;
    }

    const subMode = (iti.sub_mode || "").trim().toLowerCase();
    if (subMode === "auto") {
      newAuto += subAmt;
    }

    let actDetails = null;
    if (iti.activity_details) {
      try {
        actDetails = typeof iti.activity_details === "string" ? JSON.parse(iti.activity_details) : iti.activity_details;
      } catch (e) {}
    }

    let itiAssigned = 0;
    let itiCompleted = 0;
    let itiPms = 0;
    let itiAsset = 0;
    let itiCalibration = parseInt(iti.calibration_count || "0", 10) || 0;
    let itiMobilise = parseInt(iti.mobilise_asset_count || "0", 10) || 0;

    const sanitizedActs = [];

    if (actDetails) {
      const selectedActs = Array.isArray(actDetails.selected_activities) ? actDetails.selected_activities : [];
      const callsList = Array.isArray(actDetails.calls_list) ? actDetails.calls_list : [];
      const pmsList = Array.isArray(actDetails.pms_list) ? actDetails.pms_list : [];
      const assetsList = Array.isArray(actDetails.assets_list) ? actDetails.assets_list : [];

      const validCallsList = callsList.filter(c => c && c.barcode && String(c.barcode).trim() !== "");
      if (validCallsList.length > 0) {
        itiCompleted = validCallsList.length;
        itiAssigned = validCallsList.length;
        sanitizedActs.push("Calls");
      } else {
        itiCompleted = 0;
        itiAssigned = 0;
      }

      if (pmsList.length > 0) {
        itiPms = pmsList.filter(p => p.barcode || p.status === "Close" || p.status === "Attended").length;
        if (itiPms > 0 || pmsList.length > 0) sanitizedActs.push("PMS");
      }

      if (assetsList.length > 0) {
        itiAsset = assetsList.reduce((sum, item) => sum + (parseInt(item.quantity || "0", 10) || 0), 0);
        if (itiAsset > 0 || assetsList.length > 0) sanitizedActs.push("Asset Tagging");
      }

      if (itiCalibration > 0) sanitizedActs.push("Calibration");
      if (itiMobilise > 0) sanitizedActs.push("Mobilisation");

      if (selectedActs.includes("Other") || (actDetails.activity_other_desc && actDetails.activity_other_desc.trim())) {
        sanitizedActs.push("Other");
      }

      actDetails.selected_activities = sanitizedActs;
      if (typeof iti.activity_details === "object") {
        iti.activity_details = actDetails;
      } else {
        iti.activity_details = JSON.stringify(actDetails);
      }
    } else {
      if (iti.oth_desc && iti.oth_desc.trim()) sanitizedActs.push("Other");
    }

    const cleanPurpose = sanitizedActs.length > 0 ? `Activities: ${sanitizedActs.join(", ")}` : (iti.visit_purpose && !iti.visit_purpose.startsWith("Activities:") ? iti.visit_purpose : "Field visit");
    iti.visit_purpose = cleanPurpose;
    if (idx === 0 && !firstPurpose) firstPurpose = cleanPurpose;

    sanitizedActs.forEach(act => allClaimActivitiesSet.add(act));

    totalAssigned += itiAssigned;
    totalCompleted += itiCompleted;
    totalPms += itiPms;
    totalAsset += itiAsset;
    totalCalibration += itiCalibration;
    totalMobilise += itiMobilise;
  }

  const actOrder = ["Calls", "PMS", "Asset Tagging", "Calibration", "Mobilise Asset Update", "Other"];
  const sortedClaimActs = Array.from(allClaimActivitiesSet).sort((a, b) => {
    let idxA = actOrder.findIndex(o => a.toLowerCase().includes(o.toLowerCase()));
    let idxB = actOrder.findIndex(o => b.toLowerCase().includes(o.toLowerCase()));
    if (idxA === -1) idxA = 99;
    if (idxB === -1) idxB = 99;
    return idxA - idxB;
  });
  if (sortedClaimActs.length > 0) {
    firstPurpose = `Activities: ${sortedClaimActs.join(", ")}`;
  }

  // ₹0 expenses are allowed (e.g. base-location-only travel where all TA/DA was waived on frontend)
  amount = calculatedTotal;

  // Backend Limit Validation
  const gradeToLookup = (user.designation || "").toLowerCase().includes("specialist") ? "O1" : user.grade;
  const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
  const maxKmPerMonth = allowance?.max_km_per_month ?? 2000;
  const maxAutoPerMonth = 1000;

  // Format month string YYYY-MM
  const mIdx = MONTH_NAMES.indexOf(claim_month);
  const mmNum = String(mIdx !== -1 ? mIdx + 1 : 1).padStart(2, "0");
  const monthStr = `${claim_year}-${mmNum}`;

  const limits = await env.DB.prepare(`
    SELECT 
      SUM(CASE WHEN request_type = 'KM' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_km,
      SUM(CASE WHEN request_type = 'AUTO' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_auto
    FROM limit_approval_requests
    WHERE user_id = ? AND LOWER(status) = 'approved' AND for_month = ?
  `).bind(user.user_id, monthStr).first();

  const approvedKm = limits?.approved_km || 0.0;
  const approvedAuto = limits?.approved_auto || 0.0;

  let statsQuery = `
    SELECT 
      SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) IN ('bike', 'car') THEN COALESCE(i.distance_km, 0.0) ELSE 0.0 END) as total_km,
      SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) = 'auto' THEN COALESCE(i.travel_amount, 0.0) ELSE 0.0 END) +
      SUM(CASE WHEN LOWER(TRIM(i.sub_mode)) = 'auto' THEN COALESCE(i.sub_amount, 0.0) ELSE 0.0 END) as total_auto
    FROM expense_itineraries i
    JOIN expenses e ON i.exp_id = e.expense_code
    WHERE e.user_id = ? AND e.month = ? AND e.year = ? AND e.status NOT IN ('rejected', 'returned_to_draft')
  `;
  const statsBinds = [user.id, claim_month, claim_year];
  if (editExpenseId) {
    statsQuery += " AND e.id != ?";
    statsBinds.push(editExpenseId);
  }
  const statsRes = await env.DB.prepare(statsQuery).bind(...statsBinds).first();

  const accumulatedKm = statsRes?.total_km || 0.0;
  const accumulatedAuto = statsRes?.total_auto || 0.0;

  if ((accumulatedKm + newKm) > (maxKmPerMonth + approvedKm)) {
    return jsonResponse({
      error: `KM Limit Exceeded! Monthly allowance is ${maxKmPerMonth} KM. Approved extension: ${approvedKm} KM. Already claimed: ${accumulatedKm.toFixed(1)} KM. Attempted: +${newKm.toFixed(1)} KM. Total: ${(accumulatedKm + newKm).toFixed(1)} KM. Please request a limit extension first.`
    }, 400);
  }

  if ((accumulatedAuto + newAuto) > (maxAutoPerMonth + approvedAuto)) {
    return jsonResponse({
      error: `Auto Expense Limit Exceeded! Monthly allowance is ₹${maxAutoPerMonth}. Approved extension: ₹${approvedAuto}. Already claimed: ₹${accumulatedAuto.toFixed(1)}. Attempted: +₹${newAuto.toFixed(1)}. Total: ₹${(accumulatedAuto + newAuto).toFixed(1)}. Please request a limit extension first.`
    }, 400);
  }

  const majorMode = itineraries[0]?.mode || "Other";
  firstPurpose = firstPurpose || itineraries[0]?.visit_purpose || "Field visit";

  // Create approvals level sequence
  const approvalChain = await env.DB.prepare(`
    SELECT DISTINCT a.level_number, a.approver_id, a.hierarchy_id
    FROM hierarchy_approvers a
    JOIN hierarchy_requesters hr ON a.hierarchy_id = hr.hierarchy_id
    WHERE hr.user_id = ? OR hr.user_id = ? OR CAST(hr.user_id AS TEXT) = ?
    ORDER BY a.level_number ASC
  `).bind(user.id, user.user_id || "", String(user.id)).all();

  let status = "approved";
  let approvalsToInsert = [];

  // ₹0 amount expenses (e.g. base-location-only commute) are auto-approved — no approval chain needed
  if (amount <= 0) {
    status = "approved";
    approvalsToInsert = [];
  } else if (approvalChain.results && approvalChain.results.length > 0) {
    status = "submitted";
    const seenLevels = new Set();
    for (const step of approvalChain.results) {
      if (!seenLevels.has(step.level_number)) {
        seenLevels.add(step.level_number);
        approvalsToInsert.push({
          approver_id: step.approver_id,
          level_number: step.level_number,
          status: step.level_number === 1 ? "pending" : "waiting"
        });
      }
    }
  } else {
    if ((user.role || "").trim().toLowerCase() !== "admin") {
      return jsonResponse({ error: "You are not assigned to any approval hierarchy team. Please contact the administrator." }, 400);
    }
  }

  // ── FIX #2: Format Validation & Collect All Files to Upload BEFORE DB Write ──
  const filesToUpload = [];
  const validateAndAddFile = (fileKey, billType, legNum) => {
    const file = formData ? formData.get(fileKey) : null;
    if (file && typeof file === "object" && file.name) {
      const filenameLower = (file.name || "").toLowerCase();
      const typeLower = (file.type || "").toLowerCase();
      
      // FIX #2: Explicitly reject PDF files
      if (filenameLower.endsWith(".pdf") || typeLower.includes("pdf")) {
        return `PDF allowed nahi hai, sirf image (JPG/PNG/HEIC) upload karein. (Visit ${legNum} ${billType})`;
      }
      
      // Must be an image file (including HEIC/HEIF)
      if (typeLower && !typeLower.startsWith("image/") && !/\.(jpg|jpeg|png|webp|heic|heif|bmp)$/i.test(filenameLower)) {
        return `Invalid file format for Visit ${legNum} (${billType}). Sirf image (JPG/PNG/HEIC) upload karein.`;
      }

      filesToUpload.push({ fileKey, file, billType, legNum });
    }
    return null;
  };

  // Collect and validate all attachment files per leg
  for (let idx = 0; idx < itineraries.length; idx++) {
    const iti = itineraries[idx];
    const legNum = parseInt(iti.leg || (idx + 1), 10);

    let err = validateAndAddFile(`main_bill_${legNum}`, iti.mode || "Bill", legNum);
    if (err) return jsonResponse({ error: err }, 400);

    if (iti.sub_mode) {
      err = validateAndAddFile(`sub_bill_${legNum}`, iti.sub_mode, legNum);
      if (err) return jsonResponse({ error: err }, 400);
    }

    err = validateAndAddFile(`comm_mail_${legNum}`, "Communication_Mail", legNum);
    if (err) return jsonResponse({ error: err }, 400);

    err = validateAndAddFile(`oth_bill_${legNum}`, "Other", legNum);
    if (err) return jsonResponse({ error: err }, 400);

    if (legNum === 1) {
      err = validateAndAddFile("hotel_bill_1", "Hotel", 1);
      if (err) return jsonResponse({ error: err }, 400);

      err = validateAndAddFile("local_purchase_bill_1", "Local_Purchase", 1);
      if (err) return jsonResponse({ error: err }, 400);
    }
  }

  // ── FIX #1: UPLOAD-FIRST PATTERN — Upload all files BEFORE DB insertion ──
  const uploadedAttachments = [];
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const yearVal = now.getFullYear();
  const folderName = `${monthName}_${yearVal}`;

  for (const item of filesToUpload) {
    const isItemHeic = item.file.name?.toLowerCase().endsWith(".heic") || item.file.name?.toLowerCase().endsWith(".heif") || item.file.type?.includes("heic") || item.file.type?.includes("heif");
    
    let ext = ".jpg";
    let mimeType = "image/jpeg";
    if (isItemHeic) {
      ext = item.file.name?.toLowerCase().endsWith(".heif") ? ".heif" : ".heic";
      mimeType = item.file.type?.includes("heif") ? "image/heif" : "image/heic";
    }

    const filename = `${expenseCode}_leg${item.legNum}_${item.billType}_${Date.now()}${ext}`;
    
    let fileUrl = "";
    try {
      fileUrl = await uploadFileWithFallback(env, item.file, folderName, filename, mimeType);
    } catch (err) {
      console.error(`Failed to upload ${item.fileKey}:`, err);
      // FIX #1: Explicit HTTP 400/500 response — NO SILENT RETURN
      return jsonResponse({
        error: `File upload failed for Visit ${item.legNum} (${item.billType}). Detail: ${err.message || err}`
      }, 400);
    }

    uploadedAttachments.push({
      exp_id: expenseCode,
      itinerary_id: `${expenseCode}-${item.legNum}`,
      bill_type: item.billType,
      file_url: fileUrl
    });
  }

  // ── FIX #4: DB BATCH TRANSACTION — Single Atomic Write Transaction for All DB Tables ──
  const dbBatchStatements = [];

  if (existingExpense) {
    dbBatchStatements.push({
      sql: `
        UPDATE expenses 
        SET month = ?, year = ?, amount = ?, status = ?, travel_mode = ?, itinerary = ?, description = ?,
            da_amount = ?, hotel_amount = ?, other_expense_amount = ?, calls_assigned = ?, calls_completed = ?, 
            pms_count = ?, asset_tagging = ?, local_purchase_amount = ?, original_amount = ?, original_da_amount = ?, 
            original_hotel_amount = ?, original_other_expense_amount = ?, original_local_purchase_amount = ?, 
            calibration_count = ?, mobilise_count = ?, updated_at = ?, district_type = ?,
            policy_case = ?, policy_rule_name = ?
        WHERE id = ?
      `,
      params: [
        claim_month, claim_year, amount, status, majorMode, date, firstPurpose,
        totalDa, totalHotel, totalOther, totalAssigned, totalCompleted, totalPms,
        totalAsset, totalLocalPurchase, amount, totalDa, totalHotel, 
        totalOther, totalLocalPurchase, totalCalibration, totalMobilise,
        timestamp, submittedDistrictType, policyCase, policyRuleName, newExpId
      ]
    });
  } else {
    dbBatchStatements.push({
      sql: `
        INSERT INTO expenses (
          user_id, month, year, amount, status, travel_mode, itinerary, description, expense_code, 
          da_amount, hotel_amount, other_expense_amount, calls_assigned, calls_completed, pms_count, 
          asset_tagging, local_purchase_amount, original_amount, original_da_amount, original_hotel_amount, 
          original_other_expense_amount, original_local_purchase_amount, calibration_count, mobilise_count, 
          created_at, updated_at, district_type, policy_case, policy_rule_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        user.id, claim_month, claim_year, amount, status, majorMode, date, firstPurpose, expenseCode,
        totalDa, totalHotel, totalOther, totalAssigned, totalCompleted, totalPms,
        totalAsset, totalLocalPurchase, amount, totalDa, totalHotel, 
        totalOther, totalLocalPurchase, totalCalibration, totalMobilise,
        timestamp, timestamp, submittedDistrictType, policyCase, policyRuleName
      ]
    });
  }

  // Insert itinerary legs and process details in batch
  for (let idx = 0; idx < itineraries.length; idx++) {
    const iti = itineraries[idx];
    const legNum = parseInt(iti.leg || (idx + 1), 10);
    const itiId = `${expenseCode}-${legNum}`;
    const fromDist = iti.district_from || iti.from_district || user.district || user.base_reporting_location || "—";
    const toDist = iti.district || iti.to_district || user.district || user.base_reporting_location || "—";
    const fromSt = iti.state || iti.from_state || user.state || "Rajasthan";
    const toSt = iti.dest_state || iti.to_state || (iti.travel_type === "Out of State" ? "Gujarat" : (user.state || "Rajasthan"));
    const fromLoc = iti.from || iti.from_location || fromDist;
    const toLoc = iti.to || iti.to_location || toDist;
    const isCommute = !hasOutdoorLeg && checkIsCommuteLeg(iti, baseLocations, idx, itineraries.length);
    
    let itiAssigned = 0;
    let itiCompleted = 0;
    let itiPms = 0;
    let itiAsset = 0;
    let actDetails = null;

    if (iti.activity_details) {
      try {
        actDetails = typeof iti.activity_details === "string" ? JSON.parse(iti.activity_details) : iti.activity_details;
      } catch (e) {}
    }

    if (actDetails) {
      const callsList = Array.isArray(actDetails.calls_list) ? actDetails.calls_list : [];
      const pmsList = Array.isArray(actDetails.pms_list) ? actDetails.pms_list : [];
      const assetsList = Array.isArray(actDetails.assets_list) ? actDetails.assets_list : [];

      if (callsList.length > 0) {
        itiCompleted = callsList.filter(c => c.barcode || c.status === "Close" || c.status === "Attend & Close").length;
        itiAssigned = callsList.length;
        if (itiAssigned < itiCompleted) itiAssigned = itiCompleted;
      }
      if (pmsList.length > 0) {
        itiPms = pmsList.filter(p => p.barcode || p.status === "Verified Inventory" || p.verified).length;
      }
      if (assetsList.length > 0) {
        itiAsset = assetsList.length;
      }
    }

    const cleanPurpose = iti.visit_purpose || "Field visit";

    dbBatchStatements.push({
      sql: `
        INSERT INTO expense_itineraries (
          itinerary_id, exp_id, leg_number, from_district, to_district, from_state, to_state, state, dest_state, from_location, to_location, 
          travel_mode, distance_km, travel_amount, sub_mode, sub_km, sub_amount, da_amount, hotel_amount, 
          local_purchase, local_purchase_remark, other_desc, other_amount, calls_assigned, calls_completed, pms_count, asset_tagging, visit_purpose, 
          activity_details, original_distance_km, original_travel_amount, original_sub_amount, original_da_amount, 
          original_hotel_amount, original_other_amount, original_local_purchase, calibration_count, mobilise_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        itiId, expenseCode, legNum, fromDist, toDist, fromSt, toSt, fromSt, toSt, fromLoc, toLoc,
        iti.mode || "Bike", parseFloat(iti.km || "0.0"),
        isCommute ? 0.0 : parseFloat(iti.amount || "0.0"),
        iti.sub_mode || null,
        isCommute ? 0.0 : parseFloat(iti.sub_amount || "0.0"),
        isDaAllowed ? parseFloat(iti.da || "0.0") : 0.0,
        parseFloat(iti.hotel || "0.0"), parseFloat(iti.local_purchase || "0.0"), iti.local_purchase_remark || iti.local_purchase_desc || null, iti.oth_desc || null, parseFloat(iti.oth_amount || "0.0"),
        itiAssigned, itiCompleted,
        itiPms, itiAsset,
        cleanPurpose,
        typeof iti.activity_details === "string" ? iti.activity_details : JSON.stringify(iti.activity_details || {}),
        parseFloat(iti.km || "0.0"),
        isCommute ? 0.0 : parseFloat(iti.amount || "0.0"),
        isCommute ? 0.0 : parseFloat(iti.sub_amount || "0.0"),
        isDaAllowed ? parseFloat(iti.da || "0.0") : 0.0, parseFloat(iti.hotel || "0.0"), parseFloat(iti.oth_amount || "0.0"),
        parseFloat(iti.local_purchase || "0.0"), parseInt(iti.calibration_count || "0", 10),
        parseInt(iti.mobilise_asset_count || "0", 10)
      ]
    });

    if (actDetails) {
      const selectedActs = actDetails.selected_activities || [];
      
      if (selectedActs.includes("Calls")) {
        for (const call of actDetails.calls_list || []) {
          if (!call || !call.barcode || !String(call.barcode).trim()) continue;
          const asset = call.asset_details || {};
          dbBatchStatements.push({
            sql: `
              INSERT INTO expense_breakdown_calls (
                itinerary_id, barcode, call_type, call_status, district_name, hospital_name, 
                equipment_name, model_name, inventory_status, photo_url
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            params: [
              itiId, call.barcode || null, call.type || null, call.status || null, asset.district_name || null, asset.hospital_name || null,
              asset.equipment_name || null, asset.model_name || null, asset.inventory_status || null, call.photo_url || ""
            ]
          });
        }
      }

      if (selectedActs.includes("PMS")) {
        for (const pms of actDetails.pms_list || []) {
          const asset = pms.asset_details || {};
          dbBatchStatements.push({
            sql: `
              INSERT INTO expense_pms_calls (
                itinerary_id, barcode, pms_frequency, district_name, hospital_name, 
                equipment_name, model_name, inventory_status, photo_url
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            params: [
              itiId, pms.barcode || null, pms.frequency || null, asset.district_name || null, asset.hospital_name || null,
              asset.equipment_name || null, asset.model_name || null, asset.inventory_status || null, pms.photo_url || ""
            ]
          });
        }
      }

      if (selectedActs.includes("Asset Tagging")) {
        for (const asset of actDetails.assets_list || []) {
          dbBatchStatements.push({
            sql: `
              INSERT INTO expense_asset_taggings (itinerary_id, equipment_name, quantity)
              VALUES (?, ?, ?)
            `,
            params: [itiId, asset.equipment_name || null, parseInt(asset.quantity || "0", 10)]
          });
        }
      }

      if (selectedActs.includes("Mobilise Asset Update")) {
        const qty = parseInt(actDetails.mobilise_asset_count || "0", 10);
        if (qty > 0) {
          dbBatchStatements.push({
            sql: `
              INSERT INTO expense_asset_mobilises (itinerary_id, quantity)
              VALUES (?, ?)
            `,
            params: [itiId, qty]
          });
        }
      }

      if (selectedActs.includes("Calibration")) {
        const qty = parseInt(actDetails.calibration_count || "0", 10);
        if (qty > 0) {
          dbBatchStatements.push({
            sql: `
              INSERT INTO expense_calibrations (itinerary_id, quantity)
              VALUES (?, ?)
            `,
            params: [itiId, qty]
          });
        }
      }

      if (selectedActs.includes("Other")) {
        const otherDesc = actDetails.activity_other_desc || "";
        if (otherDesc && otherDesc.trim()) {
          dbBatchStatements.push({
            sql: `
              INSERT INTO expense_other_activities (itinerary_id, description)
              VALUES (?, ?)
            `,
            params: [itiId, otherDesc.trim()]
          });
        }
      }
    }
  }

  // Insert all successfully uploaded attachments into batch
  for (const att of uploadedAttachments) {
    dbBatchStatements.push({
      sql: `
        INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url)
        VALUES (?, ?, ?, ?)
      `,
      params: [att.exp_id, att.itinerary_id, att.bill_type, att.file_url]
    });
  }

  // Execute ALL DB statements in a SINGLE ATOMIC TRANSACTION
  const batchResults = await runBatchWrite(env, dbBatchStatements);

  // ── BUG 1 FIX: Capture auto-increment ID for NEW expense inserts ──
  // For edits, newExpId was already set from existingExpense.id (line 2199).
  // For new inserts, the expense INSERT is the first statement in dbBatchStatements,
  // so batchResults[0].meta.last_row_id gives the new row's integer primary key.
  if (!existingExpense) {
    const firstResult = batchResults && batchResults[0];
    newExpId = firstResult?.meta?.last_row_id ?? firstResult?.lastRowId ?? null;
    if (!newExpId) {
      console.error("BUG1: Could not resolve newExpId after expense INSERT. batchResults[0]=", JSON.stringify(firstResult));
      return jsonResponse({ error: "Expense saved but approval routing failed (could not resolve expense ID). Please contact admin." }, 500);
    }
  }

  // ── FIX: Delete any existing approval records for this expense before inserting new chain ──
  await runWrite(env, "DELETE FROM approvals WHERE expense_id = ?", [newExpId]);

  // Create approvals level sequence records
  for (const step of approvalsToInsert) {
    await runWrite(env, `
      INSERT INTO approvals (expense_id, approver_id, level_number, status, comments, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', ?, ?)
    `, [newExpId, step.approver_id, step.level_number, step.status, timestamp, timestamp]);

    if (step.status === "pending") {
      const approverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(step.approver_id).first();
      if (approverUser) {
        await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '📥 New Claim for Approval', ?, 'warning', 0, '/approval-center', ?)", [
          approverUser.user_id, `${user.name} submitted a new claim ${expenseCode} (₹${amount}) for your review.`, timestamp
        ]);
      }
    }
  }

  // Note: base location policy deductions are applied by the frontend before submission.
  // The backend saves exactly what the frontend sends — no server-side policy override needed here.

  let policyApplied = false;
  const deductionItems = [];
  if (isBaseLocOnly) {
    for (let idx = 0; idx < itineraries.length; idx++) {
      const iti = itineraries[idx];
      const legNum = idx + 1;
      const isCommute = checkIsCommuteLeg(iti, baseLocations, idx, itineraries.length);
      const origTA = parseFloat(iti.original_travel_amount || iti.amount || "0.0");
      const origSub = parseFloat(iti.original_sub_amount || iti.sub_amount || "0.0");
      const origDA = legNum === 1 ? parseFloat(iti.original_da_amount || iti.da || "0.0") : 0.0;

      const taDeducted = isCommute ? (origTA + origSub) : 0.0;
      const daDeducted = isDaAllowed ? 0.0 : origDA;

      if (taDeducted > 0.0 || daDeducted > 0.0) {
        policyApplied = true;
        deductionItems.push({
          leg: legNum,
          from: iti.from || "",
          to: iti.to || "",
          taDeducted,
          daDeducted
        });
      }
    }
  }

  // Record structured deduction audit trail in expense_deductions table
  if (env.DB && deductionItems.length > 0) {
    for (const item of deductionItems) {
      if (item.taDeducted > 0) {
        runWrite(env, `
          INSERT INTO expense_deductions (
            expense_id, expense_code, user_id, rule_case, rule_name, category,
            original_amt, deducted_amt, approved_amt, reason, applied_by, itinerary_id, leg_number, created_at
          ) VALUES (?, ?, ?, ?, ?, 'TA', ?, ?, 0.0, ?, 'system', ?, ?, ?)
        `, [
          newExpId, expenseCode, user.user_id, policyCase, policyRuleName,
          item.taDeducted, item.taDeducted,
          `Commute TA not eligible under ${policyRuleName}`,
          `${expenseCode}-${item.leg}`, item.leg, timestamp
        ]).catch(err => console.error("Error saving TA deduction audit:", err.message));
      }
      if (item.daDeducted > 0) {
        runWrite(env, `
          INSERT INTO expense_deductions (
            expense_id, expense_code, user_id, rule_case, rule_name, category,
            original_amt, deducted_amt, approved_amt, reason, applied_by, itinerary_id, leg_number, created_at
          ) VALUES (?, ?, ?, ?, ?, 'DA', ?, ?, 0.0, ?, 'system', ?, ?, ?)
        `, [
          newExpId, expenseCode, user.user_id, policyCase, policyRuleName,
          item.daDeducted, item.daDeducted,
          `Daily Allowance not applicable at base location under ${policyRuleName}`,
          `${expenseCode}-${item.leg}`, item.leg, timestamp
        ]).catch(err => console.error("Error saving DA deduction audit:", err.message));
      }
    }
  }

  const successMsg = amount <= 0
    ? (policyApplied
        ? "Your claim has been auto-approved since the total reimbursable amount is ₹0 after policy deductions. No manager approval is required."
        : "Your claim has been auto-approved since the total reimbursable amount is ₹0. No manager approval is required.")
    : "Expense claim submitted successfully.";

  return jsonResponse({
    status: "success",
    message: successMsg,
    expense_id: newExpId,
    expense_code: expenseCode,
    auto_approved: amount <= 0,
    deductions: policyApplied ? {
      policyMessage: isBaseLocOnly
        ? (!isDaAllowed
            ? "Under base location policy, both Travel Allowance (TA) and Daily Allowance (DA) are not eligible."
            : "Under base location policy, Travel Allowance (TA) is not eligible.")
        : "",
      items: deductionItems
    } : null
  });
}

/**
 * POST /api/expense/evaluate-policy
 * Evaluates base location policy deductions for a claim before submission.
 */
export async function handleEvaluatePolicy(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const targetUserId = body.user_id || user.user_id;
  const itineraries = body.itinerary_legs || body.itineraries || [];

  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ? OR id = ?")
    .bind(targetUserId, targetUserId).first();

  if (!targetUser) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  const baseReportingLocation = targetUser.base_reporting_location || "";
  const { isBaseLocOnly, isDaAllowed, baseLocations } = computeBaseLocPolicy(baseReportingLocation, itineraries);

  let policyApplied = false;
  const deductionItems = [];
  let totalTA = 0;
  let totalDA = 0;

  if (isBaseLocOnly) {
    for (let idx = 0; idx < itineraries.length; idx++) {
      const iti = itineraries[idx];
      const legNum = idx + 1;
      const isCommute = checkIsCommuteLeg(iti, baseLocations, idx, itineraries.length);
      const origTA = parseFloat(iti.original_travel_amount || iti.amount || "0.0");
      const origSub = parseFloat(iti.original_sub_amount || iti.sub_amount || "0.0");
      const origDA = legNum === 1 ? parseFloat(iti.original_da_amount || iti.da || "0.0") : 0.0;

      const taDeducted = isCommute ? (origTA + origSub) : 0.0;
      const daDeducted = isDaAllowed ? 0.0 : origDA;

      if (taDeducted > 0.0 || daDeducted > 0.0) {
        policyApplied = true;
        totalTA += taDeducted;
        totalDA += daDeducted;
        deductionItems.push({
          leg: legNum,
          from: iti.from || "",
          to: iti.to || "",
          taDeducted,
          daDeducted
        });
      }
    }
  }

  const policyMsg = isBaseLocOnly
    ? (!isDaAllowed
        ? "Under base location policy, both Travel Allowance (TA) and Daily Allowance (DA) are not eligible."
        : "Under base location policy, Travel Allowance (TA) is not eligible.")
    : "";

  return jsonResponse({
    success: true,
    hasDeductions: policyApplied,
    policyMessage: policyMsg,
    items: deductionItems,
    totalTA,
    totalDA,
    totalDeducted: totalTA + totalDA
  });
}

/**
 * POST /api/expense/retroactive-policy-check
 * Called by admin panel when base_reporting_location is assigned/changed for a user.
 * Re-evaluates all current-month non-rejected expenses for that user and corrects
 * travel_amount and da_amount according to the base location policy.
 */
export async function handleRetroactiveBasePolicyCheck(request, env, params, query, adminUser) {
  const body = await request.json().catch(() => ({}));
  const targetUserId = body.user_id;
  const baseReportingLocation = body.base_reporting_location || "";

  if (!targetUserId) {
    return jsonResponse({ error: "user_id is required" }, 400);
  }

  const timestamp = new Date().toISOString();
  const today = new Date();
  const currentMonth = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"][today.getMonth()];
  const currentYear = today.getFullYear();

  // Fetch target user record
  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ? OR id = ?")
    .bind(targetUserId, parseInt(targetUserId, 10) || 0).first().catch(() => null);
  if (!targetUser) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  // Fetch all active (non-rejected, non-draft) expenses for this user in current month
  const activeExpenses = await env.DB.prepare(`
    SELECT id, expense_code, itinerary, amount, original_amount
    FROM expenses
    WHERE user_id = ? AND LOWER(month) = LOWER(?) AND year = ?
      AND LOWER(status) NOT IN ('rejected', 'returned_to_draft')
  `).bind(targetUser.id, currentMonth, currentYear).all().catch(() => ({ results: [] }));

  const expenses = activeExpenses.results || [];
  if (expenses.length === 0) {
    return jsonResponse({
      success: true,
      message: `No active expenses found for ${targetUser.name} in ${currentMonth} ${currentYear}.`,
      affected_expenses: 0,
      total_deducted: 0
    });
  }

  let affectedCount = 0;
  let totalDeducted = 0;

  // Fetch official hospitals to resolve dropdown vs custom locations
  const hospitalsRes = await env.DB.prepare("SELECT DISTINCT hospital_name FROM assets_inventory WHERE hospital_name IS NOT NULL").all().catch(() => ({ results: [] }));
  const officialHospitals = new Set((hospitalsRes.results || []).map(h => h.hospital_name.trim().toLowerCase()));

  for (const exp of expenses) {
    // Fetch itinerary legs for this expense
    const legsRes = await env.DB.prepare(`
      SELECT itinerary_id, leg_number, from_location, to_location, travel_mode, sub_mode,
        distance_km, travel_amount, sub_amount, da_amount, hotel_amount, local_purchase,
        other_amount, original_travel_amount, original_sub_amount, original_da_amount,
        from_district, to_district, from_location AS "from", to_location AS "to"
      FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC
    `).bind(exp.expense_code).all().catch(() => ({ results: [] }));

    const legs = (legsRes.results || []).map(leg => {
      const fromLoc = (leg.from_location || "").trim().toLowerCase();
      const toLoc = (leg.to_location || "").trim().toLowerCase();
      const fromDist = (leg.from_district || "").trim().toLowerCase();
      const toDist = (leg.to_district || "").trim().toLowerCase();
      
      const legDistType = computeDistrictType(targetUser?.district || exp.district, [leg], exp.district);
      const isOutdoor = legDistType === "OUT_DISTRICT";
      const travelType = isOutdoor ? "Outdoor" : "In-District";
      
      const fromCustom = fromLoc && !officialHospitals.has(fromLoc);
      const toCustom = toLoc && !officialHospitals.has(toLoc);

      return {
        ...leg,
        from: leg.from_location || "",
        to: leg.to_location || "",
        from_custom: fromCustom,
        to_custom: toCustom,
        amount: leg.travel_amount,
        sub_amount: leg.sub_amount,
        da: leg.da_amount,
        travel_type: travelType
      };
    });

    const { isBaseLocOnly, isDaAllowed, baseLocations } = computeBaseLocPolicy(
      baseReportingLocation,
      legs
    );

    const hasOutdoorLeg = legs.some(leg => (leg.travel_type || "").trim().toLowerCase() === "outdoor");
    if (hasOutdoorLeg) continue; // No restriction applies to Outdoor expenses

    let expenseDeducted = 0;
    let policyApplied = false;
    const retroLegLogs = [];

    for (let idx = 0; idx < legs.length; idx++) {
      const leg = legs[idx];
      const isCommute = !hasOutdoorLeg && checkIsCommuteLeg(leg, baseLocations, idx, legs.length);
      const currentTA = parseFloat(leg.travel_amount || "0");
      const currentSubAmt = parseFloat(leg.sub_amount || "0");
      const currentDA = parseFloat(leg.da_amount || "0");

      const newTA = isCommute ? 0.0 : currentTA;
      const newSubAmt = isCommute ? 0.0 : currentSubAmt;
      const newDA = isDaAllowed ? currentDA : 0.0;

      if (currentTA > newTA) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "travel_amount",
          old_value: currentTA,
          new_value: newTA,
          comment: "[Retroactive] Base Location commute TA not eligible"
        });
      }
      if (currentSubAmt > newSubAmt) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "sub_amount",
          old_value: currentSubAmt,
          new_value: newSubAmt,
          comment: "[Retroactive] Base Location commute local conveyance not eligible"
        });
      }
      if (currentDA > newDA) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "da_amount",
          old_value: currentDA,
          new_value: newDA,
          comment: "[Retroactive] DA not applicable at base location"
        });
      }

      const diff = (currentTA - newTA) + (currentSubAmt - newSubAmt) + (currentDA - newDA);
      if (diff > 0) {
        policyApplied = true;
        expenseDeducted += diff;

        await runWrite(env, `
          UPDATE expense_itineraries
          SET travel_amount = ?, sub_amount = ?, da_amount = ?
          WHERE itinerary_id = ?
        `, [newTA, newSubAmt, newDA, leg.itinerary_id]);
      }
    }

    if (policyApplied) {
      // Recalculate total for this expense
      const newTotals = await env.DB.prepare(`
        SELECT SUM(travel_amount + sub_amount + da_amount + hotel_amount + other_amount + local_purchase) as new_total
        FROM expense_itineraries WHERE exp_id = ?
      `).bind(exp.expense_code).first().catch(() => ({ new_total: 0 }));

      const newTotal = parseFloat(newTotals?.new_total || 0);

      await runWrite(env, `
        UPDATE expenses SET amount = ?, da_amount = (
          SELECT SUM(da_amount) FROM expense_itineraries WHERE exp_id = ?
        ), updated_at = ? WHERE id = ?
      `, [newTotal, exp.expense_code, timestamp, exp.id]);

      // Write policy comments to expense_edit_logs
      const policyComment = buildPolicyComment(baseLocations, legs, isDaAllowed, exp.itinerary || timestamp.split("T")[0]);
      if (policyComment) {
        await runWrite(env,
          "INSERT INTO expense_edit_logs (expense_id, comment, editor_name, editor_role, editor_id) VALUES (?, ?, 'SYSTEM', 'Policy', 0)",
          [exp.id, `[Retroactive] ${policyComment}`]
        );
      }
      
      // Save leg-level edit history logs
      for (const log of retroLegLogs) {
        await runWrite(env,
          `INSERT INTO expense_edit_logs 
           (expense_id, leg_number, field_name, old_value, new_value, comment, editor_name, editor_role, editor_id)
           VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM', 'Policy', 0)`,
          [exp.id, log.leg_number, log.field_name, String(log.old_value), String(log.new_value), log.comment]
        );
      }

      // Notify user
      await runWrite(env,
        "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, 'warning', 0, '/expense', ?)",
        [
          targetUser.user_id,
          "⚠️ Expense Adjusted — Base Location Policy",
          `Your expense for ${exp.itinerary || "this period"} has been adjusted as per base location TA/DA policy. TA deducted for home-to-work commute.`,
          timestamp
        ]
      );

      affectedCount++;
      totalDeducted += expenseDeducted;
    }
  }

  return jsonResponse({
    success: true,
    message: affectedCount > 0
      ? `Base location policy applied. ${affectedCount} expense(s) adjusted for ${targetUser.name}. Total deducted: ₹${totalDeducted.toFixed(2)}.`
      : `No adjustments needed. Existing expenses for ${targetUser.name} already comply with the base location policy.`,
    affected_expenses: affectedCount,
    total_deducted: Math.round(totalDeducted * 100) / 100
  });
}

/**
 * POST /api/expense/retroactive-policy-check-bulk
 * Admin-only. Re-runs the base-location TA/DA policy (computeBaseLocPolicy /
 * checkIsCommuteLeg — see the 🔒 LOCKED comment above computeBaseLocPolicy)
 * against EVERY active (not rejected / not returned-to-draft) expense of
 * EVERY user who has a base_reporting_location configured — pending AND
 * already-approved claims, across ALL months, not just the current one.
 *
 * Use this to fix old claims whose TA/DA was calculated before a policy fix
 * (e.g. removal of the "official activities" DA override). Optionally pass
 * { month: "July", year: 2026 } in the body to scope it to one month if a
 * full all-time pass is too slow / times out for your data volume.
 */
export async function handleBulkRetroactivePolicyCheck(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse({ error: "Access denied" }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const scopeMonth = body.month || null;
  const scopeYear = body.year || null;

  const timestamp = new Date().toISOString();

  const usersRes = await env.DB.prepare(
    "SELECT id, user_id, name, base_reporting_location FROM users WHERE base_reporting_location IS NOT NULL AND TRIM(base_reporting_location) != ''"
  ).all().catch(() => ({ results: [] }));
  const targetUsers = usersRes.results || [];

  const hospitalsRes = await env.DB.prepare("SELECT DISTINCT hospital_name FROM assets_inventory WHERE hospital_name IS NOT NULL").all().catch(() => ({ results: [] }));
  const officialHospitals = new Set((hospitalsRes.results || []).map(h => h.hospital_name.trim().toLowerCase()));

  let usersAffected = 0;
  let totalExpensesAffected = 0;
  let totalDeducted = 0;
  const perUserSummary = [];

  for (const targetUser of targetUsers) {
    const baseReportingLocation = targetUser.base_reporting_location || "";

    let expensesQuery = `
      SELECT id, expense_code, itinerary, amount, original_amount
      FROM expenses
      WHERE user_id = ? AND LOWER(status) NOT IN ('rejected', 'returned_to_draft')
    `;
    const expensesBinds = [targetUser.id];
    if (scopeMonth) { expensesQuery += " AND LOWER(month) = LOWER(?)"; expensesBinds.push(scopeMonth); }
    if (scopeYear) { expensesQuery += " AND year = ?"; expensesBinds.push(scopeYear); }

    const activeExpenses = await env.DB.prepare(expensesQuery).bind(...expensesBinds).all().catch(() => ({ results: [] }));
    const expenses = activeExpenses.results || [];
    if (expenses.length === 0) continue;

    let userExpensesAffected = 0;
    let userDeducted = 0;

    for (const exp of expenses) {
      const legsRes = await env.DB.prepare(`
        SELECT itinerary_id, leg_number, from_location, to_location, travel_mode, sub_mode,
          distance_km, travel_amount, sub_amount, da_amount, hotel_amount, local_purchase,
          other_amount, original_travel_amount, original_sub_amount, original_da_amount,
          from_district, to_district, from_location AS "from", to_location AS "to"
        FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC
      `).bind(exp.expense_code).all().catch(() => ({ results: [] }));

      const legs = (legsRes.results || []).map(leg => {
        const fromLoc = (leg.from_location || "").trim().toLowerCase();
        const toLoc = (leg.to_location || "").trim().toLowerCase();
        const fromDist = (leg.from_district || "").trim().toLowerCase();
        const toDist = (leg.to_district || "").trim().toLowerCase();

        const legDistType = computeDistrictType(targetUser?.district || exp.district, [leg], exp.district);
        const isOutdoor = legDistType === "OUT_DISTRICT";
        const travelType = isOutdoor ? "Outdoor" : "In-District";

        const fromCustom = fromLoc && !officialHospitals.has(fromLoc);
        const toCustom = toLoc && !officialHospitals.has(toLoc);

        return {
          ...leg,
          from: leg.from_location || "",
          to: leg.to_location || "",
          from_custom: fromCustom,
          to_custom: toCustom,
          amount: leg.travel_amount,
          sub_amount: leg.sub_amount,
          da: leg.da_amount,
          travel_type: travelType
        };
      });

      const { isDaAllowed, baseLocations } = computeBaseLocPolicy(baseReportingLocation, legs);

      const hasOutdoorLeg = legs.some(leg => (leg.travel_type || "").trim().toLowerCase() === "outdoor");
      if (hasOutdoorLeg) continue;

      let expenseDeducted = 0;
      let policyApplied = false;
      const retroLegLogs = [];

      for (let idx = 0; idx < legs.length; idx++) {
        const leg = legs[idx];
        const isCommute = checkIsCommuteLeg(leg, baseLocations, idx, legs.length);
        const currentTA = parseFloat(leg.travel_amount || "0");
        const currentSubAmt = parseFloat(leg.sub_amount || "0");
        const currentDA = parseFloat(leg.da_amount || "0");

        const newTA = isCommute ? 0.0 : currentTA;
        const newSubAmt = isCommute ? 0.0 : currentSubAmt;
        const newDA = isDaAllowed ? currentDA : 0.0;

        if (currentTA > newTA) {
          retroLegLogs.push({ leg_number: leg.leg_number, field_name: "travel_amount", old_value: currentTA, new_value: newTA, comment: "[Retroactive Bulk] Base Location commute TA not eligible" });
        }
        if (currentSubAmt > newSubAmt) {
          retroLegLogs.push({ leg_number: leg.leg_number, field_name: "sub_amount", old_value: currentSubAmt, new_value: newSubAmt, comment: "[Retroactive Bulk] Base Location commute local conveyance not eligible" });
        }
        if (currentDA > newDA) {
          retroLegLogs.push({ leg_number: leg.leg_number, field_name: "da_amount", old_value: currentDA, new_value: newDA, comment: "[Retroactive Bulk] DA not applicable at base location" });
        }

        const diff = (currentTA - newTA) + (currentSubAmt - newSubAmt) + (currentDA - newDA);
        if (diff > 0) {
          policyApplied = true;
          expenseDeducted += diff;

          await runWrite(env, `
            UPDATE expense_itineraries
            SET travel_amount = ?, sub_amount = ?, da_amount = ?
            WHERE itinerary_id = ?
          `, [newTA, newSubAmt, newDA, leg.itinerary_id]);
        }
      }

      if (policyApplied) {
        const newTotals = await env.DB.prepare(`
          SELECT SUM(travel_amount + sub_amount + da_amount + hotel_amount + other_amount + local_purchase) as new_total
          FROM expense_itineraries WHERE exp_id = ?
        `).bind(exp.expense_code).first().catch(() => ({ new_total: 0 }));

        const newTotal = parseFloat(newTotals?.new_total || 0);

        await runWrite(env, `
          UPDATE expenses SET amount = ?, da_amount = (
            SELECT SUM(da_amount) FROM expense_itineraries WHERE exp_id = ?
          ), updated_at = ? WHERE id = ?
        `, [newTotal, exp.expense_code, timestamp, exp.id]);

        const policyComment = buildPolicyComment(baseLocations, legs, isDaAllowed, exp.itinerary || timestamp.split("T")[0]);
        if (policyComment) {
          await runWrite(env,
            "INSERT INTO expense_edit_logs (expense_id, comment, editor_name, editor_role, editor_id) VALUES (?, ?, 'SYSTEM', 'Policy', 0)",
            [exp.id, `[Retroactive Bulk] ${policyComment}`]
          );
        }

        for (const log of retroLegLogs) {
          await runWrite(env,
            `INSERT INTO expense_edit_logs 
             (expense_id, leg_number, field_name, old_value, new_value, comment, editor_name, editor_role, editor_id)
             VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM', 'Policy', 0)`,
            [exp.id, log.leg_number, log.field_name, String(log.old_value), String(log.new_value), log.comment]
          );
        }

        await runWrite(env,
          "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, 'warning', 0, '/expense', ?)",
          [
            targetUser.user_id,
            "⚠️ Expense Adjusted — Base Location Policy",
            `Your expense for ${exp.itinerary || "this period"} has been adjusted as per base location TA/DA policy.`,
            timestamp
          ]
        );

        userExpensesAffected++;
        userDeducted += expenseDeducted;
      }
    }

    if (userExpensesAffected > 0) {
      usersAffected++;
      totalExpensesAffected += userExpensesAffected;
      totalDeducted += userDeducted;
      perUserSummary.push({
        user_id: targetUser.user_id,
        name: targetUser.name,
        expenses_affected: userExpensesAffected,
        deducted: Math.round(userDeducted * 100) / 100
      });
    }
  }

  return jsonResponse({
    success: true,
    message: `Bulk base-location policy repair complete. ${usersAffected} user(s), ${totalExpensesAffected} expense(s) adjusted. Total deducted: ₹${totalDeducted.toFixed(2)}.`,
    users_affected: usersAffected,
    total_expenses_affected: totalExpensesAffected,
    total_deducted: Math.round(totalDeducted * 100) / 100,
    per_user_summary: perUserSummary
  });
}

/**
 * GET /api/expense/month-summary
 * Returns per-engineer summary for a given month (Managers/Admins see team; Engineers see self)
 */
export async function handleGetMonthSummary(request, env, params, query, user) {
  const month = query.get("month");    // e.g. "January"
  const year = parseInt(query.get("year") || "0", 10) || new Date().getFullYear();
  const district = query.get("district");
  const engineer = query.get("engineer");

  const userRoleClean = (user.role || "").trim().toLowerCase();
  const isAdminOrReportViewer = hasFullAccess(userRoleClean);

  // Build filters for new expenses table
  const whereClauses = ["1=1"];
  const bindings = [];

  if (month) {
    whereClauses.push("(e.month = ? OR LOWER(e.month) = LOWER(?))");
    bindings.push(month, month);
  }
  if (year) {
    whereClauses.push("e.year = ?");
    bindings.push(year);
  }

  // Row-level access control
  if (userRoleClean === "engineer") {
    whereClauses.push("u.user_id = ?");
    bindings.push(user.user_id);
  } else if (!isAdminOrReportViewer) {
    // Non-admin managers see team
    const nameClean = (user.name || "").trim();
    const uidClean = (user.user_id || "").trim();

    // Query direct reports
    const directReportsRes = await env.DB.prepare(`
      SELECT id FROM users
      WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
         OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
    `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all();
    const directReports = directReportsRes.results || [];

    // Query hierarchy reports
    const hierarchyApprovals = await env.DB.prepare(`
      SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
    `).bind(user.id).all();
    
    let hierarchyReports = [];
    if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
      const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
      const placeholders = hIds.map(() => "?").join(",");
      const reqsRes = await env.DB.prepare(`
        SELECT u.id FROM users u
        JOIN hierarchy_requesters hr ON u.id = hr.user_id
        WHERE hr.hierarchy_id IN (${placeholders})
      `).bind(...hIds).all();
      hierarchyReports = reqsRes.results || [];
    }

    const teamIds = Array.from(new Set([...directReports.map(u => u.id), ...hierarchyReports.map(u => u.id)]));
    if (teamIds.length === 0) {
      whereClauses.push("1=0");
    } else {
      const placeholders = teamIds.map(() => "?").join(",");
      whereClauses.push(`u.id IN (${placeholders})`);
      bindings.push(...teamIds);
    }
  }

  if (district) {
    whereClauses.push("LOWER(u.district) = LOWER(?)");
    bindings.push(district);
  }
  if (engineer) {
    whereClauses.push("(LOWER(u.name) LIKE ? OR LOWER(u.user_id) = LOWER(?))");
    bindings.push(`%${engineer.toLowerCase()}%`, engineer.toLowerCase());
  }

  const whereStr = whereClauses.join(" AND ");

  // Fetch new-style expense summaries
  const result = await env.DB.prepare(`
    SELECT 
      u.user_id, COALESCE(u.e_code, u.user_id) as e_code, u.name, u.district, u.zone, u.designation, u.grade,
      e.month as month, e.year,
      COUNT(DISTINCT e.id) as total_claims,
      COUNT(DISTINCT e.id) as claims_count,
      COUNT(DISTINCT CASE WHEN LOWER(e.status) IN ('approved', 'auto_approved', 'auto-approved') THEN e.id END) as approved_count,
      SUM(COALESCE(e.original_amount, e.amount, 0)) as claimed_amount,
      SUM(CASE WHEN LOWER(e.status) IN ('approved', 'auto_approved', 'auto-approved') THEN e.amount ELSE 0 END) as total_amount,
      SUM(CASE WHEN LOWER(e.status) IN ('approved', 'auto_approved', 'auto-approved') THEN e.amount ELSE 0 END) as approved_amount,
      SUM(CASE WHEN LOWER(e.status) = 'rejected' THEN COALESCE(e.original_amount, e.amount, 0) ELSE 0 END) as rejected_amount,
      SUM(COALESCE(e.calls_assigned, 0)) as calls_assigned,
      SUM(COALESCE(e.calls_completed, 0)) as calls_completed,
      SUM(COALESCE(e.pms_count, 0)) as pms_count,
      SUM(COALESCE(e.asset_tagging, 0)) as tagging_count,
      (
        SELECT COALESCE(SUM(i.distance_km), 0)
        FROM expense_itineraries i
        JOIN expenses e2 ON i.exp_id = e2.expense_code
        WHERE e2.user_id = u.id AND UPPER(e2.month) = UPPER(e.month) AND e2.year = e.year
          AND LOWER(e2.status) IN ('approved', 'auto_approved', 'auto-approved')
      ) as total_km
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE ${whereStr}
    GROUP BY u.user_id, u.e_code, u.name, e.month, e.year
    ORDER BY u.name ASC
  `).bind(...bindings).all();

  // Also fetch from legacy expense_master if it exists
  let legacyRows = [];
  try {
    const legacyWhereClauses = ["1=1"];
    const legacyBindings = [];

    if (month) {
      // Legacy has expense_date; match by month name
      legacyWhereClauses.push("strftime('%m', expense_date) = ?");
      const monthNum = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(month.toLowerCase()) + 1;
      legacyBindings.push(String(monthNum).padStart(2, "0"));
    }
    if (year) {
      legacyWhereClauses.push("strftime('%Y', expense_date) = ?");
      legacyBindings.push(String(year));
    }

    if (userRoleClean === "engineer") {
      legacyWhereClauses.push("LOWER(u.user_id) = LOWER(?)");
      legacyBindings.push(user.user_id);
    } else if (!isAdminOrReportViewer) {
      // Non-admin managers see team
      const nameClean = (user.name || "").trim();
      const uidClean = (user.user_id || "").trim();

      // Query direct reports
      const directReportsRes = await env.DB.prepare(`
        SELECT id FROM users
        WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
           OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
           OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
      `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all();
      const directReports = directReportsRes.results || [];

      // Query hierarchy reports
      const hierarchyApprovals = await env.DB.prepare(`
        SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
      `).bind(user.id).all();
      
      let hierarchyReports = [];
      if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
        const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
        const placeholders = hIds.map(() => "?").join(",");
        const reqsRes = await env.DB.prepare(`
          SELECT u.id FROM users u
          JOIN hierarchy_requesters hr ON u.id = hr.user_id
          WHERE hr.hierarchy_id IN (${placeholders})
        `).bind(...hIds).all();
        hierarchyReports = reqsRes.results || [];
      }

      const teamIds = Array.from(new Set([...directReports.map(u => u.id), ...hierarchyReports.map(u => u.id)]));
      if (teamIds.length === 0) {
        legacyWhereClauses.push("1=0");
      } else {
        const placeholders = teamIds.map(() => "?").join(",");
        legacyWhereClauses.push(`u.id IN (${placeholders})`);
        legacyBindings.push(...teamIds);
      }
    }

    if (district) {
      legacyWhereClauses.push("LOWER(u.district) = LOWER(?)");
      legacyBindings.push(district);
    }

    const legacyRes = await env.DB.prepare(`
      SELECT 
        m.user_id, COALESCE(u.e_code, m.user_id) as e_code, u.name, u.district, u.zone, u.designation, u.grade,
        COUNT(*) as total_claims,
        COUNT(*) as claims_count,
        COUNT(*) as approved_count,
        SUM(COALESCE(m.total_amount, 0)) as claimed_amount,
        SUM(m.total_amount) as total_amount,
        SUM(m.total_amount) as approved_amount,
        0 as rejected_amount,
        0 as calls_assigned,
        0 as calls_completed,
        0 as pms_count,
        0 as tagging_count,
        0 as total_km
      FROM expense_master m
      JOIN users u ON LOWER(m.user_id) = LOWER(u.user_id)
      WHERE ${legacyWhereClauses.join(" AND ")} AND LOWER(m.status) = 'approved'
      GROUP BY m.user_id, u.e_code, u.name, u.district, u.zone
      ORDER BY u.name ASC
    `).bind(...legacyBindings).all();
    legacyRows = legacyRes.results || [];
  } catch (e) {
    // Legacy table may not exist
    console.warn("Legacy expenses fetch failed:", e.message);
  }

  const summaryMap = {};
  for (const row of (result.results || [])) {
    summaryMap[row.user_id] = row;
  }
  // Merge legacy (de-duplicate by user_id)
  for (const row of legacyRows) {
    if (!summaryMap[row.user_id]) {
      summaryMap[row.user_id] = { ...row, month: month || "", year };
    } else {
      summaryMap[row.user_id].total_claims += row.total_claims || 0;
      summaryMap[row.user_id].claimed_amount = (parseFloat(summaryMap[row.user_id].claimed_amount) || 0) + (parseFloat(row.claimed_amount) || 0);
      summaryMap[row.user_id].total_amount = (parseFloat(summaryMap[row.user_id].total_amount) || 0) + (parseFloat(row.total_amount) || 0);
      summaryMap[row.user_id].approved_amount = (parseFloat(summaryMap[row.user_id].approved_amount) || 0) + (parseFloat(row.approved_amount) || 0);
    }
  }

  // Fetch unique districts of active users to populate the dropdown filter dynamically
  let districts = [];
  try {
    const distRes = await env.DB.prepare(`
      SELECT DISTINCT district FROM users 
      WHERE district IS NOT NULL AND TRIM(district) != ''
      ORDER BY district ASC
    `).all();
    districts = (distRes.results || []).map(r => r.district.trim());
  } catch (e) {
    console.error("Failed to fetch districts list:", e.message);
  }

  return jsonResponse({
    success: true,
    data: Object.values(summaryMap),
    districts
  });
}

/**
 * GET /api/expense/engineer-month-claims
 * Returns all detailed claims (with legs) for a specific engineer in a given month/year
 */
export async function handleGetEngineerMonthClaims(request, env, params, query, user) {
  const userCode = query.get("user_code");
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || new Date().getFullYear();

  if (!userCode || !month) {
    return jsonResponse({ error: "user_code and month are required" }, 400);
  }

  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ? OR e_code = ?").bind(userCode, userCode).first();
  if (!targetUser) {
    return jsonResponse({ error: "Engineer not found" }, 404);
  }

  const claims = [];

  // Fetch asset value master into a dictionary: equipment_name -> tender_cost
  const assetCosts = {};
  try {
    const assetCostsRes = await env.DB.prepare("SELECT equipment_name, rmsc_tender_cost FROM asset_value_master").all();
    for (const r of (assetCostsRes.results || [])) {
      if (r.equipment_name) {
        assetCosts[r.equipment_name.trim().toLowerCase()] = parseFloat(r.rmsc_tender_cost || 0.0);
      }
    }
  } catch (e) {
    console.warn("Failed to load asset costs:", e.message);
  }

  // Fetch from new expenses table
  let expenses = [];
  try {
    const expensesRes = await env.DB.prepare(`
      SELECT * FROM expenses 
      WHERE user_id = ? AND UPPER(month) = UPPER(?) AND year = ? AND LOWER(status) = 'approved'
      ORDER BY itinerary ASC
    `).bind(targetUser.id, month, year).all();
    expenses = expensesRes.results || [];

    const expCodes = expenses.map(e => e.expense_code).filter(Boolean);
    
    // Batch fetch all itineraries (legs) for all expenses in a single query
    let allLegs = [];
    if (expCodes.length > 0) {
      const placeholders = expCodes.map(() => "?").join(",");
      const legsRes = await env.DB.prepare(`
        SELECT * FROM expense_itineraries 
        WHERE exp_id IN (${placeholders}) 
        ORDER BY exp_id ASC, leg_number ASC
      `).bind(...expCodes).all();
      allLegs = legsRes.results || [];
    }

    const legsMap = {};
    for (const leg of allLegs) {
      if (!legsMap[leg.exp_id]) {
        legsMap[leg.exp_id] = [];
      }
      legsMap[leg.exp_id].push(leg);
    }

    // Batch fetch all asset taggings, breakdown calls, and PMS calls for all legs in a single query
    const itiIds = allLegs.map(l => l.itinerary_id).filter(Boolean);
    let allTaggings = [];
    let allCalls = [];
    let allPms = [];
    if (itiIds.length > 0) {
      const placeholders = itiIds.map(() => "?").join(",");
      const [tagRes, callsRes, pmsRes] = await Promise.all([
        env.DB.prepare(`
          SELECT * FROM expense_asset_taggings 
          WHERE itinerary_id IN (${placeholders})
        `).bind(...itiIds).all().catch(() => ({ results: [] })),
        env.DB.prepare(`
          SELECT * FROM expense_breakdown_calls 
          WHERE itinerary_id IN (${placeholders})
        `).bind(...itiIds).all().catch(() => ({ results: [] })),
        env.DB.prepare(`
          SELECT * FROM expense_pms_calls 
          WHERE itinerary_id IN (${placeholders})
        `).bind(...itiIds).all().catch(() => ({ results: [] }))
      ]);
      allTaggings = tagRes.results || [];
      allCalls = callsRes.results || [];
      allPms = pmsRes.results || [];
    }

    const taggingsMap = {};
    for (const t of allTaggings) {
      if (!taggingsMap[t.itinerary_id]) {
        taggingsMap[t.itinerary_id] = [];
      }
      taggingsMap[t.itinerary_id].push(t);
    }

    const callsDbMap = {};
    for (const call of allCalls) {
      if (!callsDbMap[call.itinerary_id]) callsDbMap[call.itinerary_id] = {};
      if (call.barcode) callsDbMap[call.itinerary_id][call.barcode] = call;
    }

    const pmsDbMap = {};
    for (const p of allPms) {
      if (!pmsDbMap[p.itinerary_id]) pmsDbMap[p.itinerary_id] = {};
      if (p.barcode) pmsDbMap[p.itinerary_id][p.barcode] = p;
    }

    for (const exp of expenses) {
      const legs = legsMap[exp.expense_code] || [];
      const legData = [];
      for (const leg of legs) {
        let barcodes = [];
        if (leg.activity_details) {
          try {
            const act = typeof leg.activity_details === 'string' ? JSON.parse(leg.activity_details) : leg.activity_details;
            if (act && typeof act === 'object') {
              const itiCallsMap = callsDbMap[leg.itinerary_id] || {};
              for (const item of (act.calls_list || [])) {
                if (item.barcode) {
                  barcodes.push(item.barcode);
                  const dbCall = itiCallsMap[item.barcode];
                  if (dbCall && dbCall.photo_url) {
                    item.photo_url = dbCall.photo_url;
                  }
                }
              }
              const itiPmsMap = pmsDbMap[leg.itinerary_id] || {};
              for (const item of (act.pms_list || [])) {
                if (item.barcode) {
                  if (!barcodes.includes(item.barcode)) barcodes.push(item.barcode);
                  const dbPms = itiPmsMap[item.barcode];
                  if (dbPms && dbPms.photo_url) {
                    item.photo_url = dbPms.photo_url;
                  }
                }
              }
              leg.activity_details = JSON.stringify(act);
            }
          } catch (err) {}
        }

        // Calculate total asset tagging qty and value from batch-fetched taggings in-memory
        let totalTagQty = 0;
        let totalTagVal = 0;
        const taggings = taggingsMap[leg.itinerary_id] || [];
        for (const t of taggings) {
          const qty = t.quantity || 0;
          totalTagQty += qty;
          const eqName = (t.equipment_name || "").trim().toLowerCase();
          const cost = assetCosts[eqName] || 0.0;
          totalTagVal += qty * cost;
        }

        let tagInfo = "";
        if (totalTagQty > 0) {
          tagInfo = `Qty: ${totalTagQty} | ₹${totalTagVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        }

        let barcodeTicketStr = barcodes.join(", ");
        if (tagInfo) {
          barcodeTicketStr = barcodeTicketStr ? `${barcodeTicketStr} | ${tagInfo}` : tagInfo;
        }

        const mode = (leg.travel_mode || "").trim().toLowerCase();
        const subMode = (leg.sub_mode || "").trim().toLowerCase();

        const autoAmt = (mode === "auto" ? parseFloat(leg.travel_amount || 0) : 0) +
                        (subMode === "auto" ? parseFloat(leg.sub_amount || 0) : 0);

        legData.push({
          leg_number: leg.leg_number,
          from_location: leg.from_location || leg.from_district || "—",
          to_location: leg.to_location || leg.to_district || "—",
          travel_mode: leg.travel_mode || "—",
          distance_km: parseFloat(leg.distance_km || 0.0),
          bike_km: mode === "bike" ? parseFloat(leg.distance_km || 0.0) : 0.0,
          car_km: mode === "car" ? parseFloat(leg.distance_km || 0.0) : 0.0,
          bike_amount: mode === "bike" ? parseFloat(leg.travel_amount || 0.0) : 0.0,
          car_amount: mode === "car" ? parseFloat(leg.travel_amount || 0.0) : 0.0,
          auto_amount: autoAmt,
          da_amount: parseFloat(leg.da_amount || 0.0),
          hotel_amount: parseFloat(leg.hotel_amount || 0.0),
          local_purchase: parseFloat(leg.local_purchase || 0.0),
          other_amount: parseFloat(leg.other_amount || 0.0),
          other_desc: leg.other_desc || "",
          visit_purpose: leg.visit_purpose || "",
          calls_assigned: leg.calls_assigned || 0,
          ws_assigned: leg.calls_assigned || 0,
          calls_completed: leg.calls_completed || 0,
          ws_closed: leg.calls_completed || 0,
          pms_count: leg.pms_count || 0,
          ws_pms: leg.pms_count || 0,
          ws_asset: leg.asset_tagging || 0,
          asset_tagging: leg.asset_tagging || 0,
          calibration_count: leg.calibration_count || 0,
          mobilise_count: leg.mobilise_count || 0,
          mobilise_asset_count: leg.mobilise_count || 0,
          worked_district: leg.to_district || leg.from_district || "",
          ta_amount: ["train", "bus"].includes(mode) ? parseFloat(leg.travel_amount || 0.0) : 0.0,
          sub_mode: leg.sub_mode || "",
          sub_amount: parseFloat(leg.sub_amount || 0.0),
          barcode_ticket: barcodeTicketStr,
          asset_tagging_qty: totalTagQty,
          asset_tagging_val: totalTagVal,
          activity_details: leg.activity_details || "",
        });
      }

      claims.push({
        expense_code: exp.expense_code,
        date: exp.itinerary,
        amount: parseFloat(exp.amount || 0.0),
        da_amount: parseFloat(exp.da_amount || 0.0),
        hotel_amount: parseFloat(exp.hotel_amount || 0.0),
        other_amount: parseFloat(exp.other_expense_amount || 0.0),
        local_purchase_amount: parseFloat(exp.local_purchase_amount || 0.0),
        legs: legData,
      });
    }
  } catch (e) {
    console.warn("New expenses fetch failed:", e.message);
  }

  // Fetch from legacy expense_master
  let legacyExpenses = [];
  try {
    const legacyRes = await env.DB.prepare(`
      SELECT * FROM expense_master
      WHERE LOWER(user_id) = LOWER(?)
        AND strftime('%m', expense_date) = ?
        AND strftime('%Y', expense_date) = ?
        AND LOWER(status) = 'approved'
      ORDER BY expense_date ASC
    `).bind(userCode,
      String(["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(month.toLowerCase()) + 1).padStart(2, "0"),
      String(year)
    ).all();
    legacyExpenses = legacyRes.results || [];

    const legacyExpIds = legacyExpenses.map(e => e.exp_id).filter(Boolean);
    
    // Batch fetch all legacy itineraries (legs) in a single query
    let legacyLegs = [];
    if (legacyExpIds.length > 0) {
      const placeholders = legacyExpIds.map(() => "?").join(",");
      const legacyLegsRes = await env.DB.prepare(`
        SELECT * FROM expense_itineraries 
        WHERE exp_id IN (${placeholders}) 
        ORDER BY exp_id ASC, leg_number ASC
      `).bind(...legacyExpIds).all();
      legacyLegs = legacyLegsRes.results || [];
    }

    const legacyLegsMap = {};
    for (const leg of legacyLegs) {
      if (!legacyLegsMap[leg.exp_id]) {
        legacyLegsMap[leg.exp_id] = [];
      }
      legacyLegsMap[leg.exp_id].push(leg);
    }

    for (const exp of legacyExpenses) {
      const legs = legacyLegsMap[exp.exp_id] || [];
      const legData = [];
      for (const leg of legs) {
        legData.push({
          leg_number: leg.leg_number,
          from_location: leg.from_location || "—",
          to_location: leg.to_location || "—",
          travel_mode: leg.travel_mode || "—",
          distance_km: parseFloat(leg.distance_km || 0.0),
          bike_km: leg.travel_mode === "Bike" ? parseFloat(leg.distance_km || 0.0) : 0.0,
          car_km: leg.travel_mode === "Car" ? parseFloat(leg.distance_km || 0.0) : 0.0,
          bike_amount: parseFloat(leg.bike_amount || 0.0),
          car_amount: parseFloat(leg.car_amount || 0.0),
          auto_amount: parseFloat(leg.auto_amount || 0.0),
          da_amount: parseFloat(leg.da_amount || 0.0),
          hotel_amount: parseFloat(leg.hotel_amount || 0.0),
          local_purchase: parseFloat(leg.local_purchase || 0.0),
          other_amount: parseFloat(leg.other_amount || 0.0),
          other_desc: leg.other_desc || "",
          visit_purpose: leg.visit_purpose || "",
          calls_assigned: leg.calls_assigned || 0,
          ws_assigned: leg.calls_assigned || 0,
          calls_completed: leg.calls_completed || 0,
          ws_closed: leg.calls_completed || 0,
          pms_count: leg.pms_count || 0,
          ws_pms: leg.pms_count || 0,
          ws_asset: leg.asset_tagging || 0,
          asset_tagging: leg.asset_tagging || 0,
          calibration_count: leg.calibration_count || 0,
          mobilise_count: leg.mobilise_count || 0,
          mobilise_asset_count: leg.mobilise_count || 0,
          worked_district: leg.worked_district || "",
          ta_amount: parseFloat(leg.ta_amount || 0.0),
          sub_mode: leg.sub_mode || "",
          sub_amount: parseFloat(leg.sub_amount || 0.0),
          barcode_ticket: leg.barcode_ticket || "",
          asset_tagging_qty: leg.asset_tagging_qty || 0,
          asset_tagging_val: leg.asset_tagging_val || 0.0,
          activity_details: leg.activity_details || "",
        });
      }

      claims.push({
        expense_code: exp.exp_id,
        date: exp.expense_date,
        amount: parseFloat(exp.total_amount || 0.0),
        da_amount: parseFloat(exp.da_amount || 0.0),
        hotel_amount: parseFloat(exp.hotel_amount || 0.0),
        other_amount: parseFloat(exp.other_amount || 0.0),
        local_purchase_amount: parseFloat(exp.local_purchase || 0.0),
        legs: legData,
      });
    }
  } catch (e) {
    console.warn("Legacy expense_master fetch failed:", e.message);
  }

  const defaultUserObj = {
    name: targetUser.name,
    user_id: targetUser.user_id,
    e_code: targetUser.e_code || targetUser.user_id,
    grade: targetUser.grade || "",
    designation: targetUser.designation || "Engineer",
    district: targetUser.district || "",
    zone: targetUser.zone || "",
    manager: targetUser.manager || "",
    coordinator: targetUser.coordinator || "",
    mobile: targetUser.mobile_number || "",
    type: targetUser.type || (targetUser.zone || ""),
    month: month,
    year: year
  };

  // Query all attachments for these expenses
  const expenseCodes = claims.map(c => c.expense_code);
  const validAttachments = [];
  if (expenseCodes.length > 0) {
    try {
      const placeholders = expenseCodes.map(() => "?").join(",");
      const attachRes = await env.DB.prepare(`
        SELECT * FROM expense_attachments 
        WHERE exp_id IN (${placeholders})
      `).bind(...expenseCodes).all();

      const expenseDateMap = {};
      for (const c of claims) {
        expenseDateMap[c.expense_code] = c.date;
      }

      // Map legs for fast lookup by itinerary_id (exp_id + "-" + leg_number)
      const legsMap = {};
      for (const c of claims) {
        for (const leg of (c.legs || [])) {
          const key = `${c.expense_code}-${leg.leg_number}`.toLowerCase();
          legsMap[key] = leg;
        }
      }

      for (const a of (attachRes.results || [])) {
        const billType = (a.bill_type || "").toLowerCase();
        if (a.file_url && !billType.includes("pms") && !billType.includes("call")) {
          // Check if the approved amount for this attachment type is zero
          const legKey = `${a.exp_id}-${a.itinerary_id.split("-").pop()}`.toLowerCase();
          const leg = legsMap[legKey];
          if (leg) {
            let isApprovedAmountZero = false;
            if (billType === "hotel") {
              isApprovedAmountZero = (parseFloat(leg.hotel_amount) || 0) === 0;
            } else if (billType === "local_purchase") {
              isApprovedAmountZero = (parseFloat(leg.local_purchase) || 0) === 0;
            } else if (billType === "other" || billType === "other_expense") {
              isApprovedAmountZero = (parseFloat(leg.other_amount) || 0) === 0;
            } else if (billType === "bus" || billType === "train" || billType === "travel" || (leg.travel_mode && billType === leg.travel_mode.toLowerCase())) {
              isApprovedAmountZero = (parseFloat(leg.ta_amount || leg.travel_amount) || 0) === 0;
            } else if (leg.sub_mode && billType === leg.sub_mode.toLowerCase()) {
              isApprovedAmountZero = (parseFloat(leg.sub_amount) || 0) === 0;
            }
            
            if (isApprovedAmountZero) {
              // Skip zeroed-out attachment
              continue;
            }
          }

          validAttachments.push({
            file_url: a.file_url,
            url: a.file_url,
            bill_type: a.bill_type || "Expense Bill Attachment",
            date: expenseDateMap[a.exp_id] || ""
          });
        }
      }

      // Attach attachments to claims array as well
      for (const c of claims) {
        c.attachments = (attachRes.results || [])
          .filter(a => a.exp_id === c.expense_code && a.file_url)
          .map(a => ({
            file_url: a.file_url,
            url: a.file_url,
            bill_type: a.bill_type || "Expense Bill Attachment"
          }));
      }
    } catch (e) {
      console.warn("Attachments fetch failed:", e.message);
    }
  }

  return jsonResponse({
    success: true,
    user: defaultUserObj,
    claims: claims,
    attachments: validAttachments
  });
}

/**
 * GET /api/expense/engineer-advance
 * Returns the advance amount for an engineer for a specific month/year
 */
export async function handleGetEngineerAdvance(request, env, params, query, user) {
  const userCode = query.get("user_code");
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || new Date().getFullYear();

  if (!userCode || !month) {
    return jsonResponse({ error: "user_code and month are required" }, 400);
  }

  const record = await env.DB.prepare(`
    SELECT * FROM engineer_advances
    WHERE LOWER(user_id) = LOWER(?) AND LOWER(month) = LOWER(?) AND year = ?
    LIMIT 1
  `).bind(userCode, month, year).first().catch(() => null);

  return jsonResponse({
    user_code: userCode,
    month,
    year,
    advance_amount: parseFloat(record?.advance_amount || 0)
  });
}

/**
 * POST /api/expense/engineer-advance
 * Save/update the advance amount for an engineer for a specific month/year
 */
export async function handleSaveEngineerAdvance(request, env, params, query, user) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  const { user_code, month, year, advance_amount } = body;
  if (!user_code || !month || !year) {
    return jsonResponse({ error: "user_code, month, and year are required" }, 400);
  }

  const timestamp = new Date().toISOString();
  const amount = parseFloat(advance_amount || 0);

  // Upsert the advance record
  const existing = await env.DB.prepare(`
    SELECT id FROM engineer_advances
    WHERE LOWER(user_id) = LOWER(?) AND LOWER(month) = LOWER(?) AND year = ?
  `).bind(user_code, month, year).first().catch(() => null);

  if (existing) {
    await runWrite(env, "UPDATE engineer_advances SET advance_amount = ?, updated_at = ? WHERE id = ?", [amount, timestamp, existing.id]);
  } else {
    await runWrite(env, `
      INSERT INTO engineer_advances (user_id, month, year, advance_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user_code, month, year, amount, timestamp, timestamp]).catch(async () => {
      // Table may not have updated_at column, try simpler version
      await runWrite(env, `
        INSERT INTO engineer_advances (user_id, month, year, advance_amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [user_code, month, year, amount, timestamp]);
    });
  }

  return jsonResponse({ status: "success", message: "Advance saved successfully", advance_amount: amount });
}

/**
 * GET /api/expense/consolidated-report
 * Returns a consolidated summary for all engineers in a month/year
 */
export async function handleGetConsolidatedReport(request, env, params, query, user) {
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || new Date().getFullYear();

  if (!month) {
    return jsonResponse({ error: "month is required" }, 400);
  }

  // 1. Fetch all users (including manager column)
  const usersRes = await env.DB.prepare(`
    SELECT id, user_id, name, district, zone, grade, designation, date_of_joining, e_code, manager FROM users
  `).all().catch(() => ({ results: [] }));
  const allUsers = usersRes.results || [];

  // Determine allowed users based on role and hierarchy mapping
  const userRoleClean = (user.role || "").trim().toLowerCase();
  const isAdminOrReportViewer = hasFullAccess(userRoleClean);

  const allowedUserCodesSet = new Set();
  let filteredUsers = [];

  if (isAdminOrReportViewer) {
    for (const u of allUsers) {
      if (u.id) allowedUserCodesSet.add(u.id);
    }
    filteredUsers = allUsers;
  } else {
    const nameClean = (user.name || "").trim();
    const uidClean = (user.user_id || "").trim();

    // Query direct reports
    const directReportsRes = await env.DB.prepare(`
      SELECT id, user_id FROM users
      WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
         OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
    `).bind(
      nameClean.toLowerCase(), uidClean.toLowerCase(),
      nameClean.toLowerCase(), uidClean.toLowerCase(),
      nameClean.toLowerCase(), uidClean.toLowerCase()
    ).all().catch(() => ({ results: [] }));
    const directReports = directReportsRes.results || [];
    for (const r of directReports) {
      if (r.id) allowedUserCodesSet.add(r.id);
    }

    // Query hierarchy reports
    const hierarchyApprovals = await env.DB.prepare(`
      SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
    `).bind(user.id).all().catch(() => ({ results: [] }));
    
    if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
      const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
      const placeholders = hIds.map(() => "?").join(",");
      const reqsRes = await env.DB.prepare(`
        SELECT id, user_id FROM hierarchy_requesters
        WHERE hierarchy_id IN (${placeholders})
      `).bind(...hIds).all().catch(() => ({ results: [] }));
      for (const r of (reqsRes.results || [])) {
        if (r.id) allowedUserCodesSet.add(r.id);
      }
    }

    // Also include self
    if (user.id) allowedUserCodesSet.add(user.id);

    filteredUsers = allUsers.filter(u => u.id && allowedUserCodesSet.has(u.id));
  }

  const allowedUserCodes = Array.from(allowedUserCodesSet);

  // Build name resolution map for managers using allUsers (since we might need to resolve a manager's name who is not in filteredUsers)
  const nameLookupMap = {};
  for (const u of allUsers) {
    if (u.user_id) nameLookupMap[u.user_id.toLowerCase().trim()] = u.name;
    if (u.e_code) nameLookupMap[u.e_code.toLowerCase().trim()] = u.name;
    if (u.name) nameLookupMap[u.name.toLowerCase().trim()] = u.name;
  }

  const userMap = {};
  const userByCode = {};
  for (const u of filteredUsers) {
    userMap[u.id] = u;
    userByCode[u.user_id] = u;
  }

  // 2. Fetch approved expenses for allowed users
  let expenses = [];
  if (allowedUserCodes.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < allowedUserCodes.length; i += chunkSize) {
      const chunk = allowedUserCodes.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const chunkRes = await env.DB.prepare(`
        SELECT id, user_id, expense_code, amount, original_amount, status, itinerary, created_at FROM expenses
        WHERE UPPER(month) = UPPER(?) AND year = ? AND LOWER(status) = 'approved' AND user_id IN (${placeholders})
      `).bind(month, year, ...chunk).all().catch(() => ({ results: [] }));
      if (chunkRes.results) {
        expenses = expenses.concat(chunkRes.results);
      }
    }
  }

  if (expenses.length === 0) {
    return jsonResponse({ success: true, data: [] });
  }

  // 3. Fetch all itineraries for these expenses using queryInChunks (to avoid D1 parameter limit)
  const expenseCodes = expenses.map(e => e.expense_code).filter(Boolean);
  let legs = [];
  if (expenseCodes.length > 0) {
    try {
      legs = await queryInChunks(
        env.DB,
        "SELECT exp_id, travel_mode, sub_mode, distance_km, travel_amount, sub_amount, da_amount, local_purchase, local_purchase_remark, hotel_amount, other_desc, other_amount, original_distance_km, original_travel_amount, original_sub_amount, original_da_amount, original_local_purchase, original_hotel_amount, original_other_amount FROM expense_itineraries WHERE exp_id IN (?)",
        expenseCodes
      );
    } catch (e) {
      console.error("Consolidated report itineraries query failed:", e.message);
    }
  }

  // Group legs by exp_id (case-insensitive key normalization)
  const legsByCode = {};
  for (const leg of legs) {
    const key = (leg.exp_id || "").trim().toUpperCase();
    if (!legsByCode[key]) legsByCode[key] = [];
    legsByCode[key].push(leg);
  }

  // 4. Fetch advances
  const advancesRes = await env.DB.prepare(`
    SELECT user_id, advance_amount FROM engineer_advances
    WHERE LOWER(month) = LOWER(?) AND year = ?
  `).bind(month, year).all().catch(() => ({ results: [] }));
  const advances = advancesRes.results || [];
  const advancesMap = {};
  for (const adv of advances) {
    advancesMap[(adv.user_id || "").toLowerCase()] = parseFloat(adv.advance_amount || 0);
  }

  // 5. Fetch edit logs for comments using queryInChunks
  const expenseIds = expenses.map(e => e.id);
  let editLogs = [];
  if (expenseIds.length > 0) {
    try {
      editLogs = await queryInChunks(
        env.DB,
        "SELECT expense_id, comment FROM expense_edit_logs WHERE expense_id IN (?)",
        expenseIds
      );
    } catch (e) {
      console.error("Consolidated report edit logs query failed:", e.message);
    }
  }

  const commentsByExpense = {};
  for (const log of editLogs) {
    if (log.comment && log.comment.trim()) {
      if (!commentsByExpense[log.expense_id]) commentsByExpense[log.expense_id] = [];
      commentsByExpense[log.expense_id].push(log.comment.trim());
    }
  }

  // 6. Group expenses by user
  const expensesByUser = {};
  for (const exp of expenses) {
    const usr = userMap[exp.user_id];
    if (!usr) continue;
    if (!expensesByUser[usr.user_id]) expensesByUser[usr.user_id] = [];
    expensesByUser[usr.user_id].push(exp);
  }

  // 7. Compile report rows
  const reportRows = [];
  for (const [user_code, userExps] of Object.entries(expensesByUser)) {
    const usr = userByCode[user_code];
    if (!usr) continue;

    let travel_expense = 0;
    let bike_km = 0;
    let car_km = 0;
    let auto_amount = 0;
    let train_bus_amount = 0;
    let da_allowance = 0;
    let spare_purchase = 0;
    let courier_charges = 0;
    let boarding_lodging = 0;
    let printing_stationery = 0;
    let claimed_amount = 0;
    const allComments = [];

    const claimDates = [];
    const kmDeductions = {};
    const autoDeductions = {};
    const daDeductions = {};
    const hotelDeductions = {};
    const spareDeductions = {};
    const otherDeductions = {};

    for (const exp of userExps) {
      claimed_amount += parseFloat(exp.original_amount || exp.amount || 0);
      
      // Save claim date
      if (exp.itinerary) {
        // Format to DD-MM-YYYY
        const parts = exp.itinerary.split("-");
        if (parts.length === 3) {
          claimDates.push(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          claimDates.push(exp.itinerary);
        }
      } else if (exp.created_at) {
        // Fallback to created_at date
        const datePart = exp.created_at.split(" ")[0];
        const parts = datePart.split("-");
        if (parts.length === 3) {
          claimDates.push(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          claimDates.push(datePart);
        }
      }

      const expComments = commentsByExpense[exp.id] || [];
      allComments.push(...expComments);

      const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];
      for (const leg of expLegs) {
        // Get day of month for deduction tracking
        let day = 0;
        if (exp.itinerary) {
          day = parseInt(exp.itinerary.split("-")[2], 10) || 0;
        } else if (exp.created_at) {
          const datePart = exp.created_at.split(" ")[0];
          day = parseInt(datePart.split("-")[2], 10) || 0;
        }

        const mode = (leg.travel_mode || "").trim().toLowerCase();
        const sub_mode = (leg.sub_mode || "").trim().toLowerCase();

        let km_part = 0;
        if (mode === "bike") {
          km_part = parseFloat(leg.distance_km || 0) * 4.5;
          bike_km += parseFloat(leg.distance_km || 0);
        } else if (mode === "car") {
          km_part = parseFloat(leg.distance_km || 0) * 9.0;
          car_km += parseFloat(leg.distance_km || 0);
        }

        let auto_part = 0;
        if (mode === "auto") {
          auto_part += parseFloat(leg.travel_amount || 0);
          auto_amount += parseFloat(leg.travel_amount || 0);
        }
        if (sub_mode === "auto") {
          auto_part += parseFloat(leg.sub_amount || 0);
          auto_amount += parseFloat(leg.sub_amount || 0);
        }

        let ta_part = 0;
        if (mode === "train" || mode === "bus") {
          ta_part += parseFloat(leg.travel_amount || 0);
          train_bus_amount += parseFloat(leg.travel_amount || 0);
        }

        travel_expense += (km_part + auto_part + ta_part);
        da_allowance += parseFloat(leg.da_amount || 0);
        spare_purchase += parseFloat(leg.local_purchase || 0);
        boarding_lodging += parseFloat(leg.hotel_amount || 0);

        const oth_desc = (leg.other_desc || "").trim().toLowerCase();
        const oth_amt = parseFloat(leg.other_amount || 0);
        if (oth_amt > 0) {
          if (oth_desc.includes("courier") || oth_desc.includes("courrier")) {
            courier_charges += oth_amt;
          } else {
            printing_stationery += oth_amt;
          }
        }

        // Deductions calculation per leg (claimed vs approved)
        const kmDiff = parseFloat(leg.original_distance_km || 0) - parseFloat(leg.distance_km || 0);
        const autoDiff = (
          ((leg.travel_mode || "").trim().toLowerCase() === "auto" ? (parseFloat(leg.original_travel_amount || 0) - parseFloat(leg.travel_amount || 0)) : 0) +
          ((leg.sub_mode || "").trim().toLowerCase() === "auto" ? (parseFloat(leg.original_sub_amount || 0) - parseFloat(leg.sub_amount || 0)) : 0)
        );
        const daDiff = parseFloat(leg.original_da_amount || 0) - parseFloat(leg.da_amount || 0);
        const hotelDiff = parseFloat(leg.original_hotel_amount || 0) - parseFloat(leg.hotel_amount || 0);
        const spareDiff = parseFloat(leg.original_local_purchase || 0) - parseFloat(leg.local_purchase || 0);
        const otherDiff = parseFloat(leg.original_other_amount || 0) - parseFloat(leg.other_amount || 0);

        if (day > 0) {
          if (kmDiff > 0) kmDeductions[day] = (kmDeductions[day] || 0) + kmDiff;
          if (autoDiff > 0) autoDeductions[day] = (autoDeductions[day] || 0) + autoDiff;
          if (daDiff > 0) daDeductions[day] = (daDeductions[day] || 0) + daDiff;
          if (hotelDiff > 0) hotelDeductions[day] = (hotelDeductions[day] || 0) + hotelDiff;
          if (spareDiff > 0) spareDeductions[day] = (spareDeductions[day] || 0) + spareDiff;
          if (otherDiff > 0) otherDeductions[day] = (otherDeductions[day] || 0) + otherDiff;
        }
      }
    }

    // Build automated deduction strings with dates (concise format)
    const categoryTexts = [];
    
    // KM
    const kmDays = Object.keys(kmDeductions).map(Number).sort((a,b)=>a-b);
    if (kmDays.length > 0) {
      const totalKm = kmDays.reduce((sum, d) => sum + kmDeductions[d], 0);
      categoryTexts.push(`KM: ${totalKm}km (${kmDays.length} days: ${kmDays.join(",")})`);
    }

    // Auto
    const autoDays = Object.keys(autoDeductions).map(Number).sort((a,b)=>a-b);
    if (autoDays.length > 0) {
      const totalAuto = autoDays.reduce((sum, d) => sum + autoDeductions[d], 0);
      categoryTexts.push(`Auto: ${totalAuto} (${autoDays.length} days: ${autoDays.join(",")})`);
    }

    // DA
    const daDays = Object.keys(daDeductions).map(Number).sort((a,b)=>a-b);
    if (daDays.length > 0) {
      const totalDa = daDays.reduce((sum, d) => sum + daDeductions[d], 0);
      categoryTexts.push(`DA: ${totalDa} (${daDays.length} days: ${daDays.join(",")})`);
    }

    // Hotel
    const hotelDays = Object.keys(hotelDeductions).map(Number).sort((a,b)=>a-b);
    if (hotelDays.length > 0) {
      const totalHotel = hotelDays.reduce((sum, d) => sum + hotelDeductions[d], 0);
      categoryTexts.push(`Hotel: ${totalHotel} (${hotelDays.length} days: ${hotelDays.join(",")})`);
    }

    // Spare
    const spareDays = Object.keys(spareDeductions).map(Number).sort((a,b)=>a-b);
    if (spareDays.length > 0) {
      const totalSpare = spareDays.reduce((sum, d) => sum + spareDeductions[d], 0);
      categoryTexts.push(`Spare: ${totalSpare} (${spareDays.length} days: ${spareDays.join(",")})`);
    }

    // Other
    const otherDays = Object.keys(otherDeductions).map(Number).sort((a,b)=>a-b);
    if (otherDays.length > 0) {
      const totalOther = otherDays.reduce((sum, d) => sum + otherDeductions[d], 0);
      categoryTexts.push(`Other: ${totalOther} (${otherDays.length} days: ${otherDays.join(",")})`);
    }

    const user_advance = advancesMap[(usr.user_id || "").toLowerCase()] || 0;
    const row_total = travel_expense + da_allowance + spare_purchase + courier_charges + boarding_lodging + printing_stationery;
    const net_payable = row_total - user_advance;

    // Next Month logic (e.g. July expense -> submitted date 5 August)
    const nextMonthMap = {
      january: "February",
      february: "March",
      march: "April",
      april: "May",
      may: "June",
      june: "July",
      july: "August",
      august: "September",
      september: "October",
      october: "November",
      november: "December",
      december: "January"
    };
    const mClean = month.trim().toLowerCase();
    let nextMonthName = "August";
    for (const [curr, next] of Object.entries(nextMonthMap)) {
      if (curr.startsWith(mClean) || mClean.startsWith(curr)) {
        nextMonthName = next;
        break;
      }
    }
    const submitted_date_val = `5 ${nextMonthName}`;

    // Case-insensitively deduplicate deduction reasons and comments
    const seenReasons = new Set();
    const uniqueReasons = [];
    for (const r of [...categoryTexts, ...allComments]) {
      if (!r) continue;
      const normalized = r.trim().toLowerCase().replace(/\s+/g, " ");
      if (!seenReasons.has(normalized)) {
        seenReasons.add(normalized);
        uniqueReasons.push(r.trim());
      }
    }
    const deduction_reason = uniqueReasons.join("; ");

    // Format Month as Month-Year (e.g. July-2026)
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
    const month_val = `${capitalizedMonth}-${year}`;

    // Resolve Manager Name
    const rawManager = (usr.manager || "").trim();
    const resolvedManager = rawManager && rawManager.toLowerCase() !== "none"
      ? (nameLookupMap[rawManager.toLowerCase()] || rawManager)
      : "";

    reportRows.push({
      zone: usr.zone || "",
      ee_code: usr.e_code || usr.user_id,
      grade: usr.grade || "",
      cc: usr.district || "",
      ee_name: usr.name,
      doj: usr.date_of_joining || "",
      submitted_date: submitted_date_val,
      mail_hard_copy: "Soft Copy",
      designation: usr.designation || "",
      travel_expense: Math.round(travel_expense * 100) / 100,
      bike_km: Math.round(bike_km * 100) / 100,
      car_km: Math.round(car_km * 100) / 100,
      auto_amount: Math.round(auto_amount * 100) / 100,
      train_bus_amount: Math.round(train_bus_amount * 100) / 100,
      da_allowance: Math.round(da_allowance * 100) / 100,
      spare_purchase: Math.round(spare_purchase * 100) / 100,
      courier_charges: Math.round(courier_charges * 100) / 100,
      boarding_lodging: Math.round(boarding_lodging * 100) / 100,
      printing_stationery: Math.round(printing_stationery * 100) / 100,
      misc_expenses: 0.0,
      fuel_expenses: 0.0,
      total: Math.round(row_total * 100) / 100,
      advance: Math.round(user_advance * 100) / 100,
      net_payable: Math.round(net_payable * 100) / 100,
      gst_bills: "",
      status: "Approved",
      deduction_reason: deduction_reason,
      month: month_val,
      hold_reason: "No",
      remarks: "",
      manager: resolvedManager,
      state: "Rajasthan",
      claimed_amount: Math.round(claimed_amount * 100) / 100
    });
  }

  return jsonResponse({ success: true, data: reportRows });
}

export async function handleServeExpenseAttachment(request, env, params, query, user) {
  return handleServeFile(request, env, params, query);
}

/**
 * GET /api/expense/team-users
 * Returns list of team members for whom the current user is a manager, coordinator, or zonal manager.
 */
export async function handleGetTeamUsers(request, env, params, query, user) {
  let teamUsers = [];
  const userRoleClean = (user.role || "").trim().toLowerCase();
  const isAdminOrReportViewer = hasFullAccess(userRoleClean);

  if (isAdminOrReportViewer) {
    const res = await env.DB.prepare("SELECT id, user_id, name, role, zone, district, designation, manager FROM users ORDER BY name ASC").all();
    teamUsers = res.results || [];
  } else {
    const nameClean = (user.name || "").trim();
    const uidClean = (user.user_id || "").trim();

    // Query direct reports
    const directReportsRes = await env.DB.prepare(`
      SELECT id, user_id, name, role, zone, district, designation, manager FROM users
      WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
         OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
      ORDER BY name ASC
    `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all();
    const directReports = directReportsRes.results || [];

    // Query hierarchy reports
    const hierarchyApprovals = await env.DB.prepare(`
      SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
    `).bind(user.id).all();
    
    let hierarchyReports = [];
    if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
      const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
      const placeholders = hIds.map(() => "?").join(",");
      const reqsRes = await env.DB.prepare(`
        SELECT u.id, u.user_id, u.name, u.role, u.zone, u.district, u.designation, u.manager FROM users u
        JOIN hierarchy_requesters hr ON u.id = hr.user_id
        WHERE hr.hierarchy_id IN (${placeholders})
        ORDER BY u.name ASC
      `).bind(...hIds).all();
      hierarchyReports = reqsRes.results || [];
    }

    // Merge and de-duplicate team users
    const reportsMap = {};
    for (const u of [...directReports, ...hierarchyReports]) {
      reportsMap[u.id] = u;
    }
    teamUsers = Object.values(reportsMap);
  }

  return jsonResponse(teamUsers);
}

/**
 * GET /api/expense/kpi-appraisal
 * Query parameter user_id, month, year.
 */
export async function handleGetKpiAppraisal(request, env, params, query, user) {
  const targetUserId = query.user_id;
  const month = query.month;
  const yearStr = query.year;
  
  if (!targetUserId || !month || !yearStr) {
    return jsonResponse({ error: "Missing required parameters: user_id, month, year" }, 400);
  }
  const year = parseInt(yearStr);

  // Authorization check: User can read their own. Managers can read their reports.
  if (targetUserId !== "self" && targetUserId !== user.user_id) {
    const isAllowed = await isManagerOfUser(user, targetUserId, env);
    if (!isAllowed) {
      return jsonResponse({ error: "Access denied" }, 403);
    }
  }

  const eCode = targetUserId === "self" ? user.user_id : targetUserId;

  const appraisal = await env.DB.prepare(`
    SELECT * FROM kpi_appraisals WHERE user_id = ? AND month = ? AND year = ?
  `).bind(eCode, month, year).first();

  if (!appraisal) {
    return jsonResponse({
      user_id: eCode,
      month,
      year,
      self_achieved_values: "{}",
      manager_achieved_values: "{}",
      core_ratings: "{}",
      submitted_by_self: 0,
      submitted_by_manager: 0
    });
  }

  return jsonResponse(appraisal);
}

/**
 * POST /api/expense/kpi-appraisal
 */
export async function handleSaveKpiAppraisal(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, month, year: yearVal, self_achieved_values, manager_achieved_values, core_ratings, type } = body;

  if (!user_id || !month || !yearVal || !type) {
    return jsonResponse({ error: "Missing required fields: user_id, month, year, type" }, 400);
  }

  const year = parseInt(yearVal);
  const targetCode = user_id === "self" ? user.user_id : user_id;

  // Authorization check
  if (type === "self") {
    if (targetCode !== user.user_id) {
      return jsonResponse({ error: "Access denied. Cannot submit self assessment for another user." }, 403);
    }
  } else if (type === "manager") {
    const isAllowed = await isManagerOfUser(user, targetCode, env);
    if (!isAllowed) {
      return jsonResponse({ error: "Access denied. You are not a manager of this user." }, 403);
    }
  } else {
    return jsonResponse({ error: "Invalid submission type" }, 400);
  }

  // Check if appraisal record exists
  const existing = await env.DB.prepare(`
    SELECT user_id FROM kpi_appraisals WHERE user_id = ? AND month = ? AND year = ?
  `).bind(targetCode, month, year).first();

  if (existing) {
    if (type === "self") {
      await env.DB.prepare(`
        UPDATE kpi_appraisals
        SET self_achieved_values = ?, submitted_by_self = 1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND month = ? AND year = ?
      `).bind(JSON.stringify(self_achieved_values || {}), targetCode, month, year).run();
    } else {
      await env.DB.prepare(`
        UPDATE kpi_appraisals
        SET manager_achieved_values = ?, core_ratings = ?, submitted_by_manager = 1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND month = ? AND year = ?
      `).bind(JSON.stringify(manager_achieved_values || {}), JSON.stringify(core_ratings || {}), targetCode, month, year).run();
    }
  } else {
    if (type === "self") {
      await env.DB.prepare(`
        INSERT INTO kpi_appraisals (user_id, month, year, self_achieved_values, manager_achieved_values, core_ratings, submitted_by_self, submitted_by_manager)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0)
      `).bind(targetCode, month, year, JSON.stringify(self_achieved_values || {}), "{}", "{}").run();
    } else {
      await env.DB.prepare(`
        INSERT INTO kpi_appraisals (user_id, month, year, self_achieved_values, manager_achieved_values, core_ratings, submitted_by_self, submitted_by_manager)
        VALUES (?, ?, ?, ?, ?, ?, 0, 1)
      `).bind(targetCode, month, year, "{}", JSON.stringify(manager_achieved_values || {}), JSON.stringify(core_ratings || {})).run();
    }
  }

  return jsonResponse({ success: true, message: "Appraisal saved successfully." });
}

// Helper: check hierarchy
async function isManagerOfUser(managerUser, targetUserId, env) {
  const managerRoleClean = (managerUser.role || "").trim().toLowerCase();
  if (["admin", "mis", "vp", "accountant", "hr", "project head", "travel desk", "travel tesk"].includes(managerRoleClean)) {
    return true;
  }
  
  const nameClean = (managerUser.name || "").trim();
  const uidClean = (managerUser.user_id || "").trim();
  
  const directReport = await env.DB.prepare(`
    SELECT id FROM users
    WHERE user_id = ? AND (
      LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
      OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
      OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
    )
  `).bind(
    targetUserId,
    nameClean.toLowerCase(), uidClean.toLowerCase(),
    nameClean.toLowerCase(), uidClean.toLowerCase(),
    nameClean.toLowerCase(), uidClean.toLowerCase()
  ).first();
  
  if (directReport) return true;

  // Check hierarchy
  const hierarchyApprovals = await env.DB.prepare(`
    SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
  `).bind(managerUser.id).all();

  if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
    const hIds = hierarchyApprovals.results.map(h => h.hierarchy_id);
    const placeholders = hIds.map(() => "?").join(",");
    const req = await env.DB.prepare(`
      SELECT u.id FROM users u
      JOIN hierarchy_requesters hr ON u.id = hr.user_id
      WHERE u.user_id = ? AND hr.hierarchy_id IN (${placeholders})
    `).bind(targetUserId, ...hIds).first();
    if (req) return true;
  }

  return false;
}

export async function handleGetPolicyRules(req, env, params, query) {
  try {
    const grade = query.grade ? decodeURIComponent(query.grade).trim() : null;
    let results;
    if (grade) {
      results = await env.DB.prepare(
        "SELECT * FROM allowance_master WHERE LOWER(grade) = ?"
      ).bind(grade.toLowerCase()).all();
    } else {
      results = await env.DB.prepare(
        "SELECT * FROM allowance_master ORDER BY grade ASC"
      ).all();
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: results.results || []
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        detail: `Failed to fetch policy rules: ${err.message}`
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}

export async function ensureFieldAssetTable(env) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS field_asset_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE NOT NULL,
        prefix_code TEXT DEFAULT '(8004890615671)',
        suffix_code TEXT NOT NULL,
        equipment_name TEXT NOT NULL,
        district TEXT,
        hospital_name TEXT NOT NULL,
        make TEXT,
        model TEXT,
        serial_number TEXT,
        has_warranty INTEGER DEFAULT 0,
        warranty_start_date TEXT,
        warranty_end_date TEXT,
        barcode_photo TEXT,
        serial_photo TEXT,
        model_photo TEXT,
        created_by_user_id TEXT,
        created_by_user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {
    console.error("ensureFieldAssetTable error:", e);
  }
}

export async function handleSaveFieldAsset(request, env, params, query, user) {
  try {
    await ensureFieldAssetTable(env);
    const body = await request.json();
    const {
      barcode, prefix_code, suffix_code, equipment_name, district,
      hospital_name, make, model, serial_number, has_warranty,
      warranty_start_date, warranty_end_date, barcode_photo,
      serial_photo, model_photo
    } = body;

    if (!barcode || !equipment_name || !hospital_name) {
      return jsonResponse({ success: false, error: "Missing mandatory asset fields" }, 400);
    }

    const userId = user?.id || user?.user_id || "USER";
    const userName = user?.name || user?.user_name || "Staff";

    await env.DB.prepare(`
      INSERT INTO field_asset_data (
        barcode, prefix_code, suffix_code, equipment_name, district,
        hospital_name, make, model, serial_number, has_warranty,
        warranty_start_date, warranty_end_date, barcode_photo,
        serial_photo, model_photo, created_by_user_id, created_by_user_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(barcode) DO UPDATE SET
        equipment_name = excluded.equipment_name,
        district = excluded.district,
        hospital_name = excluded.hospital_name,
        make = excluded.make,
        model = excluded.model,
        serial_number = excluded.serial_number,
        has_warranty = excluded.has_warranty,
        warranty_start_date = excluded.warranty_start_date,
        warranty_end_date = excluded.warranty_end_date,
        barcode_photo = COALESCE(excluded.barcode_photo, field_asset_data.barcode_photo),
        serial_photo = COALESCE(excluded.serial_photo, field_asset_data.serial_photo),
        model_photo = COALESCE(excluded.model_photo, field_asset_data.model_photo)
    `).bind(
      barcode, prefix_code || "(8004890615671)", suffix_code || "",
      equipment_name, district || "", hospital_name,
      make || "", model || "", serial_number || "",
      has_warranty ? 1 : 0, warranty_start_date || "", warranty_end_date || "",
      barcode_photo || "", serial_photo || "", model_photo || "",
      userId, userName
    ).run();

    return jsonResponse({ success: true, message: "Asset tagged successfully", barcode });
  } catch (err) {
    console.error("handleSaveFieldAsset error:", err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

export async function handleGetFieldAssetByBarcode(request, env, params, query, user) {
  try {
    await ensureFieldAssetTable(env);
    const barcode = (query.get("barcode") || "").trim();
    if (!barcode) {
      return jsonResponse({ success: false, error: "Missing barcode" }, 400);
    }

    const row = await env.DB.prepare(`
      SELECT * FROM field_asset_data WHERE barcode = ? OR suffix_code = ? OR barcode LIKE ?
    `).bind(barcode, barcode, `%${barcode}%`).first();

    if (!row) {
      return jsonResponse({ success: true, found: false });
    }

    return jsonResponse({ success: true, found: true, asset: row });
  } catch (err) {
    console.error("handleGetFieldAssetByBarcode error:", err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

export async function handleGetOpenCalls(request, env, params, query, user) {
  try {
    const barcode = (query.get("barcode") || "").trim();
    const complaintId = (query.get("complaint_id") || "").trim();

    let sql = `
      SELECT c.*, e.user_name, e.expense_code
      FROM expense_breakdown_calls c
      JOIN expenses e ON (c.exp_id = e.expense_code OR c.exp_id = CAST(e.id AS TEXT) OR c.exp_id = e.id)
      WHERE (LOWER(c.calls_status) LIKE '%open%' OR LOWER(c.calls_status) LIKE '%pending%')
    `;
    const paramsList = [];

    if (barcode) {
      sql += ` AND (c.barcode LIKE ? OR c.barcode = ?)`;
      paramsList.push(`%${barcode}%`, barcode);
    }
    if (complaintId) {
      sql += ` AND (c.calls_complaint_id LIKE ? OR c.calls_complaint_id = ?)`;
      paramsList.push(`%${complaintId}%`, complaintId);
    }

    sql += ` ORDER BY c.id DESC LIMIT 10`;

    const res = await env.DB.prepare(sql).bind(...paramsList).all();

    return jsonResponse({
      success: true,
      openCalls: res.results || []
    });
  } catch (err) {
    console.error("handleGetOpenCalls error:", err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}


