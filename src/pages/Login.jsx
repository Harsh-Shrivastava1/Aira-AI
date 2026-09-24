import React, { useState } from "react";
import LoginOrb from "../components/LoginOrb";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles, X, Brain, MessageCircle, Repeat2, Lightbulb, Zap, User2, Check, ChevronDown } from "lucide-react";
import { auth, provider, signInWithPopup } from "@/config/firebase";
import { useToast } from "../components/Toast";

/* ─────────────────────────────────────────────────
   ABOUT MODAL — light glass, 3 sections
───────────────────────────────────────────────── */
const SECTIONS = [
  {
    id: "how",
    icon: <Mic size={15} />,
    title: "How to use AIRA",
    items: [
      { tag: "Speak Naturally", text: "Zero typing needed — talk freely just like you would to an engineering peer." },
      { tag: "Instant Interruption", text: "Speak up anytime (barge-in); AIRA cuts off immediately and listens." },
      { tag: "Execute Real Actions", text: "Search your Gmail, draft & send emails, inspect code, research the web, or practice mock interviews." },
      { tag: "Interactive VoiceOrb", text: "Tap the dynamic orb anytime to start speaking, pause, or wake AIRA up." },
      { tag: "Toggle Web Search", text: "Enable Web Search mode to let AIRA research live web sources and cite them in responses." },
    ],
  },
  {
    id: "do",
    icon: <Lightbulb size={15} />,
    title: "What you can do with AIRA",
    items: [
      { tag: "Web Research", text: "Toggle Web Search to get real-time answers sourced from the live internet with clickable citations." },
      { tag: "Email Drafting", text: "Say 'Draft an email to…' and AIRA opens a dedicated email composer right inside the chat panel." },
      { tag: "Full Gmail Assistant", text: "Search your inbox, summarize email threads, draft replies, and send — all hands-free." },
      { tag: "File & Code Review", text: "Drop in source code, notes, or PDFs for instant line-by-line debugging and analysis." },
      { tag: "Live Mock Interviews", text: "Practice real-world technical and HR interviews with comprehensive scoring reports." },
      { tag: "Contextual Memory", text: "Remembers your preferences, background, and previous conversation context naturally." },
    ],
  },
];

function SectionBlock({ sec }) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 14,
      }}>
        <div style={{
          color: "#2563eb",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {sec.icon}
        </div>
        <span style={{
          fontSize: "0.74rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#475569",
        }}>
          {sec.title}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 11, paddingLeft: 2 }}>
        {sec.items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{
              width: 4, height: 4, borderRadius: "50%",
              background: "#94a3b8",
              flexShrink: 0,
              transform: "translateY(-2px)",
            }} />
            <div style={{ fontSize: "0.82rem", lineHeight: 1.55, color: "#475569" }}>
              <strong style={{ color: "#0f172a", fontWeight: 600 }}>{item.tag}: </strong>
              <span>{item.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonBlock() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
          Why AIRA Feels Different
        </div>
        <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: 2 }}>
          The contrast between typing into chatbots and talking with AIRA
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 12,
        width: "100%",
      }}>
        {/* Normal AI Column */}
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "14px 15px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#475569" }}>
              Everyday Chatbots
            </span>
            <span style={{ fontSize: "0.64rem", color: "#64748b", fontWeight: 500, background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "2px 7px", borderRadius: 6 }}>
              Text Box
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { tag: "Typing Required", text: "Locked into static chat boxes and endless typing" },
              { tag: "Scripted Filler", text: "Robotic disclaimers and repetitive boilerplate" },
              { tag: "No Barge-in", text: "Cannot interrupt speech or ongoing generation" },
              { tag: "Isolated Box", text: "Zero integration with your actual Gmail or tools" },
              { tag: "Generic Tone", text: "Surface-level answers lacking technical depth" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ color: "#94a3b8", marginTop: 3, flexShrink: 0 }}>
                  <X size={12} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                  <strong style={{ color: "#475569", fontWeight: 600 }}>{item.tag}:</strong> {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AIRA Column */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: "14px 15px",
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#0f172a" }}>
              AIRA Assistant
            </span>
            <span style={{ fontSize: "0.64rem", color: "#2563eb", fontWeight: 600, background: "#eff6ff", border: "1px solid #dbeafe", padding: "2px 7px", borderRadius: 6 }}>
              Voice & Web & Actions
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { tag: "Voice-First", text: "Natural spoken dialogue that feels like an engineering peer" },
              { tag: "Instant Barge-in", text: "Interrupt mid-sentence anytime; AIRA cuts off immediately" },
              { tag: "Web Research", text: "Toggle live web search to get real-time sourced answers with citations" },
              { tag: "Email Composer", text: "Dedicated in-chat email drafting UI with To, Subject, and rich body" },
              { tag: "Gmail Assistant", text: "Search your inbox, summarize threads, draft & send replies" },
              { tag: "Code & Doc Review", text: "Inspect source files and documents with line-by-line feedback" },
              { tag: "Rich Responses", text: "Polished markdown rendering with code blocks, tables, and lists" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ color: "#2563eb", marginTop: 3, flexShrink: 0 }}>
                  <Check size={12} strokeWidth={3} />
                </div>
                <span style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.45 }}>
                  <strong style={{ color: "#0f172a", fontWeight: 600 }}>{item.tag}:</strong> {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Takeaway */}
      <div style={{
        marginTop: 12,
        padding: "11px 14px",
        borderRadius: 8,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#475569", lineHeight: 1.55 }}>
          <strong style={{ color: "#0f172a", fontWeight: 600 }}>The Takeaway: </strong>
          AIRA isn't a text box wrapped in a voice widget — it is a voice-native copilot that researches the web, drafts emails, and acts as a real-world engineering partner.
        </p>
      </div>
    </div>
  );
}

