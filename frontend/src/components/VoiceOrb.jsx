import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const STATES = {
  idle: {
    label: "Tap to speak",
    sublabel: "AIRA is ready",
    gradient: "linear-gradient(135deg, #c7d2fe 0%, #818cf8 55%, #6366f1 100%)",
    glowColor: "rgba(99, 102, 241, 0.22)",
    glowLarge: "rgba(99, 102, 241, 0.09)",
    ringColor: "rgba(99, 102, 241, 0.15)",
  },
  listening: {
    label: "Listening…",
    sublabel: "Speak now",
    gradient: "linear-gradient(135deg, #a5f3fc 0%, #22d3ee 55%, #0891b2 100%)",
    glowColor: "rgba(6, 182, 212, 0.35)",
    glowLarge: "rgba(6, 182, 212, 0.12)",
    ringColor: "rgba(6, 182, 212, 0.2)",
  },
  thinking: {
    label: "Thinking…",
    sublabel: "Just a sec",
    gradient: "linear-gradient(135deg, #ddd6fe 0%, #a78bfa 55%, #7c3aed 100%)",
    glowColor: "rgba(139, 92, 246, 0.32)",
    glowLarge: "rgba(139, 92, 246, 0.1)",
    ringColor: "rgba(139, 92, 246, 0.2)",
  },
  speaking: {
    label: "Speaking…",
    sublabel: "AIRA is responding",
    gradient: "linear-gradient(135deg, #a5b4fc 0%, #6366f1 55%, #4338ca 100%)",
    glowColor: "rgba(99, 102, 241, 0.45)",
    glowLarge: "rgba(99, 102, 241, 0.15)",
    ringColor: "rgba(99, 102, 241, 0.22)",
  }
};

export default function VoiceOrb({ state, toggleListening }) {
  const cfg = STATES[state] || STATES.idle;

  return (
    <div className="flex flex-col items-center gap-7 select-none">

      {/* ── Floating + glow pulse container ── */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >

        {/* ── Large ambient glow (outer) ── */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 240, height: 240, background: `radial-gradient(circle, ${cfg.glowLarge}, transparent 70%)` }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* ── Medium glow ── */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 170, height: 170, background: `radial-gradient(circle, ${cfg.glowColor}, transparent 65%)`, filter: "blur(14px)" }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />

        {/* ── Speaking rings ── */}
        <AnimatePresence>
          {state === "speaking" && [0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{ border: `1.5px solid ${cfg.ringColor}` }}
              initial={{ width: 144, height: 144, opacity: 0.8 }}
              animate={{ width: 144 + (i + 1) * 60, height: 144 + (i + 1) * 60, opacity: 0 }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.65, ease: "easeOut" }}
            />
          ))}
        </AnimatePresence>

        {/* ── Listening ring ── */}
        <AnimatePresence>
          {state === "listening" && (
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{ border: `2px solid ${cfg.ringColor}` }}
              animate={{ width: [144, 196, 144], height: [144, 196, 144], opacity: [0.9, 0.2, 0.9] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        {/* ── Main orb button ── */}
        <motion.button
          onClick={toggleListening}
          animate={{ background: cfg.gradient }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.91 }}
          className="relative w-36 h-36 rounded-full cursor-pointer z-10 focus:outline-none overflow-hidden"
          style={{
            boxShadow: `0 20px 60px ${cfg.glowColor}, 0 6px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.45)`
          }}
        >
          {/* Gloss inside orb */}
          <div
            className="absolute top-3 left-4 w-12 h-6 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, transparent 80%)", opacity: 0.5 }}
          />

          {/* Thinking spinner */}
          {state === "thinking" && (
            <motion.div
              className="absolute inset-2 rounded-full border-2 border-transparent pointer-events-none"
              style={{ borderTopColor: "rgba(255,255,255,0.75)", borderRightColor: "rgba(255,255,255,0.3)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            />
          )}

          {/* Center dot / waveform */}
          <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
            {state === "speaking"
              ? [0, 1, 2, 3, 4].map(i => (
                  <motion.div
                    key={i}
                    className="w-[3px] rounded-full bg-white/70"
                    animate={{ height: [6, 18 + i * 4, 6] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                  />
                ))
              : <motion.div
                  className="rounded-full bg-white/60"
                  animate={{ width: state === "listening" ? [8, 13, 8] : 8, height: state === "listening" ? [8, 13, 8] : 8 }}
                  transition={{ duration: 0.7, repeat: state === "listening" ? Infinity : 0, ease: "easeInOut" }}
                />
            }
          </div>
        </motion.button>
      </motion.div>

      {/* ── Label ── */}
      <div className="flex flex-col items-center gap-1">
        <motion.p
          key={state + "_l"}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-sm font-semibold text-slate-700 tracking-wide"
        >
          {cfg.label}
        </motion.p>
        <motion.p
          key={state + "_s"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-[11px] text-slate-400 font-light tracking-wide"
        >
          {cfg.sublabel}
        </motion.p>
      </div>
    </div>
  );
}
