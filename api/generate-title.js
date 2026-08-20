import { createGroqChatCompletion } from "./groqClient.js";

/**
 * Fast deterministic title extractor for common conversational intents
 */
function deriveDeterministicTitle(text = "") {
  const clean = text.trim().toLowerCase();
  if (!clean) return "General Chat";

  if (/^(hello|hi|hey|good\s+(morning|evening|afternoon)|howdy|greetings)\b/i.test(clean) && clean.length < 30) {
    return "General Chat";
  }

  if (/\b(java\s+interview|prepare\s+for\s+(my\s+)?java\s+interview)\b/i.test(clean)) {
    return "Java Interview Preparation";
  }

  if (/\b(react\s+error|fix\s+(this\s+)?react\s+error)\b/i.test(clean)) {
    return "React Error Fix";
  }

  if (/\b(developer|who\s+built\s+you|created\s+you|harsh\s+shrivastava)\b/i.test(clean)) {
    return "About AIRA's Developer";
  }

  if (/\b(devwatch|devwatchai)\b/i.test(clean)) {
    return "DevWatchAI Project";
  }

  if (/\b(propvera)\b/i.test(clean)) {
    return "PropVera Project";
  }

  if (/\b(sahara)\b/i.test(clean)) {
    return "Sahara Project";
  }

  if (/\b(flowspace)\b/i.test(clean)) {
    return "FlowSpace Project";
  }

  if (/\b(resume|cv|portfolio)\b/i.test(clean)) {
    return "Resume & Profile Discussion";
  }

  return null;
}

/**
 * Clean and normalize title to 2-6 words
 */
function sanitizeTitle(rawTitle, fallbackText) {
  if (!rawTitle || typeof rawTitle !== "string") {
    return deriveFallbackFromText(fallbackText);
  }

  let cleaned = rawTitle
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/^(title|chat\s*title|conversation\s*title):\s*/i, "")
    .trim();

  // Strip trailing punctuation
  cleaned = cleaned.replace(/[.,:;!?]+$/, "").trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 6) {
    return cleaned;
  }

  if (words.length > 6) {
    return words.slice(0, 5).join(" ");
  }

  return deriveFallbackFromText(fallbackText);
}

function deriveFallbackFromText(text) {
  if (!text) return "General Chat";
  const words = text
    .trim()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "General Chat";
  if (words.length <= 2 && (words[0].toLowerCase() === "hi" || words[0].toLowerCase() === "hello")) {
    return "General Chat";
  }

  const titleWords = words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return titleWords.join(" ") || "General Chat";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(200).json({ title: "General Chat" });
    }

    const trimmedMsg = message.trim();

    // 1. Fast deterministic patterns
    const fastTitle = deriveDeterministicTitle(trimmedMsg);
    if (fastTitle) {
      return res.status(200).json({ title: fastTitle });
    }

    // 2. Asynchronous LLM title generation
    try {
      const { content: rawTitle } = await createGroqChatCompletion(
        [
          {
            role: "system",
            content: "You are a concise title generator. Generate a 2-5 word human-readable title for a chat based on the user's message. Avoid generic titles like 'New Chat' or 'Help Request'. Return JSON: {\"title\": \"Short Title\"}"
          },
          { role: "user", content: trimmedMsg.slice(0, 200) }
        ],
        {
          temperature: 0.4,
          max_tokens: 30,
          response_format: { type: "json_object" }
        }
      );

      const parsed = JSON.parse(rawTitle || "{}");
      const title = sanitizeTitle(parsed.title, trimmedMsg);
      return res.status(200).json({ title });
    } catch (err) {
      console.warn("AI title generation fallback:", err.message);
      const fallback = sanitizeTitle(null, trimmedMsg);
      return res.status(200).json({ title: fallback });
    }
  } catch (error) {
    console.error("Title generation handler error:", error);
    return res.status(200).json({ title: "General Chat" });
  }
}
