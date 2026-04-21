import Groq from "groq-sdk";
import Busboy from "busboy";
import { createRequire } from "module";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Use createRequire for pdf-parse (CJS module)
const require = createRequire(import.meta.url);

/**
 * Parse multipart form data from the request using Busboy.
 * Returns { buffer, mimetype, originalName }
 */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: 10 * 1024 * 1024 } // 10MB
    });

    let fileData = null;

    busboy.on("file", (fieldname, stream, info) => {
      const { filename, mimeType } = info;
      const chunks = [];

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

      if (!allowed.includes(mimeType)) {
        stream.resume(); // Drain the stream
        reject(new Error(`Unsupported file type: ${mimeType}`));
        return;
      }

      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        fileData = {
          buffer: Buffer.concat(chunks),
          mimetype: mimeType,
          originalName: filename,
        };
      });
    });

    busboy.on("finish", () => {
      if (!fileData) {
        reject(new Error("No file uploaded"));
      } else {
        resolve(fileData);
      }
    });

    busboy.on("error", reject);

    // Pipe the request into busboy
    if (req.body && Buffer.isBuffer(req.body)) {
      // Vercel sometimes provides raw buffer
      busboy.end(req.body);
    } else {
      req.pipe(busboy);
    }
  });
}

/**
 * Extract text from file based on mimetype
 */
async function processFile(buffer, mimetype, originalName) {
  try {
    let text = "";

    if (mimetype === "application/pdf") {
      const pdf = require("pdf-parse");
      const data = await pdf(buffer);
      text = data.text || "";
    } else if (
      mimetype === "text/plain" ||
      mimetype === "text/csv" ||
      mimetype === "text/markdown" ||
      mimetype === "application/json"
    ) {
      text = buffer.toString("utf-8");
    } else if (mimetype.startsWith("image/")) {
      const path = await import("path");
      const ext = path.extname(originalName).toLowerCase();
      text = `[Image file uploaded: ${path.basename(originalName)} (${ext}). ` +
        `Image content analysis is not available in this version. ` +
        `Please describe what the image contains so I can help you with it.]`;
    } else {
      try {
        text = buffer.toString("utf-8");
      } catch {
        return { text: "", error: "Unsupported file type: " + mimetype };
      }
    }

    // Truncate very large files to ~30k chars (~7k tokens)
    const MAX_CHARS = 30000;
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + "\n\n[... Content truncated due to size limit ...]";
    }

    return { text, originalName };
  } catch (err) {
    console.error("File processing error:", err);
    return { text: "", error: err.message };
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable Vercel's default body parsing for file uploads
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { buffer, mimetype, originalName } = await parseMultipart(req);

    const { text, error } = await processFile(buffer, mimetype, originalName);

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

    return res.status(200).json({
      success: true,
      fileName: originalName,
      fileSize: buffer.length,
      extractedText: text,
      summary: parsed.summary || "File processed successfully.",
      keyPoints: parsed.keyPoints || [],
      documentType: parsed.documentType || "Document",
      spokenSummary: parsed.spokenSummary || parsed.summary || "I've analyzed your file.",
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message || "Failed to process file" });
  }
}
