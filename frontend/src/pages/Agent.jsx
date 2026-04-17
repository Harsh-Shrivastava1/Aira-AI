import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Cpu } from "lucide-react";
import VoiceOrb from "../components/VoiceOrb";
import TransientChatBox from "../components/TransientChatBox";
import MinimalEvaluationOverlay from "../components/MinimalEvaluationOverlay";
import { useVoice } from "../hooks/useVoice";
import { saveChat, fetchMemory, saveSessionEvaluation } from "../hooks/useFirestore";
import { auth } from "../firebase";

const API = "http://localhost:5000/api";

export default function Agent({ user }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [memoryText, setMemoryText] = useState(null);

  const messageHistoryRef = useRef([]);
  const userName = user?.displayName?.split(" ")[0] || "there";

  useEffect(() => {
    if (user?.uid) fetchMemory(user.uid).then(m => setMemoryText(m));
  }, [user?.uid]);

  const addMessage = useCallback((role, text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, text }]);
  }, []);

  const handleEvaluate = useCallback(async (scenario) => {
    const log = messageHistoryRef.current.map(m => m.role + ": " + m.content);
    try {
      const resp = await fetch(API + "/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationLog: log, scenario })
      });
      const data = await resp.json();
      if (data.evaluation) {
        setEvaluation(data.evaluation);
        setCurrentScenario(null);
        if (user?.uid) saveSessionEvaluation(user.uid, Date.now().toString(), data.evaluation, scenario);
        return data.evaluation;
      }
    } catch (e) {
      console.error("Evaluation failed:", e);
    }
    return null;
  }, [user?.uid]);

  const handleUserSpeak = useCallback(async (transcript) => {
    addMessage("user", transcript);
    messageHistoryRef.current.push({ role: "user", content: transcript });
    voice.setThinking();

    try {
      const resp = await fetch(API + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageHistory: messageHistoryRef.current,
          userName,
          memory: memoryText
        })
      });
      const data = await resp.json();
      const reply = data.reply || "Hmm, say that again?";

      messageHistoryRef.current.push({ role: "assistant", content: reply });
      addMessage("aira", reply);

      if (user?.uid) saveChat(user.uid, transcript, reply);
      if (data.intent === "start_session" && data.scenario) setCurrentScenario(data.scenario);

      voice.speak(reply, async () => {
        if (data.intent === "end_session" || data.intent === "evaluate") {
          const scenario = currentScenario || data.scenario || "General Practice";
          const evalResult = await handleEvaluate(scenario);
          if (evalResult) {
            const scoreMsg = `Your confidence score was ${evalResult.confidenceScore} and communication was ${evalResult.communicationScore}. Not bad at all, ${userName}! Want to go again?`;
            addMessage("aira", scoreMsg);
            voice.speak(scoreMsg);
          }
        }
      });
    } catch (err) {
      console.error("Chat error:", err);
      const errMsg = "Oops, I couldn't reach the server. Check your connection?";
      addMessage("aira", errMsg);
      voice.speak(errMsg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMessage, handleEvaluate, memoryText, userName, user?.uid, currentScenario]);

  const voice = useVoice(handleUserSpeak);

  // ── Personalized greeting on mount ──
  useEffect(() => {
    const greeting = `Hey ${userName}! I'm AIRA — your personal AI assistant. I'm here to chat, help you practice, or just hang out. What do you wanna do?`;
    const t = setTimeout(() => {
      addMessage("aira", greeting);
      voice.speak(greeting);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = () => {
    voice.stopListening();
    auth.signOut();
    navigate("/");
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: "linear-gradient(145deg, #f8faff 0%, #eef2ff 45%, #dbeafe 100%)" }}
    >
      {/* ── Background blobs (decorative) ── */}
      <motion.div
        className="blob w-[500px] h-[500px] bg-indigo-200 -top-40 -right-40 pointer-events-none"
        animate={{ scale: [1, 1.1, 1], x: [0, 18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="blob w-[380px] h-[380px] bg-cyan-100 -bottom-28 -left-28 pointer-events-none"
        animate={{ scale: [1, 1.14, 1], y: [0, -18, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* ── Header (absolute top) ── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4"
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #a5b4fc, #6366f1)",
              boxShadow: "0 4px 12px rgba(99,102,241,0.25)"
            }}
          >
            <Cpu size={14} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-700 leading-none block">AIRA</span>
            <span className="text-[10px] text-slate-400 font-medium">AI Voice Agent</span>
          </div>

          {/* Active scenario pill */}
          <AnimatePresence>
            {currentScenario && (
              <motion.div
                initial={{ opacity: 0, x: -8, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 ml-2 bg-white border border-indigo-100 text-indigo-600 text-[10px] font-semibold px-3 py-1 rounded-full"
                style={{ boxShadow: "0 2px 10px rgba(99,102,241,0.1)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                {currentScenario}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt={userName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full ring-2 ring-white"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
            />
          )}
          <span className="text-sm text-slate-500 font-medium hidden sm:block">{userName}</span>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 transition-colors duration-200 text-xs font-medium"
          >
            <LogOut size={14} />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </motion.header>

      {/* ── Evaluation overlay ── */}
      <AnimatePresence>
        {evaluation && (
          <MinimalEvaluationOverlay evaluation={evaluation} onClose={() => setEvaluation(null)} />
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════
          ORB — always dead-center on screen
          Uses absolute + transform centering
          so it NEVER moves with chat content
      ══════════════════════════════════ */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="pointer-events-auto" style={{ marginTop: "-40px" }}>
          <VoiceOrb
            state={voice.state}
            toggleListening={() =>
              voice.state === "listening" ? voice.stopListening() : voice.startListening()
            }
          />
        </div>
      </div>

      {/* ══════════════════════════════════
          CHAT — pinned to bottom, scrollable
          Orb is NOT in the same flex context,
          so chat CANNOT push the orb up
      ══════════════════════════════════ */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-8 pt-4">
        {/* Hint text when no messages yet */}
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-sm text-slate-400 font-light mb-4"
            >
              Try saying{" "}
              <span className="text-indigo-500 font-medium">"Start an interview"</span> or{" "}
              <span className="text-indigo-500 font-medium">"What can you do?"</span>
            </motion.p>
          )}
        </AnimatePresence>

        <TransientChatBox messages={messages} />
      </div>
    </div>
  );
}