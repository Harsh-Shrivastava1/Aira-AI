import { createGroqChatCompletion } from "./_lib/groqClient.js";
import { getCategoryProfileMemory } from "./_lib/userProfile.js";
import { enforceRateLimit, RATE_LIMIT_POLICIES } from "./_lib/rateLimiter.js";
import { getGmailStatus, searchEmails, sendEmail, replyToThread } from "./_lib/gmailService.js";
import { isEmailRelated, detectEmailIntent, extractGmailSearchQuery, findRecentEmailDraft, isValidEmailAddress } from "./_lib/emailHelper.js";
import { verifyUserToken } from "./_lib/firebaseAdmin.js";
import {
  retrieveRelevantMemories,
  fetchUserMemoryFromFirestore,
  fetchThreadSummaryFromFirestore,
  generateThreadSummary,
  saveThreadSummaryToFirestore
} from "./_lib/memoryService.js";
import { performWebResearch } from "./_lib/webSearchService.js";

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
    const { messageHistory, userName, memory: clientMemory, chatId, conversationSummary: clientSummary, webSearch, activeDraft } = req.body || {};

    // Verify Firebase identity server-side (never trust arbitrary client-supplied body UID)
    const authResult = await verifyUserToken(req).catch(() => ({ authenticated: false }));
    const verifiedUid = authResult.authenticated && authResult.user?.uid ? authResult.user.uid : null;
    const effectiveUid = verifiedUid || req.body?.userId || null;

    // Load server-side authoritative memory if client memory is missing
    let effectiveMemory = clientMemory || "";
    if (!effectiveMemory && effectiveUid) {
      const serverMemory = await fetchUserMemoryFromFirestore(effectiveUid);
      if (serverMemory) {
        effectiveMemory = serverMemory;
      }
    }

    // Load conversation summary for the active thread if available
    let threadSummary = clientSummary || null;
    if (!threadSummary && effectiveUid && chatId) {
      threadSummary = await fetchThreadSummaryFromFirestore(effectiveUid, chatId);
    }

    const latestUserTurn = (messageHistory || [])
      .filter((m) => m.role === "user")
      .slice(-1)[0]?.content || "";

    // 0. Live Web Research (when webSearch is ON)
    let webResearchResult = { sources: [], contextBlock: "" };
    if (webSearch && latestUserTurn) {
      try {
        webResearchResult = await performWebResearch(latestUserTurn);
      } catch (searchErr) {
        console.warn("[WebResearch Error]:", searchErr.message);
        webResearchResult = {
          sources: [],
          contextBlock: "\n\n=== WEB RESEARCH RESULTS ===\nWeb research encountered an error attempting to retrieve live web data for this query.\n============================\n",
        };
      }
    }

    // 0. Email / Gmail Intent Handling
    let emailContextBlock = "";
    if (isEmailRelated(latestUserTurn)) {
      const emailIntent = detectEmailIntent(latestUserTurn);

      // Branch 1: Explicit Send Protection & Execution
      if (emailIntent === "SEND_EXPLICIT") {
        const currentDraft = (activeDraft && activeDraft.body)
          ? activeDraft
          : findRecentEmailDraft(messageHistory);

        if (!currentDraft || !currentDraft.body) {
          return res.status(200).json({
            reply: "There's no email draft ready to send. Tell me what you'd like me to write and who to send it to, and I'll draft it for you first.",
            intent: "chat",
            scenario: "normal",
            emailDraft: null
          });
        }

        if (!verifiedUid) {
          return res.status(200).json({
            reply: "Please sign in to your AIRA account and connect your Gmail so I can send your email. Your draft is still here.",
            intent: "chat",
            scenario: "normal",
            emailDraft: currentDraft,
            emailError: "auth_required"
          });
        }

        const gmailStatus = await getGmailStatus(verifiedUid);
        if (!gmailStatus.connected) {
          return res.status(200).json({
            reply: "Your Gmail account isn't connected yet. Please connect your Gmail account from your profile menu so I can send your emails. Your draft is still here.",
            intent: "chat",
            scenario: "normal",
            emailDraft: currentDraft,
            emailError: "gmail_not_connected"
          });
        }

        const recipient = (currentDraft.to || "").trim();
        if (!recipient || !isValidEmailAddress(recipient)) {
          return res.status(200).json({
            reply: `I have your draft ready ("${currentDraft.subject || "No Subject"}"), but I need a valid email address to send it to. Who should I send it to?`,
            intent: "chat",
            scenario: "normal",
            emailDraft: currentDraft
          });
        }

        try {
          if (currentDraft.threadId) {
            await replyToThread(verifiedUid, {
              threadId: currentDraft.threadId,
              to: recipient,
              subject: currentDraft.subject,
              body: currentDraft.body
            });
          } else {
            await sendEmail(verifiedUid, {
              to: recipient,
              subject: currentDraft.subject,
              body: currentDraft.body
            });
          }

          return res.status(200).json({
            reply: `Sent. Your email to ${recipient} with subject "${currentDraft.subject || "No Subject"}" was sent successfully.`,
            intent: "chat",
            scenario: "normal",
            emailDraft: null,
            emailSent: true
          });
        } catch (sendErr) {
          console.error(`[Gmail Send Error] user ${verifiedUid}:`, sendErr.message);
          return res.status(200).json({
            reply: `Couldn't send the email: ${sendErr.message}. Your draft is still here.`,
            intent: "chat",
            scenario: "normal",
            emailDraft: currentDraft,
            emailError: sendErr.message
          });
        }
      }

      // Branch 2: Search or Read Emails
      if (emailIntent === "SEARCH_READ") {
        if (!verifiedUid) {
          return res.status(200).json({
            reply: "Please sign in to your AIRA account and connect your Gmail so I can check or search your emails.",
            intent: "chat",
            scenario: "normal",
            emailDraft: null
          });
        }
        const gmailStatus = await getGmailStatus(verifiedUid);
        if (!gmailStatus.connected) {
          return res.status(200).json({
            reply: "Your Gmail account isn't connected yet. Please connect your Gmail account from your profile menu so I can search your emails.",
            intent: "chat",
            scenario: "normal",
            emailDraft: null
          });
        }
        try {
          const query = extractGmailSearchQuery(latestUserTurn);
          const messages = await searchEmails(verifiedUid, query, 3);

          if (messages.length === 0) {
            emailContextBlock = `\n\n=== GMAIL SEARCH RESULTS (CURRENT REQUEST ONLY) ===\nQuery: "${query}"\nNo matching emails found.\nInstruction: Tell the user conversationally that you checked their Gmail and found no matching emails for that query.`;
          } else {
            const formattedMessages = messages.map((m, idx) => `
Message ${idx + 1}:
- From: ${m.from}
- To: ${m.to}
- Subject: ${m.subject}
- Date: ${m.date}
- Thread ID: ${m.threadId}
- Message ID: ${m.messageId}
- Snippet: ${m.snippet}
- Content: ${m.body || m.snippet}
`).join("\n");

            emailContextBlock = `\n\n=== GMAIL SEARCH RESULTS (CURRENT REQUEST ONLY) ===
Query: "${query}"
Retrieved ${messages.length} email(s):
${formattedMessages}
==================================================
CRITICAL INSTRUCTIONS FOR GMAIL CONTEXT:
- Answer the user's specific question directly and concisely using the email details above.
- Mention who sent the email, when, and the key points.
- If asked to summarize, give a clean 2-3 sentence conversational summary suitable for voice.
- Do NOT fabricate email contents not present in the search results.
- Do NOT output an emailDraft unless explicitly asked to draft or compose a reply.`;
          }
        } catch (searchErr) {
          console.warn(`[Gmail Search Error] user ${verifiedUid}:`, searchErr.message);
          emailContextBlock = `\n\n=== GMAIL SEARCH RESULTS (CURRENT REQUEST ONLY) ===\nCould not query Gmail: ${searchErr.message}.\nInstruction: Inform the user that there was a temporary issue checking their emails.`;
        }
      }
    }

    // 1. Check categorized profile memory with conversation context for pronoun/elliptical resolution
    const profileMemoryItem = getCategoryProfileMemory(latestUserTurn, messageHistory);

    // 2. Filter session memory server-side
    const sessionMemory = retrieveRelevantMemories(effectiveMemory, messageHistory);

    let summaryBlock = "";
    if (threadSummary) {
      summaryBlock = `\n\n=== CONVERSATION SUMMARY (EARLIER IN THIS THREAD) ===\n${threadSummary}`;
    }

    let webSearchBlock = "";
    if (webSearch) {
      webSearchBlock = `${webResearchResult.contextBlock}
========================
LIVE WEB RESEARCH MODE RULES (WEB SEARCH IS ACTIVE)
========================
1. Ground your answer in the retrieved web sources provided above whenever available.
2. Structure your response professionally:
   - Begin with a direct, comprehensive answer (use ## Answer if detailed).
   - Include ### Key Points when summarizing multiple findings.
   - Include ### Details for in-depth technical or explanatory context.
   - Connect claims to sources using bracketed inline citations like [1], [2] corresponding to the retrieved sources.
3. DISTINGUISH SOURCES: Clearly distinguish information verified from retrieved web pages from your general reasoning.
4. ACCURACY & INTEGRITY:
   - NEVER fabricate or invent citations, URLs, dates, or source names.
   - NEVER claim a website was consulted if it is not present in the retrieved sources above.
   - If the retrieved sources do not contain enough info, or if retrieval was unavailable, clearly state: "I couldn't access live web sources to verify this right now" or "Live search did not return reliable sources for this query" and answer only from general knowledge while stating so.
5. If the user provided a direct URL to summarize or analyze:
   - Summarize ONLY what was retrieved from that URL.
   - If the URL could not be accessed, clearly state that the page could not be accessed rather than inventing its content.`;
    }

    let activeDraftBlock = "";
    if (activeDraft && (activeDraft.body || activeDraft.subject)) {
      activeDraftBlock = `\n\n=== CURRENT ACTIVE EMAIL DRAFT (USER IS REVIEWING/EDITING) ===
To: ${activeDraft.to || "(not specified yet)"}
Subject: ${activeDraft.subject || "(no subject yet)"}
Body:
${activeDraft.body || ""}
Thread ID: ${activeDraft.threadId || "none"}
==================================================
CRITICAL INSTRUCTIONS FOR CURRENT EMAIL DRAFT:
1. The user is currently reviewing and interacting with this email draft in the UI.
2. If the user asks to modify, rewrite, adjust tone (e.g. "more professional", "more casual", "make it shorter", "make it longer"), change the subject, change recipient, or adjust wording, you MUST return the updated "emailDraft" object in your JSON response with the updated fields, preserving any fields the user did not ask to change.
3. Keep your conversational "reply" very short and natural (1 concise sentence), confirming the change (e.g., "I've made it more professional." or "Updated the subject.").
4. DRAFTS ARE NEVER AUTOMATICALLY SENT. Only send if user explicitly confirms sending.`;
    }

    const relevantMemoryBlock = profileMemoryItem
      ? `=== RELEVANT CONTEXT (SILENT BACKGROUND CONTEXT — NOT A SCRIPT) ===\n${profileMemoryItem.content}\n\n=== RELEVANT SESSION MEMORY ===\n${sessionMemory}${summaryBlock}${emailContextBlock}${activeDraftBlock}${webSearchBlock ? `\n\n${webSearchBlock}` : ""}`
      : `=== RELEVANT SESSION MEMORY ===\n${sessionMemory}${summaryBlock}${emailContextBlock}${activeDraftBlock}${webSearchBlock ? `\n\n${webSearchBlock}` : ""}`;

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
  "intent": "chat | start_session | end_session",
  "scenario": "normal | interview | teaching | roleplay | problem_solving",
  "emailDraft": { "to": "...", "subject": "...", "body": "...", "threadId": "..." } | null
}

