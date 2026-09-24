import assert from "node:assert";
import test from "node:test";
import { handleSubmitExpense } from "../src/routes/expense.js";

// ── Integration Test for handleSubmitExpense Production Endpoint ─────────────
test("Integration Test: handleSubmitExpense overrides client amount 5000 with calculated leg sum 2000", async () => {
  const recordedWrites = [];

  // Mock Cloudflare D1 Database Engine
  const mockDB = {
    prepare(sql) {
      const sqlLower = sql.toLowerCase();
      const bindFunc = (...args) => {
        return {
          async first(col) {
            if (sqlLower.includes("system_settings")) return null;
            if (sqlLower.includes("expenses") && sqlLower.includes("itinerary")) return null;
            if (sqlLower.includes("allowance_master")) return { max_km_per_month: 2000 };
            if (sqlLower.includes("hierarchy_approvers")) return null;
            return null;
          },
          async all() {
            if (sqlLower.includes("system_settings")) return { results: [] };
            if (sqlLower.includes("expense_code")) return { results: [] };
            if (sqlLower.includes("expense_itineraries")) return { results: [] };
            if (sqlLower.includes("hierarchy_approvers")) return { results: [] };
            return { results: [] };
          },
          async run() {
            recordedWrites.push({ sql, args });
            return { meta: { last_row_id: 101, changes: 1 } };
          }
        };
      };

      return {
        bind: bindFunc,
        async first(col) { return null; },
        async all() { return { results: [] }; },
        async run() {
          recordedWrites.push({ sql, args: [] });
          return { meta: { last_row_id: 101, changes: 1 } };
        }
      };
    },
    async batch(stmts) {
      const results = [];
      for (const s of stmts) {
        if (s && typeof s.run === "function") {
          results.push(await s.run());
        }
      }
      return results;
    }
  };

  const env = { DB: mockDB };

  // Prepare FormData with manipulated amount = 5000, but leg sum = 2000
  const formData = new FormData();
  const payloadStr = JSON.stringify({
    date: "2026-07-20",
    amount: 5000, // Client attempts to claim 5000!
    claim_month: "July",
    claim_year: 2026,
    description: "Integration test claim",
    itineraries: [
      {
        travel_type: "Outdoor",
        travel_mode: "BIKE",
        distance_km: 75,
        travel_amount: 750,
        da_amount: 250,
        hotel_amount: 0,
        local_purchase: 0,
        other_amount: 0
      },
      {
        travel_type: "Outdoor",
        travel_mode: "BIKE",
        distance_km: 75,
        travel_amount: 750,
        da_amount: 250,
        hotel_amount: 0,
        local_purchase: 0,
        other_amount: 0
      }
    ] // Actual Leg Sum = (500 + 250 + 250) * 2 = 2000
  });

  formData.append("payload", payloadStr);

  const request = new Request("http://localhost/api/expense", {
    method: "POST",
    body: formData
  });

  const user = {
    id: 42,
    user_id: "ENG42",
    role: "Admin",
    base_reporting_location: "Office Base"
  };

  // Directly execute production route handler: handleSubmitExpense
  const response = await handleSubmitExpense(request, env, {}, new URLSearchParams(), user);
  const resJson = await response.json();

  assert.strictEqual(response.status, 200, `API should return 200 OK, got: ${JSON.stringify(resJson)}`);
  assert.strictEqual(resJson.status, "success");

  // Inspect the recorded SQL INSERT INTO expenses query
  const expenseInsert = recordedWrites.find(w => w.sql.includes("INSERT INTO expenses"));
  assert.ok(expenseInsert, "INSERT INTO expenses SQL query must be executed");

  // In INSERT INTO expenses (user_id, month, year, amount, ...), 4th parameter bound is amount (index 3)
  const insertedAmount = expenseInsert.args[3];

  // VERIFY: The amount inserted into Database MUST be 2000, NOT 5000!
  assert.strictEqual(insertedAmount, 2000, "Database INSERT query MUST receive 2000 as the amount parameter");
  assert.notStrictEqual(insertedAmount, 5000, "Client manipulated amount 5000 MUST be overridden by server");
});

test("Integration Test: handleSubmitExpense safely handles empty string amounts without producing NaN or NULL", async () => {
  const recordedWrites = [];

  const mockDB = {
    prepare(sql) {
      const sqlLower = sql.toLowerCase();
      const bindFunc = (...args) => {
        return {
          async first() {
            if (sqlLower.includes("allowance_master")) return { max_km_per_month: 2000 };
            return null;
          },
          async all() { return { results: [] }; },
          async run() {
            recordedWrites.push({ sql, args });
            return { meta: { last_row_id: 102, changes: 1 } };
          }
        };
      };

      return {
        bind: bindFunc,
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() {
          recordedWrites.push({ sql, args: [] });
          return { meta: { last_row_id: 102, changes: 1 } };
        }
      };
    },
    async batch(stmts) {
      const results = [];
      for (const s of stmts) {
        if (s && typeof s.run === "function") {
          results.push(await s.run());
        }
      }
      return results;
    }
  };

  const env = { DB: mockDB };

  const formData = new FormData();
  const payloadStr = JSON.stringify({
    date: "2026-07-21",
    amount: "",
    claim_month: "July",
    claim_year: 2026,
    description: "Empty string amount test claim",
    itineraries: [
      {
        travel_type: "Outdoor",
        travel_mode: "BIKE",
        distance_km: "50",
        amount: "500",
        da_amount: "200",
        hotel_amount: "",
        local_purchase: "",
        other_amount: ""
      },
      {
        travel_type: "Outdoor",
        travel_mode: "BIKE",
        distance_km: "50",
        amount: "500",
        da_amount: "0",
        hotel_amount: "",
        local_purchase: "",
        other_amount: ""
      }
    ]
  });

  formData.append("payload", payloadStr);

  const request = new Request("http://localhost/api/expense", {
    method: "POST",
    body: formData
  });

  const user = {
    id: 42,
    user_id: "ENG42",
    role: "Admin",
    base_reporting_location: "Office Base"
  };

  const response = await handleSubmitExpense(request, env, {}, new URLSearchParams(), user);
  const resJson = await response.json();

  assert.strictEqual(response.status, 200, `API should return 200 OK, got: ${JSON.stringify(resJson)}`);
  assert.strictEqual(resJson.status, "success");

  const expenseInsert = recordedWrites.find(w => w.sql.includes("INSERT INTO expenses"));
  assert.ok(expenseInsert, "INSERT INTO expenses SQL query must be executed");

  const insertedAmount = expenseInsert.args[3];
  assert.strictEqual(insertedAmount, 1200, "Calculated amount should be exactly 1200 (500 + 200 + 500), not NaN or NULL");
  assert.strictEqual(isNaN(insertedAmount), false, "Amount must not be NaN");
});

