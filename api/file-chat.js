import { createGroqChatCompletion } from "./groqClient.js";
import { enforceRateLimit, RATE_LIMIT_POLICIES } from "./rateLimiter.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Enforce File Chat Rate Limiting
  const rateLimitResult = await enforceRateLimit(req, res, RATE_LIMIT_POLICIES.fileChat);
  if (!rateLimitResult.allowed) {
    return;
  }

  try {
    const { question, fileContent, fileName, type } = req.body;

    if (!question || !fileContent) {
      return res.status(400).json({ error: "question and fileContent are required" });
    }

    // Trim file content to fit context window
    const trimmedContent = fileContent.slice(0, 50000);

    let systemPrompt;

    if (type === "code_block") {
      systemPrompt = `You are AIRA — a senior software engineer and expert debugger.
The user has provided a code snippet. Analyze it thoroughly:
1. Identify any bugs, errors, or issues.
2. Fix the problems and return corrected code inside triple backticks.
3. Explain what was wrong and what you changed — concisely.

Be direct and technically precise. Skip preamble. Do not start with "Certainly!" or "Great question!" or similar scripted phrases.
Keep the explanation concise (2–4 sentences) since it may be spoken aloud, but the code block can be as long as needed.`;
    } else {
      systemPrompt = `You are AIRA — an intelligent assistant helping the user understand a document called "${fileName || "document"}".

Answer the user's question based ONLY on the document content provided. Be accurate and helpful.
If the answer is not in the document, say so honestly — do not invent information.

Be direct: answer the question first, then add context if needed.
Do not start with "Certainly!", "Of course!", "Great question!", or similar scripted phrases.
Keep responses concise (2–4 sentences) since they may be spoken aloud via text-to-speech.`;
    }

    const messages = [
      {
        role: "system",
        content: `${systemPrompt}

DOCUMENT/CODE CONTENT:
---
${trimmedContent}
---

Return ONLY valid JSON (no markdown fences):
{
  "reply": "Your answer to the user's question.",
  "emailDraft": { "subject": "...", "body": "..." } | null
}

CRITICAL: ONLY provide "emailDraft" if the user EXPLICITLY asked you to draft, write, or compose an email based on the file. Otherwise, set it to null.`
      },
      { role: "user", content: question }
    ];

    const { content: rawContent } = await createGroqChatCompletion(messages, {
      temperature: 0.5,
      max_tokens: type === "code_block" ? 2500 : 800,
      response_format: { type: "json_object" }
    });

    const data = JSON.parse(rawContent || "{}");

    // Robust email draft validation
    let finalEmailDraft = null;
    if (data.emailDraft && data.emailDraft.subject && data.emailDraft.body) {
      const subject = data.emailDraft.subject.trim();
      const body = data.emailDraft.body.trim();
      if (subject !== "..." && body !== "..." && subject.length > 2 && body.length > 5) {
        finalEmailDraft = { subject, body };
      }
    }

    return res.status(200).json({
      reply: data.reply || "I couldn't find a clear answer in this document.",
      emailDraft: finalEmailDraft,
    });
  } catch (error) {
    console.error("File chat error:", error);
    return res.status(500).json({ error: "Failed to answer question about file" });
  }
}
