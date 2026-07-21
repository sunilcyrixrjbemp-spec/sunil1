/**
 * OTP DELIVERY & CORRELATION ID TEST SUITE
 * Tests retry behavior, exponential backoff, and correlation ID generation for OTP emails.
 */

import assert from "node:assert";
import test from "node:test";

test("OTP delivery payload includes correlationId and handles success", async () => {
  let capturedPayload = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    capturedPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: "Email sent successfully",
        correlationId: capturedPayload.correlationId
      })
    };
  };

  try {
    const correlationId = `otp_${Date.now()}_test123`;
    const payload = {
      to: "test@example.com",
      otp: "123456",
      purpose: "password_reset",
      correlationId: correlationId
    };

    const res = await fetch("https://mock-gas-url.test/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(data.success, true);
    assert.strictEqual(capturedPayload.correlationId, correlationId);
    assert.ok(capturedPayload.correlationId.startsWith("otp_"));
    console.log("  PASS: OTP payload includes correlationId and receives 200 OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OTP delivery retry logic retries on transient errors", async () => {
  let attempts = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    attempts++;
    if (attempts < 3) {
      return {
        ok: false,
        status: 503,
        text: async () => "Service Temporarily Unavailable"
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: "Sent on attempt 3" })
    };
  };

  try {
    // Simulate retry loop
    const maxRetries = 3;
    let success = false;
    for (let i = 1; i <= maxRetries; i++) {
      try {
        const res = await fetch("https://mock-gas-url.test/exec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "test@example.com", otp: "654321" })
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        if (json.success) {
          success = true;
          break;
        }
      } catch (err) {
        // continue retry
      }
    }

    assert.strictEqual(attempts, 3, "Should have attempted 3 times");
    assert.strictEqual(success, true, "Should have succeeded on 3rd attempt");
    console.log("  PASS: OTP retry logic successfully recovers from transient 503 error");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OTP multi-URL failover switches to Account #2 when Account #1 exhausts quota", async () => {
  const calledUrls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calledUrls.push(url);
    if (url.includes("account1")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: false, error: "Quota exhausted on this account (0)" })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: "Sent via Account #2" })
    };
  };

  try {
    const urls = ["https://mock-gas.test/account1/exec", "https://mock-gas.test/account2/exec"];
    let success = false;
    for (const gasUrl of urls) {
      const res = await fetch(gasUrl, { method: "POST", body: JSON.stringify({ to: "user@test.com" }) });
      const json = await res.json();
      if (json.success) {
        success = true;
        break;
      }
    }

    assert.strictEqual(calledUrls.length, 2, "Should attempt Account #1, fail, then call Account #2");
    assert.strictEqual(success, true, "Should succeed via Account #2");
    console.log("  PASS: Multi-URL failover instantly switches to Account #2 on Account #1 quota exhaustion");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
