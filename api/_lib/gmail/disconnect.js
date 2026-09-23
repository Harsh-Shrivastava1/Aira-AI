import { disconnectGmail } from "../gmailService.js";
import { verifyUserToken } from "../firebaseAdmin.js";

/**
 * POST /api/gmail/disconnect
 * Disconnects Gmail for the authenticated Firebase user:
 * - Revokes token with Google
 * - Deletes the user's document from gmailConnections/{uid}
 * - Does not touch user account or other data
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const authResult = await verifyUserToken(req);
    if (!authResult.authenticated || !authResult.user?.uid) {
      return res.status(401).json({ error: "Authentication required to disconnect Gmail." });
    }

    await disconnectGmail(authResult.user.uid);

    return res.status(200).json({
      success: true,
      message: "Gmail disconnected successfully.",
    });
  } catch (err) {
    console.error("[Gmail Disconnect Error]:", err.message);
    return res.status(500).json({ error: err.message || "Failed to disconnect Gmail." });
  }
}
