import assert from "node:assert";
import test from "node:test";
import { getPasswordHash, verifyPassword, signJwt, verifyJwt } from "../src/utils/security.js";

test("Password Hashing and Verification", async () => {
  const plainPassword = "SuperSecurePassword123!";
  const hash = await getPasswordHash(plainPassword);

  assert.ok(hash.startsWith("pbkdf2_sha256$"), "Hash format should start with pbkdf2_sha256$");

  const isValid = await verifyPassword(plainPassword, hash);
  assert.strictEqual(isValid, true, "Correct password must verify to true");

  const isInvalid = await verifyPassword("WrongPassword", hash);
  assert.strictEqual(isInvalid, false, "Wrong password must verify to false");
});

test("JWT Signing and Verification", async () => {
  const payload = { userId: "USER123", role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 };
  const secret = "test-secret-key-32-chars-minimum!";

  const token = await signJwt(payload, secret);
  assert.ok(typeof token === "string" && token.split(".").length === 3, "JWT token must have 3 dot-separated parts");

  const verified = await verifyJwt(token, secret);
  assert.strictEqual(verified.userId, "USER123", "Payload userId should match");
  assert.strictEqual(verified.role, "admin", "Payload role should match");

  const invalidSecret = await verifyJwt(token, "wrong-secret");
  assert.strictEqual(invalidSecret, null, "Verification with wrong secret must return null");
});
