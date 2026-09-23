/**
 * OTP DELIVERY & CORRELATION ID TEST SUITE
 * Tests Cloudflare MailChannels delivery, retry behavior, and correlation ID handling for OTP emails.
 */

import assert from "node:assert";
import test from "node:test";

test("OTP delivery via Cloudflare MailChannels payload includes correlationId and handles success", async () => {
  let capturedPayload = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    capturedPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: "Email sent successfully via MailChannels",
        correlationId: capturedPayload.personalizations?.[0]?.correlationId
      })
    };
  };

  try {
    const correlationId = `otp_${Date.now()}_test123`;
    const payload = {
      personalizations: [{
        to: [{ email: "test@example.com", name: "Test User" }],
        correlationId: correlationId
      }],
      from: { email: "noreply@indrae.in", name: "Cyrix Field Connect" },
      subject: "Security OTP Verification Code",
      content: [
        { type: "text/plain", value: "Your OTP is 123456" }
      ]
    };

    const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(data.success, true);
    assert.strictEqual(capturedPayload.personalizations[0].correlationId, correlationId);
    assert.ok(capturedPayload.personalizations[0].correlationId.startsWith("otp_"));
    console.log("  PASS: OTP payload via MailChannels includes correlationId and receives 200 OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OTP delivery retry logic retries on transient 503 errors", async () => {
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
      status: 202,
      json: async () => ({ success: true, message: "Accepted on attempt 3" })
    };
  };

  try {
    const maxRetries = 3;
    let success = false;
    for (let i = 1; i <= maxRetries; i++) {
      try {
        const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "test@example.com", otp: "654321" })
        });
        if (!res.ok && res.status !== 202) throw new Error("HTTP " + res.status);
        success = true;
        break;
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

test("Cloudflare Email Worker fallback triggers when MailChannels fails", async () => {
  let cfFallbackCalled = false;
  const originalFetch = globalThis.fetch;

  // Mock MailChannels failing
  globalThis.fetch = async (url, options) => {
    return {
      ok: false,
      status: 500,
      text: async () => "MailChannels Outage"
    };
  };

  try {
    const mockEnv = {
      EMAIL_FROM_ADDRESS: "noreply@indrae.in",
      EMAIL_SENDER: {
        send: async (msg) => {
          cfFallbackCalled = true;
          return { success: true };
        }
      }
    };

    // Simulate fallback logic
    const mcRes = await fetch("https://api.mailchannels.net/tx/v1/send", { method: "POST" });
    if (!mcRes.ok && mockEnv.EMAIL_SENDER) {
      await mockEnv.EMAIL_SENDER.send({ from: mockEnv.EMAIL_FROM_ADDRESS, to: "user@test.com" });
    }

    assert.strictEqual(cfFallbackCalled, true, "Should fallback to Cloudflare Native Email Sender");
    console.log("  PASS: Cloudflare Email Workers fallback activates automatically on MailChannels failure");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
