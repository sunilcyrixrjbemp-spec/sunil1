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
        travel_mode: "BIKE",
        distance_km: 100,
        travel_amount: 1000,
        da_amount: 500,
        hotel_amount: 500,
        local_purchase: 0,
        other_amount: 0
      }
    ] // Actual Leg Sum = 1000 + 500 + 500 = 2000
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
