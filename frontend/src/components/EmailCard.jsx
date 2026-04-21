import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Copy, Check, Feather, Type } from "lucide-react";

export default function EmailCard({ subject, body, onRefine }) {
  const [copied, setCopied]     = useState(false);
  const [activeTone, setTone]   = useState(null); // "formal" | "casual"

  const fullText = subject
    ? `Subject: ${subject}\n\n${body}`
    : body;

  /* ── Copy to clipboard ── */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      // Safari / older browsers fallback
      const ta = document.createElement("textarea");
      ta.value = fullText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  /* ── Tone refinement ── */
  const handleTone = (tone) => {
    setTone(tone);
    onRefine?.(
      `Rewrite the previous email in a ${tone} tone. Keep the same subject and content, just change the language style.`
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(99,102,241,0.25)",
        background: "rgba(12,15,28,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 4px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ── Header bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        background: "rgba(99,102,241,0.09)",
        borderBottom: "1px solid rgba(99,102,241,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Mail size={13} color="#818cf8" />
          </div>
          <span style={{
            fontSize: "0.6rem", fontWeight: 700,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "#818cf8",
          }}>
            Email Draft
          </span>
        </div>
        {/* top accent line */}
        <div style={{ fontSize: "0.6rem", color: "rgba(100,116,139,0.5)" }}>
          Ready to send
        </div>
      </div>

      {/* ── Subject row ── */}
      {subject && (
        <div style={{
          padding: "10px 16px 9px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.018)",
        }}>
          <div style={{
            fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#475569", marginBottom: 3,
          }}>
            Subject
          </div>
          <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "#e2e8f0" }}>
            {subject}
          </div>
        </div>
      )}

      {/* ── Email body ── */}
      <div style={{
        padding: "18px 18px 14px",
        fontSize: "0.8rem",
        color: "#cbd5e1",
        lineHeight: 1.85,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {body}
      </div>

      {/* ── Action bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "10px 14px",
        borderTop: "1px solid rgba(255,255,255,0.055)",
        background: "rgba(255,255,255,0.015)",
      }}>

        {/* Copy button */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={handleCopy}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 13px", borderRadius: 8,
            fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
            color: copied ? "#34d399" : "#a5b4fc",
            background: copied ? "rgba(52,211,153,0.1)" : "rgba(99,102,241,0.12)",
            border: `1px solid ${copied ? "rgba(52,211,153,0.28)" : "rgba(99,102,241,0.28)"}`,
            transition: "all 0.25s",
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied
              ? <motion.div key="chk" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                  <Check size={12} />
                </motion.div>
              : <motion.div key="cpy" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                  <Copy size={12} />
                </motion.div>
            }
          </AnimatePresence>
          {copied ? "Copied!" : "Copy Email"}
        </motion.button>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.08)" }} />

        {/* Tone buttons */}
        <span style={{ fontSize: "0.62rem", color: "#334155", fontWeight: 500, whiteSpace: "nowrap" }}>
          Tone:
        </span>
        {[
          { tone: "formal",   icon: <Type size={11} />,    label: "Formal" },
          { tone: "casual",   icon: <Feather size={11} />, label: "Casual" },
        ].map(({ tone, icon, label }) => (
          <button
            key={tone}
            onClick={() => handleTone(tone)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 11px", borderRadius: 8,
              fontSize: "0.68rem", fontWeight: 600, cursor: "pointer",
              color:       activeTone === tone ? "#e2e8f0" : "#475569",
              background:  activeTone === tone ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
              border:      `1px solid ${activeTone === tone ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.08)"}`,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { if (activeTone !== tone) { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; } }}
            onMouseLeave={(e) => { if (activeTone !== tone) { e.currentTarget.style.color = "#475569"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
          >
            {icon}{label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
