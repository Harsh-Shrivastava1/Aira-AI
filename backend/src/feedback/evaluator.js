import { groq } from "../config/groq.js";

// Evaluates the conversation logs and generates performance score
export const evaluateSession = async (uid, sessionId, conversationLog, scenario) => {
  try {
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
    const resultObj = JSON.parse(resultString);

    // Return the JSON directly, the frontend handles DB writing cleanly.
    return resultObj;
  } catch (error) {
    console.error("Error evaluating session:", error);
    return null;
  }
};
