import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ title: "New Conversation" });
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Generate a VERY short, 2-5 word title for a chat thread based on the user's first message. Return ONLY the title string, no quotes or extra text."
        },
        { role: "user", content: message }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 20
    });

    const title = completion.choices[0]?.message?.content?.trim() || "New Conversation";
    return res.status(200).json({ title });
  } catch (error) {
    console.error("Title generation error:", error);
    return res.status(200).json({ title: "New Conversation" });
  }
}
