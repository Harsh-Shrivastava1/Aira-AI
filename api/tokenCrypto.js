import crypto from "crypto";

/**
 * Returns a 32-byte key derived from GMAIL_TOKEN_ENCRYPTION_KEY.
 */
function getEncryptionKey() {
  const secret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!secret || !secret.trim()) {
    // In local development or testing, fall back to a deterministic development key if not configured,
    // but in production throw a descriptive error.
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required environment variable: GMAIL_TOKEN_ENCRYPTION_KEY");
    }
    // Deterministic dev fallback key
    return crypto.createHash("sha256").update("aira_local_development_encryption_secret_key_32b").digest();
  }
  return crypto.createHash("sha256").update(secret.trim()).digest();
}

/**
 * Encrypt a plaintext token using AES-256-GCM authenticated encryption.
 * @param {string} plaintext - Sensitive token string
 * @returns {string} iv:authTag:ciphertext (hex-encoded)
 */
export function encryptToken(plaintext) {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("Cannot encrypt empty or invalid token.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended 12 bytes for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted payload and verify authenticity.
 * @param {string} encryptedPayload - iv:authTag:ciphertext
 * @returns {string} Decrypted plaintext token
 */
export function decryptToken(encryptedPayload) {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new Error("Cannot decrypt empty or invalid payload.");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format. Expected iv:authTag:ciphertext.");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error("Malformed encryption initialization vector or authentication tag.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8"); // Throws if authentication tag verification fails

  return decrypted;
}

/**
 * Base64url encoding helper
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Base64url decoding helper
 */
function base64UrlDecode(str) {
  let normalized = str.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) {
    normalized += "=";
  }
  return Buffer.from(normalized, "base64").toString("utf8");
}

/**
 * Generate a cryptographically signed, tamper-proof OAuth state token bound to a Firebase UID.
 * Valid for 10 minutes.
 * @param {string} uid - Authenticated Firebase UID
 * @returns {string} Signed state token
 */
export function createOAuthState(uid) {
  if (!uid || typeof uid !== "string") {
    throw new Error("Firebase UID is required to create OAuth state.");
  }

  const payload = {
    uid: uid.trim(),
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000, // 10 minutes TTL
  };

  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = base64UrlEncode(payloadStr);

  const key = getEncryptionKey();
  const signature = crypto.createHmac("sha256", key).update(payloadBase64).digest("hex");

  return `${payloadBase64}.${signature}`;
}

/**
 * Verify an OAuth state token, validating the HMAC signature and expiration.
 * @param {string} stateString - state parameter received from Google callback
 * @returns {{ valid: boolean, uid?: string, error?: string }}
 */
export function verifyOAuthState(stateString) {
  if (!stateString || typeof stateString !== "string") {
    return { valid: false, error: "Missing or invalid OAuth state parameter." };
  }

  const parts = stateString.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed OAuth state parameter format." };
  }

  const [payloadBase64, providedSignature] = parts;

  // Signature must be exactly 64 hex characters (32 bytes HMAC-SHA256)
  if (!/^[0-9a-fA-F]{64}$/.test(providedSignature)) {
    return { valid: false, error: "Malformed OAuth state signature format." };
  }

  const key = getEncryptionKey();
  const expectedSignature = crypto.createHmac("sha256", key).update(payloadBase64).digest("hex");

  // Constant-time comparison to prevent timing attacks
  const providedBuf = Buffer.from(providedSignature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, error: "Invalid OAuth state signature. Possible CSRF attack." };
  }

  try {
    const payloadStr = base64UrlDecode(payloadBase64);
    const payload = JSON.parse(payloadStr);

    if (!payload.uid || !payload.exp) {
      return { valid: false, error: "Incomplete OAuth state payload." };
    }

    if (Date.now() > payload.exp) {
      return { valid: false, error: "OAuth state parameter has expired. Please initiate authorization again." };
    }

    return { valid: true, uid: payload.uid };
  } catch (err) {
    return { valid: false, error: "Failed to parse OAuth state payload." };
  }
}
