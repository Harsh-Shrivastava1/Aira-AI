import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Sparkles, Shield, Zap, X, Brain, MessageCircle,
  Repeat2, BarChart3, User2, ChevronRight
} from "lucide-react";
import { auth, provider, signInWithPopup } from "../firebase";

// ─── About Modal ────────────────────────────────────────────────
const FEATURES = [
  { icon: <Mic size={15} />, text: "Voice-first interaction — no typing needed" },
  { icon: <Brain size={15} />, text: "Context-aware, adaptive conversations" },
  { icon: <Repeat2 size={15} />, text: "Remembers past interactions" },
  { icon: <MessageCircle size={15} />, text: "Real-life simulations: interviews, negotiations & more" },
  { icon: <BarChart3 size={15} />, text: "Personal growth tracking & AI feedback" },
];

function AboutModal({ onClose }) {
  return (
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(12px)", background: "rgba(238,242,255,0.55)" }}
    >
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.93, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", bounce: 0.28, duration: 0.55 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255,255,255,0.95)",
          borderRadius: "2rem",
          boxShadow: "0 8px 40px rgba(99,102,241,0.14), 0 32px 80px rgba(99,102,241,0.08), 0 0 0 1px rgba(255,255,255,0.6)"
        }}
      >
        {/* Accent blob inside modal */}
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(165,180,252,0.35), transparent 70%)", filter: "blur(24px)" }}
        />
        <div
          className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(186,230,253,0.4), transparent 70%)", filter: "blur(20px)" }}
        />

        <div className="relative p-8">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%)",
                boxShadow: "0 8px 24px rgba(99,102,241,0.3)"
              }}
            >
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">What is AIRA?</h2>
              <p className="text-[11px] text-indigo-500 font-semibold tracking-widest uppercase">
                Advanced Intelligent Responsive Assistant
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 mb-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              AIRA is a <span className="text-indigo-600 font-semibold">voice-first AI assistant</span> designed
              for professionals. It doesn't just perform tasks — it understands you, interacts naturally, and helps
              you grow through real-time conversations and intelligent simulations.
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              Unlike traditional AI agents that only execute commands, AIRA <span className="text-slate-700 font-medium">listens, remembers, adapts,
                and responds like a human.</span>
            </p>
          </div>

          {/* Purpose section */}
          <div
            className="rounded-2xl p-4 mb-5"
            style={{ background: "linear-gradient(135deg, #eef2ff, #e0f2fe)", border: "1px solid rgba(165,180,252,0.3)" }}
          >
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-3">Built to help you</p>
            <ul className="space-y-2 text-sm text-slate-600">
              {[
                "Practice real-world scenarios like interviews and negotiations",
                "Handle daily professional tasks using voice",
                "Improve communication, confidence, and decision-making"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              At the same time, AIRA behaves like a <span className="text-slate-600 font-medium">friendly companion</span> — making
              interactions natural, engaging, and stress-free.
            </p>
          </div>

          {/* Key Features */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Key Features</p>
            <div className="space-y-2">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.07, duration: 0.3 }}
                  className="flex items-center gap-3 group"
                >
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-500"
                    style={{ background: "rgba(99,102,241,0.08)" }}
                  >
                    {f.icon}
                  </div>
                  <span className="text-sm text-slate-600">{f.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
            <User2 size={13} className="text-slate-300" />
            <p className="text-xs text-slate-400">
              Built by <span className="text-indigo-500 font-semibold">Harsh Shrivastava</span>
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Login Page ──────────────────────────────────────────────────
function Particles() {
  const [particles] = React.useState(() =>
    Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 22 + 14,
      delay: Math.random() * 8,
      isIndigo: Math.random() > 0.5
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.isIndigo ? "rgba(99,102,241,0.45)" : "rgba(34,211,238,0.4)",
            boxShadow: `0 0 ${p.size * 4}px ${p.isIndigo ? "rgba(99,102,241,0.4)" : "rgba(34,211,238,0.4)"}`
          }}
          animate={{ y: ["0%", "-130%"], opacity: [0, 0.8, 0] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "linear" }}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (
        error.code !== "auth/popup-closed-by-user" &&
        error.code !== "auth/cancelled-popup-request"
      ) {
        alert("Login failed: " + error.message);
      }
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(145deg, #f8faff 0%, #eef2ff 50%, #dbeafe 100%)" }}
    >
      {/* Background blobs */}
      <motion.div
        className="blob w-[520px] h-[520px] bg-indigo-300 -top-40 -left-40"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="blob w-[420px] h-[420px] bg-cyan-200 -bottom-24 -right-24"
        animate={{ x: [0, -25, 0], y: [0, 20, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="blob w-[280px] h-[280px] bg-violet-200 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      <Particles />

      {/* ── Main card ── */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="glass-elevated px-10 py-12 flex flex-col items-center text-center">

          {/* Floating orb logo */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative mb-8"
          >
            <motion.div
              animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0.5, 0.25] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-indigo-400 blur-xl scale-150"
            />
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #a5b4fc 0%, #6366f1 55%, #4f46e5 100%)",
                boxShadow: "0 20px 60px rgba(99,102,241,0.3), 0 4px 20px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.3)"
              }}
            >
              <Mic size={32} className="text-white" strokeWidth={1.5} />
              {/* gloss */}
              <div
                className="absolute top-3 left-4 w-9 h-5 rounded-full opacity-35"
                style={{ background: "radial-gradient(ellipse, rgba(255,255,255,0.9), transparent)" }}
              />
            </div>
          </motion.div>

          {/* Brand text */}
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-1">AIRA</h1>
          <p className="text-[10px] font-semibold text-indigo-500 tracking-[0.3em] uppercase mb-3">
            Advanced Intelligent Responsive Assistant
          </p>
          <p className="text-sm text-slate-400 font-light leading-relaxed mb-8 max-w-[200px]">
            Your voice-first AI companion for professional growth
          </p>

          {/* ── Google sign-in button ── */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 10px 36px rgba(99,102,241,0.35)" }}
            whileTap={{ scale: 0.97 }}
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-60 mb-3"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              boxShadow: "0 4px 20px rgba(99,102,241,0.28)"
            }}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 48 48" fill="none">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.6 39.5 16.3 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l.1-.1 6.2 5.2C36.9 40.7 44 35 44 24c0-1.2-.1-2.4-.4-3.5z" />
              </svg>
            )}
            {loading ? "Connecting…" : "Continue with Google"}
          </motion.button>

          {/* ── What is AIRA? button ── */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(99,102,241,0.25)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAbout(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-sm font-medium text-indigo-600 transition-all duration-200"
            style={{
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.18)"
            }}
          >
            <Sparkles size={15} className="text-indigo-400" />
            What is AIRA?
          </motion.button>

          {/* Feature pills */}
          <div className="mt-7 flex items-center gap-4 text-slate-400">
            {[
              { icon: <Shield size={12} />, text: "Secure" },
              { icon: <Zap size={12} />, text: "Instant" },
              { icon: <Sparkles size={12} />, text: "AI-powered" }
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] font-medium">
                {f.icon}<span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── About Modal ── */}
      <AnimatePresence>
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      </AnimatePresence>
    </div>
  );
}
