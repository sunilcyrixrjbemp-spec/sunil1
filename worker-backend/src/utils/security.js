import bcrypt from "./bcrypt.js";

/**
 * Verify a plain text password against a PBKDF2 SHA256 or bcrypt hashed password
 */
export async function verifyPassword(plainPassword, hashedPassword) {
  try {
    if (hashedPassword.startsWith("pbkdf2_sha256$")) {
      const parts = hashedPassword.split("$");
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const keyHex = parts[3];

      const encoder = new TextEncoder();
      const baseKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(plainPassword),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: encoder.encode(salt),
          iterations: iterations,
          hash: "SHA-256"
        },
        baseKey,
        256 // 32 bytes
      );

      const newKeyHex = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return newKeyHex === keyHex;
    }

    // Default fallback to bcryptjs verification
    return bcrypt.compareSync(plainPassword, hashedPassword);
  } catch (e) {
    console.error("verifyPassword error:", e);
  }
  return false;
}

/**
 * Hash a plain text password using PBKDF2 SHA256
 */
export async function getPasswordHash(password) {
  const encoder = new TextEncoder();
  // Generate random 16 character salt
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const salt = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const iterations = 100000;

  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: iterations,
      hash: "SHA-256"
    },
    baseKey,
    256 // 32 bytes
  );

  const keyHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `pbkdf2_sha256$${iterations}$${salt}$${keyHex}`;
}

/**
 * Generate a JWT signed with HS256 algorithm
 */
export async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const encoder = new TextEncoder();
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verify a JWT signed with HS256 algorithm
 */
export async function verifyJwt(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBin = atob(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"));
    const signature = new Uint8Array(signatureBin.length);
    for (let i = 0; i < signatureBin.length; i++) {
      signature[i] = signatureBin.charCodeAt(i);
    }

    const valid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!valid) return null;

    const payloadBin = atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(decodeURIComponent(escape(payloadBin)));
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null; // Expired
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}
