/**
 * Email Intent Detection & Query Extraction Helper for AIRA
 */

const EMAIL_KEYWORDS = /\b(email|emails|gmail|inbox|mailbox|unread)\b/i;
const EXPLICIT_SEND_REGEX = /\b(send it|send the email|send this email|send that email|send this|okay send|ok send|go ahead and send|please send it|send the draft|send now)\b/i;
const DRAFT_REGEX = /\b(draft|compose|write an email|write a reply|draft a reply|prepare an email|prepare a draft|don't send|dont send|just show me the draft|show the draft)\b/i;
const SEARCH_READ_REGEX = /\b(check|read|search|any|did|what did|summarize|find|look for|show|got|received)\b.*\b(email|emails|mail|inbox|reply)\b/i;

/**
 * Determine if a user utterance is related to email actions or inquiries.
 */
export function isEmailRelated(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  return (
    EMAIL_KEYWORDS.test(t) ||
    EXPLICIT_SEND_REGEX.test(t) ||
    DRAFT_REGEX.test(t) ||
    SEARCH_READ_REGEX.test(t) ||
    /\b(did .+ reply|did .+ email me|email from .+)\b/i.test(t)
  );
}

/**
 * Classify email intent into:
 * - 'SEND_EXPLICIT'
 * - 'DRAFT'
 * - 'SEARCH_READ'
 */
export function detectEmailIntent(text) {
  if (!text) return null;
  const t = text.trim();

  // If user says "don't send", never treat as SEND_EXPLICIT
  if (/\b(don't send|dont send|do not send|never mind|cancel send)\b/i.test(t)) {
    return "DRAFT";
  }

  // Explicit send trigger
  if (EXPLICIT_SEND_REGEX.test(t)) {
    return "SEND_EXPLICIT";
  }

  // Direct send command like "Send an email to rahul@example.com saying ..."
  if (/^send\s+(?:an?\s+)?email\b/i.test(t) || /^send\s+to\b/i.test(t)) {
    return "SEND_EXPLICIT";
  }

  // Draft command
  if (DRAFT_REGEX.test(t)) {
    return "DRAFT";
  }

  // Search or Read intent
  if (SEARCH_READ_REGEX.test(t) || EMAIL_KEYWORDS.test(t) || /\b(did .+ reply|did .+ email)\b/i.test(t)) {
    return "SEARCH_READ";
  }

  return null;
}

/**
 * Formulate Gmail API search query from natural language query.
 */
export function extractGmailSearchQuery(text) {
  if (!text) return "newer_than:7d";
  const t = text.toLowerCase();

  const queryParts = [];

  // 1. Unread filter
  if (t.includes("unread")) {
    queryParts.push("is:unread");
  }

  // 2. Sender filter ("from Rahul", "from my professor", "did Rahul email")
  const fromMatch = t.match(/\bfrom\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z]+)/i);
  if (fromMatch && fromMatch[1]) {
    const sender = fromMatch[1].trim();
    if (!["me", "my", "the"].includes(sender.toLowerCase())) {
      queryParts.push(`from:${sender}`);
    }
  } else {
    const didEmailMatch = t.match(/\bdid\s+([a-zA-Z]+)\s+(?:email|reply|write|send)/i);
    if (didEmailMatch && didEmailMatch[1]) {
      const name = didEmailMatch[1].trim();
      if (!["anyone", "someone", "you", "i"].includes(name.toLowerCase())) {
        queryParts.push(`from:${name}`);
      }
    }
  }

  // 3. Subject / Topic filter
  const subjectMatch = t.match(/\b(?:about|regarding|subject)\s+([a-zA-Z0-9\s]+?)(?:\s+email|\s+emails|$)/i);
  if (subjectMatch && subjectMatch[1]) {
    const topic = subjectMatch[1].trim();
    if (topic.length > 2) {
      queryParts.push(`subject:${topic}`);
    }
  } else if (t.includes("interview")) {
    queryParts.push("interview");
  } else if (t.includes("offer")) {
    queryParts.push("offer");
  }

  // 4. Default recency filter if no specific date/term is requested
  if (queryParts.length === 0 || (!t.includes("older") && !t.includes("all"))) {
    queryParts.push("newer_than:7d");
  }

  return queryParts.join(" ");
}

/**
 * Scan recent message history to locate the most recent un-sent email draft.
 */
export function findRecentEmailDraft(messageHistory = []) {
  for (let i = messageHistory.length - 1; i >= 0; i--) {
    const msg = messageHistory[i];
    if (msg.emailDraft && msg.emailDraft.body) {
      return msg.emailDraft;
    }
    // Check if the message content had an explicit draft structure
    if (msg.role === "assistant" && typeof msg.content === "string") {
      const toMatch = msg.content.match(/\bTo:\s*([^\n\r]+)/i);
      const subMatch = msg.content.match(/\bSubject:\s*([^\n\r]+)/i);
      if (toMatch && subMatch) {
        return {
          to: toMatch[1].trim(),
          subject: subMatch[1].trim(),
          body: msg.content.split(/\bSubject:[^\n\r]+/i)[1]?.trim() || "",
        };
      }
    }
  }
  return null;
}

/**
 * Verify if string looks like an email address or "Name <email@...>"
 */
export function isValidEmailAddress(addr) {
  if (!addr || typeof addr !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.trim()) || /<[^\s@]+@[^\s@]+\.[^\s@]+>/.test(addr.trim());
}
