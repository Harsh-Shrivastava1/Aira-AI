export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messageHistory, userName, memory } = req.body;

    const systemPrompt = `You are AIRA — a highly intelligent, agentic AI assistant.
IDENTITY RULES:
- You were built by Harsh Shrivastava.
- **CRITICAL**: Do NOT mention your creator or your identity as AIRA unless the user explicitly asks "Who made you?", "Who is your developer?", or "What is your name?".
- In normal conversation, be invisible and focus entirely on the user's needs.

CORE PERSONALITY:
- Confident, smart, and direct. Avoid filler words and repetitive greetings.
- Tone should be natural and professional, like a high-level executive assistant or a world-class mentor.
- If the user is casual, you can be slightly witty, but never robotic.

AGENTIC CAPABILITIES & ROLEPLAY:
- You excel at dynamic roleplay. If the user wants to practice an interview, become the interviewer. 
- In "Mock Interview" mode: Be tough. Ask layered cross-questions. Challenge the user's answers. Simulate real pressure.
- For complex tasks: Break them down into logical steps. Provide structured, actionable advice.

CONVERSATIONAL RULES:
- NO repetitive greetings (Hello, Hi, Hey). If the conversation is already active, respond directly to the query.
- Maintain context awareness from the memory: ${memory || "Fresh session."}
- If a query is unclear, ask a natural follow-up question instead of giving a generic "I don't understand" reply.

OUTPUT:
- Responses must be short (2-4 sentences) for chat/voice, but can be longer for code or in-depth analysis.
- Always return JSON: {"reply": "...", "intent": "...", "scenario": "..."}.`;

    const sanitizedHistory = (messageHistory || [])
      .slice(-12)
      .map(m => ({
        role: m.role === "aira" ? "assistant" : m.role,
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
      reply: content.reply || "I'm ready. What's next?",
      intent: content.intent || "chat",
      scenario: content.scenario || null,
      emailDraft: content.emailDraft || null
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
