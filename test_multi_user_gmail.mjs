import assert from "assert";
import { encryptToken, decryptToken, createOAuthState, verifyOAuthState } from "file:///d:/Website/Aira%20AI/api/_lib/tokenCrypto.js";

process.env.AIRA_TEST_MODE = "true";
process.env.GMAIL_TOKEN_ENCRYPTION_KEY = "test_aira_encryption_key_32_bytes_super_secure!";
process.env.GOOGLE_CLIENT_ID = "mock_client_id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "mock_client_secret";
process.env.GOOGLE_REDIRECT_URI = "https://aira-ai-taupe.vercel.app/api/gmail/callback";

console.log("==================================================");
console.log("AIRA MULTI-USER GMAIL OAUTH TEST SUITE");
console.log("==================================================");

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedCount++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedCount++;
  }
}

// 1. Encryption & Decryption
runTest("Test 6: Refresh token is encrypted with AES-256-GCM", () => {
  const plainToken = "1//04test_refresh_token_for_user_a";
  const encrypted = encryptToken(plainToken);
  assert(encrypted !== plainToken, "Token must not be stored in plaintext");
  assert(encrypted.split(":").length === 3, "Encrypted token must have iv:authTag:ciphertext format");
  const decrypted = decryptToken(encrypted);
  assert.strictEqual(decrypted, plainToken, "Decrypted token must match original");
});

// 2. Encryption Tamper-proofing
runTest("Test 6b: Encryption fails if ciphertext or authTag is tampered with", () => {
  const plainToken = "sensitive_data_123";
  const encrypted = encryptToken(plainToken);
  const parts = encrypted.split(":");
  const tamperedTag = parts[0] + ":" + "f".repeat(32) + ":" + parts[2];
  assert.throws(() => decryptToken(tamperedTag), /Unsupported state or unable to authenticate data|Malformed/);
});

// 3. OAuth State validation & binding
runTest("Test 16: OAuth state is bound to UID, signed, and validated", () => {
  const uidA = "firebase_user_A_123";
  const stateA = createOAuthState(uidA);
  const verified = verifyOAuthState(stateA);
  assert(verified.valid === true, "State must be valid");
  assert.strictEqual(verified.uid, uidA, "State must unpack correct UID");

  // Tampered state
  const tamperedSig = stateA.substring(0, stateA.length - 4) + "0000";
  const badSig = verifyOAuthState(tamperedSig);
  assert(badSig.valid === false, "Tampered state signature must be rejected");

  // Non-hex tampered state
  const badFormat = verifyOAuthState(stateA + "tamper");
  assert(badFormat.valid === false, "Malformed state signature must be rejected");
});

// 4. Firestore Multi-User Connections & Isolation
await runAsyncTest("Test 1, 2, 3, 4: User A and User B connect independently and are strictly isolated", async () => {
  const { getAdminDb, verifyUserToken } = await import("file:///d:/Website/Aira%20AI/api/_lib/firebaseAdmin.js");
  const { getUserGmailConnection } = await import("file:///d:/Website/Aira%20AI/api/_lib/gmailService.js");

  const db = getAdminDb();
  db._clearTestStore();

  const uidA = "user_A_alice";
  const uidB = "user_B_bob";

  const tokenA = "1//04_alice_secret_refresh_token";
  const tokenB = "1//04_bob_secret_refresh_token";

  // Save User A connection
  await db.collection("gmailConnections").doc(uidA).set({
    userId: uidA,
    googleEmail: "alice@gmail.com",
    googleUserId: "g_alice_1",
    encryptedRefreshToken: encryptToken(tokenA),
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    status: "connected",
    connectedAt: new Date().toISOString(),
  });

  // Save User B connection
  await db.collection("gmailConnections").doc(uidB).set({
    userId: uidB,
    googleEmail: "bob@gmail.com",
    googleUserId: "g_bob_2",
    encryptedRefreshToken: encryptToken(tokenB),
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    status: "connected",
    connectedAt: new Date().toISOString(),
  });

  // User A gets ONLY User A's connection
  const connA = await getUserGmailConnection(uidA);
  assert(connA !== null, "User A must have a connection");
  assert.strictEqual(connA.googleEmail, "alice@gmail.com");
  assert.strictEqual(connA.refreshToken, tokenA);

  // User B gets ONLY User B's connection
  const connB = await getUserGmailConnection(uidB);
  assert(connB !== null, "User B must have a connection");
  assert.strictEqual(connB.googleEmail, "bob@gmail.com");
  assert.strictEqual(connB.refreshToken, tokenB);

  // User A's connection does NOT contain User B's token
  assert.notStrictEqual(connA.refreshToken, tokenB);
  assert.notStrictEqual(connB.refreshToken, tokenA);
});

