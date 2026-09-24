import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, Send, X, Trash2, Loader2, Sparkles } from "lucide-react";

/**
 * Desktop Email Drafting Interface
 * Replaces the message content area inside the existing chat panel
 * when email composing/drafting mode is active.
 */
export default function EmailDraftPanel({
  draft = {},
  onChange,
  onSend,
  onCancel,
  isSending = false,
}) {
  const toInputRef = useRef(null);
  const textareaRef = useRef(null);

  const to = draft?.to || "";
  const subject = draft?.subject || "";
  const body = draft?.body || "";

  // Auto-focus To input if empty, otherwise body
  useEffect(() => {
    if (!to.trim() && toInputRef.current) {
      toInputRef.current.focus();
    }
  }, []);

  const handleFieldChange = (field, value) => {
    onChange?.(
      {
        ...draft,
        [field]: value,
      },
      field
    );
  };

  const handleSendClick = () => {
    if (isSending) return;
    onSend?.({
      ...draft,
      to,
      subject,
      body,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        background: "#ffffff",
        borderRadius: 16,
        border: "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Compact Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          background: "rgba(248, 250, 252, 0.95)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563eb",
            }}
          >
            <Mail size={14} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "#0f172a",
                letterSpacing: "-0.01em",
              }}
            >
              Email Draft
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                color: "#64748b",
                fontWeight: 500,
              }}
            >
              Review before sending
            </span>
          </div>
        </div>

        {/* Subtle Discard / Close Button */}
        <button
          onClick={onCancel}
          disabled={isSending}
          title="Discard draft (Cancel)"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isSending ? "not-allowed" : "pointer",
            background: "transparent",
            border: "1px solid transparent",
            color: "#64748b",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!isSending) {
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.05)";
              e.currentTarget.style.color = "#0f172a";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#64748b";
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Recipient (To:) Row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#475569",
            width: 55,
            flexShrink: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          To
        </span>
        <input
          ref={toInputRef}
          type="text"
          value={to}
          onChange={(e) => handleFieldChange("to", e.target.value)}
          placeholder="recipient@example.com"
          disabled={isSending}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "0.85rem",
            color: "#0f172a",
            fontWeight: 500,
            background: "transparent",
            padding: "2px 0",
          }}
        />
      </div>

      {/* ── Subject Row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#475569",
            width: 55,
            flexShrink: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Subject
        </span>
        <input
          type="text"
          value={subject}
          onChange={(e) => handleFieldChange("subject", e.target.value)}
          placeholder="Subject"
          disabled={isSending}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "#0f172a",
            background: "transparent",
            padding: "2px 0",
          }}
        />
      </div>

      {/* ── Email Body Editor (Scrollable, multiline) ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "14px 16px",
          position: "relative",
        }}
      >
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleFieldChange("body", e.target.value)}
          placeholder="Write your email body here..."
          disabled={isSending}
          className="custom-scrollbar"
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "0.88rem",
            lineHeight: 1.7,
            color: "#1e293b",
            fontFamily: "inherit",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        />
      </div>

      {/* ── Action Footer ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderTop: "1px solid rgba(0, 0, 0, 0.06)",
          background: "rgba(248, 250, 252, 0.95)",
          flexShrink: 0,
          gap: 12,
        }}
      >
        {/* Discard / Cancel button */}
        <button
          onClick={onCancel}
          disabled={isSending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 8,
            fontSize: "0.78rem",
            fontWeight: 500,
            color: "#64748b",
            background: "rgba(0, 0, 0, 0.03)",
            border: "1px solid rgba(0, 0, 0, 0.06)",
            cursor: isSending ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!isSending) {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.2)";
              e.currentTarget.style.color = "#dc2626";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0, 0, 0, 0.03)";
            e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.06)";
            e.currentTarget.style.color = "#64748b";
          }}
        >
          <Trash2 size={13} />
          <span>Discard</span>
        </button>

        {/* Send Email button */}
        <motion.button
          whileTap={isSending ? {} : { scale: 0.97 }}
          onClick={handleSendClick}
          disabled={isSending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 18px",
            borderRadius: 8,
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: isSending ? "not-allowed" : "pointer",
            color: "#ffffff",
            background: isSending
              ? "rgba(59, 130, 246, 0.7)"
              : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            border: "1px solid rgba(37, 99, 235, 0.5)",
            boxShadow: "0 2px 10px rgba(37, 99, 235, 0.25)",
            transition: "all 0.2s",
          }}
        >
          {isSending ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send size={13} />
              <span>Send Email</span>
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
