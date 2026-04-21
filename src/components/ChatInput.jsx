import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, MicOff } from "lucide-react";

export default function ChatInput({ onSend, onToggleMic, isListening, state }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  return (
    <div 
      className="chat-input-container"
      style={{
        padding: "8px 12px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0, 0, 0, 0.05)",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 100,
      }}
    >
      <div 
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          background: "rgba(240, 242, 247, 0.7)",
          padding: "6px 10px",
          borderRadius: "24px",
          border: "1px solid rgba(0, 0, 0, 0.03)",
          transition: "all 0.3s ease",
          maxWidth: "420px",
          margin: "0 auto",
        }}
        className="input-wrapper"
      >
        <button
          onClick={onToggleMic}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: isListening ? "rgba(59, 130, 246, 0.1)" : "transparent",
            color: isListening ? "#3b82f6" : "#64748b",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.2s ease",
          }}
          className="touch-button"
        >
          {isListening ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message AIRA..."
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            padding: "10px 4px",
            fontSize: "0.95rem",
            color: "#1a1a1a",
            resize: "none",
            maxHeight: "150px",
            fontFamily: "inherit",
            lineHeight: "1.4",
          }}
        />

        <AnimatePresence>
          {text.trim() && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={handleSend}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                background: "linear-gradient(135deg, #6a8cff, #3b82f6)",
                color: "white",
                cursor: "pointer",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(106, 140, 255, 0.3)",
              }}
              className="touch-button"
            >
              <Send size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .input-wrapper:focus-within {
          background: #ffffff !important;
          border-color: rgba(106, 140, 255, 0.4) !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06) !important;
        }
        .touch-button:active {
          transform: scale(0.95);
        }
        @media (min-width: 769px) {
          .chat-input-container {
            display: none; /* Only show on mobile as per user request to not affect desktop UI */
          }
        }
      `}</style>
    </div>
  );
}
