import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);
  toastsRef.current = toasts;

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ title, message, type = "info", duration = 4500 }) => {
    // Avoid duplicate notifications if exact same title and message is currently showing
    const isDuplicate = toastsRef.current.some(
      (t) => t.title === title && t.message === message
    );
    if (isDuplicate) return;

    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, title, message, type };

    setToasts((prev) => [newToast, ...prev.slice(0, 1)]); // keep at most 2 compact toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast container floating at top center */}
      <div
        style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
          width: "calc(100% - 32px)",
          maxWidth: 420,
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const isSuccess = toast.type === "success";
            const isError = toast.type === "error";

            const accentColor = isSuccess ? "#10b981" : isError ? "#ef4444" : "#3b82f6";
            const iconBg = isSuccess
              ? "rgba(16, 185, 129, 0.1)"
              : isError
              ? "rgba(239, 68, 68, 0.1)"
              : "rgba(59, 130, 246, 0.1)";

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                style={{
                  pointerEvents: "auto",
                  width: "100%",
                  background: "rgba(255, 255, 255, 0.98)",
                  backdropFilter: "blur(12px)",
                  borderRadius: 14,
                  border: `1px solid ${isSuccess ? "rgba(16,185,129,0.25)" : isError ? "rgba(239,68,68,0.25)" : "rgba(59,130,246,0.25)"}`,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {isSuccess ? (
                    <CheckCircle2 size={17} color={accentColor} />
                  ) : isError ? (
                    <AlertCircle size={17} color={accentColor} />
                  ) : (
                    <Info size={17} color={accentColor} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {toast.title && (
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.3,
                      }}
                    >
                      {toast.title}
                    </h4>
                  )}
                  {toast.message && (
                    <p
                      style={{
                        margin: toast.title ? "3px 0 0" : 0,
                        fontSize: "0.75rem",
                        color: "#64748b",
                        lineHeight: 1.45,
                        fontWeight: 450,
                      }}
                    >
                      {toast.message}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  aria-label="Close notification"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    flexShrink: 0,
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if used outside provider
    return {
      showToast: ({ title, message }) => console.log(`[Toast]: ${title} - ${message}`),
      removeToast: () => {},
    };
  }
  return context;
}
