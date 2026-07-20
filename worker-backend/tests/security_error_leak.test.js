import assert from "node:assert";
import test from "node:test";
import { handleForgotPassword } from "../src/routes/auth.js";

// ── Security Verification Test: Prevent DB Leak & Verify Server Error Logging ──
test("Security Verification: DB Failure does not leak SQL/table details to client & logs error to console", async () => {
  // 1. Spy on console.error to verify server-side logging
  const loggedErrorMessages = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    loggedErrorMessages.push(args.map(a => (a && a.message) ? a.message : String(a)).join(" "));
    originalConsoleError(...args);
  };

  // 2. Mock D1 Database that throws a sensitive DB Error (simulating internal SQLite crash)
  const mockFailingDB = {
    prepare(sql) {
      throw new Error("FATAL_SQLITE_ERROR: UNIQUE constraint failed: users.user_id | SQL: SELECT * FROM users WHERE user_id = 'ENG999' | Stack: Error at sqlite3.c:4210");
    }
  };

  const env = { DB: mockFailingDB };

  // 3. Prepare Request Payload for Forgot Password
  const request = new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: "ENG999",
      date_of_birth: "1995-05-15"
    })
  });

  try {
    // 4. Call handleForgotPassword with failing DB
    const response = await handleForgotPassword(request, env, {}, new URLSearchParams());
    const resJson = await response.json();

    // ── VERIFICATION 1: Client Response Security ───────────────────────────────
    assert.strictEqual(response.status, 500, "Should return 500 Internal Server Error status");
    assert.strictEqual(resJson.status, "error");
    assert.strictEqual(resJson.error, "Failed to process forgot password request", "Client should receive clean, safe error message");

    // Ensure NO sensitive DB info or stack trace leaks to client
    const responseString = JSON.stringify(resJson);
    assert.strictEqual(responseString.includes("FATAL_SQLITE_ERROR"), false, "Client response MUST NOT contain raw error type");
    assert.strictEqual(responseString.includes("users.user_id"), false, "Client response MUST NOT leak table/column names");
    assert.strictEqual(responseString.includes("SELECT * FROM users"), false, "Client response MUST NOT leak raw SQL queries");
    assert.strictEqual(responseString.includes("sqlite3.c"), false, "Client response MUST NOT leak stack trace files");
    assert.strictEqual(resJson.detail, undefined, "Client response MUST NOT contain detail field");
    assert.strictEqual(resJson.stack, undefined, "Client response MUST NOT contain stack field");

    // ── VERIFICATION 2: Server Console Logging ─────────────────────────────────
    assert.ok(loggedErrorMessages.length > 0, "Server console MUST record the error log");
    const loggedText = loggedErrorMessages.join(" ");
    assert.ok(loggedText.includes("FATAL_SQLITE_ERROR"), "Server console log MUST capture full detailed error");
    assert.ok(loggedText.includes("Failed to process forgot password request"), "Server console log MUST capture error context");

  } finally {
    // Restore original console.error
    console.error = originalConsoleError;
  }
});

// ── Test Bulk Import Error Categorization ──────────────────────────────────
test("Bulk Import Categorization: SQLite constraint errors are safely mapped to admin categories", async () => {
  const { handleBulkImportHierarchies } = await import("../src/routes/admin.js");

  const mockFailingDB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("approval_hierarchies")) {
                throw new Error("UNIQUE constraint failed: approval_hierarchies.name");
              }
              return null;
            },
            async all() { return { results: [] }; }
          };
        },
        async all() { return { results: [] }; }
      };
    }
  };

  const env = { DB: mockFailingDB };
  const request = new Request("http://localhost/api/admin/hierarchies/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rows: [
        { hierarchy_name: "Test Hierarchy" }
      ]
    })
  });

  const adminUser = { role: "Admin" };
  const response = await handleBulkImportHierarchies(request, env, {}, new URLSearchParams(), adminUser);
  const resJson = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(resJson.failed_count, 1);
  assert.ok(resJson.errors.length > 0);
  assert.ok(resJson.errors[0].includes("Duplicate entry"), `Expected 'Duplicate entry' category, got: ${resJson.errors[0]}`);
  assert.strictEqual(resJson.errors[0].includes("UNIQUE constraint failed"), false, "Must not leak raw SQLite error text");
});

test("Bulk Import Batch Safety: Batch transaction failure does not leak raw SQL details to client", async () => {
  const { handleBulkCreateUsers } = await import("../src/routes/admin.js");

  const mockFailingBatchDB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() { return null; },
            async all() { return { results: [] }; }
          };
        },
        async all() { return { results: [] }; }
      };
    },
    async batch(statements) {
      throw new Error("FATAL_BATCH_TRANSACTION_ERROR: SQLite disk or constraint error");
    }
  };

  const env = { DB: mockFailingBatchDB };
  const request = new Request("http://localhost/api/admin/users/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      { e_code: "ENG102", name: "Test User 2", password: "Password123" }
    ])
  });

  const adminUser = { role: "Admin" };
  const response = await handleBulkCreateUsers(request, env, {}, new URLSearchParams(), adminUser);
  const resJson = await response.json();

  assert.strictEqual(response.status, 500);
  assert.strictEqual(resJson.status, "error");
  assert.strictEqual(resJson.error, "Failed to execute bulk user import");
  assert.strictEqual(JSON.stringify(resJson).includes("FATAL_BATCH_TRANSACTION_ERROR"), false);
});

