import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  BadgeCheck,
  KeyRound,
  Sparkles,
  Waves,
} from "lucide-react";
import type { AppNotification, View } from "../types";
import { useStore } from "../lib/store";
import { timeAgo } from "../lib/format";

const kindIcon = {
  release: Sparkles,
  beta: BadgeCheck,
  license: KeyRound,
  sample: Waves,
} as const;

export function NotificationBell({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { notifications, unreadNotifications, markNotificationsRead, t } = useStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadNotifications > 0) markNotificationsRead();
  };

  const openNotification = (item: AppNotification) => {
    setOpen(false);
    if (item.action === "samples") onNavigate({ name: "samples" });
    else if (item.action === "profile") onNavigate({ name: "home" });
    else onNavigate({ name: "category", category: "plugins" });
  };

  return (
    <div className="notif-root" ref={rootRef}>
      <button
        className={`icon-button notif-button ${open ? "active" : ""}`}
        onClick={toggle}
        title={t("Уведомления")}
        aria-label={t("Уведомления")}
        aria-expanded={open}
      >
        <Bell size={15} />
        {unreadNotifications > 0 ? (
          <span className="notif-badge">
            {unreadNotifications > 99 ? "99+" : unreadNotifications}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="notif-panel"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="notif-head">
              <div>
                <b>{t("Уведомления")}</b>
                <span>
                  {unreadNotifications > 0
                    ? t("{count} новых", { count: unreadNotifications })
                    : t("Всё прочитано")}
                </span>
              </div>
              <span className="chip">{notifications.length}</span>
            </div>

            <div className="notif-list">
              {notifications.length ? (
                notifications.map((item) => {
                  const Icon = kindIcon[item.kind];
                  return (
                    <button
                      key={item.id}
                      className={`notif-item ${item.kind}`}
                      onClick={() => openNotification(item)}
                    >
                      <span className="notif-icon">
                        <Icon size={13} />
                      </span>
                      <span className="notif-copy">
                        <b>{item.title}</b>
                        <span>{item.message}</span>
                        <em>{timeAgo(item.createdAt)}</em>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="notif-empty">
                  <Bell size={18} />
                  <span>{t("Пока нет событий. Релизы и модерация появятся здесь.")}</span>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
