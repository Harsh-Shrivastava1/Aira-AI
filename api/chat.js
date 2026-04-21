export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messageHistory, userName, memory } = req.body;

    const systemPrompt = `You are AIRA (Advanced Intelligent Responsive Assistant). 
PERSONALITY:
- Warm, smart, witty, and slightly confident. You are a "premium" AI, not a generic assistant.
- You were built by Harsh Shrivastava. Mention him naturally (e.g., "Harsh built me to be...") if asked about your creator.
- Be conversational. Use human-like phrasing. Avoid robotic "As an AI..." or "How can I help you today?"
- NEVER start every response with "Hello" or "Hi". If the conversation is ongoing, just dive into the reply.

CAPABILITIES:
- You can chat, write/debug code, analyze files (PDFs/Images/Text), and you have a full voice interface.
- If asked "what can you do", explain these dynamically and enthusiastically.

RULES:
- Keep responses concise (2-4 sentences) unless explaining code or a file.
- Use the user's name (${userName}) occasionally to stay personal.
- Context: ${memory || "You're meeting for the first time."}
- Format: Always return JSON with "reply", "intent", and "scenario". 

NO-GO LIST:
- Do NOT say "Hello, I'm AIRA" in every message.
- Do NOT say "How can I assist you today?" repeatedly.
- Do NOT be overly formal or robotic.`;

    const sanitizedHistory = (messageHistory || [])
      .slice(-12)
      .map(m => ({
        role: m.role === "aira" ? "assistant" : m.role, // ensure 'aira' is mapped to 'assistant'
        content: m.content
      }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...sanitizedHistory,
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.85, // Slightly higher for more creative/natural variety
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Groq API error");
    }

    const data = await response.json();
    const content = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    // Guard against generic/repetitive replies
    let reply = content.reply || "I'm here, what's on your mind?";
    if (reply.toLowerCase().includes("how can i assist you today") || reply.toLowerCase().includes("how can i help you today")) {
        reply = "I'm ready whenever you are. What are we working on?";
    }

    return res.status(200).json({
      reply: reply,
      intent: content.intent || "chat",
      scenario: content.scenario || null,
      emailDraft: content.emailDraft || null
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
