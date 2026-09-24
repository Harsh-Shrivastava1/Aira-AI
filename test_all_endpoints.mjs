import assert from "assert";

const BASE_URL = "http://localhost:5173";

async function smokeTests() {
  console.log("=========================================");
  console.log("RUNNING AIRA ALL-ENDPOINTS SMOKE TESTS");
  console.log("=========================================");

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. User Profile endpoint
  await check("GET /api/userProfile returns Harsh's profile", async () => {
    const res = await fetch(`${BASE_URL}/api/userProfile`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.profile.identity.name, "Harsh Shrivastava");
  });

  // 2. Legacy /api/history rewrite
  await check("GET /api/history returns compatibility response", async () => {
    const res = await fetch(`${BASE_URL}/api/history`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "success");
    assert(data.message.includes("Firebase"));
  });

  // 3. Legacy /api/memory rewrite
  await check("GET /api/memory returns compatibility response", async () => {
    const res = await fetch(`${BASE_URL}/api/memory`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "success");
    assert(data.message.includes("Firebase"));
  });

  // 4. Gmail Status
  await check("GET /api/gmail/status responds with JSON", async () => {
    const res = await fetch(`${BASE_URL}/api/gmail/status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.connected, false);
    assert.strictEqual(data.reason, "unauthenticated");
  });

  // 5. Gmail Auth
  await check("GET /api/gmail/auth rejects unauthenticated caller with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/gmail/auth?redirect=false`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert(data.error.includes("Authentication required"));
  });

  // 6. Gmail Callback
  await check("GET /api/gmail/callback rejects forged state with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/gmail/callback?code=mock_code&state=mock_state`);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert(data.error.includes("state"));
  });

  // 7. Gmail Disconnect
  await check("POST /api/gmail/disconnect rejects unauthenticated caller with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/gmail/disconnect`, { method: "POST" });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert(data.error.includes("Authentication required"));
  });

  // 8. Title generation
  await check("POST /api/generate-title generates title", async () => {
    const res = await fetch(`${BASE_URL}/api/generate-title`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello AIRA, how are you today?" })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.title && typeof data.title === "string");
  });

  // 9. Extract memory
  await check("POST /api/extract-memory handles empty gracefully", async () => {
    const res = await fetch(`${BASE_URL}/api/extract-memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recentMessages: [] })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.updatedMemory, null);
  });

  // 10. File chat
  await check("POST /api/file-chat validates input", async () => {
    const res = await fetch(`${BASE_URL}/api/file-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
  });

  // 11. Evaluate
  await check("POST /api/evaluate validates input", async () => {
    const res = await fetch(`${BASE_URL}/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
  });

  // 12. Chat
  await check("POST /api/chat handles basic message", async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageHistory: [{ role: "user", content: "What is 2+2? Answer in one word." }]
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.reply && data.reply.length > 0);
  });

  console.log("=========================================");
  console.log(`SMOKE TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("=========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

smokeTests().catch((err) => {
  console.error("Smoke test failure:", err);
  process.exit(1);
});
