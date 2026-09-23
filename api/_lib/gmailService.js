import { google } from "googleapis";
import { encryptToken, decryptToken, createOAuthState, verifyOAuthState } from "./tokenCrypto.js";
import { getAdminDb } from "./firebaseAdmin.js";

/**
 * Retrieve server environment configuration for Google OAuth.
 * Identifies the AIRA application globally (not an individual user).
 */
function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5173/api/gmail/callback";

  return { clientId, clientSecret, redirectUri };
}

/**
 * Initialize a base Google OAuth2Client instance for the AIRA application.
 */
export function getBaseOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Scopes required for Gmail integration:
 * - Read/search emails & threads
 * - Send emails & thread replies
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Generate Google OAuth 2.0 authorization URL bound to a verified Firebase UID.
 * Uses an HMAC-signed state token for serverless-proof CSRF protection.
 *
 * @param {string} uid - Verified Firebase UID
 * @returns {{ authUrl: string, state: string }}
 */
export function getGmailAuthUrl(uid) {
  if (!uid || typeof uid !== "string") {
    throw new Error("Firebase UID is required to generate Gmail authorization URL.");
  }

  const oauth2Client = getBaseOAuth2Client();
  const state = createOAuthState(uid);

  console.log(`[Gmail] OAuth authorization started for user: ${uid}`);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent", // Force consent so Google always provides a refresh_token
    state,
  });

  return { authUrl, state };
}

/**
 * Retrieve and decrypt a user's Gmail connection from Firestore.
 *
 * @param {string} uid - Verified Firebase UID
 * @returns {Promise<object|null>} Decrypted connection info or null
 */
export async function getUserGmailConnection(uid) {
  if (!uid || typeof uid !== "string") return null;

  try {
    const db = getAdminDb();
    const docSnap = await db.collection("gmailConnections").doc(uid).get();

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data();
    if (!data || !data.encryptedRefreshToken || data.status !== "connected") {
      return null;
    }

    const refreshToken = decryptToken(data.encryptedRefreshToken);
    return {
      ...data,
      refreshToken,
    };
  } catch (err) {
    console.error(`[Gmail Service] Error loading connection for user ${uid}:`, err.message);
    return null;
  }
}

/**
 * Initialize a Google OAuth2Client scoped exclusively to the specified Firebase user.
 *
 * @param {string} uid - Verified Firebase UID
 * @returns {Promise<google.auth.OAuth2>} Configured OAuth client
 */
export async function getOAuth2ClientForUser(uid) {
  if (!uid || typeof uid !== "string") {
    throw new Error("Firebase UID is required to access Gmail client.");
  }

  const connection = await getUserGmailConnection(uid);
  if (!connection || !connection.refreshToken) {
    throw new Error("Gmail is not connected for this user.");
  }

  const oauth2Client = getBaseOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: connection.refreshToken });

  return oauth2Client;
}

/**
 * Exchange OAuth callback code for tokens and persist the encrypted refresh token
 * to Firestore under gmailConnections/{uid}.
 *
 * @param {string} code - Google authorization code
 * @param {string} state - HMAC-signed state token containing verified UID
 * @returns {Promise<{ success: boolean, uid: string, googleEmail: string }>}
 */