CRITICAL EMAIL RULES:
1. Provide "emailDraft" if the user asked to draft/compose an email OR if an active email draft is being refined/edited (e.g. "make it more professional", "make it shorter", "change the subject", "change tomorrow to Monday"). Otherwise set "emailDraft" to null.
2. When refining an active draft, keep unchanged fields from the active draft and update only what the user requested.
3. DRAFTS ARE NEVER AUTOMATICALLY SENT. When generating an emailDraft, always explain conversationally that the draft is ready for their review and let them know they can say "Send it" when ready.
4. If drafting a reply to a previous email from search results, populate "threadId" with the matching thread ID and set "to" to the sender's email address.

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
      temperature: webSearch ? 0.4 : 0.65,
      response_format: { type: "json_object" },
      max_tokens: webSearch ? 1400 : 800
    });

    const content = JSON.parse(rawContent || "{}");

    let finalEmailDraft = null;
    if (content.emailDraft && (content.emailDraft.subject || content.emailDraft.body)) {
      const subject = (content.emailDraft.subject || activeDraft?.subject || "").trim();
      const body = (content.emailDraft.body || activeDraft?.body || "").trim();
      const to = content.emailDraft.to ? content.emailDraft.to.trim() : (activeDraft?.to || "");
      const threadId = content.emailDraft.threadId ? content.emailDraft.threadId.trim() : (activeDraft?.threadId || null);
      if (subject !== "..." && body !== "..." && (subject.length > 2 || body.length > 5)) {
        finalEmailDraft = { to, subject, body, threadId };
      }
    }

    // Periodically update conversation summary asynchronously for long threads
    if (messageHistory && messageHistory.length >= 6 && messageHistory.length % 4 === 0 && effectiveUid && chatId) {
      generateThreadSummary(messageHistory, threadSummary)
        .then((newSummary) => {
          if (newSummary) {
            saveThreadSummaryToFirestore(effectiveUid, chatId, newSummary);
          }
        })
        .catch(() => {});
    }

    return res.status(200).json({
      reply: content.reply || "Something went wrong on my end. Try again?",
      intent: content.intent || "chat",
      scenario: content.scenario || "normal",
      emailDraft: finalEmailDraft,
      sources: webSearch ? webResearchResult.sources : undefined
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
