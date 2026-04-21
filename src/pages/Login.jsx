import React, { useState } from "react";
import LoginOrb from "../components/LoginOrb";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles, X, Brain, MessageCircle, Repeat2, Lightbulb, Zap, User2, Check, ChevronDown } from "lucide-react";
import { auth, provider, signInWithPopup } from "@/config/firebase";

/* ─────────────────────────────────────────────────
   ABOUT MODAL — light glass, 3 sections
───────────────────────────────────────────────── */
const SECTIONS = [
  {
    id: "how",
    icon: <Mic size={15} />,
    color: { accent: "#0ea5e9", bg: "rgba(14,165,233,0.04)", border: "rgba(14,165,233,0.12)" },
    title: "How to use AIRA",
    items: [
      "Just speak naturally — no typing needed",
      "Ask anything or give AIRA a task",
      "Interrupt anytime — it listens instantly",
      "Tap the orb to start, pause, or stop",
    ],
  },
  {
    id: "do",
    icon: <Lightbulb size={15} />,
    color: { accent: "#6366f1", bg: "rgba(99,102,241,0.04)", border: "rgba(99,102,241,0.12)" },
    title: "What you can do",
    items: [
      "Talk, ask questions, explore ideas",
      "Get help with emails, planning, learning",
      "Practice interviews and conversations",
      "Use it as a smart companion — anytime",
    ],
  },
];

