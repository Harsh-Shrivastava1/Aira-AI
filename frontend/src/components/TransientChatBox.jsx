import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TransientChatBox({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const visible = messages.slice(-6);

  return (
    <div className="w-full max-w-xl mx-auto px-6 flex flex-col gap-3">
      {/* Fade mask at top so messages blend in softly */}
      <div
        className="flex flex-col gap-3"
        style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 100%)" }}
      >
        <AnimatePresence initial={false}>
          {visible.map((m, i) => {
            const isUser = m.role === "user";
            const age = visible.length - 1 - i;
            const opacity = Math.max(0.22, 1 - age * 0.18);

            return (
              <motion.div
                layout
                key={m.id || i}
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.2 } }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    max-w-[80%] px-4 py-3 text-[13px] leading-relaxed tracking-[0.01em]
                    ${isUser ? "bubble-user font-medium" : "bubble-aira font-[450] text-slate-700"}
                  `}
                >
                  {m.text}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
