import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (message: string) => addToast("success", message),
    error: (message: string) => addToast("error", message),
    info: (message: string) => addToast("info", message),
  };

  const ICONS = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
  };

  const COLORS = {
    success: { border: "border-emerald-500/40", icon: "text-emerald-400", bg: "bg-emerald-500/5" },
    error: { border: "border-red-500/40", icon: "text-red-400", bg: "bg-red-500/5" },
    info: { border: "border-blue-500/40", icon: "text-blue-400", bg: "bg-blue-500/5" },
  };

  const LEFT_BORDER = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs w-full sm:max-w-sm pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => {
            const Icon = ICONS[t.type];
            const colors = COLORS[t.type];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`pointer-events-auto flex items-start gap-3 bg-card border ${colors.border} rounded-xl shadow-2xl overflow-hidden`}
              >
                {/* Left accent bar */}
                <div className={`w-1 self-stretch flex-shrink-0 ${LEFT_BORDER[t.type]}`} />

                <div className="flex items-center gap-3 flex-1 py-3 pr-3">
                  <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${colors.icon}`} />
                  <p className="text-sm text-foreground font-medium flex-1">{t.message}</p>
                  <button
                    onClick={() => dismiss(t.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