function SectionBlock({ sec, si }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 + si * 0.06, duration: 0.3 }}
      style={{ borderRadius: 14, border: `1px solid ${sec.color.border}`, background: sec.color.bg, overflow: "hidden" }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "10px 14px 8px",
        borderBottom: `1px solid ${sec.color.border}`,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: "white", border: `1px solid ${sec.color.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: sec.color.accent,
          boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
        }}>{sec.icon}</div>
        <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: sec.color.accent }}>
          {sec.title}
        </span>
      </div>
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
        {sec.items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: sec.color.accent, opacity: 0.5, flexShrink: 0, marginTop: 6 }} />
            <span style={{ fontSize: "0.75rem", color: "#475569", lineHeight: 1.55 }}>{item}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ComparisonBlock({ forceExpanded = false }) {
  const [expanded, setExpanded] = useState(forceExpanded);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.3 }}
      style={{ borderRadius: 14, border: "1px solid rgba(99,102,241,0.12)", background: "rgba(255,255,255,0.4)", overflow: "hidden" }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", cursor: "pointer",
          borderBottom: expanded ? "1px solid rgba(99,102,241,0.08)" : "none",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(99,102,241,0.03)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: "white", border: "1px solid rgba(99,102,241,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#6366f1",
            boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
          }}><Brain size={15} /></div>
          <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6366f1" }}>
            Why AIRA feels different
          </span>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} style={{ color: "#6366f1" }}>
          <ChevronDown size={16} />
        </motion.div>
      </div>

      {/* Content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Normal AI Column */}
              <div style={{
                background: "rgba(241,245,249,0.5)", border: "1px solid rgba(203,213,225,0.4)",
                borderRadius: 10, padding: 14
              }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  Normal AI
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "You speak or type → it replies",
                    "Works like a tool",
                    "Just executes tasks",
                    "No real understanding of context",
                    "No personality or interaction depth"
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ color: "#94a3b8", marginTop: 2 }}><X size={12} strokeWidth={3} /></div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.45 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AIRA Column */}
              <div style={{
                background: "linear-gradient(145deg, rgba(99,102,241,0.05), rgba(139,92,246,0.05))",
                border: "1px solid rgba(99,102,241,0.15)",
                borderRadius: 10, padding: 14,
                boxShadow: "0 4px 15px rgba(99,102,241,0.05)"
              }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 800, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  AIRA
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "Listens, understands, and responds naturally",
                    "Feels like talking to a real person",
                    "Can roleplay (manager, HR, interviewer, etc.)",
                    "Helps in real scenarios like salary negotiation, interviews, decision-making",
                    "Thinks ahead — not just replies, but suggests what to do next",
                    "Adapts to your tone and conversation style",
                    "Remembers context to keep conversations meaningful",
                    "Acts like a companion, not just a tool"
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ color: "#6366f1", marginTop: 2 }}>
                        <Check size={12} strokeWidth={4} />
                      </div>
                      <span style={{ fontSize: "0.76rem", color: "#1e293b", lineHeight: 1.5, fontWeight: 500 }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AgenticComparisonBlock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.3 }}
      style={{ borderRadius: 14, border: "1px solid rgba(14,165,233,0.12)", background: "rgba(255,255,255,0.4)", overflow: "hidden", padding: 14 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: "white", border: "1px solid rgba(14,165,233,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#0ea5e9",
          boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
        }}><Brain size={15} /></div>
        <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0ea5e9" }}>
          AI vs Agentic AI
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, width: "100%", flexDirection: "row" }}>
        {/* Normal AI Column */}
        <div style={{
          flex: 1,
          background: "rgba(241,245,249,0.5)", border: "1px solid rgba(203,213,225,0.4)",
          borderRadius: 10, padding: 12
        }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Normal AI
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Responds to what you ask", "Works step-by-step", "Waits for your input", "Like a smart tool"].map((item, i) => (
              <div key={"norm" + i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ color: "#94a3b8", marginTop: 2 }}><X size={10} strokeWidth={3} /></div>
                <span style={{ fontSize: "0.7rem", color: "#64748b", lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agentic AI Column */}
        <div style={{
          flex: 1,
          background: "linear-gradient(145deg, rgba(14,165,233,0.05), rgba(99,102,241,0.05))",
          border: "1px solid rgba(14,165,233,0.15)",
          borderRadius: 10, padding: 12,
          boxShadow: "0 4px 15px rgba(14,165,233,0.05)"
        }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 800, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Agentic AI
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Understands your goal", "Thinks & plans ahead", "Takes initiative", "Suggests & guides", "Like an assistant"].map((item, i) => (
              <div key={"agent" + i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ color: "#0ea5e9", marginTop: 2 }}><Check size={10} strokeWidth={4} /></div>
                <span style={{ fontSize: "0.7rem", color: "#1e293b", lineHeight: 1.4, fontWeight: 500 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 12, padding: "10px 12px", borderRadius: 8,
        background: "rgba(14,165,233,0.04)", border: "1px solid rgba(14,165,233,0.1)"
      }}>
        <p style={{ margin: 0, fontSize: "0.72rem", color: "#475569", lineHeight: 1.5 }}>
          <strong style={{ color: "#0ea5e9" }}>AIRA is built as an Agentic AI</strong> — it doesn’t just respond, it understands, suggests, and guides you like a real companion.
        </p>
      </div>
    </motion.div>
  );
}

function AboutModal({ onClose, modalType }) {
  const isWhat = modalType === "what";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        background: "rgba(241, 245, 249, 0.4)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.48 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: 500,
          maxHeight: "88vh", overflowY: "auto",
          borderRadius: 28,
          background: "rgba(255, 255, 255, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.6)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* top accent line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          borderRadius: "28px 28px 0 0",
          background: "linear-gradient(to right, #6366f1, #0ea5e9, #6366f1)",
        }} />

        <div style={{ padding: "32px 30px 28px" }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
                boxShadow: "0 8px 20px rgba(99,102,241,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Brain size={18} color="white" />
              </div>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                  {isWhat ? "What is AIRA?" : "How AIRA is different"}
                </div>
                {isWhat && (
                  <div style={{ fontSize: "0.55rem", color: "#6366f1", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 2 }}>
                    Advanced Intelligent Responsive Assistant
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#64748b", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
            ><X size={14} /></button>
          </div>

          {/* lead */}
          {isWhat && (
            <p style={{
              fontSize: "0.82rem", color: "#475569", lineHeight: 1.7, marginBottom: 24,
              padding: "14px 16px", borderRadius: 14,
              background: "rgba(99,102,241,0.03)", border: "1px solid rgba(99,102,241,0.06)",
            }}>
              AIRA is a <span style={{ color: "#4f46e5", fontWeight: 600 }}>voice-first AI assistant</span> that listens, remembers, and adapts — so every conversation feels natural, useful, and real.
            </p>
          )}

          {/* sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isWhat ? (
              <>
                <SectionBlock sec={SECTIONS[1]} si={0} />
                <AgenticComparisonBlock />
              </>
            ) : (
              <>
                <SectionBlock sec={SECTIONS[0]} si={0} />
                <ComparisonBlock forceExpanded={true} />
              </>
            )}
          </div>

          {/* footer */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginTop: 24, paddingTop: 18,
            borderTop: "1px solid rgba(0,0,0,0.05)",
          }}>
            <User2 size={12} color="#94a3b8" />
            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
              Built by{" "}
              <a href="mailto:hshrivastava23032007@gmail.com" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>
                Harsh Shrivastava
              </a>
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────
   STARFIELD BACKGROUND
───────────────────────────────────────────────── */
function Starfield() {
  const [stars] = React.useState(() =>
    Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      dur: Math.random() * 4 + 3,
      delay: Math.random() * 5,
    }))
  );
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {stars.map((s) => (
        <motion.div
          key={s.id}
          style={{
            position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: "50%",
            background: "rgba(255,255,255,0.5)",
            boxShadow: "0 0 4px rgba(255,255,255,0.3)",
          }}
          animate={{ opacity: [0.1, 0.7, 0.1] }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   GOOGLE ICON
───────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.6 39.5 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l.1-.1 6.2 5.2C36.9 40.7 44 35 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/* LivingAICore removed — replaced by <LoginOrb> imported from components/LoginOrb.jsx */

/* ─────────────────────────────────────────────────
   LOGIN PAGE — dark premium, matches Agent UI
───────────────────────────────────────────────── */
export default function Login() {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(null); // 'what' | 'diff' | null
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const taglines = [
    "Talk naturally. No typing.",
    "Practice real conversations.",
    "Think, plan, and grow with AI.",
    "More than a chatbot."
  ];

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % taglines.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
        alert("Login failed: " + error.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="split-container" style={{
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "row",
      overflow: "hidden",
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "linear-gradient(145deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)",
    }}>

      {/* Noise texture */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E")`,
        backgroundSize: "200px",
      }} />

      {/* Moving Ambient Light */}
      <motion.div
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          background: "linear-gradient(270deg, rgba(99,102,241,0.03), rgba(139,92,246,0.03), rgba(56,189,248,0.03), rgba(99,102,241,0.03))",
          backgroundSize: "400% 400%"
        }}
      />

      {/* ── LEFT SIDE: IMMERSIVE VISUAL AREA ── */}
      <div className="left-side" style={{
        flex: "1 1 60%", position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        borderRight: "1px solid rgba(0,0,0,0.03)",
        zIndex: 5,
      }}>
        {/* Faint light focus behind orb */}
        <motion.div
          animate={{ x: mousePos.x * -20, y: mousePos.y * -20 }}
          transition={{ type: "spring", stiffness: 50, damping: 20 }}
          style={{
            position: "absolute", borderRadius: "50%", pointerEvents: "none",
            width: 800, height: 800, top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
        />

        {/* Animated gradient waves behind orb */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", top: "45%", left: "50%", transform: "translate(-50%, -50%)",
            width: 350, height: 350, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)",
            filter: "blur(30px)",
            pointerEvents: "none",
          }}
        />

        {/* LOGIN AI CORE — LoginOrb (login-page exclusive) */}
        <LoginOrb mousePos={mousePos} />

        {/* Elegant Text */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          style={{ textAlign: "center", padding: "0 20px" }}
        >
          <h1 style={{
            fontSize: "2.8rem", fontWeight: 800, margin: "0 0 12px",
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}></h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4 }}
          style={{ textAlign: "center" }}
        >
          <p style={{ fontSize: "1.1rem", color: "#64748b", fontWeight: 500, margin: 0 }}>

          </p>
        </motion.div>
      </div>

      {/* ── RIGHT SIDE: LOGIN AREA ── */}
      <div className="right-side" style={{
        flex: "1 1 40%", position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.2)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%", maxWidth: 380, margin: "0 32px" }}
        >
          <motion.div
            style={{
              position: "relative",
              background: "rgba(255, 255, 255, 0.65)",
              backdropFilter: "blur(40px) saturate(150%)",
              WebkitBackdropFilter: "blur(40px) saturate(150%)",
              border: "1px solid rgba(255, 255, 255, 0.8)",
              borderRadius: 32,
              boxShadow: "0 24px 48px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1), inset 0 0 20px rgba(255,255,255,0.4)",
              padding: "56px 48px",
              display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            }}
          >
            {/* Premium Logo Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: "linear-gradient(135deg, #6366f1, #0ea5e9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 16px rgba(99,102,241,0.25)"
              }}>
                <Sparkles size={22} color="white" />
              </div>
              <h2 style={{
                fontSize: "2.4rem", fontWeight: 800, color: "#0f172a",
                margin: 0, letterSpacing: "-0.03em"
              }}>AIRA</h2>
            </div>

            {/* ── Google button ── */}
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 12px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(99,102,241,0.1)" }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                padding: "16px 24px",
                borderRadius: 16,
                fontSize: "1rem", fontWeight: 600,
                color: "#1e293b",
                background: "#ffffff",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,1)",
                border: "1px solid rgba(226,232,240,0.8)",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.2s ease",
                marginBottom: 32,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <motion.div
                initial={{ x: "-100%" }}
                whileHover={{ x: "200%" }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
                style={{
                  position: "absolute", top: 0, left: 0, width: "50%", height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.06), transparent)",
                  transform: "skewX(-20deg)",
                  pointerEvents: "none",
                }}
              />
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  style={{ width: 18, height: 18, border: "2.5px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%" }}
                />
              ) : <GoogleIcon />}
              {loading ? "Connecting..." : "Continue with Google"}
            </motion.button>

            {/* ── Refined Minimal Links ── */}
            <div style={{ display: "flex", gap: 16, width: "100%", justifyContent: "center", alignItems: "center" }}>
              <motion.button
                whileHover={{ color: "#4f46e5", background: "rgba(99,102,241,0.06)" }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setModalOpen("what")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  fontSize: "0.82rem", fontWeight: 600,
                  color: "#64748b",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                What is AIRA?
              </motion.button>

              <div style={{ width: 1, height: 16, background: "rgba(203,213,225,0.6)" }} />

              <motion.button
                whileHover={{ color: "#4f46e5", background: "rgba(99,102,241,0.06)" }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setModalOpen("diff")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  fontSize: "0.82rem", fontWeight: 600,
                  color: "#64748b",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Why it's different
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <AnimatePresence>
        {modalOpen && <AboutModal onClose={() => setModalOpen(null)} modalType={modalOpen} />}
      </AnimatePresence>

      <style>{`
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }
        @media (max-width: 768px) {
          .split-container { flex-direction: column !important; }
          .left-side { flex: none !important; height: 50vh !important; }
          .right-side { flex: none !important; height: 50vh !important; }
        }
      `}</style>
    </div>
  );
}
