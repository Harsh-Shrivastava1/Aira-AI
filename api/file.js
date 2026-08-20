import { createGroqChatCompletion } from "./groqClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileContent, question, fileName } = req.body;

    if (!fileContent) {
      return res.status(400).json({ error: "No file content provided" });
    }

    const systemPrompt = `You are AIRA, analyzing a document called "${fileName || 'uploaded file'}".
Answer the user's question based strictly on the content provided. Keep it short.

CONTENT:
---
${fileContent.slice(0, 30000)}
---`;

    const { content: reply } = await createGroqChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: question || "Please summarize this file." }
      ],
      {
        temperature: 0.3,
        response_format: null
      }
    );

    return res.status(200).json({ reply: reply || "Could not analyze the file." });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
