import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

/**
 * Extract text content from uploaded files.
 * Supports: PDF, plain text, and images (placeholder).
 */

// ── PDF extraction ──
async function extractPDF(buffer) {
  const data = await pdf(buffer);
  return data.text || "";
}

// ── Plain text extraction ──
async function extractText(buffer) {
  return buffer.toString("utf-8");
}

// ── Image — basic description (no heavy OCR dependency) ──
async function extractImage(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  return `[Image file uploaded: ${path.basename(originalName)} (${ext}). ` +
    `Image content analysis is not available in this version. ` +
    `Please describe what the image contains so I can help you with it.]`;
}

/**
 * Main dispatcher — pick extractor based on mimetype.
 * Returns { text, originalName, error? }
 */
export async function processFile(buffer, mimetype, originalName) {
  try {
    let text = "";

    if (mimetype === "application/pdf") {
      text = await extractPDF(buffer);
    } else if (
      mimetype === "text/plain" ||
      mimetype === "text/csv" ||
      mimetype === "text/markdown" ||
      mimetype === "application/json"
    ) {
      text = await extractText(buffer);
    } else if (mimetype.startsWith("image/")) {
      text = await extractImage(originalName);
    } else {
      // Attempt as text
      try {
        text = await extractText(buffer);
      } catch {
        return { text: "", error: "Unsupported file type: " + mimetype };
      }
    }

    // Truncate very large files to ~30k chars (~7k tokens) to stay within Groq limits
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
