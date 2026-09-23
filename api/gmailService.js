import { google } from "googleapis";
import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * In-memory OAuth state store with 10-minute TTL for CSRF protection.
 */
const stateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanupStates() {
  const now = Date.now();
  for (const [state, timestamp] of stateStore.entries()) {
    if (now - timestamp > STATE_TTL_MS) {
      stateStore.delete(state);
    }
  }
}

/**
 * Retrieve server environment configuration for Google OAuth.
 */
function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5173/api/gmail/callback";
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  return { clientId, clientSecret, redirectUri, refreshToken };
}

/**
 * Initialize a Google OAuth2Client instance.
 */
export function getOAuth2Client() {
  const { clientId, clientSecret, redirectUri, refreshToken } = getOAuthConfig();

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  if (refreshToken && refreshToken.trim()) {
    oauth2Client.setCredentials({ refresh_token: refreshToken.trim() });
  }

  return oauth2Client;
}

/**
 * Scopes required for Gmail integration:
 * - Read/search emails & threads
 * - Send emails & thread replies
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

/**
 * Generate Google OAuth 2.0 authorization URL with CSRF state protection.
 */
export function getGmailAuthUrl() {
  cleanupStates();
  const oauth2Client = getOAuth2Client();

  const state = crypto.randomBytes(24).toString("hex");
  stateStore.set(state, Date.now());

  console.log("[Gmail] OAuth authorization started");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent", // Force consent so Google always provides a refresh_token
    state,
  });

  return { authUrl, state };
}

/**
 * Safely persist GMAIL_REFRESH_TOKEN to .env file on disk for personal single-user app.
 */