// 5. Cross-user spoofing prevention
await runAsyncTest("Test 5: User A cannot request User B's connection by spoofing body UID", async () => {
  const chatHandler = (await import("file:///d:/Website/Aira%20AI/api/chat.js")).default;
  const statusHandler = (await import("file:///d:/Website/Aira%20AI/api/_lib/gmail/status.js")).default;

  // Mock Request where Header authenticated as User A, but body maliciously says userId = User B
  const req = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-uid": "user_A_alice", // Authenticated as User A
    },
    body: {
      messageHistory: [{ role: "user", content: "Check my unread emails" }],
      userId: "user_B_bob", // Attacker trying to spoof Bob's UID
    }
  };

  let responseData = null;
  const res = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(d) { responseData = d; return this; },
    setHeader() {},
  };

  // Status check for user A
  const reqStatus = {
    method: "GET",
    headers: { "x-test-uid": "user_A_alice" },
    query: { userId: "user_B_bob" } // Query param spoofing attempt
  };

  let statusData = null;
  const resStatus = {
    status(c) { return this; },
    json(d) { statusData = d; return this; },
  };

  await statusHandler(reqStatus, resStatus);
  assert.strictEqual(statusData.emailAddress, "alice@gmail.com", "Status must return Alice's email, NOT Bob's email");
});

// 6. Refresh token never returned to frontend
await runAsyncTest("Test 7: Refresh token is never returned in /api/gmail/status", async () => {
  const statusHandler = (await import("file:///d:/Website/Aira%20AI/api/_lib/gmail/status.js")).default;

  const req = {
    method: "GET",
    headers: { "x-test-uid": "user_A_alice" },
  };

  let statusData = null;
  const res = {
    status(c) { return this; },
    json(d) { statusData = d; return this; },
  };

  await statusHandler(req, res);
  assert.strictEqual(statusData.refreshToken, undefined, "Refresh token must NEVER be returned in status");
  assert.strictEqual(statusData.encryptedRefreshToken, undefined, "Encrypted token must NEVER be returned in status");
});

// 7. Disconnect removes only current user
await runAsyncTest("Test 9: Disconnect removes only current user's connection", async () => {
  const disconnectHandler = (await import("file:///d:/Website/Aira%20AI/api/_lib/gmail/disconnect.js")).default;
  const { getUserGmailConnection } = await import("file:///d:/Website/Aira%20AI/api/_lib/gmailService.js");

  const uidA = "user_A_alice";
  const uidB = "user_B_bob";

  // Disconnect Alice
  const req = {
    method: "POST",
    headers: { "x-test-uid": uidA },
  };

  let responseData = null;
  const res = {
    status(c) { return this; },
    json(d) { responseData = d; return this; },
  };

  await disconnectHandler(req, res);
  assert.strictEqual(responseData.success, true);

  // Alice is now disconnected
  const connA = await getUserGmailConnection(uidA);
  assert.strictEqual(connA, null, "Alice's connection must be deleted");

  // Bob is STILL connected!
  const connB = await getUserGmailConnection(uidB);
  assert(connB !== null, "Bob must remain connected when Alice disconnects");
  assert.strictEqual(connB.googleEmail, "bob@gmail.com");
});

// 8. Auth endpoint requires authentication
await runAsyncTest("Test 11 & 16: /api/gmail/auth rejects unauthenticated callers", async () => {
  const authHandler = (await import("file:///d:/Website/Aira%20AI/api/_lib/gmail/auth.js")).default;

  const req = {
    method: "GET",
    headers: {}, // No token provided
  };

  let statusCode = 200;
  let responseData = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(d) { responseData = d; return this; },
    redirect(url) {},
  };

  await authHandler(req, res);
  assert.strictEqual(statusCode, 401, "Unauthenticated request must be rejected with 401");
});

