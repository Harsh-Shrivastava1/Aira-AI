import { handleGmailCallback } from "../gmailService.js";

/**
 * GET /api/gmail/callback
 * Handles Google's OAuth 2.0 authorization code response.
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
    await handleGmailCallback(code, state);
    // Redirect back to AIRA app with success indicator
    return res.redirect("/?gmail=connected");
  } catch (err) {
    console.error("[Gmail Callback Error]:", err.message);
    if (err.message.includes("state")) {
      return res.status(400).json({ error: "Invalid or expired OAuth state parameter." });
    }
    return res.redirect(`/?gmail=error&reason=${encodeURIComponent("token_exchange_failed")}`);
  }
}
