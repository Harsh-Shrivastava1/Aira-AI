import React, { useRef, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─────────────────────────────────────────────────
   AIRA LOGIN ORB — Living AI Core
   Visually dynamic, fluid, luminous, and interactive.
   Preserves the signature AIRA light-mode glass sphere
   aesthetic while delivering smooth, alive, organic motion.
───────────────────────────────────────────────── */

/* ── Fluid Plasma Canvas — Vibrant organic wave ribbons ── */
function PlasmaCanvas({ size, isHovered = false }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const tRef = useRef(0);
  const hoverFactorRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const S = size;

    /* High-DPI support */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = S * dpr;
    canvas.height = S * dpr;
    ctx.scale(dpr, dpr);

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* 3 Layered Harmonic Waves with rich glowing gradients */
    const WAVES = [
      {
        // Primary deep indigo-violet ribbon
        colors: [
          "rgba(99, 102, 241, 0.78)",
          "rgba(139, 92, 246, 0.82)",
          "rgba(56, 189, 248, 0.72)",
        ],
        coreColor: "#818cf8",
        amp: 18,
        freq: 1.6,
        spd: 0.85,
        thick: 11,
      },
      {
        // Secondary electric cyan-sky ribbon
        colors: [
          "rgba(56, 189, 248, 0.75)",
          "rgba(99, 102, 241, 0.70)",
          "rgba(168, 85, 247, 0.65)",
        ],
        coreColor: "#38bdf8",
        amp: 14,
        freq: 2.2,
        spd: 0.68,
        thick: 9,
      },
      {
        // Tertiary luminous purple-magenta ribbon
        colors: [
          "rgba(168, 85, 247, 0.72)",
          "rgba(217, 70, 239, 0.60)",
          "rgba(99, 102, 241, 0.68)",
        ],
        coreColor: "#c084fc",
        amp: 11,
        freq: 2.8,
        spd: 0.95,
        thick: 7.5,
      },
    ];

    function frame() {
      /* Smooth hover interpolation */
      const targetHover = isHovered ? 1.0 : 0.0;
      hoverFactorRef.current += (targetHover - hoverFactorRef.current) * 0.08;
      const hf = hoverFactorRef.current;

      /* Dynamic pacing */
      const spd = prefersReducedMotion ? 0.2 : 1.0 + hf * 0.25;
      tRef.current += spd;
      const t = tRef.current;

      ctx.clearRect(0, 0, S, S);

      /* Clip strictly inside the sphere */
      ctx.save();
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      ctx.clip();

      /* ── 1. Soft ethereal background gradient ── */
      const bg = ctx.createRadialGradient(
        S * 0.35, S * 0.30, 0,
        S / 2, S / 2, S / 2
      );
      bg.addColorStop(0, "rgba(244, 248, 255, 0.96)");
      bg.addColorStop(0.42, "rgba(224, 235, 255, 0.85)");
      bg.addColorStop(0.78, "rgba(202, 218, 255, 0.68)");
      bg.addColorStop(1, "rgba(182, 204, 255, 0.55)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      /* ── 2. Sweeping volumetric internal aurora light ── */
      const auroraT = t * 0.012;
      const aX = S / 2 + Math.sin(auroraT) * (S * 0.22);
      const aY = S / 2 + Math.cos(auroraT * 0.75) * (S * 0.16);
      const aurora = ctx.createRadialGradient(aX, aY, 0, aX, aY, S * 0.48);
      aurora.addColorStop(0, `rgba(139, 92, 246, ${0.16 + hf * 0.08})`);
      aurora.addColorStop(0.45, `rgba(56, 189, 248, ${0.10 + hf * 0.06})`);
      aurora.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = aurora;
      ctx.fillRect(0, 0, S, S);

      /* ── 3. Luminous Fluid Wave Ribbons ── */
      WAVES.forEach((wave, wi) => {
        const ph = (wi / WAVES.length) * Math.PI * 1.6;
        const spread = (wi - (WAVES.length - 1) / 2) * (wave.amp * 0.75);
        const yBase = S / 2 + spread;

        /* Organic harmonic swell (rhythmic breathing) */
        const swell =
          1 +
          0.16 * Math.sin(t * 0.024 + wi * 2.1) +
          0.10 * Math.cos(t * 0.038 - wi * 1.4) +
          hf * 0.22;
        const currentAmp = wave.amp * swell;

        const pts = [];
        const step = 2;

        for (let xi = 0; xi <= S; xi += step) {
          const nx = xi / S;

          /* Compound multi-frequency undulation */
          const a1 = nx * Math.PI * 2 * wave.freq + t * wave.spd * 0.032 + ph;
          const a2 = nx * Math.PI * 2 * (wave.freq * 1.55) - t * wave.spd * 0.022 + ph * 0.75;
          const a3 = nx * Math.PI * 2 * (wave.freq * 0.45) + t * wave.spd * 0.012 + ph * 1.35;

          const y =
            yBase +
            Math.sin(a1) * currentAmp +
            Math.sin(a2) * (currentAmp * 0.32) +
            Math.sin(a3) * (currentAmp * 0.16);

          /* Gentle edge taper so ribbons dissolve naturally inside the sphere rim */
          const taper = Math.sin(nx * Math.PI);
          const currentThick = wave.thick * (0.35 + 0.65 * taper) * (1 + hf * 0.15);

          pts.push({
            x: xi,
            yt: y - currentThick,
            yb: y + currentThick,
            yc: y,
          });
        }

        /* 3A. Draw translucent filled ribbon */
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.yt) : ctx.lineTo(p.x, p.yt)));
        [...pts].reverse().forEach((p) => ctx.lineTo(p.x, p.yb));
        ctx.closePath();

        const gr = ctx.createLinearGradient(0, 0, S, 0);
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(0.12, wave.colors[0]);
        gr.addColorStop(0.5, wave.colors[1]);
        gr.addColorStop(0.88, wave.colors[2]);
        gr.addColorStop(1, "rgba(255,255,255,0)");

        ctx.shadowBlur = 18 + hf * 8;
        ctx.shadowColor = wave.coreColor + "88";
        ctx.fillStyle = gr;
        ctx.fill();

        /* 3B. Radiant glowing core spine */
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.yc) : ctx.lineTo(p.x, p.yc)));
        const sg = ctx.createLinearGradient(0, 0, S, 0);
        sg.addColorStop(0, "rgba(255,255,255,0)");
        sg.addColorStop(0.18, wave.coreColor + "aa");
        sg.addColorStop(0.5, "#ffffffea");
        sg.addColorStop(0.82, wave.coreColor + "aa");
        sg.addColorStop(1, "rgba(255,255,255,0)");

        ctx.strokeStyle = sg;
        ctx.lineWidth = 1.6 + hf * 0.4;
        ctx.shadowBlur = 10 + hf * 6;
        ctx.shadowColor = wave.coreColor;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      /* ── 4. Inner perimeter vignette & depth wash ── */
      const vgn = ctx.createRadialGradient(
        S / 2, S / 2, S * 0.22,
        S / 2, S / 2, S / 2
      );
      vgn.addColorStop(0, "rgba(255,255,255,0)");
      vgn.addColorStop(0.72, "rgba(255,255,255,0)");
      vgn.addColorStop(1, "rgba(165,190,255,0.35)");
      ctx.fillStyle = vgn;
      ctx.fillRect(0, 0, S, S);

      ctx.restore();
      rafRef.current = requestAnimationFrame(frame);
    }

    frame();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size, isHovered]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "block",
      }}
    />
  );
}

