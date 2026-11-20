import { motion } from "framer-motion";
import { LifeBuoy, LockKeyhole, X } from "lucide-react";
import { useStore } from "../lib/store";

export function SupportModal({ onClose }: { onClose: () => void }) {
  const { t } = useStore();

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="modal narrow"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.99 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="modal-head">
          <div>
            <h2>{t("Поддержка")}</h2>
            <div className="sub">{t("Скоро здесь появится встроенная поддержка.")}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t("Закрыть")}>
            <X size={15} />
          </button>
        </div>

        <div className="support-body">
          <div className="support-locked-hero">
            <div className="support-lock-seal">
              <LockKeyhole size={26} />
            </div>
            <span className="support-lock-glyph">
              <LifeBuoy size={20} />
            </span>

            <span className="support-lock-badge">{t("В процессе создания")}</span>

            <h3>{t("Поддержка уже в разработке")}</h3>
            <p>
              {t(
                "Совсем скоро здесь появится встроенная техподдержка Aether Hub: обращения, переписка с создателем и статусы тикетов — всё внутри хаба.",
              )}
            </p>

            <div className="support-lock-line" />
            <span className="support-lock-foot">{t("Следите за обновлениями")}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
