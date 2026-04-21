import express from "express";
import multer from "multer";
import path from "path";
import { processFile } from "../services/fileProcessor.js";
import { groq } from "../config/groq.js";

const router = express.Router();

// ── Multer configuration ──
const storage = multer.memoryStorage(); // Use memory to avoid triggering node --watch restarts

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "text/plain",
      "text/csv",
      "text/markdown",
      "application/json",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Helper to handle Multer errors
const uploadSingle = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// ─────────────────────────────────────────────
// POST /api/upload  — Upload + summarize file
// ─────────────────────────────────────────────
router.post("/upload", uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { text, error } = await processFile(
      req.file.buffer, 
      req.file.mimetype,
      req.file.originalname
    );

    if (error) {
      return res.status(422).json({ error });
    }

    if (!text || text.trim().length < 10) {
      return res.status(422).json({ error: "Could not extract meaningful content from this file." });
    }

    // Generate summary via Groq
    const summaryPrompt = `You are AIRA, an intelligent assistant. A user just uploaded a document. Analyze it and provide:

1. A clear, concise summary (3-5 sentences)
2. Key points or highlights (bullet points)
3. The type/nature of the document

Document content:
---
${text.slice(0, 15000)}
---

Return ONLY valid JSON (no markdown fences):
{
  "summary": "Your concise summary here",
  "keyPoints": ["point 1", "point 2", "..."],
  "documentType": "e.g. Research paper, Resume, Legal contract, etc.",
  "spokenSummary": "A short, natural 2-sentence spoken summary for text-to-speech"
}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: summaryPrompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");

    res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      extractedText: text,
      summary: parsed.summary || "File processed successfully.",
      keyPoints: parsed.keyPoints || [],
      documentType: parsed.documentType || "Document",
      spokenSummary: parsed.spokenSummary || parsed.summary || "I've analyzed your file.",
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message || "Failed to process file" });
  }
});

// ─────────────────────────────────────────────
// POST /api/file-chat  — Ask questions about file
// ─────────────────────────────────────────────
router.post("/file-chat", async (req, res) => {
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
  "reply": "Your answer to the user's question. If providing code, use triple backticks inside this string."
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

    res.json({
      reply: data.reply || "I couldn't find a clear answer in the document.",
    });
  } catch (err) {
    console.error("File chat error:", err);
    res.status(500).json({ error: "Failed to answer question about file" });
  }
});

export default router;
