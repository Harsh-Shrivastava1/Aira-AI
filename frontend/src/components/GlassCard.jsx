import React from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";

export default function GlassCard({ children, className, hover = true, delay = 0, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hover ? { y: -3, boxShadow: "0 8px 32px rgba(99,102,241,0.14)" } : {}}
      className={cn("glass-card p-6 flex flex-col", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
