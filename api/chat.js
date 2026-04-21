export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messageHistory, userName, memory } = req.body;

    const systemPrompt = `You are AIRA — Advanced Intelligent Responsive Assistant. 
Developer: Harsh Shrivastava.
User: ${userName || "User"}.
Context: ${memory || "No previous context."}

Personality: Warm, witty, and natural. Keep responses short (2-4 sentences). 
Format: Return structured JSON with "reply", "intent", and "scenario".`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(messageHistory || []).slice(-12), // Optimized history length
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
        temperature: 0.8,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Groq API error");
    }

    const data = await response.json();
    const content = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    return res.status(200).json({
      reply: content.reply || "I'm here, what's on your mind?",
      intent: content.intent || "chat",
      scenario: content.scenario || null,
      emailDraft: content.emailDraft || null
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
