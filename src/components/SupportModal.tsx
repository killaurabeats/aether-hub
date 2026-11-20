import { motion } from "framer-motion";
import {
  ArrowUpRight,
  LifeBuoy,
  LockKeyhole,
  Mail,
  Send,
  X,
} from "lucide-react";
import { useStore } from "../lib/store";
import { openExternal, TELEGRAM_URL } from "../lib/desktop";

const SUPPORT_EMAIL = "support@aetherplugins.com";

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
            <div className="sub">{t("Мы на связи — выберите удобный способ.")}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t("Закрыть")}>
            <X size={15} />
          </button>
        </div>

        <div className="modal-scroll">
          <div className="support-body">
            <div className="support-hero">
              <div className="support-seal">
                <LifeBuoy size={22} />
              </div>
              <div>
                <h3>{t("Мы на связи")}</h3>
                <p>{t("Напишите нам напрямую — ответим в Telegram или на почту.")}</p>
              </div>
            </div>

            <div className="support-contacts">
              <button
                className="support-contact"
                onClick={() => void openExternal(TELEGRAM_URL)}
              >
                <span className="support-contact-icon telegram">
                  <Send size={17} />
                </span>
                <span className="support-contact-copy">
                  <b>{t("Написать в Telegram")}</b>
                  <span>@whofriends1</span>
                </span>
                <ArrowUpRight size={15} />
              </button>

              <button
                className="support-contact"
                onClick={() => void openExternal(`mailto:${SUPPORT_EMAIL}`)}
              >
                <span className="support-contact-icon mail">
                  <Mail size={17} />
                </span>
                <span className="support-contact-copy">
                  <b>{t("Написать на Email")}</b>
                  <span>{SUPPORT_EMAIL}</span>
                </span>
                <ArrowUpRight size={15} />
              </button>
            </div>

            <div className="support-locked">
              <div className="support-locked-head">
                <span className="support-lock">
                  <LockKeyhole size={14} />
                </span>
                <div>
                  <b>{t("Встроенная форма тикета")}</b>
                  <span>{t("Прямое обращение из хаба")}</span>
                </div>
                <span className="chip gold">{t("В процессе создания")}</span>
              </div>

              <p className="support-locked-hint">
                {t(
                  "Скоро здесь можно будет отправить обращение прямо из хаба. Пока напишите нам в Telegram или на Email — так мы ответим быстрее.",
                )}
              </p>

              <div className="support-form-mock" aria-hidden>
                <div className="support-form-line" />
                <div className="support-form-line short" />
                <div className="support-form-area" />
                <button className="btn btn-primary btn-sm" disabled>
                  <Send size={11} /> {t("Отправить тикет")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
