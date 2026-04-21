import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Cpu, BarChart2, MessageCircle, FileText, X, Trash2, Clipboard } from "lucide-react";
import VoiceOrb from "../components/VoiceOrb";
import TransientChatBox from "../components/TransientChatBox";
import MinimalEvaluationOverlay from "../components/MinimalEvaluationOverlay";
import FileUpload from "../components/FileUpload";
import { useVoice } from "../hooks/useVoice";
import { getActiveChatId, createNewThread, saveMessage, fetchThreadMessages, fetchMemory, saveSessionEvaluation, fetchAllThreads } from "../hooks/useFirestore";
import { auth } from "../config/firebase";
import { API_BASE } from "../config/api";
const API = `${API_BASE}/api`;

const SCORE_REQUEST_PATTERNS = [
  /show\s+(my\s+)?score/i,
  /how\s+did\s+i\s+(do|perform)/i,
  /give\s+(me\s+)?(feedback|my\s+score)/i,
  /what\s+(was|were)\s+my\s+score/i,
  /my\s+(results?|performance|evaluation)/i,
];
function isScoreRequest(text) {
  return SCORE_REQUEST_PATTERNS.some((re) => re.test(text));
}

/* Developer identity — always answered on the frontend to guarantee accuracy */
const DEV_PATTERNS = [
  /who\s+(created|made|built|developed)\s+(you|aira)/i,
  /who\s+is\s+(your\s+)?(developer|creator|maker|author)/i,
  /who\s+owns\s+(you|aira)/i,
  /tell\s+me\s+about\s+your\s+(developer|creator)/i,
];
function isDevQuestion(text) {
  return DEV_PATTERNS.some((re) => re.test(text));
}
const DEV_REPLY =
  "I was built by Harsh Shrivastava — he's the mind behind everything I am ❤️! " +
  "You can reach him at hshrivastava23032007@gmail.com or connect with him on LinkedIn.";

/* Greeting pool — picked randomly on each session */
const GREETINGS = (name) => [
  `Hey ${name}! I'm AIRA. Harsh built me to help you tackle tasks, practice interviews, or just chat. What's on your mind?`,
  `Good to see you, ${name}! I'm AIRA, your smart assistant. Whether it's code, documents, or just a conversation—I'm ready when you are.`,
  `Hey ${name}, I'm AIRA. I've been refining my skills and I'm ready to help with whatever you need. Where should we start?`,
  `Welcome back, ${name}! I'm AIRA. Let's make some progress today. What can I do for you?`,
];
function pickGreeting(name) {
  const pool = GREETINGS(name);
  return pool[Math.floor(Math.random() * pool.length)];
}

const HEADER_H = 70;

