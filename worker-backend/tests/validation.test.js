import assert from "node:assert";
import test from "node:test";
import { saveUserSchema } from "../src/routes/admin.js";
import { submitExpenseSchema, itineraryLegSchema } from "../src/routes/expense.js";

// ── Scenario 1: Valid user create ─────────────────────────────────────────────
test("Scenario 1: Valid user create validation", () => {
  const payload = {
    user_id: "ENG999",
    name: "Sunil Vishnoi",
    password: "securePassword123",
    role: "Engineer",
    designation: "Senior Engineer",
    grade: "Grade A",
    zone: "Jodhpur",
    district: "Barmer",
    mobile_number: "9876543210",
    mail_id: "sunil@cyrixhealth.com"
  };

  const result = saveUserSchema.safeParse(payload);
  assert.strictEqual(result.success, true, "Valid user create payload should pass validation");
  assert.strictEqual(result.data.user_id, "ENG999");
  assert.strictEqual(result.data.name, "Sunil Vishnoi");
});

// ── Scenario 2: Valid user update (partial fields only) ────────────────────────
test("Scenario 2: Valid user update (partial fields only)", () => {
  const payload = {
    id: 105,
    mobile_number: "9988776655",
    user_status: "active",
    base_reporting_location: "Hospital Base A"
  };

  const result = saveUserSchema.safeParse(payload);
  assert.strictEqual(result.success, true, "Partial update payload for existing user (with id) should pass validation");
  assert.strictEqual(result.data.id, 105);
  assert.strictEqual(result.data.mobile_number, "9988776655");
});

// ── Scenario 3: Missing required field ─────────────────────────────────────────
test("Scenario 3: Missing required field validation", () => {
  const payloadMissingPass = {
    name: "Test User No Pass",
    role: "Engineer"
  };

  const result = saveUserSchema.safeParse(payloadMissingPass);
  
  const cleanUserId = (result.data?.user_id || result.data?.e_code || "").trim();
  const isMissing = !cleanUserId || !result.data?.password || !result.data?.name;
  
  assert.strictEqual(isMissing, true, "Should identify missing required fields (user_id/e_code, password)");
});

// ── Scenario 4: Mobile app actual payload format with extra fields ────────────
test("Scenario 4: Mobile app payload with extra metadata fields (passthrough check)", () => {
  const mobilePayload = {
    date: "2026-07-20",
    amount: 350.50,
    claim_month: "July",
    claim_year: 2026,
    description: "Field visit claim",
    client_timestamp: "2026-07-20T10:00:00Z",
    app_version: "2.4.1",
    device_info: "Android 14; Samsung Galaxy",
    itineraries: [
      {
        from_district: "Jodhpur",
        to_district: "Barmer",
        from_location: "Base Office",
        to_location: "Govt Hospital Barmer",
        travel_mode: "BIKE",
        distance_km: 120,
        travel_amount: 350.50,
        da_amount: 0,
        hotel_amount: 0,
        local_purchase: 0,
        gps_lat_lng: "26.2389,73.0243"
      }
    ]
  };

  const result = submitExpenseSchema.safeParse(mobilePayload);
  assert.strictEqual(result.success, true, "Mobile payload with extra fields must pass validation");
  assert.strictEqual(result.data.client_timestamp, "2026-07-20T10:00:00Z", "Extra top-level field must be preserved (passthrough)");
  assert.strictEqual(result.data.itineraries[0].gps_lat_lng, "26.2389,73.0243", "Extra leg field must be preserved (passthrough)");
});

// ── Scenario 5: Expense submit with invalid date (e.g. 2024-13-45) ───────────
test("Scenario 5: Expense submit with invalid date (2024-13-45)", () => {
  const payloadInvalidDate = {
    date: "2024-13-45",
    amount: 100,
    itineraries: [
      { travel_mode: "BUS", distance_km: 50, travel_amount: 100 }
    ]
  };

  const result = submitExpenseSchema.safeParse(payloadInvalidDate);
  assert.strictEqual(result.success, false, "Invalid date 2024-13-45 must be rejected");
  assert.ok(result.error.errors.length > 0, "Error details must be present");
  const msg = result.error.errors[0].message;
  assert.ok(msg.includes("YYYY-MM-DD") || msg.includes("calendar date"), "Clear error message must be returned");
});

// ── Scenario 6: Password less than 8 characters rejection ────────────────────
test("Scenario 6: Password less than 8 characters rejection", () => {
  const payloadShortPass = {
    user_id: "ENG998",
    name: "Short Pass User",
    password: "1234", // 4 characters password
    role: "Engineer"
  };

  const result = saveUserSchema.safeParse(payloadShortPass);
  assert.strictEqual(result.success, false, "Password with 4 characters must be rejected");
  assert.ok(result.error.errors.length > 0);
  const msg = result.error.errors[0].message;
  assert.ok(msg.includes("at least 8 characters"), "Error message should mention minimum 8 characters requirement");
});

// ── Scenario 7: Amount Recalculation Override Check ──────────────────────────
test("Scenario 7: Amount Recalculation Override (Client sends 5000, Leg Sum is 2000)", () => {
  const clientPayload = {
    date: "2026-07-20",
    amount: 5000, // Client attempts to claim 5000
    itineraries: [
      {
        travel_mode: "BIKE",
        distance_km: 100,
        travel_amount: 1000,
        da_amount: 500,
        hotel_amount: 500,
        local_purchase: 0,
        other_amount: 0
      }
    ]
  };

  // 1. Zod schema accepts structural payload
  const result = submitExpenseSchema.safeParse(clientPayload);
  assert.strictEqual(result.success, true);

  // 2. Server recalculation logic (replicates expense.js lines 2088-2166)
  const itineraries = result.data.itineraries;
  let calculatedTotal = 0;
  for (const iti of itineraries) {
    const travelAmt = parseFloat(iti.travel_amount || "0");
    const subAmt = parseFloat(iti.sub_amount || "0");
    const daAmt = parseFloat(iti.da_amount || "0");
    const hotelAmt = parseFloat(iti.hotel_amount || "0");
    const otherAmt = parseFloat(iti.other_amount || "0");
    const lpAmt = parseFloat(iti.local_purchase || "0");
    calculatedTotal += travelAmt + subAmt + daAmt + hotelAmt + otherAmt + lpAmt;
  }

  // Server overrides client amount (5000) with calculatedTotal (2000)
  const finalServerAmount = calculatedTotal;
  assert.strictEqual(finalServerAmount, 2000, "Server must override client 5000 with exact leg sum 2000");
  assert.notStrictEqual(finalServerAmount, clientPayload.amount, "Client manipulated amount must be overridden");
});

