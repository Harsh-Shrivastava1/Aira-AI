import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

/* ─────────────────────────────────────────────────
   LOGIN ORB — Premium futuristic AI core
   For LOGIN PAGE ONLY. Do NOT use on dashboard.
───────────────────────────────────────────────── */

/* Plasma canvas — soft idle waves in light-mode palette */
function PlasmaCanvas({ size }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const S = size;

    const WAVES = [
      { colors: ["rgba(99,102,241,0.55)", "rgba(139,92,246,0.45)"], amp: 10, freq: 1.6, spd: 0.22, thick: 8 },
      { colors: ["rgba(56,189,248,0.45)", "rgba(99,102,241,0.35)"], amp: 7,  freq: 2.4, spd: 0.16, thick: 6 },
      { colors: ["rgba(168,85,247,0.38)", "rgba(56,189,248,0.28)"], amp: 5,  freq: 3.1, spd: 0.28, thick: 5 },
    ];

    function frame() {
      tRef.current += 1;
      const t = tRef.current;
      ctx.clearRect(0, 0, S, S);

      /* Soft light-mode inner background */
      ctx.save();
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      ctx.clip();

      const bg = ctx.createRadialGradient(S * 0.35, S * 0.28, 0, S / 2, S / 2, S / 2);
      bg.addColorStop(0, "rgba(230,238,255,0.92)");
      bg.addColorStop(0.45, "rgba(210,220,255,0.75)");
      bg.addColorStop(0.8, "rgba(196,210,255,0.60)");
      bg.addColorStop(1, "rgba(180,200,255,0.50)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      /* Wave ribbons */
      WAVES.forEach((wave, wi) => {
        const phase = (wi / WAVES.length) * Math.PI * 1.8;
        const yBase = S / 2 + (wi - (WAVES.length - 1) / 2) * (wave.amp * 1.1);
        const pts = [];

        for (let xi = 0; xi <= S; xi += 2) {
          const a1 = (xi / S) * Math.PI * 2 * wave.freq + t * wave.spd * 0.05 + phase;
          const a2 = (xi / S) * Math.PI * 2 * (wave.freq * 1.7) - t * wave.spd * 0.03 + phase * 0.7;
          const a3 = (xi / S) * Math.PI * 2 * (wave.freq * 0.45) + t * wave.spd * 0.018 + phase * 1.4;
          const y = yBase + Math.sin(a1) * wave.amp + Math.sin(a2) * wave.amp * 0.3 + Math.sin(a3) * wave.amp * 0.14;
          const taper = 0.5 + 0.5 * Math.sin((xi / S) * Math.PI);
          pts.push({ x: xi, yt: y - wave.thick * taper, yb: y + wave.thick * taper, yc: y });
        }

        /* Filled ribbon */
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.yt) : ctx.lineTo(p.x, p.yt));
        [...pts].reverse().forEach((p) => ctx.lineTo(p.x, p.yb));
        ctx.closePath();

        const gr = ctx.createLinearGradient(0, 0, S, 0);
        gr.addColorStop(0, wave.colors[0]);
        gr.addColorStop(0.5, wave.colors[1]);
        gr.addColorStop(1, wave.colors[0]);
        ctx.shadowBlur = 12;
        ctx.shadowColor = wave.colors[0].replace(/[\d.]+\)$/, "0.5)");
        ctx.fillStyle = gr;
        ctx.fill();

        /* Bright center line */
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.yc) : ctx.lineTo(p.x, p.yc));
        ctx.strokeStyle = wave.colors[0].replace(/[\d.]+\)$/, "0.85)");
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = wave.colors[0].replace(/[\d.]+\)$/, "0.6)");
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      /* Inner vignette overlay — soft white edge */
      const vgn = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
      vgn.addColorStop(0, "rgba(255,255,255,0.0)");
      vgn.addColorStop(0.75, "rgba(255,255,255,0.0)");
      vgn.addColorStop(1, "rgba(220,230,255,0.25)");
      ctx.fillStyle = vgn;
      ctx.fillRect(0, 0, S, S);

      ctx.restore();
      rafRef.current = requestAnimationFrame(frame);
    }

    frame();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: "50%", display: "block" }}
    />
  );
}

