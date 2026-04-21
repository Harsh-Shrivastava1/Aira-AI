import React, { useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ORB = 240;
const CV = 200;

/* ── Per-state visual config ── */
const CFGS = {
  idle: {
    border: "rgba(100,120,255,0.18)",
    glow1: "rgba(100,120,255,0.12)", glow2: "rgba(100,120,255,0.06)",
    glowR: [260, 320],
    pulse: { scale: [1, 1.012, 1], dur: 7 },
    ring: "rgba(100,120,255,0.08)",
    waves: [
      { c: ["#5b7cfa99", "#7ec8ff88"], amp: 6, freq: 1.6, spd: 0.25, tk: 5 },
      { c: ["#7ec8ff88", "#a78bfa66"], amp: 4, freq: 2.3, spd: 0.15, tk: 3 },
    ],
  },
  listening: {
    border: "rgba(56,189,248,0.4)",
    glow1: "rgba(56,189,248,0.28)", glow2: "rgba(56,189,248,0.12)",
    glowR: [270, 340],
    pulse: { scale: [1, 1.055, 1], dur: 2 },
    ring: "rgba(56,189,248,0.2)",
    waves: [
      { c: ["#38bdf8cc", "#6366f1aa"], amp: 24, freq: 2.0, spd: 1.8, tk: 13 },
      { c: ["#6366f1aa", "#38bdf888"], amp: 17, freq: 2.8, spd: 1.4, tk: 9 },
      { c: ["#818cf844", "#38bdf866"], amp: 10, freq: 3.5, spd: 1.1, tk: 5 },
    ],
  },
  thinking: {
    border: "rgba(168,85,247,0.35)",
    glow1: "rgba(168,85,247,0.22)", glow2: "rgba(168,85,247,0.08)",
    glowR: [265, 330],
    pulse: { scale: [1, 1.025, 1], dur: 4 },
    ring: "rgba(168,85,247,0.15)",
    waves: [
      { c: ["#a855f7aa", "#c084fcaa"], amp: 14, freq: 1.4, spd: 0.7, tk: 10 },
      { c: ["#818cf8aa", "#a855f777"], amp: 10, freq: 2.2, spd: 0.5, tk: 7 },
    ],
  },
  speaking: {
    border: "rgba(99,102,241,0.5)",
    glow1: "rgba(99,102,241,0.38)", glow2: "rgba(99,102,241,0.14)",
    glowR: [280, 360],
    pulse: { scale: [1, 1.07, 0.98, 1.04, 1], dur: 1.0 },
    ring: "rgba(99,102,241,0.25)",
    waves: [
      { c: ["#6366f1cc", "#38bdf8bb"], amp: 34, freq: 2.2, spd: 3.0, tk: 15 },
      { c: ["#38bdf8cc", "#a855f7aa"], amp: 26, freq: 1.7, spd: 2.4, tk: 11 },
      { c: ["#a855f7aa", "#6366f166"], amp: 18, freq: 3.2, spd: 2.8, tk: 8 },
    ],
  },
};

/* ── Canvas waveform renderer ── */
function PlasmaCanvas({ cfgRef }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const tRef = useRef(0);
  const ampRef = useRef(CFGS.idle.waves.map((w) => w.amp));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CV * dpr;
    canvas.height = CV * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const S = CV;

    function frame() {
      tRef.current += 1;
      const t = tRef.current;
      const cfg = cfgRef.current;
      const wvs = cfg.waves;

      ampRef.current = ampRef.current.map((a, i) => {
        const tgt = wvs[i]?.amp ?? 0;
        return a + (tgt - a) * 0.05;
      });
      while (ampRef.current.length < wvs.length) ampRef.current.push(0);

      ctx.clearRect(0, 0, S, S);
      ctx.save();
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      ctx.clip();

      /* deep background gradient */
      const bg = ctx.createRadialGradient(S / 2, S * 0.4, 0, S / 2, S / 2, S / 2);
      bg.addColorStop(0, "#ffffff");
      bg.addColorStop(0.5, "#eef2ff");
      bg.addColorStop(1, "#d4dcff");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      /* subtle aurora sweep behind waves */
      const auroraT = t * 0.008;
      const aX = S / 2 + Math.sin(auroraT) * S * 0.25;
      const aY = S / 2 + Math.cos(auroraT * 0.7) * S * 0.15;
      const aurora = ctx.createRadialGradient(aX, aY, 0, aX, aY, S * 0.5);
      aurora.addColorStop(0, "rgba(99,102,241,0.08)");
      aurora.addColorStop(0.5, "rgba(56,189,248,0.04)");
      aurora.addColorStop(1, "transparent");
      ctx.fillStyle = aurora;
      ctx.fillRect(0, 0, S, S);

      /* wave ribbons */
      wvs.forEach((wave, wi) => {
        const ph = (wi / wvs.length) * Math.PI * 1.5;
        const spread = wvs.length > 2 ? 0.65 : 0.85;
        const yBase = S / 2 + (wi - (wvs.length - 1) / 2) * (wave.amp * spread);
        const amp = ampRef.current[wi] ?? wave.amp;
        const pts = [];

        for (let xi = 0; xi <= S; xi += 2) {
          const nx = xi / S;
          const a1 = nx * Math.PI * 2 * wave.freq + t * wave.spd * 0.05 + ph;
          const a2 = nx * Math.PI * 2 * (wave.freq * 1.6) - t * wave.spd * 0.035 + ph * 0.8;
          const a3 = nx * Math.PI * 2 * (wave.freq * 0.45) + t * wave.spd * 0.018 + ph * 1.4;
          const y = yBase + Math.sin(a1) * amp + Math.sin(a2) * amp * 0.3 + Math.sin(a3) * amp * 0.15;
          const taper = 0.45 + 0.55 * Math.sin(nx * Math.PI);
          pts.push({ x: xi, yt: y - wave.tk * taper, yb: y + wave.tk * taper, yc: y });
        }

        /* filled ribbon with glow */
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.yt) : ctx.lineTo(p.x, p.yt));
        [...pts].reverse().forEach((p) => ctx.lineTo(p.x, p.yb));
        ctx.closePath();

        const gr = ctx.createLinearGradient(0, 0, S, 0);
        gr.addColorStop(0, "transparent");
        gr.addColorStop(0.15, wave.c[0]);
        gr.addColorStop(0.5, wave.c[1] ?? wave.c[0]);
        gr.addColorStop(0.85, wave.c[0]);
        gr.addColorStop(1, "transparent");
        ctx.shadowBlur = 22;
        ctx.shadowColor = wave.c[0].slice(0, 7) + "aa";
        ctx.fillStyle = gr;
        ctx.fill();

        /* bright center stroke */
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.yc) : ctx.lineTo(p.x, p.yc));
        const sg = ctx.createLinearGradient(0, 0, S, 0);
        sg.addColorStop(0, "transparent");
        sg.addColorStop(0.2, wave.c[0].slice(0, 7) + "ee");
        sg.addColorStop(0.5, "#ffffffcc");
        sg.addColorStop(0.8, wave.c[0].slice(0, 7) + "ee");
        sg.addColorStop(1, "transparent");
        ctx.strokeStyle = sg;
        ctx.lineWidth = 1.6;
        ctx.shadowBlur = 12;
        ctx.shadowColor = wave.c[0].slice(0, 7) + "cc";
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      /* inner vignette */
      const vgn = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
      vgn.addColorStop(0, "rgba(255,255,255,0)");
      vgn.addColorStop(0.65, "rgba(255,255,255,0)");
      vgn.addColorStop(1, "rgba(100,120,255,0.25)");
      ctx.fillStyle = vgn;
      ctx.fillRect(0, 0, S, S);

      ctx.restore();
      rafRef.current = requestAnimationFrame(frame);
    }

    frame();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      width={CV}
      height={CV}
      style={{ borderRadius: "50%", display: "block", width: CV, height: CV }}
    />
  );
}

