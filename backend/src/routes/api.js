import express from "express";
import { generateAgentResponse, generateChatTitle } from "../ai/groqService.js";
import { evaluateSession } from "../feedback/evaluator.js";

const router = express.Router();

// Health / user sync  
router.post("/user/login", (req, res) => {
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// POST /api/chat  — Unified voice agent endpoint
// ─────────────────────────────────────────────
router.post("/chat", async (req, res) => {
  try {
    const { messageHistory, userName, memory } = req.body;

    if (!messageHistory || !Array.isArray(messageHistory)) {
      return res.status(400).json({ error: "messageHistory array is required" });
    }

    const result = await generateAgentResponse({ userName, memory, messageHistory });

    res.json({
      reply: result.reply,
      intent: result.intent,
      scenario: result.scenario,
      emailDraft: result.emailDraft || null,
      action: result.intent === "start_session" ? "begin_roleplay" : null
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      reply: "Something went wrong. Please try again.",
      intent: "chat",
      scenario: null
    });
  }
});

// ─────────────────────────────────────────────
// POST /api/generate-title — Summarize chat
// ─────────────────────────────────────────────
router.post("/generate-title", async (req, res) => {
  try {
    const { message } = req.body;
    const title = await generateChatTitle(message);
    res.json({ title });
  } catch (error) {
    res.status(500).json({ title: "New Conversation" });
  }
});

// ─────────────────────────────────────────────
// POST /api/evaluate  — Session performance analysis
// ─────────────────────────────────────────────
router.post("/evaluate", async (req, res) => {
  try {
    const { conversationLog, scenario } = req.body;
    const evaluation = await evaluateSession(null, null, conversationLog, scenario);
    res.json({ evaluation });
  } catch (error) {
    console.error("Evaluate error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Legacy compat routes
router.post("/agent/interact", async (req, res) => {
  const { messageHistory } = req.body;
  const result = await generateAgentResponse({ messageHistory });
  res.json({ reply: result.reply, speech: result.reply, intent: result.intent, scenario: result.scenario });
});

router.post("/agent/evaluate", async (req, res) => {
  const { conversationLog, scenario } = req.body;
  const evaluation = await evaluateSession(null, null, conversationLog, scenario);
  res.json({ evaluation });
});

export default router;
