import { getAdminDb } from "./firebaseAdmin.js";
import { createGroqChatCompletion } from "./groqClient.js";

/**
 * Standard English conversational stop words to exclude during token extraction
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
  "yourselves", "tell", "show", "give", "help", "want", "like", "know", "think", "make", "get", "just",
  "said", "told", "asked", "mention", "mentioned"
]);

/**
 * Lightweight English morphological stemmer to match inflections:
 * building -> build, databases -> database, apps -> app, etc.
 */
export function stemWord(word) {
  if (!word || typeof word !== "string") return "";
  let w = word.toLowerCase().trim();
  if (w.length <= 3) return w;

  // Specific common technical & domain plurals
  if (w === "databases") return "database";
  if (w === "technologies") return "technology";
  if (w === "libraries") return "library";
  if (w === "queries") return "query";
  if (w === "apps") return "app";

  // Common endings
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ment") && w.length > 6) return w.slice(0, -4);
  if (w.endsWith("tions") && w.length > 7) return w.slice(0, -5);
  if (w.endsWith("tion") && w.length > 6) return w.slice(0, -4);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);

  return w;
}

/**
 * Generic filler words that shouldn't independently score relevance across domains
 */
const GENERIC_MEMORY_TERMS = new Set([
  "user", "users", "is", "was", "are", "were", "using", "uses", "use",
  "project", "projects", "app", "thing", "things", "about", "called",
  "work", "worked", "working", "building", "build", "built", "the", "that", "this"
]);

/**
 * Extract meaningful semantic and stemmed tokens from text.
 */
export function extractTokens(text) {
  if (!text || typeof text !== "string") return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w]+|[^\w]+$/g, ""))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const tokenSet = new Set();
  for (const w of words) {
    tokenSet.add(w);
    const stemmed = stemWord(w);
    if (stemmed) tokenSet.add(stemmed);
  }
  return tokenSet;
}

/**
 * Extract specific non-generic entity tokens for cross-topic relevance scoring
 */
export function extractEntityTokens(text) {
  if (!text || typeof text !== "string") return new Set();
  const tokens = extractTokens(text);
  const entitySet = new Set();
  for (const t of tokens) {
    if (!GENERIC_MEMORY_TERMS.has(t) && t.length > 2) {
      entitySet.add(t);
    }
  }
  return entitySet;
}

/**
 * High-precision domain and semantic topic matchers with strict word boundaries
 */
const DOMAIN_MATCHERS = [
  {
    domain: "mobile",
    queryRegex: /\b(mobile|phone|ios|android|react native|expo|flutter)\b/i,
    lineRegex: /\b(react native|expo|flutter|mobile|ios|android)\b/i,
    score: 8
  },
  {
    domain: "database",
    queryRegex: /\b(database|databases|db|storage|datastore|mongodb|firebase|firestore|postgres|postgresql|mysql|sqlite|redis|atlas)\b/i,
    lineRegex: /\b(mongodb|firebase|firestore|postgres|postgresql|mysql|sqlite|redis|atlas|database|db)\b/i,
    score: 8
  },
  {
    domain: "portal",
    queryRegex: /\b(portal|platform|internship)\b/i,
    lineRegex: /\b(portal|platform|internship)\b/i,
    score: 7
  },
  {
    domain: "preferences",
    queryRegex: /\b(prefer|preference|style|concise|tone|communication|how do you (?:answer|explain|reply))\b/i,
    lineRegex: /\b(prefer|concise|direct|explanation|communication|style)\b/i,
    score: 6
  },
  {
    domain: "backend",
    queryRegex: /\b(backend|server|express|nodejs|fastapi|django)\b/i,
    lineRegex: /\b(backend|server|express|nodejs|fastapi|django)\b/i,
    score: 6
  },
  {
    domain: "frontend",
    queryRegex: /\b(frontend|ui|tailwind|nextjs|vite|vue)\b/i,
    lineRegex: /\b(frontend|ui|tailwind|nextjs|vite|vue)\b/i,
    score: 6
  }
];

/**
 * Parse raw bulleted memory text into structured memory items.
 */
export function parseMemoryLines(rawMemory) {
  if (!rawMemory || typeof rawMemory !== "string") return [];
  return rawMemory
    .split(/\n+/)
    .map((l) => l.trim().replace(/^[-*•\d.]+\s*/, ""))
    .filter(Boolean);
}

/**
 * Detect entity conflicts between two facts (e.g. "uses Firebase" vs "uses MongoDB").
 * Returns true if the new fact appears to update or supersede the old fact.
 */