function AgenticComparisonBlock() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
          AI vs Agentic AI
        </div>
        <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: 2 }}>
          Why AIRA goes far beyond standard Q&A chatbots
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 12,
        width: "100%",
      }}>
        {/* Normal AI Column */}
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "14px 15px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#475569" }}>
              Standard AI
            </span>
            <span style={{ fontSize: "0.64rem", color: "#64748b", fontWeight: 500, background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "2px 7px", borderRadius: 6 }}>
              Passive
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { tag: "Passive", text: "Waits for explicit instructions every turn" },
              { tag: "Text-bound", text: "Cannot trigger outside tools or services" },
              { tag: "Isolated", text: "Treats conversations as disconnected turns" },
              { tag: "Stateless", text: "Forgets goals and context between sessions" },
            ].map((item, i) => (
              <div key={"norm" + i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ color: "#94a3b8", marginTop: 3, flexShrink: 0 }}>
                  <X size={12} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                  <strong style={{ color: "#475569", fontWeight: 600 }}>{item.tag}:</strong> {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Agentic AI Column */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: "14px 15px",
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#0f172a" }}>
              AIRA (Agentic)
            </span>
            <span style={{ fontSize: "0.64rem", color: "#2563eb", fontWeight: 600, background: "#eff6ff", border: "1px solid #dbeafe", padding: "2px 7px", borderRadius: 6 }}>
              Action-Ready
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { tag: "Goal-Driven", text: "Plans ahead and takes initiative to solve tasks" },
              { tag: "Real Actions", text: "Searches Gmail, drafts emails, researches the web & analyzes code" },
              { tag: "Voice-Native", text: "Instant speech barge-in & continuous dialogue" },
              { tag: "Web Research", text: "Fetches live web sources and provides cited, verifiable answers" },
              { tag: "Persistent", text: "Retains context, personal preferences & memory" },
            ].map((item, i) => (
              <div key={"agent" + i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ color: "#2563eb", marginTop: 3, flexShrink: 0 }}>
                  <Check size={12} strokeWidth={3} />
                </div>
                <span style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.45 }}>
                  <strong style={{ color: "#0f172a", fontWeight: 600 }}>{item.tag}:</strong> {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Takeaway */}
      <div style={{
        marginTop: 12,
        padding: "11px 14px",
        borderRadius: 8,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#475569", lineHeight: 1.55 }}>
          <strong style={{ color: "#0f172a", fontWeight: 600 }}>The Takeaway: </strong>
          AIRA doesn't just produce text — it listens, researches live web sources, drafts emails, understands your objectives, and executes real workflows alongside you like an engineering partner.
        </p>
      </div>
    </div>
  );
}

