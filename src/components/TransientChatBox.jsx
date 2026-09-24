import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Globe } from "lucide-react";
import EmailCard from "./EmailCard";
import AssistantMessageRenderer from "./AssistantMessageRenderer";

export default function TransientChatBox({ messages, onRefineEmail, onSendEmail }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl" style={{ minWidth: 0 }}>
      <AnimatePresence initial={false}>
        {messages.map((m, i) => {
          const isUser = m.role === "user";

          // Skip completely empty assistant responses
          if (!isUser && !m.text && m.type !== "code") {
            return null;
          }

          const isRichAssistant = !isUser && (
            m.type === "code" ||
            (m.text && (
              m.text.length > 140 ||
              m.text.includes("```") ||
              m.text.includes("|") ||
              m.text.includes("\n\n") ||
              /^#{1,6}\s+/m.test(m.text) ||
              /^\s*[*+-]\s+/m.test(m.text) ||
              /^\s*\d+[.)]\s+/m.test(m.text) ||
              /^\s*>\s+/m.test(m.text)
            ))
          );

          return (
            <motion.div
              layout
              key={m.id || i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col w-full mb-[10px]"
              style={{ alignItems: isUser ? "flex-end" : "flex-start", minWidth: 0 }}
            >
              {/* Row for avatar + chat bubble */}
              <div
                className="flex w-full px-4"
                style={{
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  gap: "10px",
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                {/* AIRA avatar dot - hidden on mobile if preferred, but kept for context */}
                {!isUser && (
                  <div
                    className="flex-none w-8 h-8 rounded-full flex items-center justify-center mt-1 sm:flex hidden"
                    style={{
                      background: "linear-gradient(135deg, #6a8cff, #8ed0ff)",
                      boxShadow: "0 4px 10px rgba(100,140,255,0.2)",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "white", fontWeight: 800 }}>AI</span>
                  </div>
                )}

                <div
                  className="chat-bubble"
                  style={{
                    maxWidth: isUser ? "75%" : "100%",
                    minWidth: 0,
                    width: isUser ? "auto" : (isRichAssistant ? "100%" : "fit-content"),
                    flex: isUser ? "none" : (isRichAssistant ? "1 1 auto" : "0 1 auto"),
                    padding: isUser
                      ? "12px 18px"
                      : m.type === "code"
                      ? "0"
                      : "12px 18px",
                    borderRadius: "20px",
                    fontSize: isUser ? "1rem" : "0.95rem",
                    lineHeight: 1.5,
                    position: "relative",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    boxSizing: "border-box",
                    ...(isUser && m.type !== "code"
                      ? {
                          background: "linear-gradient(135deg, #3b82f6, #60a5fa)",
                          color: "white",
                          boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)",
                          fontWeight: 500,
                          borderBottomRightRadius: "4px",
                        }
                      : m.type === "code"
                      ? {
                          background: "transparent",
                          color: "#1a1a1a",
                          boxShadow: "none",
                        }
                      : {
                          background: "rgba(255, 255, 255, 0.7)",
                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid rgba(255, 255, 255, 0.4)",
                          color: "#1a1a1a",
                          boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
                          borderBottomLeftRadius: "4px",
                        }),
                  }}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  ) : (
                    <AssistantMessageRenderer message={m} />
                  )}
                </div>
              </div>

              {/* Optional Web Sources Card Section */}
              {!isUser && Array.isArray(m.sources) && m.sources.length > 0 && (
                <div style={{ marginTop: 8, width: "100%", paddingLeft: 16, paddingRight: 16, minWidth: 0, boxSizing: "border-box" }}>
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.8)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid rgba(106, 140, 255, 0.2)",
                      borderRadius: "14px",
                      padding: "10px 14px",
                      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
                      maxWidth: "100%",
                      minWidth: 0,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Globe size={13} style={{ color: "#3b82f6" }} />
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Sources ({m.sources.length})
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {m.sources.map((s, idx) => (
                        <a
                          key={idx}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={s.snippet ? `${s.title}\n\n${s.snippet}` : s.title}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 10px",
                            background: "rgba(241, 245, 249, 0.85)",
                            border: "1px solid rgba(226, 232, 240, 0.9)",
                            borderRadius: "8px",
                            textDecoration: "none",
                            color: "#1e293b",
                            fontSize: "0.78rem",
                            transition: "all 0.2s ease",
                            maxWidth: "100%",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(238, 242, 255, 1)";
                            e.currentTarget.style.borderColor = "rgba(106, 140, 255, 0.4)";
                            e.currentTarget.style.color = "#2563eb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(241, 245, 249, 0.85)";
                            e.currentTarget.style.borderColor = "rgba(226, 232, 240, 0.9)";
                            e.currentTarget.style.color = "#1e293b";
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "rgba(59, 130, 246, 0.15)",
                              color: "#2563eb",
                              fontSize: "0.65rem",
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              maxWidth: 160,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {s.title || s.domain}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#64748b", flexShrink: 0 }}>
                            {s.domain}
                          </span>
                          <ExternalLink size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Email Card */}
              {!isUser && m.emailDraft && m.emailDraft.subject && m.emailDraft.body && m.emailDraft.subject !== "..." && (
                <div style={{ marginTop: 14, width: "100%", paddingLeft: 16, paddingRight: 16, minWidth: 0, boxSizing: "border-box" }}>
                  <EmailCard
                    to={m.emailDraft.to}
                    subject={m.emailDraft.subject}
                    body={m.emailDraft.body}
                    onRefine={(req) => onRefineEmail && onRefineEmail(req)}
                    onSend={(draft) => onSendEmail && onSendEmail(draft)}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