function isFactSuperseded(oldFact, newFact) {
  const o = oldFact.toLowerCase();
  const n = newFact.toLowerCase();

  // Project backend / database conflict
  if (
    (o.includes("database") || o.includes("backend") || o.includes("firebase") || o.includes("mongodb")) &&
    (n.includes("database") || n.includes("backend") || n.includes("firebase") || n.includes("mongodb"))
  ) {
    if (n.includes("switch") || n.includes("changed") || n.includes("migrated") || n.includes("now using") || n.includes("mongodb")) {
      return true;
    }
  }

  // Frontend framework conflict
  if (
    (o.includes("frontend") || o.includes("framework") || o.includes("react") || o.includes("vue") || o.includes("angular")) &&
    (n.includes("frontend") || n.includes("preferred stack") || n.includes("now using"))
  ) {
    if (n.includes("switch") || n.includes("prefer") || n.includes("now")) {
      return true;
    }
  }

  // Project name change
  if (o.includes("main project is") && n.includes("main project is")) {
    return true;
  }

  return false;
}

/**
 * Deduplicate and resolve conflicts across memory facts.
 * Ensures newer facts replace outdated ones and duplicates are discarded.
 */
export function mergeAndDeduplicateMemories(existingLines = [], newLines = []) {
  let combined = [...existingLines];

  for (const newFact of newLines) {
    const cleanNew = newFact.trim();
    if (!cleanNew) continue;

    const nNorm = cleanNew.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

    // Check exact or near duplicate
    const isDuplicate = combined.some((oldFact) => {
      const oNorm = oldFact.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
      if (oNorm === nNorm) return true;

      const STOP = new Set(["is", "was", "with", "using", "for", "the", "a", "an", "user"]);
      const oWords = new Set(oNorm.split(" ").filter((w) => w && !STOP.has(w)));
      const nWords = new Set(nNorm.split(" ").filter((w) => w && !STOP.has(w)));
      let intersection = 0;
      for (const w of nWords) {
        if (oWords.has(w)) intersection++;
      }
      const union = new Set([...oWords, ...nWords]).size;
      return union > 0 && (intersection / union) >= 0.8;
    });

    if (isDuplicate) {
      continue;
    }

    // Check if new fact supersedes an older fact
    const supersededIndex = combined.findIndex((oldFact) => isFactSuperseded(oldFact, cleanNew));
    if (supersededIndex !== -1) {
      combined[supersededIndex] = cleanNew; // Replace stale with newer fact
    } else {
      combined.push(cleanNew);
    }
  }

  // Bound total memories to prevent uncontrolled memory bloat (max 25 active facts)
  if (combined.length > 25) {
    combined = combined.slice(-25);
  }

  return combined;
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
export function retrieveRelevantMemories(rawMemory, messageHistory = []) {
  if (!rawMemory || typeof rawMemory !== "string" || !rawMemory.trim()) {
    return "No custom session memory for this turn.";
  }

  const memoryLines = parseMemoryLines(rawMemory);
  if (memoryLines.length === 0) {
    return "No custom session memory for this turn.";
  }

  // If memory has 2 or fewer facts and is concise, inject all
  if (memoryLines.length <= 2 && rawMemory.length < 160) {
    return memoryLines.map((l) => `- ${l}`).join("\n");
  }

  const recentUserTurns = messageHistory
    .slice(-4)
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => m.content || "")
    .join(" ");

  const latestTurn = messageHistory.slice(-1)[0]?.content || "";
  const queryTokens = extractTokens(recentUserTurns);
  const queryEntityTokens = extractEntityTokens(recentUserTurns);

  // Check if user is asking a broad question about their projects or memory
  const isBroadMemoryInquiry = /\b(what (?:was|is|are) (?:my|the|that) (?:project|app|database|stack|portal|mobile|technolog)|tell me about (?:that|my) (?:project|app|work)|what do you (?:remember|know) about me)\b/i.test(latestTurn);

  const scoredMemories = [];

  for (const line of memoryLines) {
    const lineLower = line.toLowerCase();
    const lineEntityTokens = extractEntityTokens(line);

    let score = 0;

    // 1. Precise domain matching (e.g. mobile app -> React Native/Expo/Pulse)
    for (const matcher of DOMAIN_MATCHERS) {
      if (matcher.queryRegex.test(recentUserTurns) && matcher.lineRegex.test(lineLower)) {
        score += matcher.score;
      }
    }

    // 2. Specific entity and non-generic token overlap (e.g. "Pulse", "MongoDB", "Atlas", "Rust")
    for (const token of queryEntityTokens) {
      if (lineEntityTokens.has(token)) {
        score += 6;
      }
    }

    // 3. Pronoun / Elliptical inquiry ("that project", "my app", "the backend", "that portal")
    if (/\b(that project|the project|that app|the app|the portal)\b/i.test(recentUserTurns)) {
      if (lineLower.includes("project") || lineLower.includes("portal") || lineLower.includes("app")) {
        score += 2;
      }
    }

    // 4. Broad memory inquiry fallback
    if (isBroadMemoryInquiry && (lineLower.includes("project") || lineLower.includes("building") || lineLower.includes("uses") || lineLower.includes("stack"))) {
      score += 4;
    }

    if (score >= 5) {
      scoredMemories.push({ line, score });
    }
  }

  scoredMemories.sort((a, b) => b.score - a.score);

  // Return top 3-5 bounded memories
  const topFacts = scoredMemories.slice(0, 5).map((item) => `- ${item.line}`);

  if (topFacts.length === 0) {
    // If it was a broad query, fallback to the most recent 2 memories
    if (isBroadMemoryInquiry && memoryLines.length > 0) {
      return memoryLines.slice(-2).map((l) => `- ${l}`).join("\n");
    }
    return "No custom session memory relevant to this turn.";
  }

  return topFacts.join("\n");
}