/* ── Rotating Concentric Ring ── */
function DynamicRing({
  size,
  duration,
  reverse = false,
  color,
  opacity,
  inset,
  dashed = false,
  pulseDur = 5,
}) {
  return (
    <motion.div
      animate={{
        rotate: reverse ? -360 : 360,
        scale: [1, 1.02, 0.99, 1],
        opacity: [opacity * 0.85, opacity * 1.2, opacity * 0.85],
      }}
      transition={{
        rotate: { duration, repeat: Infinity, ease: "linear" },
        scale: { duration: pulseDur, repeat: Infinity, ease: "easeInOut" },
        opacity: { duration: pulseDur * 0.8, repeat: Infinity, ease: "easeInOut" },
      }}
      style={{
        position: "absolute",
        top: inset,
        left: inset,
        right: inset,
        bottom: inset,
        borderRadius: "50%",
        border: `1px ${dashed ? "dashed" : "solid"} ${color}`,
        pointerEvents: "none",
      }}
    />
  );
}

/* ── Orbiting Planetary Micro-Node with Glowing Halo ── */
function DynamicNode({
  size,
  duration,
  delay = 0,
  color,
  orbitRadius,
  pulseDur = 3.5,
}) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear", delay }}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: orbitRadius * 2,
        height: orbitRadius * 2,
        marginTop: -orbitRadius,
        marginLeft: -orbitRadius,
        borderRadius: "50%",
        pointerEvents: "none",
      }}
    >
      <motion.div
        animate={{
          scale: [1, 1.35, 0.92, 1],
          opacity: [0.75, 1, 0.7, 0.75],
        }}
        transition={{
          duration: pulseDur,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          marginLeft: -size / 2,
          marginTop: -size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${size * 3}px ${color}, 0 0 ${size * 6}px ${color}88`,
        }}
      />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────
   MAIN LOGIN ORB — Exported for Login.jsx
───────────────────────────────────────────────── */
export default function LoginOrb({
  mousePos = { x: 0, y: 0 },
  onClick,
}) {
  const ORB = 312; // Standard size matching design
  const [isHovered, setIsHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  /* Gentle idle breathing pulse */
  const breatheDur = 4.8;

  /* Handle interactive click ripple */
  const handleClick = (e) => {
    setClickCount((c) => c + 1);
    if (onClick) onClick(e);
  };

  return (
    <motion.div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileTap={{ scale: 0.975 }}
      style={{
        position: "relative",
        width: ORB,
        height: ORB,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {/* ── LAYER 1: OUTER AMBIENT GLOW (Parallax Plane 1) ── */}
      <motion.div
        animate={{
          x: mousePos.x * 8,
          y: mousePos.y * 8,
          scale: isHovered ? [1.06, 1.12, 1.06] : [1, 1.035, 1],
          opacity: isHovered ? 0.65 : [0.38, 0.55, 0.38],
        }}
        transition={{
          x: { type: "spring", stiffness: 45, damping: 20 },
          y: { type: "spring", stiffness: 45, damping: 20 },
          scale: { duration: breatheDur * 1.2, repeat: Infinity, ease: "easeInOut" },
          opacity: { duration: breatheDur * 1.2, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{
          position: "absolute",
          width: ORB + 100,
          height: ORB + 100,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.14) 35%, rgba(56,189,248,0.08) 60%, transparent 75%)",
          filter: "blur(32px)",
          pointerEvents: "none",
        }}
      />

      {/* ── LAYER 1B: INNER GLOW ACCENT ── */}
      <motion.div
        animate={{
          x: mousePos.x * 12,
          y: mousePos.y * 12,
          scale: isHovered ? 1.05 : [0.98, 1.025, 0.98],
          opacity: isHovered ? 0.55 : [0.3, 0.48, 0.3],
        }}
        transition={{
          x: { type: "spring", stiffness: 50, damping: 18 },
          y: { type: "spring", stiffness: 50, damping: 18 },
          scale: { duration: breatheDur, repeat: Infinity, ease: "easeInOut", delay: 0.3 },
          opacity: { duration: breatheDur, repeat: Infinity, ease: "easeInOut", delay: 0.3 },
        }}
        style={{
          position: "absolute",
          width: ORB + 40,
          height: ORB + 40,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(139,92,246,0.18) 0%, rgba(56,189,248,0.10) 50%, transparent 70%)",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      {/* ── LAYER 2: ROTATING PLANETARY ENERGY RINGS (Parallax Plane 2) ── */}
      <motion.div
        animate={{
          x: mousePos.x * 14,
          y: mousePos.y * 14,
        }}
        transition={{ type: "spring", stiffness: 55, damping: 18 }}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {/* Outermost ring — graceful clockwise */}
        <DynamicRing
          size={ORB}
          duration={22}
          reverse={false}
          color="rgba(99,102,241,0.24)"
          opacity={0.75}
          inset={-22}
          pulseDur={5.2}
        />
        {/* Mid dashed decorative ring */}
        <DynamicRing
          size={ORB}
          duration={28}
          reverse={true}
          color="rgba(168,85,247,0.20)"
          opacity={0.7}
          inset={-15}
          dashed={true}
          pulseDur={4.8}
        />
        {/* Counter-rotating mid ring */}
        <DynamicRing
          size={ORB}
          duration={16}
          reverse={true}
          color="rgba(139,92,246,0.26)"
          opacity={0.65}
          inset={-9}
          pulseDur={4.2}
        />
        {/* Inner boundary ring */}
        <DynamicRing
          size={ORB}
          duration={12}
          reverse={false}
          color="rgba(56,189,248,0.25)"
          opacity={0.6}
          inset={0}
          pulseDur={3.8}
        />

        {/* ── Orbiting planetary micro-nodes with radiant glow ── */}
        <DynamicNode
          size={5.5}
          duration={9.5}
          delay={0}
          color="#6366f1"
          orbitRadius={ORB / 2 + 13}
          pulseDur={3.2}
        />
        <DynamicNode
          size={4.5}
          duration={13}
          delay={2}
          color="#38bdf8"
          orbitRadius={ORB / 2 + 19}
          pulseDur={3.8}
        />
        <DynamicNode
          size={3.5}
          duration={18}
          delay={4.5}
          color="#a855f7"
          orbitRadius={ORB / 2 + 23}
          pulseDur={4.2}
        />
      </motion.div>

      {/* ── LAYER 3: CORE TRANSLUCENT GLASS SPHERE (Parallax Plane 3) ── */}
      <motion.div
        animate={{
          x: mousePos.x * 18,
          y: mousePos.y * 18,
          scale: isHovered ? 1.025 : [1, 1.018, 1],
        }}
        transition={{
          x: { type: "spring", stiffness: 60, damping: 16 },
          y: { type: "spring", stiffness: 60, damping: 16 },
          scale: { duration: breatheDur, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{
          position: "relative",
          width: ORB,
          height: ORB,
          borderRadius: "50%",
          overflow: "hidden",
          /* Authentic AIRA soft translucent glass gradient */
          background:
            "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92) 0%, rgba(224,235,255,0.72) 22%, rgba(198,214,255,0.54) 50%, rgba(167,139,250,0.38) 80%, rgba(139,92,246,0.28) 100%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1.5px solid rgba(255,255,255,0.85)",
          boxShadow: [
            "0 20px 56px rgba(99,102,241,0.18)",
            "0 6px 24px rgba(56,189,248,0.14)",
            "inset 0 14px 32px rgba(255,255,255,0.92)",
            "inset 0 -16px 28px rgba(139,92,246,0.16)",
            "inset 0 0 0 1px rgba(255,255,255,0.6)",
          ].join(", "),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* ── LAYER 4: INNER WAVEFORM CANVAS ── */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden" }}>
          <PlasmaCanvas size={ORB} isHovered={isHovered} />
        </div>

        {/* Soft volumetric breathing color tint */}
        <motion.div
          animate={{ opacity: isHovered ? 0.35 : [0.20, 0.30, 0.20] }}
          transition={{ duration: breatheDur * 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 45% 50%, rgba(99,102,241,0.25) 0%, rgba(56,189,248,0.14) 50%, transparent 75%)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />

        {/* ── FLOATING TOP-LEFT GLASS SPECULAR HIGHLIGHT ── */}
        <motion.div
          animate={{
            x: [-2, 3, -2],
            y: [-2, 2, -2],
            opacity: [0.94, 1, 0.94],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: "6%",
            left: "11%",
            width: "42%",
            height: "28%",
            borderRadius: "50%",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.0) 100%)",
            transform: "rotate(-22deg)",
            zIndex: 5,
            pointerEvents: "none",
          }}
        />

        {/* ── FLOATING BOTTOM-RIGHT SPECULAR GLOW DOT ── */}
        <motion.div
          animate={{
            opacity: [0.60, 0.85, 0.60],
            scale: [0.95, 1.10, 0.95],
          }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          style={{
            position: "absolute",
            top: "62%",
            right: "14%",
            width: "10%",
            height: "10%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 80%)",
            filter: "blur(2px)",
            zIndex: 5,
            pointerEvents: "none",
          }}
        />

        {/* ── INNER RIM REFRACTIVE LIGHT ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.55)",
            pointerEvents: "none",
            zIndex: 6,
          }}
        />
      </motion.div>

      {/* ── TACTILE INTERACTIVE CLICK RIPPLE ── */}
      <AnimatePresence>
        {clickCount > 0 && (
          <motion.div
            key={clickCount}
            initial={{ scale: 0.95, opacity: 0.75 }}
            animate={{ scale: 1.38, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: -10,
              borderRadius: "50%",
              border: "2px solid rgba(99, 102, 241, 0.45)",
              boxShadow: "0 0 20px rgba(99,102,241,0.25)",
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}