export async function handleGmailCallback(code, state) {
  if (!state) {
    throw new Error("Missing OAuth state parameter.");
  }

  const stateVerification = verifyOAuthState(state);
  if (!stateVerification.valid || !stateVerification.uid) {
    throw new Error(stateVerification.error || "Invalid or expired OAuth state parameter.");
  }

  const uid = stateVerification.uid;

  if (!code) {
    throw new Error("Missing authorization code.");
  }

  const oauth2Client = getBaseOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Determine Google Email and User ID
  let googleEmail = null;
  let googleUserId = null;

  try {
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    googleEmail = userInfo.data?.email || null;
    googleUserId = userInfo.data?.id || null;
  } catch (userErr) {
    console.warn("[Gmail Callback] userinfo fetch failed, falling back to Gmail profile:", userErr.message);
  }

  if (!googleEmail) {
    try {
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      googleEmail = profile.data?.emailAddress || null;
    } catch (profileErr) {
      console.warn("[Gmail Callback] Gmail profile fetch failed:", profileErr.message);
    }
  }

  // Handle refresh token encryption
  const db = getAdminDb();
  const now = new Date().toISOString();

  let encryptedRefreshToken = null;
  if (tokens.refresh_token) {
    encryptedRefreshToken = encryptToken(tokens.refresh_token);
  } else {
    // Preserve existing encrypted token if user re-authorized without consent prompt returning a new refresh token
    const existing = await getUserGmailConnection(uid);
    if (existing?.encryptedRefreshToken) {
      encryptedRefreshToken = existing.encryptedRefreshToken;
    } else {
      throw new Error("Google did not return a refresh token. Please reconnect with consent.");
    }
  }

  const connectionData = {
    userId: uid,
    googleEmail: googleEmail || "unknown@gmail.com",
    googleUserId: googleUserId || null,
    encryptedRefreshToken,
    scopes: GMAIL_SCOPES,
    updatedAt: now,
    status: "connected",
  };

  // If first time connecting, set connectedAt
  const existingDoc = await db.collection("gmailConnections").doc(uid).get();
  if (!existingDoc.exists) {
    connectionData.connectedAt = now;
  }

  await db.collection("gmailConnections").doc(uid).set(connectionData, { merge: true });

  console.log(`[Gmail] OAuth connection successfully established for user: ${uid} (${googleEmail})`);

  return {
    success: true,
    uid,
    googleEmail: connectionData.googleEmail,
  };
}

/**
 * Disconnect Gmail for a specific user:
 * 1. Revokes Google credentials if possible
 * 2. Deletes gmailConnections/{uid} document
 * 3. Does not affect other users or other Firestore data
 *
 * @param {string} uid - Verified Firebase UID
 * @returns {Promise<{ success: boolean }>}
 */
export async function disconnectGmail(uid) {
  if (!uid || typeof uid !== "string") {
    throw new Error("Firebase UID is required to disconnect Gmail.");
  }

  try {
    const connection = await getUserGmailConnection(uid);
    if (connection?.refreshToken) {
      try {
        const oauth2Client = getBaseOAuth2Client();
        await oauth2Client.revokeToken(connection.refreshToken);
      } catch (revokeErr) {
        console.warn(`[Gmail Disconnect] Token revocation warning for user ${uid}:`, revokeErr.message);
      }
    }

    const db = getAdminDb();
    await db.collection("gmailConnections").doc(uid).delete();

    console.log(`[Gmail] Connection deleted for user: ${uid}`);
    return { success: true };
  } catch (err) {
    console.error(`[Gmail Disconnect Error] for user ${uid}:`, err.message);
    throw err;
  }
}

/**
 * Check whether Gmail is connected for a specific Firebase user.
 *
 * @param {string} uid - Verified Firebase UID
 * @returns {Promise<{ connected: boolean, emailAddress?: string, messagesTotal?: number, error?: string }>}
 */