/**
 * Server-side Firestore persistence for user memory.
 */
export async function saveUserMemoryToFirestore(uid, memoryText, structuredItems = []) {
  if (!uid || typeof uid !== "string") return false;
  try {
    const db = getAdminDb();
    const cleanText = typeof memoryText === "string" ? memoryText.trim() : "";
    
    // Save to users/{uid}/memory/core
    await db.collection("users").doc(uid).collection("memory").doc("core").set({
      text: cleanText,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Save structured items to users/{uid}/memories/{id} if provided
    if (Array.isArray(structuredItems) && structuredItems.length > 0) {
      for (const item of structuredItems) {
        if (!item || !item.id) continue;
        await db.collection("users").doc(uid).collection("memories").doc(item.id).set({
          ...item,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    }
    return true;
  } catch (err) {
    console.warn(`[MemoryService] Failed to save memory to Firestore for user ${uid}:`, err.message);
    return false;
  }
}

/**
 * Server-side Firestore fetch for user memory.
 */
export async function fetchUserMemoryFromFirestore(uid) {
  if (!uid || typeof uid !== "string") return null;
  try {
    const db = getAdminDb();
    const docSnap = await db.collection("users").doc(uid).collection("memory").doc("core").get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return data?.text || null;
    }
    return null;
  } catch (err) {
    console.warn(`[MemoryService] Failed to fetch memory from Firestore for user ${uid}:`, err.message);
    return null;
  }
}

/**
 * Server-side Firestore persistence for thread conversation summary.
 */
export async function saveThreadSummaryToFirestore(uid, chatId, summary) {
  if (!uid || !chatId || !summary) return false;
  try {
    const db = getAdminDb();
    await db.collection("users").doc(uid).collection("threads").doc(chatId).set({
      summary: summary.trim(),
      summaryUpdatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn(`[MemoryService] Failed to save thread summary for user ${uid}, thread ${chatId}:`, err.message);
    return false;
  }
}

/**
 * Server-side Firestore fetch for thread conversation summary.
 */
export async function fetchThreadSummaryFromFirestore(uid, chatId) {
  if (!uid || !chatId) return null;
  try {
    const db = getAdminDb();
    const docSnap = await db.collection("users").doc(uid).collection("threads").doc(chatId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return data?.summary || null;
    }
    return null;
  } catch (err) {
    console.warn(`[MemoryService] Failed to fetch thread summary for user ${uid}, thread ${chatId}:`, err.message);
    return null;
  }
}

/**
 * Generate or update a concise conversation summary for a long thread.
 */
export async function generateThreadSummary(messageHistory = [], existingSummary = null) {
  if (!messageHistory || messageHistory.length < 4) return null;

  try {
    const conversationTranscript = messageHistory
      .slice(-12)
      .map((m) => `${m.role === "assistant" ? "AIRA" : "User"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `You are a concise conversation summarizer.
Create or update a tight 2-3 sentence summary capturing key context, active topics, user decisions, project names, and ongoing tasks discussed.
Do not lose earlier decisions or project context when updating.
${existingSummary ? `\nPREVIOUS SUMMARY:\n${existingSummary}` : ""}
Return ONLY the summary string (no formatting, no prefixes like "Summary:").`;

    const { content: summary } = await createGroqChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Conversation turns to summarize:\n\n${conversationTranscript}` }
    ], {
      temperature: 0.2,
      max_tokens: 200,
    });

    return summary?.trim() || null;
  } catch (err) {
    console.warn("[MemoryService] Failed to generate conversation summary:", err.message);
    return null;
  }
}
