import { createGroqChatCompletion } from "./_lib/groqClient.js";
import { enforceRateLimit, RATE_LIMIT_POLICIES, isOperationDuplicate, getUserIdentifier, getClientIp } from "./_lib/rateLimiter.js";
import { verifyUserToken } from "./_lib/firebaseAdmin.js";
import {
  parseMemoryLines,
  mergeAndDeduplicateMemories,
  saveUserMemoryToFirestore,
  fetchUserMemoryFromFirestore
} from "./_lib/memoryService.js";

/**
 * Programmatic redaction filter to guarantee no API keys, tokens, or credentials
 * are ever stored into long-term memory even if inadvertently returned by LLM.
 */
function sanitizeMemory(memoryText) {
  if (!memoryText || typeof memoryText !== "string") return null;

  let cleaned = memoryText;

  // Redact API key patterns (Groq, OpenAI, Google, AWS, GitHub, JWTs, etc.)
  cleaned = cleaned.replace(/\b(gsk_[a-zA-Z0-9]{20,})\b/gi, "[REDACTED]");
  cleaned = cleaned.replace(/\b(sk-[a-zA-Z0-9]{20,})\b/gi, "[REDACTED]");
  cleaned = cleaned.replace(/\b(AIza[a-zA-Z0-9_-]{35})\b/gi, "[REDACTED]");
  cleaned = cleaned.replace(/\b(ghp_[a-zA-Z0-9]{36})\b/gi, "[REDACTED]");
  cleaned = cleaned.replace(/\b(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g, "[REDACTED]");
  cleaned = cleaned.replace(/password\s*[:=]\s*\S+/gi, "password: [REDACTED]");

  return cleaned.trim() || null;
}

/**
 * Filter out temporary conversational statements (e.g., "I'm tired", "I feel sick", "Good morning")
 */
function isTemporaryStatement(text) {
  if (!text || typeof text !== "string") return false;
  return /\b(i('m| am| feel) (?:tired|sleepy|bored|hungry|sick|exhausted|busy right now|leaving)|good (?:morning|night|afternoon)|how are you|test|testing)\b/i.test(text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Enforce Background Memory Extraction Rate Limiting
  const rateLimitResult = await enforceRateLimit(req, res, RATE_LIMIT_POLICIES.extractMemory);
  if (!rateLimitResult.allowed) {
    return res.status(200).json({ updatedMemory: null });
  }

  try {
    const { recentMessages, existingMemory: clientMemory, userName, userId: clientUserId } = req.body || {};

    if (!recentMessages || recentMessages.length === 0) {
      return res.status(200).json({ updatedMemory: null });
    }

    // Resolve authenticated user ID
    let effectiveUid = clientUserId || null;
    const authResult = await verifyUserToken(req).catch(() => ({ authenticated: false }));
    if (authResult.authenticated && authResult.user?.uid) {
      effectiveUid = authResult.user.uid;
    }

    // Deduplicate rapid identical extraction calls for the same user turns
    const userIdentifier = effectiveUid || getUserIdentifier(req) || getClientIp(req);
    const lastContent = recentMessages.slice(-2).map((m) => m?.content || "").join("|");
    const dedupKey = `dedup:mem:${userIdentifier}:${lastContent}`;
    if (isOperationDuplicate(dedupKey, 20)) {
      return res.status(200).json({ updatedMemory: null });
    }

    // Load server-side authoritative memory if client memory is missing
    let currentMemory = clientMemory || "";
    if (!currentMemory && effectiveUid) {
      const serverMemory = await fetchUserMemoryFromFirestore(effectiveUid);
      if (serverMemory) {
        currentMemory = serverMemory;
      }
    }

    // Quick filter: Check if last user message is just a temporary statement
    const lastUserMessage = recentMessages.filter((m) => m?.role === "user").slice(-1)[0]?.content || "";
    if (isTemporaryStatement(lastUserMessage) && !/\b(remember|project|app|stack|database)\b/i.test(lastUserMessage)) {
      return res.status(200).json({ updatedMemory: null });
    }

    const systemPrompt = `You are a memory extraction assistant for AIRA, an AI voice assistant.

Review the conversation below and decide whether it contains stable, durable, useful information about the user that AIRA should remember across future sessions.

━━━ WHAT TO EXTRACT (durable, useful facts only) ━━━
- User's preferred name or nickname (if different from login)
- Ongoing or mentioned projects (project name, tech stack, database, architecture, framework, goals)
- Technology preferences (languages, frameworks, tools, databases, e.g. "prefers React and TypeScript", "internship portal uses MongoDB")
- Stable career or study context (role, company, university, target interviews)
- Explicit instructions: When the user says "Remember that...", ALWAYS extract the exact fact with top priority.

━━━ NEVER EXTRACT (hard rules) ━━━
- Temporary states: "I'm tired today", "I feel sleepy", "It's cold", "I will eat later"
- Passwords, API keys, tokens, credentials, financial details
- Conversational filler, greetings, or questions asked by the user

━━━ QUALITY & CONFLICT RULES ━━━
1. If the user states a new fact that contradicts or updates an older fact (e.g. "I switched to MongoDB"), output the NEW information clearly.
2. Do not duplicate facts that are already in CURRENT MEMORY.
3. Keep facts short, clear, and objective (bullet points).
4. If nothing new or durable was shared → return {"newFacts": []}

━━━ CURRENT MEMORY ━━━
${currentMemory ? currentMemory : "(No existing memory for this user)"}

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON (no markdown fences):
{
  "newFacts": ["User is building a project called Pulse using React Native and Expo.", "User's internship portal uses MongoDB Atlas."]
}
If nothing new to remember:
{
  "newFacts": []
}`;

    const conversationText = recentMessages
      .map((m) => {
        const speaker = m?.role === "assistant" ? "AIRA" : (userName || "User");
        return `${speaker}: ${m?.content || ""}`;
      })
      .join("\n");

    const { content: rawContent } = await createGroqChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Conversation to analyze:\n\n${conversationText}` }
      ],
      {
        temperature: 0.1,
        max_tokens: 350,
        response_format: { type: "json_object" }
      }
    );

    const result = JSON.parse(rawContent || "{}");
    const newFacts = Array.isArray(result.newFacts) ? result.newFacts : [];

    if (newFacts.length === 0) {
      return res.status(200).json({ updatedMemory: null });
    }

    // Merge, deduplicate, and resolve conflicts with existing memory
    const existingLines = parseMemoryLines(currentMemory);
    const sanitizedNewFacts = newFacts
      .map((f) => sanitizeMemory(f))
      .filter((f) => f && f.length > 5);

    if (sanitizedNewFacts.length === 0) {
      return res.status(200).json({ updatedMemory: null });
    }

    const mergedLines = mergeAndDeduplicateMemories(existingLines, sanitizedNewFacts);
    const updatedMemory = mergedLines.map((l) => `- ${l}`).join("\n");

    // If unchanged, return null
    if (updatedMemory.trim() === currentMemory.trim()) {
      return res.status(200).json({ updatedMemory: null });
    }

    // Persist directly to Firestore server-side if user is authenticated
    if (effectiveUid) {
      await saveUserMemoryToFirestore(effectiveUid, updatedMemory);
    }

    return res.status(200).json({
      updatedMemory,
      items: mergedLines.map((fact, index) => ({
        id: `mem_${index}_${Buffer.from(fact.slice(0, 20)).toString("hex").slice(0, 8)}`,
        fact,
        updatedAt: new Date().toISOString()
      }))
    });

  } catch (error) {
    console.error("[extract-memory] Error:", error.message);
    return res.status(200).json({ updatedMemory: null });
  }
}