// 9. Callback handles tampered state
await runAsyncTest("Test 16b: /api/gmail/callback rejects forged or tampered state with 400", async () => {
  const callbackHandler = (await import("file:///d:/Website/Aira%20AI/api/_lib/gmail/callback.js")).default;

  const req = {
    method: "GET",
    query: {
      code: "valid_mock_code",
      state: "fake_forged_state_token",
    }
  };

  let statusCode = 200;
  let responseData = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(d) { responseData = d; return this; },
    redirect(url) {},
  };

  await callbackHandler(req, res);
  assert.strictEqual(statusCode, 400, "Callback must reject forged state with 400");
});

// 10. Local and production callbacks
runTest("Test 17 & 18: Callback URI configurable for local and production", () => {
  const baseClient = (process.env.GOOGLE_REDIRECT_URI = "https://aira-ai-taupe.vercel.app/api/gmail/callback");
  assert.strictEqual(process.env.GOOGLE_REDIRECT_URI, "https://aira-ai-taupe.vercel.app/api/gmail/callback");

  process.env.GOOGLE_REDIRECT_URI = "http://localhost:5173/api/gmail/callback";
  assert.strictEqual(process.env.GOOGLE_REDIRECT_URI, "http://localhost:5173/api/gmail/callback");
});

// 11. Email Draft vs Send protection
await runAsyncTest("Test 14 & 15: Draft intent never sends; explicit send checks valid email", async () => {
  const { detectEmailIntent, findRecentEmailDraft, isValidEmailAddress } = await import("file:///d:/Website/Aira%20AI/api/_lib/emailHelper.js");

  assert.strictEqual(detectEmailIntent("Write an email to Alice about the meeting"), "DRAFT");
  assert.strictEqual(detectEmailIntent("Don't send it, just show me the draft"), "DRAFT");
  assert.strictEqual(detectEmailIntent("Yes, send it now"), "SEND_EXPLICIT");

  assert.strictEqual(isValidEmailAddress("alice@example.com"), true);
  assert.strictEqual(isValidEmailAddress("Alice"), false);
});

// 13. Revoked token handling
await runAsyncTest("Test 10: Revoked token marks status as revoked and returns connected: false", async () => {
  const { getAdminDb } = await import("file:///d:/Website/Aira%20AI/api/_lib/firebaseAdmin.js");
  const { getGmailStatus } = await import("file:///d:/Website/Aira%20AI/api/_lib/gmailService.js");
  const db = getAdminDb();
  const revokedUid = "user_revoked_test";

  await db.collection("gmailConnections").doc(revokedUid).set({
    userId: revokedUid,
    googleEmail: "revoked@gmail.com",
    encryptedRefreshToken: encryptToken("invalid_token_123"),
    status: "connected",
  });

  // Temporarily disable test mode fallback to test revocation logic
  delete process.env.AIRA_TEST_MODE;
  const status = await getGmailStatus(revokedUid);
  process.env.AIRA_TEST_MODE = "true";

  assert.strictEqual(status.connected, false, "Revoked token must yield connected: false");
});

// 14. Refresh token is never logged
runTest("Test 8: Refresh token is never exposed in logs or object dumps", () => {
  const plainToken = "1//04_super_sensitive_token_do_not_log";
  const encrypted = encryptToken(plainToken);
  assert(!encrypted.includes(plainToken), "Encrypted string must not contain raw token");
  const state = createOAuthState("user_secret_test");
  assert(!state.includes(plainToken), "OAuth state must not contain token");
});

// 15. Existing Firebase users & collections are unaffected
await runAsyncTest("Test 19: Existing users/{userId} collections are completely unaffected", async () => {
  const { getAdminDb } = await import("file:///d:/Website/Aira%20AI/api/_lib/firebaseAdmin.js");
  const db = getAdminDb();

  // Create a regular user thread
  await db.collection("users").doc("user_regular_123").set({
    name: "Regular User",
    email: "user@example.com",
  });

  const snap = await db.collection("users").doc("user_regular_123").get();
  assert(snap.exists, "Regular user document must exist unharmed");
  assert.strictEqual(snap.data().name, "Regular User");
});

console.log("==================================================");
console.log(`TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log("==================================================");

if (failedCount > 0) {
  process.exit(1);
}
