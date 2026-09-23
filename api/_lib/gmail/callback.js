import { handleGmailCallback } from "../gmailService.js";

/**
 * GET /api/gmail/callback
 * Handles Google's OAuth 2.0 authorization code response.
 * Cryptographically verifies the state token, extracts the authenticated Firebase UID,
 * encrypts the refresh token, and binds the connection to that user's Firestore document.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { code, state, error } = req.query || {};

  if (error) {
    console.warn("[Gmail Callback Warning]: OAuth was denied or encountered an error:", error);
    return res.redirect(`/?gmail=denied&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    console.warn("[Gmail Callback Warning]: Missing code or state parameter.");
    return res.status(400).json({ error: "Missing authorization code or state parameter." });
  }

  try {
    const result = await handleGmailCallback(code, state);
    console.log(`[Gmail Callback] Successfully linked Gmail to Firebase user: ${result.uid}`);
    // Redirect back to AIRA app with success indicator
    return res.redirect("/?gmail=connected");
  } catch (err) {
    console.error("[Gmail Callback Error]:", err.message);
    if (err.message.includes("state") || err.message.includes("CSRF")) {
      return res.status(400).json({
        error: "OAuth state verification failed. Possible expired or cross-site request.",
        details: err.message,
      });
    }
    return res.redirect(`/?gmail=error&reason=${encodeURIComponent(err.message || "token_exchange_failed")}`);
  }
}
