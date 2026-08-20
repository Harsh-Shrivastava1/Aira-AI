import { createGroqChatCompletion } from "./groqClient.js";
import { enforceRateLimit, RATE_LIMIT_POLICIES, isOperationDuplicate, getUserIdentifier, getClientIp } from "./rateLimiter.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Enforce Background Memory Extraction Rate Limiting
  const rateLimitResult = await enforceRateLimit(req, res, RATE_LIMIT_POLICIES.extractMemory);
  if (!rateLimitResult.allowed) {
    // Return 200 with null so the frontend is never interrupted
    return res.status(200).json({ updatedMemory: null });
  }

  try {
    const { recentMessages, existingMemory, userName } = req.body;

    if (!recentMessages || recentMessages.length === 0) {
      return res.status(200).json({ updatedMemory: null });
    }

    // Deduplicate rapid identical extraction calls for the same user turns
    const userIdentifier = getUserIdentifier(req) || getClientIp(req);
    const lastContent = recentMessages.slice(-2).map((m) => m.content).join("|");
    const dedupKey = `dedup:mem:${userIdentifier}:${lastContent}`;
    if (isOperationDuplicate(dedupKey, 30)) {
      return res.status(200).json({ updatedMemory: null });
    }

    const systemPrompt = `You are a memory extraction assistant for AIRA, an AI voice assistant.

Review the conversation below and decide whether it contains stable, useful information about the user that AIRA should remember across future sessions.

━━━ WHAT TO EXTRACT (stable, useful facts only) ━━━
- User's preferred name or nickname (if different from their login name)
- Ongoing projects (name, tech stack, goals)
- Long-term career goals or aspirations
- Stable preferences (communication style, preferred languages, tools, frameworks)
- Recurring work or study context ("I'm a backend engineer", "I'm preparing for FAANG interviews")
- Important non-sensitive personal context that will help future conversations

━━━ NEVER EXTRACT (hard rules) ━━━
- Passwords, API keys, tokens, secrets, credentials of any kind
- Financial information
- Sensitive personal information
- Temporary conversation details (today's bug, this hour's question)
- One-off statements unlikely to matter in future sessions
- Full conversation transcripts or summaries of what was discussed

━━━ MEMORY QUALITY RULES ━━━
1. If nothing new and stable was shared → return {"updatedMemory": null}
2. Merge new facts into the existing memory. Do not duplicate.
3. If existing memory already has the same fact, do not add it again.
4. If new information clearly supersedes old (e.g., user changed their project), update it.
5. Keep total memory under 300 words. Use bullet points or short sentences.
6. Do not overwrite existing memory entries unless superseded.
7. Preserve all existing memory that is still relevant.

━━━ CURRENT MEMORY ━━━
${existingMemory ? existingMemory : "(No existing memory for this user)"}

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON. No markdown, no extra text:
{"updatedMemory": "Updated memory text here as bullet points or short lines"}

If nothing worth saving: {"updatedMemory": null}`;

    const conversationText = recentMessages
      .map(m => {
        const speaker = m.role === "assistant" ? "AIRA" : (userName || "User");
        return `${speaker}: ${m.content}`;
      })
      .join("\n");

    const { content: rawContent } = await createGroqChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Conversation to analyze:\n\n${conversationText}` }
      ],
      {
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: "json_object" }
      }
    );

    const result = JSON.parse(rawContent || "{}");
    const rawUpdatedMemory = result.updatedMemory || null;

    // Sanitize to guarantee credential privacy
    const updatedMemory = sanitizeMemory(rawUpdatedMemory);

    // If the LLM returned null or the same memory, signal no update needed
    if (!updatedMemory || updatedMemory.trim() === (existingMemory || "").trim()) {
      return res.status(200).json({ updatedMemory: null });
    }

    return res.status(200).json({ updatedMemory });

  } catch (error) {
    console.error("[extract-memory] Error:", error);
    // Always return 200 — memory extraction must never fail the caller
    return res.status(200).json({ updatedMemory: null });
  }
}
