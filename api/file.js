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

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question || "Please summarize this file." }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Could not analyze the file.";

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