function AboutModal({ onClose, modalType }) {
  const isWhat = modalType === "what";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: 620,
          maxHeight: "88vh", overflowY: "auto",
          borderRadius: 20,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 45px -12px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.04)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div style={{ padding: "28px 28px 24px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
                {isWhat ? "What is AIRA?" : "How AIRA is different"}
              </div>
              {isWhat ? (
                <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 3 }}>
                  AIRA • Advanced Intelligent Responsive Assistant
                </div>
              ) : (
                <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 3 }}>
                  Voice-First • Web Research • Email Drafting • Agentic Actions
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: "#f8fafc", border: "1px solid #e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#64748b", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#0f172a"; e.currentTarget.style.background = "#f1f5f9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "#f8fafc"; }}
              aria-label="Close modal"
            ><X size={15} /></button>
          </div>

          {/* Hero Lead Note */}
          {isWhat ? (
            <div style={{
              padding: "13px 16px", borderRadius: 10, marginBottom: 20,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#2563eb", fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <Sparkles size={12} />
                <span>Next-Gen Voice Intelligence</span>
              </div>
              <p style={{ margin: 0, fontSize: "0.83rem", color: "#334155", lineHeight: 1.55 }}>
                AIRA — <strong style={{ color: "#0f172a", fontWeight: 600 }}>Advanced Intelligent Responsive Assistant</strong> — is an agentic voice-first AI designed for spontaneous spoken dialogue, live web research, email drafting, direct action execution, and real-time workflows.
              </p>
            </div>
          ) : (
            <div style={{
              padding: "13px 16px", borderRadius: 10, marginBottom: 20,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#2563eb", fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <Zap size={12} />
                <span>Beyond Standard Chatbots</span>
              </div>
              <p style={{ margin: 0, fontSize: "0.83rem", color: "#334155", lineHeight: 1.55 }}>
                Traditional chatbots wait for typed prompts and output text. AIRA operates as a <strong style={{ color: "#0f172a", fontWeight: 600 }}>proactive spoken companion</strong> with natural barge-in interruption, live web research, in-chat email drafting, active memory, and hands-free tool execution.
              </p>
            </div>
          )}

          {/* Sections Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {isWhat ? (
              <>
                <SectionBlock sec={SECTIONS[1]} />
                <div style={{ height: 1, background: "#f1f5f9" }} />
                <AgenticComparisonBlock />
              </>
            ) : (
              <>
                <SectionBlock sec={SECTIONS[0]} />
                <div style={{ height: 1, background: "#f1f5f9" }} />
                <ComparisonBlock />
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 22, paddingTop: 16,
            borderTop: "1px solid #f1f5f9",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <User2 size={13} color="#94a3b8" />
              <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                Built by{" "}
                <a href="mailto:hshrivastava23032007@gmail.com" style={{ color: "#2563eb", fontWeight: 500, textDecoration: "none" }}>
                  Harsh Shrivastava
                </a>
              </span>
            </div>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 500, letterSpacing: "0.02em" }}>
              AIRA v2.0 • Advanced Intelligent Responsive Assistant
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

  const { showToast } = useToast();

  React.useEffect(() => {
    if (sessionStorage.getItem("aira_just_signed_out")) {
      sessionStorage.removeItem("aira_just_signed_out");
      showToast({
        title: "Signed Out",
        message: "You've been signed out of AIRA.",
        type: "info",
      });
    }
  }, [showToast]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      sessionStorage.setItem("aira_just_logged_in", "true");
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
          style={{ width: "100%", maxWidth: 360, margin: "0 28px" }}
        >
          <motion.div
            style={{
              position: "relative",
              background: "rgba(255, 255, 255, 0.65)",
              backdropFilter: "blur(40px) saturate(150%)",
              WebkitBackdropFilter: "blur(40px) saturate(150%)",
              border: "1px solid rgba(255, 255, 255, 0.8)",
              borderRadius: 28,
              boxShadow: "none",
              padding: "48px 38px 42px",
              display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            }}
          >
            {/* Brand Header */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              textAlign: "center", marginBottom: 32, width: "100%",
            }}>
              <h2 style={{
                fontSize: "2.4rem", fontWeight: 800, color: "#0f172a",
                margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1,
              }}>
                AIRA
              </h2>
              <div style={{
                fontSize: "0.60rem",
                fontWeight: 600,
                color: "#64748b",
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                marginTop: 7,
                lineHeight: 1.4,
                maxWidth: "100%",
              }}>
                ADVANCED INTELLIGENT RESPONSIVE ASSISTANT
              </div>
            </div>

            {/* ── Google button ── */}
            <motion.button
              whileHover={{ scale: 1.015, boxShadow: "0 10px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(99,102,241,0.1)" }}
              whileTap={{ scale: 0.985 }}
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                padding: "15px 22px",
                borderRadius: 14,
                fontSize: "0.98rem", fontWeight: 600,
                color: "#1e293b",
                background: "#ffffff",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,1)",
                border: "1px solid rgba(226,232,240,0.85)",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.2s ease",
                marginBottom: 22,
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
            <div style={{ display: "flex", gap: 12, width: "100%", justifyContent: "center", alignItems: "center" }}>
              <motion.button
                whileHover={{ color: "#0f172a" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setModalOpen("what")}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: "0.80rem", fontWeight: 500,
                  color: "#64748b",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 0.15s ease",
                }}
              >
                What is AIRA?
              </motion.button>

              <div style={{ width: 1, height: 12, background: "rgba(203,213,225,0.7)" }} />

              <motion.button
                whileHover={{ color: "#0f172a" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setModalOpen("diff")}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: "0.80rem", fontWeight: 500,
                  color: "#64748b",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 0.15s ease",
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
