import { getGmailAuthUrl } from "../gmailService.js";
import { verifyUserToken } from "../firebaseAdmin.js";

/**
 * GET /api/gmail/auth
 * Initiates the Google OAuth 2.0 authorization flow bound to the authenticated Firebase user.
 * Requires a valid Firebase Auth ID token (via Authorization: Bearer <idToken> or ?token=<idToken>).
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {
    const authResult = await verifyUserToken(req);
    if (!authResult.authenticated || !authResult.user?.uid) {
      return res.status(401).json({
        error: "Authentication required. Please sign in to AIRA to connect your Gmail account.",
        details: authResult.error || "Missing or invalid Firebase ID token",
      });
    }

    const { authUrl } = getGmailAuthUrl(authResult.user.uid);

    // If client requested JSON or redirect=false, return { authUrl }
    if (req.headers.accept?.includes("application/json") || req.query?.redirect === "false") {
      return res.status(200).json({ authUrl });
    }

    // Direct browser redirect
    return res.redirect(authUrl);
  } catch (err) {
    console.error("[Gmail Auth Error]:", err.message);
    return res.status(500).json({ error: err.message || "Failed to initialize Gmail OAuth" });
  }
}
