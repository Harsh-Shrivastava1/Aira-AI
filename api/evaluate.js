import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { conversationLog, scenario } = req.body;

    if (!conversationLog) {
      return res.status(400).json({ error: "conversationLog is required" });
    }

    const systemPrompt = `You are an expert Performance Evaluator.
Analyze the following conversation between an AI and a User in a "${scenario || 'Simulation'}" scenario.
Extract strengths, weaknesses, provide actionable suggestions, and give an objective 0-100 score for Confidence and Communication.

Output MUST BE ONLY Valid JSON matching this structure:
{
  "confidenceScore": number,
  "communicationScore": number,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "improvementNotes": "string"
}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Conversation Log:\n${JSON.stringify(conversationLog)}` }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const resultString = completion.choices[0]?.message?.content;
    const evaluation = JSON.parse(resultString);

    return res.status(200).json({ evaluation });
  } catch (error) {
    console.error("Evaluation error:", error);
    return res.status(500).json({ error: "Failed to evaluate session" });
  }
}
