import { getGmailStatus } from "../gmailService.js";

/**
 * GET /api/gmail/status
 * Returns connection status without exposing any sensitive tokens or secrets.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {
    const status = await getGmailStatus();
    return res.status(200).json(status);
  } catch (err) {
    console.error("[Gmail Status Error]:", err.message);
    return res.status(500).json({ connected: false, error: "Failed to check Gmail status" });
  }
}
