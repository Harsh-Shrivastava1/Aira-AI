import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clipboard, Check } from "lucide-react";
import EmailCard from "./EmailCard";

export default function TransientChatBox({ messages, onRefineEmail }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);
  
  const [copiedId, setCopiedId] = React.useState(null);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderCodeBlock = (code, id, language = "") => (
    <div className="relative group w-full my-2 rounded-xl overflow-hidden bg-[#0f172a] border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-white/5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language || "Code"}</span>
        <button
          onClick={() => copyToClipboard(code, id)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 transition-all border border-white/5"
        >
          {copiedId === id ? <Check size={12} className="text-emerald-400" /> : <Clipboard size={12} />}
          <span className="text-[10px] font-bold">{copiedId === id ? "COPIED" : "COPY"}</span>
        </button>
      </div>
      <pre 
        className="p-4 overflow-x-auto overflow-y-auto custom-scrollbar"
        style={{ maxHeight: "500px" }}
      >
        <code className="text-[13px] font-mono leading-relaxed text-blue-100 block">
          {code}
        </code>
      </pre>
    </div>
  );

  const renderContent = (m) => {
    if (m.type === "code") {
      return renderCodeBlock(m.text, m.id);
    }

    if (m.text.includes("```")) {
      const blocks = m.text.split("```");
      return blocks.map((block, index) => {
        if (index % 2 === 1) {
          const lines = block.split("\n");
          const firstLine = lines[0].trim();
          const hasLang = firstLine && /^[a-z0-9+#]+$/i.test(firstLine) && firstLine.length < 15;
          const language = hasLang ? firstLine : "";
          const code = hasLang ? lines.slice(1).join("\n") : block;
          return <React.Fragment key={index}>{renderCodeBlock(code, m.id + index, language)}</React.Fragment>;
        }
        return block.trim() ? <p key={index} className="whitespace-pre-wrap mb-2">{block}</p> : null;
      });
    }

    return <p className="whitespace-pre-wrap">{m.text}</p>;
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl">
      <AnimatePresence initial={false}>
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <motion.div
              layout
              key={m.id || i}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col w-full mb-1"
              style={{ alignItems: isUser ? "flex-end" : "flex-start" }}
            >
              {/* Row for avatar + chat bubble */}
              <div className="flex w-full" style={{ justifyContent: isUser ? "flex-end" : "flex-start" }}>
                {/* AIRA avatar dot */}
                {!isUser && (
                  <div
                    className="flex-none w-7 h-7 rounded-full flex items-center justify-center mr-3 mt-1"
                    style={{
                      background: "linear-gradient(135deg, #6a8cff, #8ed0ff)",
                      boxShadow: "0 0 12px rgba(100,140,255,0.2)",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: "9px", color: "white", fontWeight: 700 }}>AI</span>
                  </div>
                )}

                <div
                  style={{
                    maxWidth: m.type === "code" || m.text.includes("```") ? "95%" : "75%",
                    width: m.type === "code" || m.text.includes("```") ? "100%" : "auto",
                    padding: m.type === "code" || m.text.includes("```") ? "0" : "12px 16px",
                    borderRadius: isUser
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                    fontSize: "0.825rem",
                    lineHeight: 1.65,
                    letterSpacing: "0.01em",
                    ...(isUser && m.type !== "code"
                      ? {
                        background: "linear-gradient(135deg, #6a8cff, #7fd3ff)",
                        color: "white",
                        boxShadow: "0 5px 20px rgba(100,120,255,0.25)",
                        fontWeight: 500,
                      }
                      : m.type === "code" || m.text.includes("```")
                      ? {
                        background: "transparent",
                        color: "#1a1a1a",
                        boxShadow: "none",
                        fontWeight: 400,
                      }
                      : {
                        background: "#ffffff",
                        border: "1px solid rgba(0,0,0,0.06)",
                        color: "#1a1a1a",
                        boxShadow: "0 4px 15px rgba(0,0,0,0.04)",
                        fontWeight: 400,
                      }),
                  }}
                >
                  {renderContent(m)}
                </div>

                {/* User avatar dot */}
                {isUser && (
                  <div
                    className="flex-none w-7 h-7 rounded-full flex items-center justify-center ml-3 mt-1"
                    style={{
                      background: "rgba(0,0,0,0.04)",
                      border: "1px solid rgba(0,0,0,0.05)",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: "9px", color: "#6b7280", fontWeight: 700 }}>
                      YOU
                    </span>
                  </div>
                )}
              </div>

              {/* Optional Email Card */}
              {!isUser && m.emailDraft && (
                <div style={{ marginTop: 14, width: "100%", paddingLeft: 40, maxWidth: "94%" }}>
                  <EmailCard
                    subject={m.emailDraft.subject}
                    body={m.emailDraft.body}
                    onRefine={(req) => onRefineEmail && onRefineEmail(req)}
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
