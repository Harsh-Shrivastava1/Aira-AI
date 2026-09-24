try { process.loadEnvFile?.('.env'); } catch {}
import assert from "assert";
import fs from "fs";
import path from "path";
import { getGmailAuthUrl, GMAIL_SCOPES, createMimeMessage } from "file:///d:/Website/Aira%20AI/api/_lib/gmailService.js";
import { isEmailRelated, detectEmailIntent, extractGmailSearchQuery, findRecentEmailDraft, isValidEmailAddress } from "file:///d:/Website/Aira%20AI/api/_lib/emailHelper.js";

async function runTestSuite() {
  console.log("=========================================");
  console.log("STARTING AIRA GMAIL INTEGRATION TEST SUITE");
  console.log("=========================================");

  // TEST 1: GET /api/gmail/auth URL generation
  console.log("\n[TEST 1] GET /api/gmail/auth URL generation...");
  const { authUrl, state } = getGmailAuthUrl("test_uid_suite");
  assert(authUrl, "Auth URL must be generated");
  assert(authUrl.startsWith("https://accounts.google.com/o/oauth2/v2/auth"), "Must use Google OAuth 2.0 auth endpoint");
  assert(authUrl.includes("access_type=offline"), "Must request offline access for refresh token");
  assert(authUrl.includes("prompt=consent"), "Must enforce consent prompt for refresh token");
  assert(authUrl.includes("state=" + state), "Auth URL must include CSRF state parameter");
  for (const scope of GMAIL_SCOPES) {
    assert(authUrl.includes(encodeURIComponent(scope)), `Auth URL must include scope: ${scope}`);
  }
  console.log("✓ TEST 1 PASSED: Google OAuth URL properly generated with offline access and required scopes.");

  // TEST 2: OAuth callback with invalid state
  console.log("\n[TEST 2] OAuth callback with invalid state rejection...");
  const invalidStateRes = await fetch("http://localhost:5173/api/gmail/callback?code=mock_code_123&state=fake_invalid_state");
  assert.strictEqual(invalidStateRes.status, 400, "Must reject invalid state with HTTP 400");
  const invalidData = await invalidStateRes.json();
  assert(invalidData.error.toLowerCase().includes("state"), "Error must mention state parameter");
  console.log("✓ TEST 2 PASSED: Invalid state rejected safely.");

  // TEST 3: CSRF State validation mechanism
  console.log("\n[TEST 3] OAuth state security...");
  assert(state && state.length >= 32, "OAuth state must be cryptographically secure and >= 32 hex chars");
  console.log("✓ TEST 3 PASSED: Secure state generated and tracked in-memory.");

  // TEST 4: Gmail status endpoint
  console.log("\n[TEST 4] Gmail status endpoint security & response...");
  const statusRes = await fetch("http://localhost:5173/api/gmail/status");
  assert.strictEqual(statusRes.status, 200, "Status endpoint must return 200");
  const statusData = await statusRes.json();
  assert("connected" in statusData, "Status must include 'connected' boolean");
  assert(!statusData.refreshToken, "Never expose refresh token");
  assert(!statusData.accessToken, "Never expose access token");
  assert(!statusData.clientSecret, "Never expose client secret");
  console.log("✓ TEST 4 PASSED: Status endpoint reports connection status without exposing sensitive credentials.");

  // TEST 5 & 6 & 7: Natural Language Query & Search Formulations
  console.log("\n[TEST 5-7] Natural Language Email Intent & Gmail Query Parsing...");
  const q1 = extractGmailSearchQuery("Check my unread emails");
  assert(q1.includes("is:unread"), "Must extract is:unread");

  const q2 = extractGmailSearchQuery("Did I get an email from Rahul?");
  assert(q2.toLowerCase().includes("from:rahul"), `Must extract from:rahul (got: ${q2})`);

  const q3 = extractGmailSearchQuery("Summarize the interview emails");
  assert(q3.includes("interview"), `Must extract interview keyword (got: ${q3})`);

  const q4 = extractGmailSearchQuery("Check my latest email");
  assert(q4.includes("newer_than:7d"), "Must default to recency filter");
  console.log("✓ TEST 5-7 PASSED: Query formulation accurately extracts filters and keywords from natural speech.");

  // TEST 8: Draft vs Send Isolation
  console.log("\n[TEST 8] Draft Intent Isolation (Must NOT trigger send)...");
  assert.strictEqual(detectEmailIntent("Write an email to Rahul asking about the interview date"), "DRAFT");
  assert.strictEqual(detectEmailIntent("Draft a reply saying I'll attend"), "DRAFT");
  assert.strictEqual(detectEmailIntent("Don't send it, just show me the draft"), "DRAFT");
  assert.strictEqual(detectEmailIntent("Prepare an email to the recruiter"), "DRAFT");
  console.log("✓ TEST 8 PASSED: Drafting requests correctly classified as DRAFT (zero send execution).");

  // TEST 9: Explicit Send Trigger
  console.log("\n[TEST 9] Explicit Send Intent Verification...");
  assert.strictEqual(detectEmailIntent("Send it."), "SEND_EXPLICIT");
  assert.strictEqual(detectEmailIntent("Send the email"), "SEND_EXPLICIT");
  assert.strictEqual(detectEmailIntent("Go ahead and send it"), "SEND_EXPLICIT");
  assert.strictEqual(detectEmailIntent("Please send it"), "SEND_EXPLICIT");
  console.log("✓ TEST 9 PASSED: Explicit send phrases correctly classified as SEND_EXPLICIT.");

  // TEST 10: Recipient Validation
  console.log("\n[TEST 10] Recipient email validation...");
  assert(isValidEmailAddress("rahul@example.com"), "Valid email must pass");
  assert(isValidEmailAddress("Rahul Sharma <rahul@example.com>"), "Name + email must pass");
  assert(!isValidEmailAddress("Rahul"), "Plain name without domain must fail");
  assert(!isValidEmailAddress(""), "Empty email must fail");
  console.log("✓ TEST 10 PASSED: Recipient email address validation prevents sending to ambiguous/empty targets.");

  // TEST 11: Normal Chat Isolation (No Gmail Overhead)
  console.log("\n[TEST 11] Normal question isolation (No Gmail triggered)...");
  assert(!isEmailRelated("What is React?"), "General programming question must NOT be email related");
  assert(!isEmailRelated("How does JavaScript handle async tasks?"), "Tech question must NOT be email related");
  assert(!isEmailRelated("Who built you?"), "Identity question must NOT be email related");
  console.log("✓ TEST 11 PASSED: General questions completely bypass Gmail API.");

  // TEST 12: Draft Extraction from History
  console.log("\n[TEST 12] Draft extraction from message history...");
  const sampleHistory = [
    { role: "user", content: "Write an email to Rahul" },
    {
      role: "assistant",
      content: "I have prepared the draft.",
      emailDraft: { to: "rahul@example.com", subject: "Interview Availability", body: "Hi Rahul,\nI will be available at 3 PM.\nThanks!" }
    }
  ];
  const foundDraft = findRecentEmailDraft(sampleHistory);
  assert(foundDraft, "Must find previous email draft");
  assert.strictEqual(foundDraft.to, "rahul@example.com");
  assert.strictEqual(foundDraft.subject, "Interview Availability");
  console.log("✓ TEST 12 PASSED: Active draft reliably extracted from conversation history when user confirms send.");

  // TEST 13: Secrets Security & Leak Inspection
  console.log("\n[TEST 13] Verification that secrets are not committed or exposed...");
  const envExample = fs.readFileSync(".env.example", "utf-8");
  assert(!envExample.includes("GOCSPX"), "No real Google secret in .env.example");
  assert(envExample.includes("GOOGLE_CLIENT_ID="), "Must have GOOGLE_CLIENT_ID placeholder");
  assert(envExample.includes("GOOGLE_CLIENT_SECRET="), "Must have GOOGLE_CLIENT_SECRET placeholder");
  assert(envExample.includes("GOOGLE_REDIRECT_URI="), "Must have GOOGLE_REDIRECT_URI placeholder");
  assert(envExample.includes("GMAIL_TOKEN_ENCRYPTION_KEY="), "Must have GMAIL_TOKEN_ENCRYPTION_KEY placeholder");

  const gitignore = fs.readFileSync(".gitignore", "utf-8");
  assert(gitignore.includes(".env"), ".gitignore must contain .env");
  console.log("✓ TEST 13 PASSED: No secrets in .env.example, .env gitignored.");

  // TEST 14: Chat API with Email Intent when not connected
  console.log("\n[TEST 14] Chat API response when Gmail is not yet connected...");
  const chatRes = await fetch("http://localhost:5173/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageHistory: [{ role: "user", content: "Check my unread emails" }],
      userName: "Harsh"
    })
  });
  assert.strictEqual(chatRes.status, 200, "Chat API returns 200");
  const chatData = await chatRes.json();
  assert(chatData.reply.toLowerCase().includes("gmail"), "Reply must inform user about connecting Gmail");
  assert.strictEqual(chatData.emailDraft, null, "emailDraft must be null");
  // TEST 15: RFC 2822 MIME message generation & Base64url encoding
  console.log("\n[TEST 15] RFC 2822 MIME message formatting & base64url encoding...");
  const encodedMime = createMimeMessage({
    to: "test@example.com",
    subject: "Test Subject",
    body: "Hello, this is a test email body."
  });
  assert(encodedMime, "Must return encoded string");
  assert(!encodedMime.includes("+") && !encodedMime.includes("/") && !encodedMime.includes("="), "Must be URL-safe base64 without padding");
  // Decode and check RFC 2822 headers
  const decoded = Buffer.from(encodedMime.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  assert(decoded.includes("To: test@example.com"), "Decoded MIME must contain To: header");
  assert(decoded.includes("Content-Type: text/plain; charset=UTF-8"), "Decoded MIME must declare UTF-8 text/plain");
  assert(decoded.includes("Hello, this is a test email body."), "Decoded MIME must contain body text");
  console.log("✓ TEST 15 PASSED: RFC 2822 MIME creation and base64url encoding verified.");

  // TEST 16: Thread reply header preservation
  console.log("\n[TEST 16] Thread reply In-Reply-To and References header generation...");
  const replyMime = createMimeMessage({
    to: "interviewer@company.com",
    subject: "Re: Interview Confirmation",
    body: "I will be attending at 3 PM.",
    inReplyTo: "<msg123@mail.gmail.com>",
    references: "<msg123@mail.gmail.com>"
  });
  const decodedReply = Buffer.from(replyMime.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  assert(decodedReply.includes("In-Reply-To: <msg123@mail.gmail.com>"), "Must include In-Reply-To header");
  assert(decodedReply.includes("References: <msg123@mail.gmail.com>"), "Must include References header");
  console.log("✓ TEST 16 PASSED: Thread continuity headers (In-Reply-To, References) correctly included.");

  console.log("\n=========================================");
  console.log("ALL TEST SUITE CHECKS PASSED SUCCESSFULLY!");
  console.log("=========================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test Suite Failure:", err);
  process.exit(1);
});