function persistRefreshTokenToEnv(token) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    if (envContent.includes("GMAIL_REFRESH_TOKEN=")) {
      envContent = envContent.replace(/GMAIL_REFRESH_TOKEN=.*(\r?\n|$)/, `GMAIL_REFRESH_TOKEN=${token}$1`);
    } else {
      envContent += `\nGMAIL_REFRESH_TOKEN=${token}\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf-8");
    process.env.GMAIL_REFRESH_TOKEN = token;
  } catch (err) {
    console.error("[Gmail] Warning: Could not persist refresh token to .env file:", err.message);
  }
}

/**
 * Exchange OAuth callback code for tokens and store refresh token securely server-side.
 */
export async function handleGmailCallback(code, state) {
  cleanupStates();

  if (!state || !stateStore.has(state)) {
    throw new Error("Invalid or expired OAuth state parameter.");
  }
  stateStore.delete(state);

  if (!code) {
    throw new Error("Missing authorization code.");
  }

  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (tokens.refresh_token) {
    persistRefreshTokenToEnv(tokens.refresh_token);
  } else if (!process.env.GMAIL_REFRESH_TOKEN) {
    console.warn("[Gmail] No refresh_token returned by Google and none saved. Re-authorization with consent required.");
  }

  oauth2Client.setCredentials(tokens);
  console.log("[Gmail] OAuth callback successful");

  return { success: true };
}

/**
 * Verify whether Gmail is currently connected with a valid token.
 */
export async function getGmailStatus() {
  const { clientId, clientSecret, refreshToken } = getOAuthConfig();

  if (!clientId || !clientSecret || !refreshToken || !refreshToken.trim()) {
    return { connected: false };
  }

  try {
    const oauth2Client = getOAuth2Client();
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });

    return {
      connected: true,
      emailAddress: profile.data.emailAddress || null,
      messagesTotal: profile.data.messagesTotal || 0,
    };
  } catch (err) {
    console.warn("[Gmail] Status check failed:", err.message);
    return { connected: false, error: "Token expired or revoked" };
  }
}

/**
 * Decode base64 / base64url data safely.
 */
function decodeBase64(data) {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

/**
 * Clean and strip HTML tags to extract readable plain text.
 */
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .trim();
}

/**
 * Recursively parse MIME parts to extract the best text representation.
 */
function extractBodyFromPayload(payload) {
  if (!payload) return "";

  if (payload.body && payload.body.data) {
    const decoded = decodeBase64(payload.body.data);
    if (payload.mimeType === "text/html") {
      return stripHtml(decoded);
    }
    return decoded;
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    // 1. First priority: look for text/plain
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body && part.body.data) {
        return decodeBase64(part.body.data);
      }
    }
    // 2. Second priority: look for text/html
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body && part.body.data) {
        return stripHtml(decodeBase64(part.body.data));
      }
    }
    // 3. Fallback: recurse child parts (multipart/mixed or multipart/alternative)
    for (const part of payload.parts) {
      const nested = extractBodyFromPayload(part);
      if (nested) return nested;
    }
  }

  return "";
}

/**
 * Extract headers into a clean lookup map.
 */
function extractHeaders(payload) {
  const headers = {};
  if (payload && payload.headers && Array.isArray(payload.headers)) {
    for (const h of payload.headers) {
      headers[h.name.toLowerCase()] = h.value;
    }
  }
  return headers;
}

/**
 * Search emails by Gmail query string (e.g. "newer_than:7d", "from:Rahul", "is:unread").
 */
export async function searchEmails(query = "", maxResults = 5) {
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  console.log("[Gmail] Gmail search executed");
  const response = await gmail.users.messages.list({
    userId: "me",
    q: query || undefined,
    maxResults: Math.min(maxResults, 10),
  });

  const messagesList = response.data.messages || [];
  if (messagesList.length === 0) {
    return [];
  }

  // Fetch brief details for each matched message
  const detailedMessages = await Promise.all(
    messagesList.map(async (msg) => {
      try {
        const details = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });

        const payload = details.data.payload || {};
        const headers = extractHeaders(payload);
        const bodyText = extractBodyFromPayload(payload);

        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: details.data.snippet || "",
          from: headers["from"] || "Unknown Sender",
          to: headers["to"] || "Me",
          subject: headers["subject"] || "(No Subject)",
          date: headers["date"] || "",
          messageId: headers["message-id"] || "",
          body: bodyText.substring(0, 1200), // Keep length compact for LLM context
        };
      } catch (err) {
        console.warn(`[Gmail] Could not load message ${msg.id}:`, err.message);
        return null;
      }
    })
  );

  return detailedMessages.filter(Boolean);
}

/**
 * Retrieve an individual email message with full details.
 */
export async function getMessage(messageId) {
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  console.log("[Gmail] Message retrieved");

  const payload = response.data.payload || {};
  const headers = extractHeaders(payload);
  const body = extractBodyFromPayload(payload);

  return {
    id: response.data.id,
    threadId: response.data.threadId,
    snippet: response.data.snippet || "",
    from: headers["from"] || "Unknown Sender",
    to: headers["to"] || "Me",
    subject: headers["subject"] || "(No Subject)",
    date: headers["date"] || "",
    messageId: headers["message-id"] || "",
    inReplyTo: headers["in-reply-to"] || "",
    references: headers["references"] || "",
    body: body.substring(0, 2000),
  };
}

/**
 * Retrieve all messages in an email thread.
 */
export async function getThread(threadId) {
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const response = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages = (response.data.messages || []).map((msg) => {
    const payload = msg.payload || {};
    const headers = extractHeaders(payload);
    const body = extractBodyFromPayload(payload);

    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet || "",
      from: headers["from"] || "Unknown",
      to: headers["to"] || "Me",
      subject: headers["subject"] || "(No Subject)",
      date: headers["date"] || "",
      messageId: headers["message-id"] || "",
      body: body.substring(0, 1000),
    };
  });

  return {
    id: response.data.id,
    messages,
  };
}

/**
 * Create base64url-encoded RFC 2822 email message.
 */
export function createMimeMessage({ to, cc, bcc, subject, body, inReplyTo, references }) {
  const lines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject || "").toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
  ];

  if (cc && cc.trim()) lines.push(`Cc: ${cc.trim()}`);
  if (bcc && bcc.trim()) lines.push(`Bcc: ${bcc.trim()}`);
  if (inReplyTo && inReplyTo.trim()) lines.push(`In-Reply-To: ${inReplyTo.trim()}`);
  if (references && references.trim()) lines.push(`References: ${references.trim()}`);

  lines.push("", body || "");

  const mimeString = lines.join("\r\n");
  return Buffer.from(mimeString)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Send an email using Gmail API's messages.send.
 */
export async function sendEmail({ to, cc, bcc, subject, body, threadId, inReplyTo, references }) {
  if (!to || !to.trim()) {
    throw new Error("Recipient email address ('to') is required to send an email.");
  }

  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const raw = createMimeMessage({ to, cc, bcc, subject, body, inReplyTo, references });

  const requestBody = { raw };
  if (threadId) {
    requestBody.threadId = threadId;
  }

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody,
  });

  console.log("[Gmail] Email sent successfully");
  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds,
  };
}

/**
 * Reply to an existing email thread, preserving thread context and message IDs.
 */
export async function replyToThread({ threadId, messageId, to, subject, body }) {
  if (!threadId) {
    throw new Error("Thread ID is required to reply to an email thread.");
  }

  let inReplyTo = "";
  let references = "";
  let threadSubject = subject;
  let recipient = to;

  // Retrieve existing message or thread to pull reply headers
  try {
    const parentMsg = await getMessage(messageId || threadId);
    if (parentMsg) {
      if (!recipient) {
        // Extract raw email address from From: header e.g. "Rahul <rahul@example.com>" -> "rahul@example.com"
        const match = parentMsg.from.match(/<([^>]+)>/);
        recipient = match ? match[1] : parentMsg.from;
      }
      if (!threadSubject) {
        threadSubject = parentMsg.subject.startsWith("Re:") ? parentMsg.subject : `Re: ${parentMsg.subject}`;
      }
      inReplyTo = parentMsg.messageId;
      references = parentMsg.references
        ? `${parentMsg.references} ${parentMsg.messageId}`.trim()
        : parentMsg.messageId;
    }
  } catch (err) {
    console.warn("[Gmail] Could not fetch parent message for thread reply:", err.message);
  }

  return sendEmail({
    to: recipient,
    subject: threadSubject || "Re: Your message",
    body,
    threadId,
    inReplyTo,
    references,
  });
}
