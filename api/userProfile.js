import { HARSH_PROFILE, resolveProfileContext, getCategoryProfileMemory } from "./_lib/userProfile.js";

export { HARSH_PROFILE, resolveProfileContext, getCategoryProfileMemory };

/**
 * GET /api/userProfile
 * Returns the public developer profile and long-term context information.
 * Also handles rewritten legacy stubs (/api/history and /api/memory).
 */
export default async function handler(req, res) {
  const action = req.query?.action;

  // Handle rewritten /api/history
  if (action === "history") {
    return res.status(200).json({
      status: "success",
      message: "History handled via frontend Firebase SDK",
    });
  }

  // Handle rewritten /api/memory
  if (action === "memory") {
    return res.status(200).json({
      status: "success",
      message: "Memory handled via frontend Firebase SDK",
    });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  return res.status(200).json({
    success: true,
    profile: HARSH_PROFILE,
  });
}
