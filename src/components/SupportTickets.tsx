import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import type { SupportTicket } from "../types";
import { useStore } from "../lib/store";
import {
  clearClosedSupportTickets,
  closeSupportTicket,
  cloudEnabled,
  deleteSupportTicket,
  fetchSupportTickets,
} from "../lib/cloud";
import { copyText, timeAgo } from "../lib/format";
import { Avatar } from "./Avatar";
import { TicketChat } from "./TicketChat";

type Filter = "all" | "open" | "closed";

export function SupportTickets() {
  const { toast, t, adminTokenReady } = useStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [chatTicket, setChatTicket] = useState<SupportTicket | null>(null);
  const [chatMinimized, setChatMinimized] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const next = await fetchSupportTickets();
        setTickets(next);
      } catch (error) {
        if (!silent) {
          toast({
            kind: "error",
            title: t("Не удалось загрузить тикеты"),
            message: String(error),
          });
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [t, toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!adminTokenReady) return;
    const interval = window.setInterval(() => void load(true), 8000);
    const focus = () => void load(true);
    window.addEventListener("focus", focus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "all") return tickets;
    return tickets.filter((ticket) => ticket.status === filter);
  }, [filter, tickets]);

  const openCount = tickets.filter((ticket) => ticket.status === "open").length;
  const closedCount = tickets.filter((ticket) => ticket.status === "closed").length;

  const copy = async (value: string) => {
    const ok = await copyText(value);
    toast({
      kind: ok ? "success" : "error",
      title: ok ? t("Machine ID скопирован") : t("Не удалось скопировать"),
    });
  };

  const closeTicket = async (ticket: SupportTicket) => {
    try {
      await closeSupportTicket(ticket.id);
      setTickets((prev) =>
        prev.map((item) => (item.id === ticket.id ? { ...item, status: "closed" } : item)),
      );
      setChatTicket((prev) =>
        prev && prev.id === ticket.id ? { ...prev, status: "closed" } : prev,
      );
      toast({ kind: "success", title: t("Тикет закрыт") });
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось обновить тикет"), message: String(error) });
    }
  };

  const removeTicket = async (ticket: SupportTicket) => {
    try {
      await deleteSupportTicket(ticket.id);
      setTickets((prev) => prev.filter((item) => item.id !== ticket.id));
      if (chatTicket?.id === ticket.id) setChatTicket(null);
      setConfirmDelete(null);
      toast({ kind: "info", title: t("Тикет удалён") });
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось обновить тикет"), message: String(error) });
    }
  };

  const clearClosed = async () => {
    try {
      await clearClosedSupportTickets();
      setTickets((prev) => prev.filter((item) => item.status !== "closed"));
      setChatTicket((prev) => (prev?.status === "closed" ? null : prev));
      setConfirmClear(false);
      toast({ kind: "info", title: t("Закрытые тикеты очищены") });
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось обновить тикет"), message: String(error) });
    }
  };

  const cloudAgreement = cloudEnabled && !adminTokenReady;

  return (
    <div className="page">
      <div className="admin-hero">
        <div className="seal">
          <Inbox size={19} />
        </div>
        <div className="copy">
          <h2>{t("Обращения пользователей")}</h2>
          <p>
            {adminTokenReady
              ? t("Обновление каждые 8 секунд · таблица support_tickets")
              : t("Локальный демо-режим · обращения сохраняются на этом устройстве")}
          </p>
        </div>
        <span className={`chip ${adminTokenReady ? "green" : "gold"}`}>
          {adminTokenReady ? "LIVE" : "LOCAL"}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={12} className={loading ? "spin" : ""} /> {t("Обновить")}
        </button>
      </div>

      {cloudAgreement ? (
        <div className="notice">
          <Inbox size={15} />
          <div>
            <b>{t("Нет доступа к облачным тикетам.")}</b>{" "}
            {t("В этой сборке отсутствует ADMIN_TOKEN — список тикетов доступен только в локальном демо-режиме.")}
          </div>
        </div>
      ) : null}

      <div className="admin-card glass">
        <div className="tickets-toolbar">
          <div className="segmented" style={{ margin: 0 }}>
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
              {t("Все обращения")} <span style={{ opacity: 0.55 }}>{tickets.length}</span>
            </button>
            <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>
              {t("Открытые")} <span style={{ opacity: 0.55 }}>{openCount}</span>
            </button>
            <button
              className={filter === "closed" ? "active" : ""}
              onClick={() => setFilter("closed")}
            >
              {t("Закрытые")} <span style={{ opacity: 0.55 }}>{closedCount}</span>
            </button>
          </div>

          {confirmClear ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-danger btn-sm" onClick={() => void clearClosed()}>
                {t("Да, очистить")}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>
                <X size={12} /> {t("Отмена")}
              </button>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmClear(true)}
              disabled={closedCount === 0}
            >
              <Trash2 size={12} /> {t("Очистить все закрытые")}
            </button>
          )}
        </div>

        {loading && !tickets.length ? (
          <div className="tickets-loading">
            <Loader2 size={16} className="spin" /> {t("Загрузка обращений…")}
          </div>
        ) : visible.length ? (
          <div className="ticket-list">
            {visible.map((ticket) => (
              <div className={`ticket-card ${ticket.status}`} key={ticket.id}>
                <div className="ticket-top">
                  <Avatar name={ticket.nickname} size={34} />
                  <div className="ticket-who">
                    <b>{ticket.nickname}</b>
                    <span>
                      {ticket.os} · {timeAgo(ticket.createdAt)}
                    </span>
                  </div>
                  <span className={`req-status ${ticket.status}`}>
                    {ticket.status === "open" ? t("Открыт") : t("Закрыт")}
                  </span>
                </div>

                <p className="ticket-message">{ticket.message}</p>

                <div className="ticket-machine">
                  <span className="ticket-machine-label">Machine ID</span>
                  <code>{ticket.machineId}</code>
                  <button
                    className="row-icon"
                    title={t("Скопировать Machine ID")}
                    onClick={() => void copy(ticket.machineId)}
                  >
                    <Copy size={12} />
                  </button>
                </div>

                <div className="ticket-actions">
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={() => {
                      setChatTicket(ticket);
                      setChatMinimized(false);
                    }}
                  >
                    <MessageCircle size={12} /> {t("Открыть чат / Ответить")}
                  </button>

                  {ticket.status === "open" ? (
                    <button className="btn btn-soft btn-sm" onClick={() => void closeTicket(ticket)}>
                      <Check size={12} /> {t("Закрыть тикет")}
                    </button>
                  ) : null}

                  {confirmDelete === ticket.id ? (
                    <>
                      <button className="btn btn-danger btn-sm" onClick={() => void removeTicket(ticket)}>
                        <Trash2 size={12} /> {t("Да, удалить")}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                        {t("Отмена")}
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmDelete(ticket.id)}
                    >
                      <Trash2 size={12} /> {t("Удалить / Очистить")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: 8 }}>
            <div className="icon">
              <Inbox size={22} />
            </div>
            <h3>{t("Тикетов нет")}</h3>
            <p>{t("Новые обращения появятся здесь.")}</p>
          </div>
        )}
      </div>

      {chatTicket && !chatMinimized ? (
        <TicketChat
          ticket={chatTicket}
          onClose={() => {
            setChatTicket(null);
            setChatMinimized(false);
          }}
          onMinimize={() => setChatMinimized(true)}
        />
      ) : null}

      {chatTicket && chatMinimized ? (
        <button className="chat-mini" onClick={() => setChatMinimized(false)}>
          <MessageCircle size={15} />
          <span>{chatTicket.nickname}</span>
          <b>{t("Чат с создателем")}</b>
        </button>
      ) : null}
    </div>
  );
}
