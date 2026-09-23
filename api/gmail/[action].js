import authHandler from "../_lib/gmail/auth.js";
import callbackHandler from "../_lib/gmail/callback.js";
import statusHandler from "../_lib/gmail/status.js";
import disconnectHandler from "../_lib/gmail/disconnect.js";

export { authHandler, callbackHandler, statusHandler, disconnectHandler };

/**
 * Consolidated Vercel Serverless Function for Gmail operations:
 * - /api/gmail/auth
 * - /api/gmail/callback
 * - /api/gmail/status
 * - /api/gmail/disconnect
 *
 * This reduces 4 serverless functions down to 1 while preserving 100% of
 * the existing public API routes, security parameters, and Firebase UID bindings.
 */
export default async function handler(req, res) {
  // Extract action defensively from req.query.action or parse from URL pathname
  let action = req.query?.action;

  if (!action && req.url) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
      const segments = urlObj.pathname.split("/").filter(Boolean);
      // e.g. ['api', 'gmail', 'callback'] -> 'callback'
      action = segments[segments.length - 1];
    } catch {
      // Fallback if URL parsing fails
      const cleanUrl = req.url.split("?")[0].replace(/\/$/, "");
      action = cleanUrl.split("/").pop();
    }
  }

  // Normalize action name (strip query strings or trailing slashes if any)
  if (typeof action === "string") {
    action = action.trim().toLowerCase();
  }

  switch (action) {
    case "auth":
      return authHandler(req, res);

    case "callback":
      return callbackHandler(req, res);

    case "status":
      return statusHandler(req, res);

    case "disconnect":
      return disconnectHandler(req, res);

    default:
      return res.status(404).json({
        error: `Gmail endpoint action '${action || "unknown"}' not found. Available actions: auth, callback, status, disconnect.`,
      });
  }
}
