import { getGmailStatus } from "../gmailService.js";
import { verifyUserToken } from "../firebaseAdmin.js";

/**
 * GET /api/gmail/status
 * Returns Gmail connection status for the CURRENT authenticated user only.
 * Never exposes refresh tokens, access tokens, client secrets, or another user's data.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {
    const authResult = await verifyUserToken(req);
    if (!authResult.authenticated || !authResult.user?.uid) {
      return res.status(200).json({ connected: false, reason: "unauthenticated" });
    }

    const status = await getGmailStatus(authResult.user.uid);
    return res.status(200).json({
      connected: !!status.connected,
      emailAddress: status.emailAddress || null,
      messagesTotal: status.messagesTotal || 0,
    });
  } catch (err) {
    console.error("[Gmail Status Error]:", err.message);
    return res.status(500).json({ connected: false, error: "Failed to check Gmail status" });
  }
}
