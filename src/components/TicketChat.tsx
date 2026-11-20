import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Crown,
  Loader2,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import type { SupportTicket, TicketMessage } from "../types";
import { useStore } from "../lib/store";
import { fetchTicketMessages, sendTicketMessage } from "../lib/cloud";
import { timeAgo } from "../lib/format";
import { Avatar } from "./Avatar";

export function TicketChat({
  ticket,
  onClose,
  onMinimize,
}: {
  ticket: SupportTicket;
  onClose: () => void;
  onMinimize: () => void;
}) {
  const { profile, adminVisible, adminTokenReady, toast, t } = useStore();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const role = adminVisible ? "admin" : "user";

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const next = await fetchTicketMessages(ticket.id);
        setMessages(next);
      } catch (error) {
        if (!silent) {
          toast({
            kind: "error",
            title: t("Не удалось загрузить чат"),
            message: String(error),
          });
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [t, ticket.id, toast],
  );

  useEffect(() => {
    void load();
    inputRef.current?.focus();
  }, [load]);

  useEffect(() => {
    if (!adminTokenReady) return;
    const interval = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const element = listRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const messagesForTicket = useMemo(
    () => messages.filter((message) => message.ticketId === ticket.id),
    [messages, ticket.id],
  );

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const message = await sendTicketMessage({
        ticketId: ticket.id,
        senderRole: role,
        senderName: profile.nickname || "aether",
        senderAvatar: role === "admin" ? "/logo.png" : profile.avatarUrl,
        message: text,
      });
      setMessages((prev) => [...prev, message]);
      setDraft("");
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (error) {
      toast({ kind: "error", title: t("Сообщение не отправлено"), message: String(error) });
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      className="chat-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.aside
        className="chat-drawer"
        initial={{ x: 420, opacity: 0.7 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0.7 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        <header className="chat-head">
          <Avatar name={ticket.nickname} src={ticket.avatarUrl} size={34} />
          <div className="chat-who">
            <b>{ticket.nickname}</b>
            <span>
              {ticket.os} ·{" "}
              {ticket.status === "open" ? t("Открыт") : t("Закрыт")} · {timeAgo(ticket.createdAt)}
            </span>
          </div>
          <button
            className="row-icon"
            onClick={onMinimize}
            title={t("Свернуть")}
            aria-label={t("Свернуть")}
          >
            <ChevronDown size={15} />
          </button>
          <button className="row-icon" onClick={onClose} title={t("Закрыть")} aria-label={t("Закрыть")}>
            <X size={15} />
          </button>
        </header>

        <div className="chat-ticket-preview">
          <span className="chat-preview-label">{t("Оригинальное обращение")}</span>
          <p>{ticket.message}</p>
          <div className="chat-preview-id">
            <span>Machine ID</span>
            <code>{ticket.machineId}</code>
          </div>
        </div>

        <div className="chat-messages" ref={listRef}>
          {loading ? (
            <div className="chat-empty">
              <Loader2 size={16} className="spin" /> {t("Загрузка сообщений…")}
            </div>
          ) : messagesForTicket.length ? (
            messagesForTicket.map((message) => {
              const isAdmin = message.senderRole === "admin";
              const avatar = isAdmin
                ? "/logo.png"
                : message.senderAvatar || ticket.avatarUrl;
              return (
                <div className={`chat-msg ${message.senderRole}`} key={message.id}>
                  <Avatar name={message.senderName} src={avatar} size={28} />
                  <div className="chat-msg-body">
                    <div className="chat-msg-meta">
                      <b>{message.senderName}</b>
                      {isAdmin ? (
                        <span className="creator-badge">
                          <Crown size={9} /> Creator
                        </span>
                      ) : null}
                      <span className="chat-msg-time">{timeAgo(message.createdAt)}</span>
                    </div>
                    <div className="chat-bubble">{message.message}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="chat-empty">{t("Сообщений пока нет.")}</div>
          )}
        </div>

        <div className="chat-composer">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("Написать ответ…")}
            maxLength={4000}
            rows={2}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <button
            className="send-btn"
            onClick={() => void send()}
            disabled={!draft.trim() || sending}
            aria-label={t("Отправить")}
          >
            {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
          </button>
        </div>

        <div className="chat-foot">
          <MessageCircle size={11} /> {t("Чат по тикету")} ·{" "}
          {adminTokenReady ? t("обновляется каждые 5 секунд") : t("локальный демо-чат")}
        </div>
      </motion.aside>
    </motion.div>
  );
}
