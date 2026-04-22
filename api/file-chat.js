import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question, fileContent, fileName, type } = req.body;

    if (!question || !fileContent) {
      return res.status(400).json({ error: "question and fileContent are required" });
    }

    // Trim file content to fit context window
    const trimmedContent = fileContent.slice(0, 50000);

    let systemPrompt = `You are AIRA — an intelligent file assistant. The user has uploaded a document called "${fileName || "document"}". Answer their questions based ONLY on the document content provided below. Be accurate, concise, and helpful. If the answer is not in the document, say so honestly.

Keep your responses SHORT (2-4 sentences) since they will be spoken via text-to-speech.`;

    if (type === "code_block") {
      systemPrompt = `You are AIRA — a Senior Software Engineer and expert debugger.
The user has provided a code snippet. Your goal is to:
1. Analyze the code for errors or improvements.
2. Fix any bugs found.
3. Explain the issues clearly but concisely.
4. Always return fixed code inside triple backticks.

Keep your explanation short (2-4 sentences), but the code block can be as long as needed.
`;
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
  "emailDraft": { "subject": "Subject line", "body": "Full email body" } // Provide this ONLY if the user asks to write or draft an email based on the file.
}`
      },
      { role: "user", content: question }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: type === "code_block" ? 2500 : 800,
      response_format: { type: "json_object" },
    });

    const data = JSON.parse(completion.choices[0]?.message?.content || "{}");

    return res.status(200).json({
      reply: data.reply || "I've processed your request.",
      emailDraft: data.emailDraft || null,
    });
  } catch (error) {
    console.error("File chat error:", error);
    return res.status(500).json({ error: "Failed to answer question about file" });
  }
}
