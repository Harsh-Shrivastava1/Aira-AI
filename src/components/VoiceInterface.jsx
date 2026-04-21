import React from "react";
import { Mic, Loader2, Volume2, MicOff } from "lucide-react";

export default function VoiceInterface({ state, toggleListening }) {
  let indicator = null;
  let textLabel = "";
  let ringClass = "";

  if (state === "idle" || state === "stopped") {
    indicator = <MicOff size={48} color="var(--text-muted)" />;
    textLabel = "Paused";
    ringClass = "";
  } else if (state === "listening") {
    indicator = <Mic size={48} color="white" />;
    textLabel = "Listening...";
    ringClass = "ring-listening";
  } else if (state === "thinking") {
    indicator = <div className="spinner-border"><Loader2 size={48} color="var(--primary)" /></div>;
    textLabel = "Thinking...";
    ringClass = "ring-thinking";
  } else if (state === "speaking") {
    indicator = <Volume2 size={48} color="white" />;
    textLabel = "Aira is Speaking...";
    ringClass = "ring-speaking";
  }

  return (
    <div className="flex-center" style={{ flexDirection: "column", gap: "2rem", margin: "4rem 0" }}>
      <div 
        className={`voice-orb flex-center ${ringClass}`}
        onClick={toggleListening}
        style={{
          width: "150px",
          height: "150px",
          borderRadius: "50%",
          background: state === "listening" ? "var(--primary)" : state === "speaking" ? "var(--accent-purple)" : "var(--bg-card)",
          border: "2px solid var(--glass-border)",
          boxShadow: state !== "idle" ? "0 0 30px var(--primary-glow)" : "none",
          cursor: "pointer",
          transition: "all 0.5s ease"
        }}
      >
        {indicator}
      </div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: "300", letterSpacing: "1px" }}>{textLabel}</h2>
      
      <style>{`
        .ring-listening {
          animation: pulseGlow 2s infinite;
        }
        .ring-speaking {
          animation: pulseGlow 1s infinite alternate;
        }
        .spinner-border {
          animation: spin 1.5s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
