import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, Sparkles, X } from "lucide-react";
import { installUpdate, type Update, type UpdateProgress } from "../lib/updater";
import { formatBytes } from "../lib/format";
import { useStore } from "../lib/store";

export function UpdateModal({
  update,
  onClose,
}: {
  update: Update;
  onClose: () => void;
}) {
  const { t } = useStore();
  const [progress, setProgress] = useState<UpdateProgress>({
    percent: 0,
    received: 0,
    total: 0,
  });
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const install = async () => {
    setInstalling(true);
    setError(null);
    try {
      await installUpdate(update, setProgress);
      setDone(true);
    } catch (err) {
      setError(String(err));
      setInstalling(false);
    }
  };

  return (
    <motion.div
      className="modal-backdrop"
      style={{ zIndex: 180 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !installing) onClose();
      }}
    >
      <motion.div
        className="modal narrow"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="modal-head">
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 9.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--violet)",
                fontWeight: 700,
              }}
            >
              <Sparkles size={11} /> {t("Обновление Aether Hub")}
            </div>
            <h2 style={{ marginTop: 6 }}>
              v{update.version}
              <span style={{ color: "var(--dim)", fontSize: 11, fontWeight: 400, marginLeft: 10 }}>
                {t("сейчас v{version}", { version: update.currentVersion })}
              </span>
            </h2>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={installing}
            aria-label={t("Закрыть")}
          >
            <X size={15} />
          </button>
        </div>

        <div className="modal-scroll" style={{ padding: "18px 20px 20px" }}>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
            {t("Новая версия уже готова. Скачайте её и приложение перезапустится само.")}
          </p>

          {update.body ? (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "rgba(5,4,10,.42)",
                fontSize: 10.5,
                lineHeight: 1.7,
                color: "var(--muted)",
                whiteSpace: "pre-wrap",
                maxHeight: 180,
                overflow: "auto",
              }}
            >
              {update.body}
            </div>
          ) : null}

          {installing || done ? (
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: "var(--dim)",
                  marginBottom: 6,
                }}
              >
                <span>
                  {done
                    ? t("Установлено - перезапускаем…")
                    : progress.total
                      ? `${formatBytes(progress.received)} / ${formatBytes(progress.total)}`
                      : t("Скачивание…")}
                </span>
                <span>{Math.round(progress.percent)}%</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.max(2, progress.percent)}%` }} />
              </div>
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(251,113,133,.28)",
                background: "rgba(251,113,133,.08)",
                color: "#ffb3bf",
                fontSize: 10.5,
                lineHeight: 1.5,
                wordBreak: "break-word",
              }}
            >
              {error}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 18,
            }}
          >
            <button className="btn btn-ghost" onClick={onClose} disabled={installing}>
              {t("Позже")}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void install()}
              disabled={installing || done}
            >
              {installing || done ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <Download size={13} />
              )}
              {done ? t("Перезапуск…") : t("Скачать и установить")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
