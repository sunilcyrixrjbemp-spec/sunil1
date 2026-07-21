/**
 * UPLOAD PIPELINE TEST
 * Tests the fix for the double-arrayBuffer() read bug in Cloudflare Workers.
 *
 * THE BUG: handleUploadImage() called file.arrayBuffer() once for the size
 * check, then uploadToGoogleDrive() called it again on the already-consumed
 * stream -> empty buffer -> empty base64 -> GAS upload failed with "Failed to upload photo".
 *
 * THE FIX: buffer is read exactly once in handleUploadImage/handleUploadDocument
 * and passed as ArrayBuffer through the entire pipeline to uploadToGoogleDrive.
 */

import assert from "node:assert";
import test from "node:test";
import { uploadToGoogleDrive, uploadFileWithFallback, handleUploadImage, handleUploadDocument } from "../src/routes/upload.js";

// Helper: create a 1x1 PNG pixel as ArrayBuffer
function makeMinimalPng() {
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes.buffer;
}

// ── Test 1: uploadToGoogleDrive accepts ArrayBuffer directly ─────────────────
test("uploadToGoogleDrive: accepts pre-read ArrayBuffer without double-read", async () => {
  let capturedPayload = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedPayload = JSON.parse(options.body);
    return {
      status: 200,
      json: async () => ({ success: true, fileId: "test_file_id_123" }),
      text: async () => ""
    };
  };

  try {
    const env = { GAS_WEB_APP_URL: "https://mock-gas.test/exec" };
    const pngBuffer = makeMinimalPng();
    const fileId = await uploadToGoogleDrive(env, pngBuffer, "July_2026", "test.jpg", "image/jpeg");

    assert.strictEqual(fileId, "test_file_id_123");
    assert.ok(capturedPayload, "GAS payload should be captured");
    assert.ok(capturedPayload.fileBase64.length > 10, "fileBase64 must be non-empty base64 string");
    assert.strictEqual(capturedPayload.mimeType, "image/jpeg");
    assert.strictEqual(capturedPayload.action, "upload_file");
    console.log("  PASS: uploadToGoogleDrive with ArrayBuffer, base64 len=" + capturedPayload.fileBase64.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Test 2: Empty buffer rejected early with clear error ─────────────────────
test("uploadToGoogleDrive: rejects empty ArrayBuffer", async () => {
  const env = { GAS_WEB_APP_URL: "https://mock-gas.test/exec" };
  const emptyBuffer = new ArrayBuffer(0);

  await assert.rejects(
    () => uploadToGoogleDrive(env, emptyBuffer, "July_2026", "test.jpg", "image/jpeg"),
    (err) => {
      assert.ok(err.message.includes("empty"), "Error should mention 'empty', got: " + err.message);
      return true;
    }
  );
  console.log("  PASS: empty buffer rejection working");
});

// ── Test 3: handleUploadImage reads buffer EXACTLY ONCE ──────────────────────
// This is the core regression test for the double-read bug.
// Simulates Cloudflare Worker one-shot stream behavior.
test("handleUploadImage: arrayBuffer() called exactly once (fixes double-read bug)", async () => {
  let arrayBufferCallCount = 0;
  let capturedPayload = null;
  const pngBuffer = makeMinimalPng();

  // Mock file that counts stream reads (simulates CF Worker one-shot stream)
  const mockFile = {
    name: "photo.jpg",
    type: "image/jpeg",
    size: pngBuffer.byteLength,
    arrayBuffer: async () => {
      arrayBufferCallCount++;
      // Simulate stream consumed on second read (Cloudflare Worker behavior)
      if (arrayBufferCallCount > 1) {
        return new ArrayBuffer(0); // BUG: this was causing empty base64
      }
      return pngBuffer;
    }
  };

  const mockFormData = { get: (key) => key === "file" ? mockFile : null };
  const mockRequest = { formData: async () => mockFormData };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedPayload = JSON.parse(options.body);
    return {
      status: 200,
      json: async () => ({ success: true, fileId: "image_456" }),
      text: async () => ""
    };
  };

  try {
    const env = { GAS_WEB_APP_URL: "https://mock-gas.test/exec" };
    const response = await handleUploadImage(mockRequest, env, {}, new URLSearchParams(), { user_id: "u1" });
    const result = await response.json();

    // CRITICAL CHECK: arrayBuffer() must have been called exactly once
    assert.strictEqual(arrayBufferCallCount, 1,
      "DOUBLE-READ BUG DETECTED: arrayBuffer() was called " + arrayBufferCallCount + " times. Must be exactly 1.");
    assert.strictEqual(result.url, "/api/upload/file/gdrive/image_456");
    assert.ok(capturedPayload.fileBase64.length > 10,
      "GAS fileBase64 must be non-empty. Empty means the double-read bug is present.");
    console.log("  PASS: buffer read exactly once. GAS base64 len=" + capturedPayload.fileBase64.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Test 4: handleUploadDocument same single-read guarantee ──────────────────
test("handleUploadDocument: arrayBuffer() called exactly once", async () => {
  let arrayBufferCallCount = 0;
  const pdfBuffer = new ArrayBuffer(512);
  new Uint8Array(pdfBuffer).fill(37); // '%PDF' like bytes

  const mockFile = {
    name: "document.pdf",
    type: "application/pdf",
    size: pdfBuffer.byteLength,
    arrayBuffer: async () => {
      arrayBufferCallCount++;
      if (arrayBufferCallCount > 1) return new ArrayBuffer(0);
      return pdfBuffer;
    }
  };

  const mockFormData = { get: (key) => key === "file" ? mockFile : null };
  const mockRequest = { formData: async () => mockFormData };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 200,
    json: async () => ({ success: true, fileId: "doc_789" }),
    text: async () => ""
  });

  try {
    const env = { GAS_WEB_APP_URL: "https://mock-gas.test/exec" };
    const response = await handleUploadDocument(mockRequest, env, {}, new URLSearchParams(), { user_id: "u1" });
    const result = await response.json();

    assert.strictEqual(arrayBufferCallCount, 1,
      "arrayBuffer() called " + arrayBufferCallCount + " times. Must be exactly 1.");
    assert.ok(result.url.startsWith("/api/upload/file/gdrive/"));
    console.log("  PASS: handleUploadDocument single-read verified");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Test 5: Oversized file rejected before upload attempt ────────────────────
test("handleUploadImage: rejects files over 10MB", async () => {
  const bigBuffer = new ArrayBuffer(11 * 1024 * 1024); // 11MB
  const mockFile = {
    name: "large.jpg",
    type: "image/jpeg",
    size: bigBuffer.byteLength,
    arrayBuffer: async () => bigBuffer
  };
  const mockFormData = { get: (key) => key === "file" ? mockFile : null };
  const mockRequest = { formData: async () => mockFormData };
  const env = {};

  const response = await handleUploadImage(mockRequest, env, {}, new URLSearchParams(), {});
  const result = await response.json();

  assert.strictEqual(response.status, 400);
  assert.ok(result.error.includes("10MB"), "Error must mention 10MB, got: " + result.error);
  console.log("  PASS: oversized file (11MB) rejected with 400");
});

// ── Test 6: Empty file rejected ──────────────────────────────────────────────
test("handleUploadImage: rejects empty files", async () => {
  const emptyBuffer = new ArrayBuffer(0);
  const mockFile = {
    name: "empty.jpg",
    type: "image/jpeg",
    size: 0,
    arrayBuffer: async () => emptyBuffer
  };
  const mockFormData = { get: (key) => key === "file" ? mockFile : null };
  const mockRequest = { formData: async () => mockFormData };
  const env = {};

  const response = await handleUploadImage(mockRequest, env, {}, new URLSearchParams(), {});
  const result = await response.json();

  assert.strictEqual(response.status, 400);
  assert.ok(result.error.toLowerCase().includes("empty"), "Error must mention 'empty', got: " + result.error);
  console.log("  PASS: empty file rejected with 400");
});