export default function Agent({ user }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [showEvalPanel, setShowEvalPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteMode, setPasteMode] = useState("text");
  const [pastedText, setPastedText] = useState("");
  const [history, setHistory] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [memoryText, setMemoryText] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [fileContext, setFileContext] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [hasStarted, setHasStarted] = useState(false); // New: Tracks if sequence has run
  const [showActivation, setShowActivation] = useState(true); // New: Activation overlay state

  const messageHistoryRef = useRef([]);
  const greetedRef = useRef(false);
  const pendingGreetingRef = useRef(null); // New: Stores greeting until interaction
  const hasShownScoreRef = useRef(false);
  const userName = user?.displayName?.split(" ")[0] || "there";

  const loadHistory = useCallback(async () => {
    if (user?.uid) {
      const all = await fetchAllThreads(user.uid);
      setHistory(all);
    }
  }, [user?.uid]);

  const openThread = async (id) => {
    setChatId(id);
    setShowHistory(false);
    const threadHistory = await fetchThreadMessages(user.uid, id, 30);
    messageHistoryRef.current = threadHistory;
    const uiMessages = threadHistory.map((msg, idx) => ({
      id: Date.now() + idx,
      role: msg.role === "assistant" ? "aira" : msg.role,
      text: msg.content,
      type: msg.type || "text"
    }));
    setMessages(uiMessages);
  };

  const deleteChatFromHistory = (e, id) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(t => t.id !== id));
    // If the active chat is deleted, we might want to reset the view
    if (chatId === id) {
      setMessages([]);
      setChatId(null);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchMemory(user.uid).then((m) => setMemoryText(m));

      getActiveChatId(user.uid).then(async (id) => {
        setChatId(id);
        const history = await fetchThreadMessages(user.uid, id, 15);
        if (history.length > 0) {
          messageHistoryRef.current = history;
          const uiMessages = history.map((msg, idx) => ({
            id: Date.now() + idx,
            role: msg.role === "assistant" ? "aira" : msg.role,
            text: msg.content,
            type: msg.type || "text"
          }));
          setMessages(uiMessages);
        }
      });
    }
  }, [user?.uid]);

  const addMessage = useCallback((role, text, emailDraft = null, type = "text") => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text, emailDraft, type }]);
  }, []);

  const handleEvaluate = useCallback(async (scenario) => {
    if (hasShownScoreRef.current) return null;
    const log = messageHistoryRef.current.map((m) => m.role + ": " + m.content);
    try {
      const resp = await fetch(API + "/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationLog: log, scenario }),
      });
      const data = await resp.json();
      if (data.evaluation) {
        hasShownScoreRef.current = true;
        setEvaluation(data.evaluation);
        setShowEvalPanel(true);
        setCurrentScenario(null);
        if (user?.uid)
          saveSessionEvaluation(user.uid, Date.now().toString(), data.evaluation, scenario);
        return data.evaluation;
      }
    } catch (e) {
      console.error("Evaluation failed:", e);
    }
    return null;
  }, [user?.uid]);

  const handleUserSpeak = useCallback(async (transcript) => {
    voice.unlock(); 
    
    // If there's a pending greeting that hasn't been spoken yet, play it now
    if (pendingGreetingRef.current) {
      voice.speak(pendingGreetingRef.current);
      pendingGreetingRef.current = null;
    }

    addMessage("user", transcript);
    messageHistoryRef.current.push({ role: "user", content: transcript });
    voice.setThinking();

    let currentChatId = chatId;

    /* ── Frontend intercepts (never need the backend) ── */

    // 0. Reset Session / Fresh Start
    const tLower = transcript.toLowerCase();
    if (tLower.includes("start fresh") || tLower.includes("new chat") || tLower.includes("reset") || tLower.includes("clear memory")) {
      if (user?.uid) {
        currentChatId = await createNewThread(user.uid);
        setChatId(currentChatId);
      }
      setMessages([]);
      messageHistoryRef.current = [];
      setFileContext(null); // clear file on reset
      const reply = "Alright, starting fresh. What would you like to talk about?";
      addMessage("aira", reply);
      messageHistoryRef.current.push({ role: "assistant", content: reply });
      if (user?.uid && currentChatId) {
        saveMessage(user.uid, currentChatId, "assistant", reply);
      }
      voice.speak(reply);
      return;
    }

    if (user?.uid && currentChatId) {
      saveMessage(user.uid, currentChatId, "user", transcript);
    }

    // 1. Developer identity
    if (isDevQuestion(transcript)) {
      addMessage("aira", DEV_REPLY);
      if (user?.uid && currentChatId) saveMessage(user.uid, currentChatId, "assistant", DEV_REPLY);
      voice.speak(DEV_REPLY);
      return;
    }

    // 2. Score request
    if (isScoreRequest(transcript) && evaluation) {
      setShowEvalPanel(true);
      const reply = "Here's your session report! Check the panel on the right.";
      addMessage("aira", reply);
      if (user?.uid && currentChatId) saveMessage(user.uid, currentChatId, "assistant", reply);
      voice.speak(reply);
      return;
    }

    // 3. File-context Q&A — if a file is active, route question to /api/file
    if (fileContext?.extractedText) {
      if (tLower.includes("remove file") || tLower.includes("clear file") || tLower.includes("close file") || tLower.includes("remove document")) {
        setFileContext(null);
        const reply = "Done! I've removed the file. We're back to normal chat.";
        addMessage("aira", reply);
        messageHistoryRef.current.push({ role: "assistant", content: reply });
        if (user?.uid && currentChatId) saveMessage(user.uid, currentChatId, "assistant", reply);
        voice.speak(reply);
        return;
      }

      try {
        const resp = await fetch(`${API_BASE}/api/file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: transcript,
            fileContent: fileContext.extractedText,
            fileName: fileContext.fileName,
          }),
        });

        if (!resp.ok) throw new Error("File API failed");

        const data = await resp.json();
        const reply = data.reply;

        messageHistoryRef.current.push({ role: "assistant", content: reply });
        addMessage("aira", reply);
        if (user?.uid && currentChatId) saveMessage(user.uid, currentChatId, "assistant", reply);
        voice.speak(reply);
        return;
      } catch (err) {
        console.error("File chat error:", err);
      }
    }

    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messageHistory: messageHistoryRef.current, 
          userName, 
          memory: memoryText 
        }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`Chat API error (${resp.status}):`, errorText);
        throw new Error(`Server responded with ${resp.status}`);
      }

      const data = await resp.json();
      const reply = data.reply || "Hmm, say that again?";

      messageHistoryRef.current.push({ role: "assistant", content: reply });
      
      // Auto-detect code blocks in AIRA's reply
      const hasCode = reply.includes("```") || (reply.includes("{") && reply.includes("}") && reply.includes(";"));
      addMessage("aira", reply, data.emailDraft, hasCode ? "code" : "text");

      if (user?.uid && currentChatId) saveMessage(user.uid, currentChatId, "assistant", reply, hasCode ? "code" : "text");

      if (data.intent === "start_session" && data.scenario) {
        setCurrentScenario(data.scenario);
        hasShownScoreRef.current = false;
      }

      // 300ms delay before speaking for natural pacing
      setTimeout(() => {
        voice.speak(reply, async () => {
          if (data.intent === "end_session" || data.intent === "evaluate") {
            const scenario = currentScenario || data.scenario || "General Practice";
            await handleEvaluate(scenario);
          }
        });
      }, 300);
    } catch (err) {
      console.error("Chat error:", err);
      const errMsg = "Oops, I couldn't reach the server. Check your connection?";
      addMessage("aira", errMsg);
      voice.speak(errMsg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMessage, handleEvaluate, evaluation, memoryText, userName, user?.uid, currentScenario, chatId, fileContext]);

  const splitText = (text, size = 4000) => {
    let chunks = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  };

  const handleSendPastedText = async () => {
    if (!pastedText.trim()) return;
    const textToAnalyze = pastedText;
    const currentMode = pasteMode;
    setShowPasteModal(false);
    setPastedText("");
    setPasteMode("text");

    const chunks = splitText(textToAnalyze, 6000);
    const firstChunk = chunks[0];
    const isLarge = chunks.length > 1;

    if (currentMode === "code") {
      addMessage("user", textToAnalyze, null, "code");
      if (user?.uid && chatId) saveMessage(user.uid, chatId, "user", textToAnalyze, "code");
    } else {
      const summary = `[Pasted Text Block]: ${textToAnalyze.substring(0, 80)}...`;
      addMessage("user", summary);
      if (user?.uid && chatId) saveMessage(user.uid, chatId, "user", summary, "text");
    }
    
    voice.setThinking(currentMode === "code" ? "Analyzing code..." : "Thinking...");

    try {
      // We'll treat this as a virtual file so the user can ask follow-up questions
      const virtualFile = {
        fileName: currentMode === "code" ? "Source Code" : "Pasted Content",
        extractedText: textToAnalyze,
        documentType: currentMode === "code" ? "Code" : "Text Snippet"
      };
      setFileContext(virtualFile);

      const resp = await fetch(API + "/file-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentMode === "code" 
            ? "You are a senior software engineer. Analyze this code, fix errors, explain issues, and return corrected code properly formatted."
            : "Please analyze this text, summarize it, and extract key points.",
          fileContent: isLarge ? firstChunk : textToAnalyze,
          fileName: currentMode === "code" ? "Source Code" : "Pasted Content",
          type: currentMode === "code" ? "code_block" : "text_block"
        }),
      });
      const data = await resp.json();
      let reply = data.reply || (currentMode === "code" ? "I've reviewed the code. What specific part should I explain or help with?" : "I've analyzed the text. What would you like to know about it?");

      if (isLarge && currentMode === "code") {
        reply = "Your code is large — I've analyzed the main part. You can ask for deeper analysis on specific sections if needed.\n\n" + reply;
      }

      addMessage("aira", reply);
      if (user?.uid && chatId) saveMessage(user.uid, chatId, "assistant", reply);
      voice.speak(reply);
    } catch (err) {
      console.error("Paste analysis error:", err);
      addMessage("aira", "I couldn't process that content. Maybe try a smaller snippet?");
    }
  };

  const voice = useVoice(handleUserSpeak);

  // Sequential Auto-Activation Logic
  const handleActivation = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);
    setShowActivation(false);
    
    // Step 1: Unlock and Greeting
    voice.unlock();
    const greeting = pickGreeting(userName);
    addMessage("aira", greeting);

    // Step 2: Speak then start listening automatically
    setTimeout(() => {
      voice.speak(greeting, () => {
        // Step 3: Auto-start listening after greeting finishes
        setTimeout(() => {
          voice.startListening();
        }, 400); 
      });
    }, 300);
  }, [hasStarted, userName, voice, addMessage]);

  useEffect(() => {
    if (!user || greetedRef.current) return;
    greetedRef.current = true;
    // We just mark it ready, activation handles the rest
  }, [user]);

  const handleDisconnect = () => {
    voice.stopListening();
    auth.signOut();
    navigate("/");
  };

  /* State dot color — plain CSS value, no motion */
  const stateDotColor =
    voice.state === "speaking" ? "#3b82f6"
      : voice.state === "listening" ? "#22d3ee"
        : voice.state === "thinking" ? "#a855f7"
          : "#334155";

  const stateDotGlow =
    voice.state !== "idle" ? `0 0 7px ${stateDotColor}` : "none";

  return (
    /*
     * ROOT SHELL — position:fixed, overflow:hidden.
     * Nothing here animates. No transform. No scale.
     * Only the VoiceOrb subtree is allowed to move.
     */
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => { e.preventDefault(); setIsDraggingFile(false); }}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "linear-gradient(135deg, #f5f7fb, #e9eef7)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>

      {/*
       * STATIC DECORATIVE BACKGROUND — NO ANIMATION
       * Previously these had motion scale/y that caused paint thrashing.
       * Now they are plain CSS with opacity only (compositor-friendly).
       */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {/* noise texture */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
          backgroundSize: "200px",
        }} />
        {/* static left glow — no scale/translate animation */}
        <div style={{
          position: "absolute", borderRadius: "50%",
          width: 800, height: 800,
          top: "30%", left: "20%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(120,140,255,0.08) 0%, transparent 70%)",
        }} />
        {/* static bottom-right glow */}
        <div style={{
          position: "absolute", borderRadius: "50%",
          width: 800, height: 800,
          bottom: "30%", right: "20%",
          transform: "translate(50%, 50%)",
          background: "radial-gradient(circle, rgba(100,200,255,0.08) 0%, transparent 70%)",
        }} />
      </div>

      {/* ════════════════════════════════════════
          HEADER — static, no motion, always visible
      ════════════════════════════════════════ */}
      <header style={{
        flexShrink: 0,
        height: isMobile ? 60 : HEADER_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 16px" : "0 24px",
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        position: "relative",
        zIndex: 100,
        transition: "all 0.25s ease",
      }}>
        {/* Top accent stripe */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(to right, #6a8cff, #8ed0ff)",
        }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #6a8cff 0%, #3b82f6 100%)",
            boxShadow: "0 4px 14px rgba(106,140,255,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Cpu size={15} color="white" />
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: "0.84rem", fontWeight: 800, color: "#1a1a1a", letterSpacing: "0.08em" }}>AIRA</div>
            {!isMobile && (
              <div style={{ fontSize: "0.55rem", color: "#6b7280", fontWeight: 600, letterSpacing: "0.2em", marginTop: 2 }}>AI VOICE AGENT</div>
            )}
          </div>

          {/* Active scenario pill */}
          <AnimatePresence>
            {currentScenario && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  marginLeft: 10,
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 11px", borderRadius: 999,
                  fontSize: "0.6rem", fontWeight: 700, color: "#4b5563",
                  background: "rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#6a8cff",
                  display: "inline-block", animation: "aira-pulse 1.5s infinite",
                }} />
                {currentScenario}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right side: Session Report (Desktop) & Mobile Tools */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AnimatePresence>
            {evaluation && !isMobile && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEvalPanel((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 13px", borderRadius: 8,
                  fontSize: "0.68rem", fontWeight: 600, cursor: "pointer",
                  color: showEvalPanel ? "#1a1a1a" : "#4b5563",
                  background: showEvalPanel ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.05)",
                  transition: "all 0.25s ease",
                }}
              >
                <BarChart2 size={13} />
                Session Report
              </motion.button>
            )}
          </AnimatePresence>

          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 50 }}>
              {evaluation && (
                <button
                  onClick={() => setShowEvalPanel((v) => !v)}
                  style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: 8,
                    width: 32, height: 32,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "#10b981",
                  }}
                >
                  <BarChart2 size={14} />
                </button>
              )}
              <button
                onClick={() => setShowPasteModal(true)}
                title="Paste large text"
                style={{
                  background: "rgba(106,140,255,0.08)",
                  border: "1px solid rgba(106,140,255,0.15)",
                  borderRadius: 8,
                  width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#6a8cff",
                }}
              >
                <Clipboard size={14} />
              </button>

              <FileUpload
                fileContext={null}
                onFileAnalyzed={(result) => setFileContext(result)}
                onClearFile={() => setFileContext(null)}
                addMessage={addMessage}
                voiceSpeak={(text) => voice.speak(text)}
              />
            </div>
          )}
        </div>
      </header>
      
      {/* ─── ACTIVATION OVERLAY ─── */}
      <AnimatePresence>
        {showActivation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleActivation}
            style={{
              position: "fixed", inset: 0, zContext: 5000,
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(12px)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              cursor: "pointer", zIndex: 10000
            }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: 100, height: 100, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(106,140,255,0.2), rgba(59,130,246,0.1))",
                border: "1px solid rgba(106,140,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 24, boxShadow: "0 0 40px rgba(106,140,255,0.15)"
              }}
            >
              <Cpu size={40} color="#6a8cff" />
            </motion.div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>AIRA is ready</h2>
            <p style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: 500 }}>Tap anywhere to activate</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════
          BODY ROW — flex:1, overflow:hidden
          Left orb (55%) + Right chat (45%)
      ════════════════════════════════════════ */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
        maxWidth: isMobile ? 420 : "none",
        margin: "0 auto",
        width: "100%",
      }}>

        {/* ── LEFT: ORB PANEL ── */}
        <div 
          className="orb-panel"
          style={{
            display: "flex",
            flex: isMobile ? "none" : "0 0 55%",
            height: isMobile ? "auto" : "100%",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            borderRight: isMobile ? "none" : "1px solid rgba(0,0,0,0.05)",
          }}
        >
          {/* Divider line */}
          <div style={{
            position: "absolute", right: 0, top: "20%", bottom: "20%",
            width: 1, pointerEvents: "none",
            background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.05), transparent)",
          }} />

          {/*
           * ORB WRAPPER — absolute centered for maximum stability.
           * This ensures the orb never shifts even if re-renders occur.
           */}
          <div 
            onClick={() => {
              if (!hasStarted) handleActivation();
            }}
            className="orb-container"
            style={{
              position: isMobile ? "relative" : "absolute",
              top: isMobile ? "auto" : "50%",
              left: isMobile ? "auto" : "50%",
              transform: isMobile ? "none" : "translate(-50%, -50%)",
              margin: isMobile ? "20px 0 10px" : "0",
              cursor: !hasStarted ? "pointer" : "default",
              transition: "all 0.4s ease",
            }}
          >
            <VoiceOrb
              state={voice.state}
              thinkingMessage={voice.thinkingMessage}
              toggleListening={() => {
                if (!hasStarted) handleActivation();
                else voice.toggleOrb();
              }}
            />
          </div>
        </div>

        {/* ── CHAT PANEL ── */}
        <div 
          className="chat-panel"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
            background: isMobile ? "transparent" : "rgba(255,255,255,0.85)",
            backdropFilter: isMobile ? "none" : "blur(20px)",
            borderLeft: isMobile ? "none" : "1px solid rgba(0,0,0,0.08)",
            width: "100%",
          }}
        >

          {/* Eval panel slides from right — only opacity+x, position:absolute so it doesn't shift layout */}
          <AnimatePresence>
            {showEvalPanel && evaluation && (
              <motion.div
                key="eval"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  position: "absolute", top: 0, right: 0, bottom: 0,
                  width: 290, zIndex: 20,
                  borderLeft: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <MinimalEvaluationOverlay evaluation={evaluation} onClose={() => setShowEvalPanel(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat sub-header — hidden on mobile */}
          {!isMobile && (
            <div style={{
              flexShrink: 0,
              height: 46,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 22px",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.95)",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: stateDotColor,
                boxShadow: stateDotGlow,
                transition: "background 0.4s, box-shadow 0.4s",
              }} />
              <span style={{
                fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em",
                textTransform: "uppercase", color: "#6b7280",
              }}>
                Conversation
              </span>

              {/* File upload button — always at the far right */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setShowPasteModal(true)}
                  title="Paste large text"
                  style={{
                    background: "rgba(106,140,255,0.08)",
                    border: "1px solid rgba(106,140,255,0.15)",
                    borderRadius: 8,
                    width: 32, height: 32,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "#6a8cff",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(106,140,255,0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(106,140,255,0.08)"; }}
                >
                  <Clipboard size={15} />
                </button>

                <FileUpload
                  fileContext={null}
                  onFileAnalyzed={(result) => setFileContext(result)}
                  onClearFile={() => setFileContext(null)}
                  addMessage={addMessage}
                  voiceSpeak={(text) => voice.speak(text)}
                />
              </div>
            </div>
          )}

          {/* SCROLLABLE AREA — only child that scrolls */}
          <div 
            className="chat-scroll-area"
            style={{
              flex: 1,
              height: "100%",
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              scrollBehavior: "smooth",
              padding: isMobile ? "12px 12px 30px" : "20px 20px 28px",
              paddingRight: (showEvalPanel && evaluation && !isMobile) ? 306 : (isMobile ? 12 : 20),
              transition: "padding-right 0.3s ease",
              maxHeight: isMobile ? "60vh" : "none",
            }}
          >
            {/* File context indicator (inside scrollable area) */}
            <AnimatePresence>
              {fileContext && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 12, marginBottom: 14,
                    background: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    boxShadow: "0 5px 15px rgba(120,140,255,0.1)",
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "rgba(100,140,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#6a8cff", flexShrink: 0,
                  }}>
                    <FileText size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "0.72rem", fontWeight: 600, color: "#1a1a1a",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      📎 {fileContext.fileName}
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "#6b7280" }}>
                      {fileContext.documentType || "Document"} — Ask questions about this file
                    </div>
                  </div>
                  <button
                    onClick={() => setFileContext(null)}
                    style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: "rgba(0,0,0,0.04)",
                      border: "1px solid rgba(0,0,0,0.05)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "#ef4444",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                    title="Remove file"
                  >
                    <X size={11} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            <AnimatePresence>
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    minHeight: "65%", gap: 14,
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: "rgba(106,140,255,0.1)", border: "1px solid rgba(106,140,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Cpu size={18} color="#6a8cff" />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>
                      Ready to chat
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "#6b7280" }}>
                      AIRA is ready to assist you.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <TransientChatBox messages={messages} onRefineEmail={handleUserSpeak} />
          </div>

        </div>
      </main>

      {/* ════════════════════════════════════════
          USER PROFILE — SAAS UI (FIXED TOP-RIGHT)
      ════════════════════════════════════════ */}
      <div
        ref={profileRef}
        style={{
          position: "fixed",
          top: isMobile ? 12 : 20,
          right: isMobile ? 16 : 24,
          zIndex: 1000,
        }}
      >
        <div
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            width: isMobile ? 36 : 42,
            height: isMobile ? 36 : 42,
            borderRadius: "50%",
            cursor: "pointer",
            border: "2px solid rgba(120,140,255,0.3)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            transition: "all 0.2s ease",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #6a8cff, #8ed0ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 }}>
              {user?.displayName?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showUserMenu && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "absolute",
                top: 55,
                right: 0,
                width: 180,
                background: "#ffffff",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #f3f4f6", marginBottom: 4 }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{user?.displayName || "User"}</p>
                <p style={{ fontSize: "0.65rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</p>
              </div>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  setShowHistory(true);
                  loadHistory();
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 8,
                  fontSize: "0.85rem", fontWeight: 500, color: "#4b5563",
                  background: "transparent", border: "none", cursor: "pointer",
                  transition: "all 0.2s ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f6ff"; e.currentTarget.style.color = "#3b82f6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4b5563"; }}
              >
                <MessageCircle size={15} />
                Chat History
              </button>

              <button
                onClick={async () => {
                  setShowUserMenu(false);
                  if (user?.uid) {
                    const newId = await createNewThread(user.uid);
                    setChatId(newId);
                    setMessages([]);
                    messageHistoryRef.current = [];
                    const reply = "Alright, new chat started. What's on your mind?";
                    addMessage("aira", reply);
                    voice.speak(reply);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 8,
                  fontSize: "0.85rem", fontWeight: 500, color: "#4b5563",
                  background: "transparent", border: "none", cursor: "pointer",
                  transition: "all 0.2s ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f6ff"; e.currentTarget.style.color = "#3b82f6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4b5563"; }}
              >
                <Cpu size={15} />
                New Conversation
              </button>

              <button
                onClick={() => auth.signOut()}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 8,
                  fontSize: "0.85rem", fontWeight: 500, color: "#ff4d4f",
                  background: "transparent", border: "none", cursor: "pointer",
                  transition: "all 0.2s ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#fff1f0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── PASTE TEXT MODAL ─── */}
      <AnimatePresence>
        {showPasteModal && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              style={{
                width: "100%", maxWidth: 600,
                background: "#fff", borderRadius: 24,
                padding: 30, boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
                display: "flex", flexDirection: "column", gap: 20,
              }}
            >
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>Paste Content</h3>
                <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Paste large notes, articles, or code snippets for AIRA to analyze.</p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button 
                  onClick={() => setPasteMode("text")}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 12,
                    background: pasteMode === "text" ? "rgba(106,140,255,0.1)" : "transparent",
                    border: `1px solid ${pasteMode === "text" ? "#6a8cff" : "#e2e8f0"}`,
                    color: pasteMode === "text" ? "#6a8cff" : "#64748b",
                    fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  Text Mode
                </button>
                <button 
                  onClick={() => setPasteMode("code")}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 12,
                    background: pasteMode === "code" ? "rgba(106,140,255,0.1)" : "transparent",
                    border: `1px solid ${pasteMode === "code" ? "#6a8cff" : "#e2e8f0"}`,
                    color: pasteMode === "code" ? "#6a8cff" : "#64748b",
                    fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  Code Mode
                </button>
              </div>

              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={pasteMode === "code" ? "Paste your code here..." : "Paste your text here..."}
                autoFocus
                style={{
                  width: "100%", height: 300,
                  padding: 18, borderRadius: 16,
                  border: "1px solid #e2e8f0", 
                  background: pasteMode === "code" ? "#0f172a" : "#f8fafc",
                  color: pasteMode === "code" ? "#e2e8f0" : "#1e293b",
                  fontSize: "0.85rem", 
                  fontFamily: pasteMode === "code" ? "monospace" : "inherit",
                  resize: "none", outline: "none",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#6a8cff"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
                <button
                  onClick={() => setShowPasteModal(false)}
                  style={{
                    padding: "12px 24px", borderRadius: 12,
                    background: "#f1f5f9", color: "#64748b",
                    border: "none", fontSize: "0.85rem", fontWeight: 700,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendPastedText}
                  disabled={!pastedText.trim()}
                  style={{
                    padding: "12px 30px", borderRadius: 12,
                    background: pastedText.trim() ? "linear-gradient(135deg, #6a8cff, #3b82f6)" : "#cbd5e1",
                    color: "#fff", border: "none", fontSize: "0.85rem", fontWeight: 700,
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: pastedText.trim() ? "0 4px 14px rgba(106,140,255,0.3)" : "none",
                  }}
                >
                  Analyze Text
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── HISTORY SIDEBAR ─── */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)",
                backdropFilter: "blur(4px)", zIndex: 1100,
              }}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{
                position: "fixed", top: 0, right: 0, bottom: 0,
                width: 340, background: "#fff", zIndex: 1200,
                boxShadow: "-10px 0 40px rgba(0,0,0,0.1)",
                display: "flex", flexDirection: "column",
              }}
            >
              <div style={{ padding: "24px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Chat History</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={16} color="#64748b" />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: "center", marginTop: 60 }}>
                    <div style={{ background: "#f8fafc", width: 48, height: 48, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MessageCircle size={20} color="#94a3b8" />
                    </div>
                    <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>No past conversations yet.</p>
                  </div>
                ) : (
                  history.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => openThread(thread.id)}
                      style={{
                        position: "relative",
                        padding: "14px 16px", borderRadius: 14, cursor: "pointer",
                        background: chatId === thread.id ? "#f3f6ff" : "transparent",
                        border: chatId === thread.id ? "1px solid rgba(59,130,246,0.1)" : "1px solid transparent",
                        marginBottom: 8, transition: "all 0.2s",
                        group: "history-item",
                      }}
                      className="history-item-container"
                      onMouseEnter={(e) => { if (chatId !== thread.id) e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { if (chatId !== thread.id) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: chatId === thread.id ? "#3b82f6" : "#1a1a1a", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {thread.title || "New Conversation"}
                          </p>
                          <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 500 }}>
                            {thread.lastUpdated?.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        </div>

                        <button
                          onClick={(e) => deleteChatFromHistory(e, thread.id)}
                          className="delete-history-btn"
                          style={{
                            background: "transparent", border: "none", padding: 4, cursor: "pointer",
                            opacity: 0, transition: "all 0.2s", color: "#ef4444",
                            marginTop: -2,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ padding: 16, borderTop: "1px solid #f1f5f9" }}>
                <button
                  onClick={async () => {
                    const newId = await createNewThread(user.uid);
                    setChatId(newId);
                    setMessages([]);
                    messageHistoryRef.current = [];
                    setShowHistory(false);
                    voice.speak("Ready for a new session. What's on your mind?");
                  }}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 12,
                    background: "linear-gradient(135deg, #6a8cff, #3b82f6)",
                    color: "#fff", border: "none", fontSize: "0.85rem", fontWeight: 700,
                    cursor: "pointer", boxShadow: "0 4px 14px rgba(106,140,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <Cpu size={16} />
                  Start New Chat
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global keyframes for smooth UI */}
      <style>{`
        @keyframes aira-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.15); }
        .history-item-container:hover .delete-history-btn { opacity: 1 !important; }
        .delete-history-btn:hover { background: #fee2e2 !important; border-radius: 6px; }

        @media (max-width: 768px) {
          .orb-container {
            transform: scale(0.65) !important;
            margin-top: 10px !important;
            margin-bottom: 5px !important;
          }
          .chat-scroll-area {
            max-height: 55vh !important;
          }
          header {
            backdrop-filter: blur(5px) !important;
            background: rgba(255, 255, 255, 0.8) !important;
          }
          main {
             overflow: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}