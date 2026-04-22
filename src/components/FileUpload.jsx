import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, X, FileText, Image, File, Upload, Loader2, Sparkles, MessageCircle } from "lucide-react";

import { API_BASE } from "../config/api";
const API = `${API_BASE}/api`;

const ACCEPT = ".pdf,.txt,.csv,.json,.md,.png,.jpg,.jpeg,.webp";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(name) {
  const ext = name?.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return <Image size={16} />;
  if (["pdf"].includes(ext)) return <FileText size={16} />;
  return <File size={16} />;
}

/**
 * FileUpload — A compact file upload widget for the AIRA Agent chat panel.
 *
 * Props:
 *  - onFileAnalyzed(result)  called when file is processed & summarized
 *  - onFileQuestion(q, ctx)  called when user asks a question about active file
 *  - onClearFile()           called when user removes the file
 *  - fileContext             current file context { fileName, extractedText, summary, ... }
 *  - voiceSpeak(text)        function to speak text via TTS
 */
export default function FileUpload({ onFileAnalyzed, onClearFile, fileContext, voiceSpeak, addMessage }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);

    if (file.size > MAX_SIZE) {
      setError("File too large (max 10MB)");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      // Format result to match expected context
      const result = {
        fileName: file.name,
        extractedText: data.extractedText,
        summary: data.summary,
        keyPoints: data.keyPoints,
        documentType: data.documentType,
        spokenSummary: data.spokenSummary || data.summary
      };

      onFileAnalyzed(result);

      // Add AIRA message + speak
      if (addMessage) {
        // Build a nice message with summary and key points
        let msg = `I've analyzed your file "${file.name}".\n\n${result.summary}`;
        if (result.keyPoints && result.keyPoints.length > 0) {
          msg += "\n\n**Key Points:**\n" + result.keyPoints.map(p => `• ${p}`).join("\n");
        }
        
        addMessage("aira", msg);
        if (voiceSpeak) voiceSpeak(result.spokenSummary || `I've analyzed ${file.name}.`);
      }
    } catch (err) {
      console.error("File processing error:", err);
      setError(err.message || "Failed to process file");
    } finally {
      setUploading(false);
    }
  }, [onFileAnalyzed, addMessage, voiceSpeak]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ── If file is active, show compact indicator ──
  if (fileContext) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.8)",
          border: "1px solid rgba(0,0,0,0.05)",
          boxShadow: "0 5px 15px rgba(120,140,255,0.1)",
          marginBottom: 8,
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: "rgba(100,140,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#6a8cff", flexShrink: 0,
        }}>
          {getFileIcon(fileContext.fileName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "0.72rem", fontWeight: 600, color: "#1a1a1a",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {fileContext.fileName}
          </div>
          <div style={{ fontSize: "0.6rem", color: "#6b7280" }}>
            {fileContext.documentType || "Document"} · Ask me anything about this file
          </div>
        </div>
        <button
          onClick={onClearFile}
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: "rgba(0,0,0,0.04)",
            border: "1px solid rgba(0,0,0,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#ef4444", flexShrink: 0,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
          title="Remove file"
        >
          <X size={12} />
        </button>
      </motion.div>
    );
  }

  return (
    <>
      {/* Upload trigger button */}
      <motion.button
        whileHover={{ scale: 1.08, background: "rgba(0,0,0,0.05)" }}
        whileTap={{ scale: 0.95 }}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: uploading ? "rgba(100,140,255,0.15)" : "rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: uploading ? "wait" : "pointer",
          color: "#6a8cff",
          transition: "all 0.2s",
        }}
        title="Upload a file (PDF, Image, Text)"
      >
        {uploading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 size={16} />
          </motion.div>
        ) : (
          <Paperclip size={16} />
        )}
      </motion.button>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {/* Drag-n-drop overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              position: "fixed", inset: 0, zIndex: 999,
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(10px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 16,
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                width: 80, height: 80, borderRadius: 20,
                background: "rgba(100,140,255,0.1)",
                border: "2px dashed rgba(100,140,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#6a8cff",
              }}
            >
              <Upload size={32} />
            </motion.div>
            <p style={{ fontSize: "1rem", fontWeight: 600, color: "#1a1a1a" }}>
              Drop your file here
            </p>
            <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
              PDF, Images, Text files — up to 10MB
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
              zIndex: 1000,
              padding: "10px 18px", borderRadius: 10,
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
              fontSize: "0.78rem", fontWeight: 500,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <X size={14} />
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: 8, background: "none", border: "none",
                color: "#f87171", cursor: "pointer", fontSize: "0.7rem",
              }}
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
