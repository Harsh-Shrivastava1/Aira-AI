import React from "react";
import { motion } from "framer-motion";
import { X, TrendingUp, MessageCircle, Award } from "lucide-react";

export default function MinimalEvaluationOverlay({ evaluation, onClose }) {
  if (!evaluation) return null;

  const confidence = evaluation.confidenceScore ?? 0;
  const communication = evaluation.communicationScore ?? 0;
  const avg = Math.round((confidence + communication) / 2);

  /* Score → color mapping */
  const scoreColor = (v) =>
    v >= 80 ? "#34d399" : v >= 60 ? "#fbbf24" : "#f87171";

  /* Score → label */
  const scoreLabel = (v) =>
    v >= 85 ? "Excellent" : v >= 70 ? "Good" : v >= 50 ? "Fair" : "Needs work";

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        overflowY: "auto",
        padding: 24,
        gap: 20,
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "rgba(100,140,255,0.1)",
              border: "1px solid rgba(100,140,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={15} color="#6a8cff" />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1a1a1a" }}>Session Report</div>
            <div style={{ fontSize: "0.6rem", color: "#6b7280", letterSpacing: "0.1em" }}>PERFORMANCE ANALYSIS</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#6b7280",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.03)"; e.currentTarget.style.color = "#6b7280"; }}
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Overall average ring ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 0",
          borderRadius: 16,
          background: "rgba(0,0,0,0.02)",
          border: "1px solid rgba(0,0,0,0.04)",
          gap: 6,
        }}
      >
        <Award size={16} color={scoreColor(avg)} style={{ marginBottom: 4 }} />
        <div style={{ fontSize: "2.5rem", fontWeight: 800, color: scoreColor(avg), lineHeight: 1 }}>
          {avg}
        </div>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.15em", color: "#6b7280", textTransform: "uppercase" }}>
          Overall Score
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: "0.7rem",
            fontWeight: 600,
            color: scoreColor(avg),
            background: `${scoreColor(avg)}18`,
            padding: "3px 10px",
            borderRadius: 99,
            border: `1px solid ${scoreColor(avg)}30`,
          }}
        >
          {scoreLabel(avg)}
        </div>
      </div>

      {/* ── Individual scores ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { label: "Confidence", value: confidence, icon: "💪" },
          { label: "Communication", value: communication, icon: "🗣️" },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(0,0,0,0.02)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.9rem" }}>{icon}</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#4b5563" }}>{label}</span>
              </div>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: scoreColor(value) }}>{value}</span>
            </div>
            {/* Progress bar */}
            <div
              style={{
                height: 5,
                borderRadius: 99,
                background: "rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                style={{
                  height: "100%",
                  borderRadius: 99,
                  background: `linear-gradient(to right, ${scoreColor(value)}99, ${scoreColor(value)})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Improvement notes ── */}
      {evaluation.improvementNotes && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(100,140,255,0.05)",
            border: "1px solid rgba(100,140,255,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <MessageCircle size={13} color="#6a8cff" />
            <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", color: "#6a8cff", textTransform: "uppercase" }}>
              AI Feedback
            </span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
            {evaluation.improvementNotes}
          </p>
        </div>
      )}

      {/* ── Footer note ── */}
      <p style={{ fontSize: "0.6rem", color: "#9ca3af", textAlign: "center", marginTop: "auto" }}>
        Say <span style={{ color: "#6a8cff" }}>"show my score"</span> anytime to reopen
      </p>
    </div>
  );
}
