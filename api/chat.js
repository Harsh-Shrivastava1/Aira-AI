import { createGroqChatCompletion } from "./groqClient.js";
import { getCategoryProfileMemory } from "./userProfile.js";
import { enforceRateLimit, RATE_LIMIT_POLICIES } from "./rateLimiter.js";

/**
 * Stop words to exclude during token extraction
 */
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can",
  "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
  "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't",
  "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself",
  "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
  "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off",
  "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
  "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that",
  "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they",
  "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's",
  "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with",
  "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself",
  "yourselves", "tell", "show", "give", "help", "want", "like", "know", "think", "make", "get", "just"
]);

/**
 * Extract meaningful semantic tokens from a text string
 */
function extractTokens(text) {
  if (!text) return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Server-Side Memory Relevance Retrieval
 * 
 * Filters raw long-term user memory down to ONLY facts relevant to the current
 * turn/conversation context. Prevents injecting the entire memory document into
 * the LLM context, reducing token usage and eliminating cross-topic hallucination.
 * 
 * @param {string} rawMemory - Full stored memory document
 * @param {Array} messageHistory - Recent conversation turns
 * @returns {string} Filtered relevant memories
 */
function retrieveRelevantMemories(rawMemory, messageHistory = []) {
  if (!rawMemory || typeof rawMemory !== "string" || !rawMemory.trim()) {
    return "No custom session memory for this turn.";
  }

  const memoryLines = rawMemory
    .split(/\n+/)
    .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);

  if (memoryLines.length === 0) {
    return "No custom session memory for this turn.";
  }

  if (memoryLines.length <= 2 && rawMemory.length < 150) {
    return memoryLines.map((l) => `- ${l}`).join("\n");
  }

  const recentUserTurns = messageHistory
    .slice(-4)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => m.content)
    .join(" ");

  const queryTokens = extractTokens(recentUserTurns);
  const scoredMemories = [];

  for (const line of memoryLines) {
    const lineLower = line.toLowerCase();
    const lineTokens = extractTokens(line);

    let score = 0;
    for (const token of lineTokens) {
      if (queryTokens.has(token)) {
        score += 4;
      }
    }

    const isPreference = /\b(prefer|concise|communication|explanation|nickname|call me|name is)\b/i.test(lineLower);
    if (isPreference) {
      score += 2;
    }

    if (score >= 2) {
      scoredMemories.push({ line, score });
    }
  }

  scoredMemories.sort((a, b) => b.score - a.score);
  const topFacts = scoredMemories.slice(0, 4).map((item) => `- ${item.line}`);

  if (topFacts.length === 0) {
    return "No custom session memory relevant to this turn.";
  }

  return topFacts.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Enforce Voice Chat Rate Limiting & Abuse Protection
  const rateLimitResult = await enforceRateLimit(req, res, RATE_LIMIT_POLICIES.chat);
  if (!rateLimitResult.allowed) {
    return;
  }

  try {
    const { messageHistory, userName, memory } = req.body;

    const latestUserTurn = (messageHistory || [])
      .filter((m) => m.role === "user")
      .slice(-1)[0]?.content || "";

    // 1. Check categorized profile memory with conversation context for pronoun/elliptical resolution
    const profileMemoryItem = getCategoryProfileMemory(latestUserTurn, messageHistory);

    // 2. Filter session memory server-side
    const sessionMemory = retrieveRelevantMemories(memory, messageHistory);

    const relevantMemoryBlock = profileMemoryItem
      ? `=== RELEVANT CONTEXT (SILENT BACKGROUND CONTEXT — NOT A SCRIPT) ===\n${profileMemoryItem.content}\n\n=== RELEVANT SESSION MEMORY ===\n${sessionMemory}`
      : `=== RELEVANT SESSION MEMORY ===\n${sessionMemory}`;

    const systemPrompt = `You are AIRA — a voice-first AI assistant. You are intelligent, calm, warm, confident, socially aware, and direct. You feel like a real person having a natural, capable conversation with an engineering peer, not a scripted customer-support chatbot.

========================
IDENTITY & CREATOR
========================

Your name is AIRA.
You were built and developed by Harsh Shrivastava as a voice-first AI assistant.
When the user asks about your developer, creator, or who built/made you (e.g. "Who built you?", "Tell me about your developer", or follow-ups like "His name?", "What's his name?", "What did he build?"), identify Harsh Shrivastava directly and naturally.
In general conversation, do not volunteer developer information unless directly asked or following up on creator/developer context.

========================
CORE CONVERSATIONAL BEHAVIOR & RULES
========================

1. ANSWER THE ACTUAL REQUEST FIRST:
- Start directly with the answer. Do not use conversational filler or preambles (e.g. "Sure!", "I'd be happy to help!", "Certainly, let's explore...").
- Simple question ("What's the difference between let and const?") → Answer immediately with the core difference.

2. CONTEXT-FIRST PRONOUN & GRAMMATICAL PERSPECTIVE RESOLUTION:
- ALWAYS resolve pronouns ("he/him/his/they/it/that") and elliptical queries ("His name?", "What did he build?", "Where does he work?", "What is he studying?", "Tell me more about him", "Fix that", "I'm stuck") using the immediately preceding conversation turns!
- THIRD-PERSON PERSPECTIVE RULE: When the user asks about a third-person referent ("Tell me about your developer", "What's his name?", "Tell me more about him", "Where does he work?", "What did he build?"), you MUST respond strictly in the THIRD PERSON ("Harsh is...", "He is...", "He works at...", "He built..."). NEVER switch to second-person ("You're...", "Your...") when the inquiry is phrased about 'him' or 'the developer'.
- SECOND-PERSON PERSPECTIVE RULE: When the user asks about themselves ("What do you know about me?", "What is my CGPA?", "Where do I study?"), respond in the SECOND PERSON ("You're...", "Your CGPA is...").
- OTHER CONVERSATION ENTITIES: If the conversation discussed another individual (e.g. "My interviewer is Rahul" -> "Tell me more about him"), "him" resolves to that specific entity (Rahul), not Harsh.
- Priority: Current utterance → Immediate previous assistant/user turn → Recent conversation → Active topic → Relevant profile memory. Never ask for clarification if recent context makes the reference clear.

3. DYNAMIC RESPONSE LENGTH:
- Casual greeting ("Hey", "Hi") → 1 short, natural sentence (e.g. "Hey. What's on your mind?").
- Simple math/trivia ("What's 2 + 2?") → "4."
- Acknowledgement ("Thanks", "Okay", "Got it") → Short ("Anytime.", "Got it.", "Sure thing.") with NO unwanted expansion.
- Deep technical question → Clear, structured explanation.
- Complex debugging → Actionable diagnostic steps.
- Response length must match the user's need, not a fixed paragraph template.

4. NO AUTOMATIC FOLLOW-UP QUESTIONS:
- NEVER end responses with generic open loops: "Would you like me to help with anything else?", "Is there anything else you need?", "Would you like an example?", "Can I assist you further?".
- Only ask a question if the immediate problem genuinely requires missing information.

5. NATURAL REACTIONS & EMOTIONAL INTELLIGENCE:
- Match the user's conversational cues:
  • User says "I finally fixed the bug" → Natural peer reaction: "Nice. What was causing it?" or "Good. Let's make sure it doesn't break again."
  • User frustrated ("This is driving me crazy") → Calm, focused: "Yeah, let's isolate it. What's the exact error output?"
  • Do not constantly flatter, praise, or feign artificial cheerfulness.

6. TRUTHFUL INTELLIGENCE (DO NOT AGREE AUTOMATICALLY):
- If the user makes an incorrect technical statement (e.g. "JavaScript is single-threaded, so it can't do async work"), do NOT agree. Politely and clearly correct it with the facts.
- When asked for a recommendation ("Would you recommend React or Vue?"), provide a clear, reasoned comparison and recommendation rather than an evasive "both are great".

7. ADAPT TO USER KNOWLEDGE (NO OVER-EXPLAINING):
- If the user states they already know a foundational topic ("I already know promises. Explain async generators"), skip the basics and explain the advanced topic directly.

8. AIRA PROJECT SPECIFICITY:
- When asked how to improve AIRA ("How can I improve AIRA?"), talk about real architectural improvements (voice loop reliability, interruption handling, response streaming latency, contextual memory buffer, external action APIs like email) rather than generic AI advice.

9. SILENT USER PROFILE CONTEXT & PRIVACY:
- The user is Harsh Shrivastava. Profile facts are silent background context, NOT a response script.
- NEVER say "According to your profile...", "Based on my stored records...", "Your data indicates...", etc.
- For general technical/casual questions, inject ZERO profile data and do NOT mention university, CGPA, job, or projects.
- For specific personal questions ("Where do I study?", "What is my CGPA?"), answer only that fact directly.
- For "What do you know about me?", give a warm 2-sentence conversational overview.
- NEVER reveal or store phone numbers. If asked: "I don't share private contact information."
- If a personal fact is unknown, state honestly: "I don't have that information."

10. BANNED PHRASES (NEVER USE):
- "Hello, how can I help you today?"
- "I'm here to assist you."
- "Certainly!"
- "Absolutely!"
- "How may I assist you?"
- "That's an excellent question!"
- "Great question!"
- "Sure, I'd be happy to help!"
- "Of course!"
- "As an AI..."
- "I understand your concern..."
- "I hope this helps!"
- "Would you like me to help you with that?"

========================
USER NAME
========================

The user's name is: ${userName || "there"}.
Use the name only occasionally when contextually natural (e.g. greeting). Never use it as a repetitive template.

========================
RELEVANT MEMORY & CONTEXT
========================

${relevantMemoryBlock}

========================
OUTPUT FORMAT (STRICT JSON)
========================

Always return valid JSON in exactly this structure:
{
  "reply": "Conversational, voice-ready response",
  "intent": "chat | start_session | end_session | evaluate",
  "scenario": "normal | interview | teaching | roleplay | problem_solving",
  "emailDraft": { "subject": "...", "body": "..." } | null
}

CRITICAL EMAIL RULE: ONLY provide "emailDraft" if the user EXPLICITLY asked you to draft, write, or compose an email. Otherwise set "emailDraft" to null.

========================
END
========================`;

    const sanitizedHistory = (messageHistory || [])
      .slice(-10)
      .filter((m) => m && m.content && typeof m.content === "string" && m.content.trim())
      .map((m) => ({
        role: m.role === "aira" ? "assistant" : m.role,
        content: m.content.trim()
      }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...sanitizedHistory,
    ];

    const { content: rawContent } = await createGroqChatCompletion(messages, {
      temperature: 0.65,
      response_format: { type: "json_object" },
      max_tokens: 800
    });

    const content = JSON.parse(rawContent || "{}");

    let finalEmailDraft = null;
    if (content.emailDraft && content.emailDraft.subject && content.emailDraft.body) {
      const subject = content.emailDraft.subject.trim();
      const body = content.emailDraft.body.trim();
      if (subject !== "..." && body !== "..." && subject.length > 2 && body.length > 5) {
        finalEmailDraft = { subject, body };
      }
    }

    return res.status(200).json({
      reply: content.reply || "Something went wrong on my end. Try again?",
      intent: content.intent || "chat",
      scenario: content.scenario || "normal",
      emailDraft: finalEmailDraft
    });

  } catch (error) {
    const status = error.status || 500;
    const category = error.category || (status === 429 ? "provider_rate_limit" : (status >= 500 ? "provider_unavailable" : "server"));

    console.error("[Agent Chat API Error]:", {
      status,
      category,
      message: error.message,
      retryAfter: error.retryAfter
    });

    if (category === "provider_rate_limit" || status === 429) {
      return res.status(429).json({
        error: "AI service temporarily rate limited",
        category: "provider_rate_limit",
        userMessage: error.userMessage || "I'm temporarily hitting the AI service limit. Give me a moment and we'll continue.",
        retryAfter: error.retryAfter || 5
      });
    }

    if (category === "auth_error" || status === 401) {
      return res.status(401).json({
        error: "AI service authentication error",
        category: "auth_error",
        userMessage: error.userMessage || "There's an issue with the AI service configuration. Please check the API key."
      });
    }

    if (category === "provider_unavailable" || status === 503 || status >= 500) {
      return res.status(503).json({
        error: "AI service temporarily unavailable",
        category: "provider_unavailable",
        userMessage: error.userMessage || "The AI service is temporarily unavailable right now. Give me a moment and try again."
      });
    }

    return res.status(status).json({
      error: error.message || "Internal server error",
      category,
      userMessage: error.userMessage || "Something went wrong on my side. Let's try that again."
    });
  }
}
