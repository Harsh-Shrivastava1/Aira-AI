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
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col w-full mb-[10px]"
              style={{ alignItems: isUser ? "flex-end" : "flex-start" }}
            >
              {/* Row for avatar + chat bubble */}
              <div className="flex w-full px-4" style={{ 
                justifyContent: isUser ? "flex-end" : "flex-start",
                gap: "10px"
              }}>
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
                    maxWidth: m.type === "code" || m.text.includes("```") ? "95%" : "75%",
                    width: m.type === "code" || m.text.includes("```") ? "100%" : "auto",
                    padding: m.type === "code" || m.text.includes("```") ? "0" : "12px 18px",
                    borderRadius: "20px",
                    fontSize: "1rem",
                    lineHeight: 1.5,
                    position: "relative",
                    ...(isUser && m.type !== "code"
                      ? {
                        background: "linear-gradient(135deg, #3b82f6, #60a5fa)",
                        color: "white",
                        boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)",
                        fontWeight: 500,
                        borderBottomRightRadius: "4px",
                      }
                      : m.type === "code" || m.text.includes("```")
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
                  {renderContent(m)}
                </div>
              </div>

              {/* Optional Email Card */}
              {!isUser && m.emailDraft && (
                <div style={{ marginTop: 14, width: "100%", paddingLeft: 16, paddingRight: 16 }}>
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