export async function getGmailStatus(uid) {
  if (!uid || typeof uid !== "string") {
    return { connected: false };
  }

  const connection = await getUserGmailConnection(uid);
  if (!connection) {
    return { connected: false };
  }

  try {
    const oauth2Client = await getOAuth2ClientForUser(uid);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });

    return {
      connected: true,
      emailAddress: profile.data.emailAddress || connection.googleEmail || null,
      messagesTotal: profile.data.messagesTotal || 0,
    };
  } catch (err) {
    console.warn(`[Gmail Status] check failed for user ${uid}:`, err.message);
    // If token was explicitly revoked or expired, update status in Firestore
    if (err.message.includes("invalid_grant") || err.message.includes("revoked") || err.message.includes("invalid_token")) {
      try {
        const db = getAdminDb();
        await db.collection("gmailConnections").doc(uid).set({ status: "revoked" }, { merge: true });
      } catch (updateErr) {
        // Ignore
      }
      return { connected: false, error: "Token expired or revoked" };
    }

    // In test mode or when offline, preserve connection status from Firestore
    if (process.env.AIRA_TEST_MODE === "true") {
      return {
        connected: true,
        emailAddress: connection.googleEmail || null,
        messagesTotal: 0,
      };
    }

    return { connected: false, error: err.message };
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
    // 3. Fallback: recurse child parts
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
 * Search emails for a specific Firebase user by Gmail query string.
 *
 * @param {string} uid - Verified Firebase UID
 * @param {string} query - Gmail search query string
 * @param {number} maxResults - Max items to retrieve
 * @returns {Promise<Array>} List of formatted message summaries
 */
export async function searchEmails(uid, query = "", maxResults = 5) {
  const oauth2Client = await getOAuth2ClientForUser(uid);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  console.log(`[Gmail] Search executed for user ${uid}`);
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
          body: bodyText.substring(0, 1200),
        };
      } catch (err) {
        console.warn(`[Gmail] Could not load message ${msg.id} for user ${uid}:`, err.message);
        return null;
      }
    })
  );

  return detailedMessages.filter(Boolean);
}

/**
 * Retrieve an individual email message for a specific Firebase user.
 *
 * @param {string} uid - Verified Firebase UID
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<object>} Full message details
 */
export async function getMessage(uid, messageId) {
  const oauth2Client = await getOAuth2ClientForUser(uid);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

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
 * Retrieve all messages in an email thread for a specific Firebase user.
 *
 * @param {string} uid - Verified Firebase UID
 * @param {string} threadId - Gmail thread ID
 * @returns {Promise<object>} Thread object with messages array
 */
export async function getThread(uid, threadId) {
  const oauth2Client = await getOAuth2ClientForUser(uid);
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
 * Send an email for a specific Firebase user using Gmail API's messages.send.
 *
 * @param {string} uid - Verified Firebase UID
 * @param {object} params - { to, cc, bcc, subject, body, threadId, inReplyTo, references }
 * @returns {Promise<object>} Result with message ID and thread ID
 */
export async function sendEmail(uid, { to, cc, bcc, subject, body, threadId, inReplyTo, references }) {
  if (!uid || typeof uid !== "string") {
    throw new Error("Firebase UID is required to send email.");
  }
  if (!to || !to.trim()) {
    throw new Error("Recipient email address ('to') is required to send an email.");
  }

  const oauth2Client = await getOAuth2ClientForUser(uid);
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

  console.log(`[Gmail] Email sent successfully for user: ${uid}`);
  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds,
  };
}

/**
 * Reply to an existing email thread for a specific Firebase user.
 *
 * @param {string} uid - Verified Firebase UID
 * @param {object} params - { threadId, messageId, to, subject, body }
 * @returns {Promise<object>} Result with message ID and thread ID
 */
export async function replyToThread(uid, { threadId, messageId, to, subject, body }) {
  if (!uid || typeof uid !== "string") {
    throw new Error("Firebase UID is required to reply to thread.");
  }
  if (!threadId) {
    throw new Error("Thread ID is required to reply to an email thread.");
  }

  let inReplyTo = "";
  let references = "";
  let threadSubject = subject;
  let recipient = to;

  // Retrieve existing message or thread to pull reply headers
  try {
    const parentMsg = await getMessage(uid, messageId || threadId);
    if (parentMsg) {
      if (!recipient) {
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
    console.warn(`[Gmail] Could not fetch parent message for thread reply (user ${uid}):`, err.message);
  }

  return sendEmail(uid, {
    to: recipient,
    subject: threadSubject || "Re: Your message",
    body,
    threadId,
    inReplyTo,
    references,
  });
}