/* ── Orbital particles ── */
function OrbitalParticles({ state }) {
  const particles = useMemo(() =>
    Array.from({ length: 10 }).map((_, i) => ({
      id: i,
      angle: (i / 10) * Math.PI * 2,
      radius: ORB / 2 + 18 + (i % 3) * 14,
      size: 2 + (i % 3),
      dur: 8 + i * 1.5,
      delay: i * 0.4,
    })), []
  );

  const isActive = state !== "idle";

  return particles.map((p) => (
    <motion.div
      key={p.id}
      style={{
        position: "absolute", borderRadius: "50%", pointerEvents: "none",
        width: p.size, height: p.size,
        background: state === "thinking" ? "#a855f7" : state === "listening" ? "#38bdf8" : "#6366f1",
        filter: `blur(${p.size > 3 ? 1 : 0}px)`,
      }}
      animate={{
        x: [Math.cos(p.angle) * p.radius, Math.cos(p.angle + Math.PI) * p.radius, Math.cos(p.angle + Math.PI * 2) * p.radius],
        y: [Math.sin(p.angle) * p.radius, Math.sin(p.angle + Math.PI) * p.radius, Math.sin(p.angle + Math.PI * 2) * p.radius],
        opacity: isActive ? [0.15, 0.55, 0.15] : [0.05, 0.2, 0.05],
        scale: isActive ? [1, 1.5, 1] : [1, 1.2, 1],
      }}
      transition={{ duration: p.dur, repeat: Infinity, ease: "linear", delay: p.delay }}
    />
  ));
}

