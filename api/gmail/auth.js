import { getGmailAuthUrl } from "../gmailService.js";

/**
 * GET /api/gmail/auth
 * Initiates the Google OAuth 2.0 authorization flow with CSRF state protection.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {
    const { authUrl } = getGmailAuthUrl();

    // If request asks for JSON explicitly, return { authUrl }
    if (req.headers.accept?.includes("application/json") && req.query?.redirect === "false") {
      return res.status(200).json({ authUrl });
    }

    // Redirect the browser to Google OAuth consent
    return res.redirect(authUrl);
  } catch (err) {
    console.error("[Gmail Auth Error]:", err.message);
    return res.status(500).json({ error: err.message || "Failed to initialize Gmail OAuth" });
  }
}
