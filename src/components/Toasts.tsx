import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useStore } from "../lib/store";

export function Toasts() {
  const { toasts, dismissToast } = useStore();

  return (
    <div className="toasts">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon =
            toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? XCircle : Info;
          return (
            <motion.div
              key={toast.id}
              className={`toast ${toast.kind}`}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              layout
            >
              <div className="ic">
                <Icon size={15} />
              </div>
              <div className="copy">
                <b>{toast.title}</b>
                {toast.message ? <p>{toast.message}</p> : null}
              </div>
              <button className="x" onClick={() => dismissToast(toast.id)} aria-label="Закрыть">
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