/* ── Main orb component ── */
export default function VoiceOrb({ state, toggleListening, thinkingMessage }) {
  const cfg = CFGS[state] ?? CFGS.idle;
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = CFGS[state] ?? CFGS.idle; }, [state]);

  const stateLabel = state === "listening" ? "Listening..." :
    state === "thinking" ? (thinkingMessage || "Thinking...") :
    state === "speaking" ? "Speaking..." : "AIRA IS READY";

  const labelColor = state === "idle" ? "#94a3b8" :
    state === "thinking" ? "#a855f7" :
    state === "listening" ? "#38bdf8" : "#6366f1";

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
      userSelect: "none", isolation: "isolate",
      willChange: "transform", transform: "translateZ(0)",
    }}>

      {/* ── Glow + orb container ── */}
      <div style={{
        position: "relative", width: ORB + 100, height: ORB + 100,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>

        {/* deep ambient glow */}
        <motion.div
          style={{
            position: "absolute", borderRadius: "50%", pointerEvents: "none",
            width: cfg.glowR[1], height: cfg.glowR[1],
            background: `radial-gradient(circle, ${cfg.glow2} 0%, transparent 65%)`,
            filter: "blur(30px)",
            willChange: "transform, opacity", transform: "translateZ(0)",
          }}
          animate={{ scale: cfg.pulse.scale, opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: cfg.pulse.dur * 1.2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* inner glow halo */}
        <motion.div
          style={{
            position: "absolute", borderRadius: "50%", pointerEvents: "none",
            width: cfg.glowR[0], height: cfg.glowR[0],
            background: `radial-gradient(circle, ${cfg.glow1} 0%, transparent 58%)`,
            filter: "blur(14px)",
            willChange: "transform, opacity", transform: "translateZ(0)",
          }}
          animate={{ scale: cfg.pulse.scale, opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: cfg.pulse.dur * 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
        />

        {/* rotating gradient rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={`ring-${i}`}
            style={{
              position: "absolute", borderRadius: "50%", pointerEvents: "none",
              width: ORB + 20 + i * 22, height: ORB + 20 + i * 22,
              border: `${1.5 - i * 0.3}px solid transparent`,
              background: `linear-gradient(${i * 120}deg, ${cfg.ring}, transparent 40%, ${cfg.ring}) border-box`,
              WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "destination-out",
              maskComposite: "exclude",
              opacity: 0.4 - i * 0.1,
            }}
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 15 + i * 8, repeat: Infinity, ease: "linear" }}
          />
        ))}

        {/* orbital particles */}
        <OrbitalParticles state={state} />

        {/* speaking ripple rings */}
        <AnimatePresence>
          {state === "speaking" && [0, 1, 2].map((i) => (
            <motion.div
              key={`sr-${i}`}
              style={{
                position: "absolute", borderRadius: "50%", pointerEvents: "none",
                width: ORB, height: ORB,
                border: `1.5px solid ${cfg.glow1}`,
              }}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.6 + i * 0.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
            />
          ))}
        </AnimatePresence>

        {/* listening breath ring */}
        <AnimatePresence>
          {state === "listening" && (
            <motion.div
              key="breath"
              style={{
                position: "absolute", borderRadius: "50%", pointerEvents: "none",
                width: ORB, height: ORB,
                border: `2px solid rgba(56,189,248,0.35)`,
                boxShadow: "0 0 20px rgba(56,189,248,0.15)",
              }}
              animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0.05, 0.7] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        {/* thinking orbit */}
        <AnimatePresence>
          {state === "thinking" && (
            <>
              <motion.div
                key="think-ring"
                style={{
                  position: "absolute", borderRadius: "50%", pointerEvents: "none",
                  width: ORB + 30, height: ORB + 30,
                  border: "1.5px dashed rgba(168,85,247,0.2)",
                }}
                animate={{ rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              {/* thinking dot orbiter */}
              <motion.div
                key="think-dot"
                style={{
                  position: "absolute", width: 6, height: 6, borderRadius: "50%",
                  background: "#a855f7", boxShadow: "0 0 10px #a855f7",
                  pointerEvents: "none",
                }}
                animate={{
                  x: [0, (ORB/2+15), 0, -(ORB/2+15), 0],
                  y: [-(ORB/2+15), 0, (ORB/2+15), 0, -(ORB/2+15)],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            </>
          )}
        </AnimatePresence>

        {/* ── GLASS ORB BUTTON ── */}
        <motion.button
          onClick={toggleListening}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.93 }}
          animate={{ scale: cfg.pulse.scale }}
          transition={{ scale: { duration: cfg.pulse.dur, repeat: Infinity, ease: "easeInOut" } }}
          style={{
            position: "relative",
            width: ORB, height: ORB,
            borderRadius: "50%",
            cursor: "pointer",
            border: "none", outline: "none", overflow: "hidden",
            willChange: "transform", transform: "translateZ(0)",
            background: "radial-gradient(circle at 35% 30%, #ffffff 0%, #eef2ff 40%, #d4dcff 80%, #c7d2fe 100%)",
            boxShadow: [
              `0 12px 50px rgba(99,102,241,0.22)`,
              `0 0 100px rgba(99,102,241,0.1)`,
              `0 0 0 1.5px ${cfg.border}`,
              "inset 0 0 40px rgba(99,102,241,0.15)",
              "inset 0 2px 0 rgba(255,255,255,0.9)",
              "inset 0 -8px 24px rgba(99,102,241,0.12)",
            ].join(", "),
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {/* canvas waveform */}
          <PlasmaCanvas cfgRef={cfgRef} />

          {/* top-left glass highlight (crescent) */}
          <div style={{
            position: "absolute", pointerEvents: "none",
            top: "6%", left: "10%",
            width: "50%", height: "28%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse at 40% 50%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 40%, transparent 75%)",
            filter: "blur(4px)",
            opacity: 0.85,
          }} />

          {/* secondary highlight — right edge */}
          <div style={{
            position: "absolute", pointerEvents: "none",
            top: "20%", right: "8%",
            width: "18%", height: "25%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.5) 0%, transparent 80%)",
            filter: "blur(5px)",
            opacity: 0.5,
          }} />

          {/* bottom depth shadow */}
          <div style={{
            position: "absolute", pointerEvents: "none",
            bottom: 0, left: "8%", right: "8%", height: "35%",
            background: "radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.2) 0%, transparent 65%)",
            borderRadius: "0 0 50% 50%",
          }} />

          {/* inner rim */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow: "inset 0 0 8px rgba(255,255,255,0.3)",
          }} />

          {/* outer rim accent */}
          <div style={{
            position: "absolute", inset: -1, borderRadius: "50%", pointerEvents: "none",
            border: `1px solid ${cfg.border}`,
          }} />
        </motion.button>
      </div>

      {/* ── State label ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state + (state === "thinking" ? thinkingMessage : "")}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: "0.7rem", fontWeight: 700,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: labelColor,
          }}
        >
          {state !== "idle" && (
            <motion.span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: labelColor,
                display: "inline-block",
              }}
              animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {stateLabel}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