/* Rotating energy ring — thin stroke with gradient */
function EnergyRing({ size, duration, reverse, color, opacity, inset }) {
  return (
    <motion.div
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
      style={{
        position: "absolute",
        top: inset, left: inset, right: inset, bottom: inset,
        borderRadius: "50%",
        border: `1px solid ${color}`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}

/* Orbiting dot node */
function OrbitNode({ size, duration, delay, color, orbitRadius }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear", delay }}
      style={{
        position: "absolute",
        top: "50%", left: "50%",
        width: orbitRadius * 2,
        height: orbitRadius * 2,
        marginTop: -orbitRadius,
        marginLeft: -orbitRadius,
        borderRadius: "50%",
        pointerEvents: "none",
      }}
    >
      <div style={{
        position: "absolute",
        top: 0, left: "50%",
        marginLeft: -size / 2,
        marginTop: -size / 2,
        width: size, height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 ${size * 3}px ${color}`,
      }} />
    </motion.div>
  );
}

/* Main login orb — exported exclusively for Login.jsx */
export default function LoginOrb({ mousePos = { x: 0, y: 0 } }) {
  const ORB = 312; // ~20% larger than original 260px
  const CANVAS = 172;

  /* Subtle idle breathing for scale */
  const breatheScale = [1, 1.025, 1];
  const breatheDur = 5.5;

  return (
    <motion.div
      animate={{ x: mousePos.x * 12, y: mousePos.y * 12 }}
      transition={{ type: "spring", stiffness: 60, damping: 18 }}
      style={{
        position: "relative",
        width: ORB,
        height: ORB,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >

      {/* ── LAYER 1: OUTER AMBIENT GLOW ── */}
      <motion.div
        animate={{ scale: breatheScale, opacity: [0.45, 0.65, 0.45] }}
        transition={{ duration: breatheDur * 1.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          width: ORB + 90,
          height: ORB + 90,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.10) 35%, rgba(56,189,248,0.05) 60%, transparent 75%)",
          filter: "blur(28px)",
          pointerEvents: "none",
        }}
      />

      {/* ── LAYER 1b: SECONDARY TIGHTER GLOW ── */}
      <motion.div
        animate={{ scale: breatheScale, opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: breatheDur * 0.85, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        style={{
          position: "absolute",
          width: ORB + 40,
          height: ORB + 40,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, rgba(56,189,248,0.08) 50%, transparent 70%)",
          filter: "blur(18px)",
          pointerEvents: "none",
        }}
      />

      {/* ── LAYER 2: ROTATING ENERGY RINGS ── */}
      {/* Outermost dashed ring — slowest */}
      <EnergyRing
        size={ORB}
        duration={32}
        reverse={false}
        color="rgba(99,102,241,0.18)"
        opacity={0.7}
        inset={-22}
      />
      {/* Mid ring — counter-rotating */}
      <EnergyRing
        size={ORB}
        duration={22}
        reverse={true}
        color="rgba(139,92,246,0.22)"
        opacity={0.6}
        inset={-10}
      />
      {/* Inner ring — fastest */}
      <EnergyRing
        size={ORB}
        duration={16}
        reverse={false}
        color="rgba(56,189,248,0.20)"
        opacity={0.55}
        inset={0}
      />

      {/* Subtle dashed decorative ring */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
        style={{
          position: "absolute",
          inset: -16,
          borderRadius: "50%",
          border: "1px dashed rgba(168,85,247,0.15)",
          pointerEvents: "none",
        }}
      />

      {/* ── Orbiting nodes (micro-planets) ── */}
      <OrbitNode size={5} duration={14} delay={0}    color="rgba(99,102,241,0.8)"  orbitRadius={ORB / 2 + 12} />
      <OrbitNode size={4} duration={19} delay={2.5}  color="rgba(56,189,248,0.75)" orbitRadius={ORB / 2 + 18} />
      <OrbitNode size={3} duration={25} delay={6}    color="rgba(168,85,247,0.65)" orbitRadius={ORB / 2 + 22} />

      {/* ── LAYER 3: CORE GLASS SPHERE ── */}
      <motion.div
        animate={{ scale: breatheScale }}
        transition={{ duration: breatheDur, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "relative",
          width: ORB,
          height: ORB,
          borderRadius: "50%",
          overflow: "hidden",
          /* Glassmorphism sphere */
          background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.88) 0%, rgba(220,232,255,0.70) 22%, rgba(196,210,255,0.52) 50%, rgba(167,139,250,0.35) 80%, rgba(139,92,246,0.25) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.75)",
          boxShadow: [
            "0 16px 48px rgba(99,102,241,0.14)",
            "0 4px 20px rgba(56,189,248,0.10)",
            "inset 0 12px 28px rgba(255,255,255,0.85)",
            "inset 0 -14px 24px rgba(139,92,246,0.12)",
            "inset 0 0 0 1px rgba(255,255,255,0.5)",
          ].join(", "),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >

        {/* ── LAYER 4: INNER ENERGY PLASMA ── */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden" }}>
          <PlasmaCanvas size={ORB} />
        </div>

        {/* Soft color wash overlay (breathing) */}
        <motion.div
          animate={{ opacity: [0.18, 0.30, 0.18] }}
          transition={{ duration: breatheDur * 0.9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(circle at 45% 50%, rgba(99,102,241,0.22) 0%, rgba(56,189,248,0.12) 50%, transparent 75%)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />

        {/* ── TOP-LEFT GLASS REFLECTION HIGHLIGHT ── */}
        <div style={{
          position: "absolute",
          top: "6%", left: "11%",
          width: "42%", height: "28%",
          borderRadius: "50%",
          background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.0) 100%)",
          transform: "rotate(-22deg)",
          zIndex: 5,
          pointerEvents: "none",
        }} />

        {/* ── SMALL SECONDARY SPECULAR DOT ── */}
        <div style={{
          position: "absolute",
          top: "62%", right: "14%",
          width: "10%", height: "10%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.7) 0%, transparent 80%)",
          filter: "blur(2px)",
          zIndex: 5,
          pointerEvents: "none",
        }} />

        {/* ── INNER RIM LIGHT ── */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.45)",
          pointerEvents: "none",
          zIndex: 6,
        }} />
      </motion.div>

      {/* CSS keyframes for any click ripple */}
      <style>{`
        @keyframes loginOrbRipple {
          0%   { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.7); opacity: 0; }
        }
      `}</style>
    </motion.div>
  );
}
