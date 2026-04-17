import React from "react";
import { motion } from "framer-motion";
import { X, TrendingUp, MessageCircle } from "lucide-react";

export default function MinimalEvaluationOverlay({ evaluation, onClose }) {
  if (!evaluation) return null;

  const confidence = evaluation.confidenceScore ?? 0;
  const communication = evaluation.communicationScore ?? 0;
  const avg = Math.round((confidence + communication) / 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
      className="absolute top-6 right-6 z-50 w-72"
    >
      <div className="glass-elevated p-5 relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100 rounded-full blur-2xl opacity-60 -translate-y-4 translate-x-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 relative">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-100 flex-center">
              <TrendingUp size={14} className="text-indigo-600" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Session Report</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex-center transition-colors"
          >
            <X size={12} className="text-slate-500" />
          </button>
        </div>

        {/* Score row */}
        <div className="flex gap-3 mb-4 relative">
          {[
            { label: "Confidence", value: confidence, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Communication", value: communication, color: "text-cyan-600", bg: "bg-cyan-50" }
          ].map(s => (
            <div key={s.label} className={`flex-1 ${s.bg} rounded-2xl p-3 text-center`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Feedback text */}
        {evaluation.improvementNotes && (
          <div className="flex gap-2 bg-slate-50 rounded-2xl p-3 relative">
            <MessageCircle size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
              {evaluation.improvementNotes}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
