import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import type { IssueLogEntry, LicenseRequest } from "../types";
import { useStore } from "../lib/store";
import { approveRequest, rejectRequest, cloudEnabled } from "../lib/cloud";
import { copyText, formatDate, timeAgo } from "../lib/format";
import { openExternal, openFolder, TELEGRAM_URL } from "../lib/desktop";
import { Avatar } from "./Avatar";

interface IssuedLicense {
  key: string;
  machineId: string;
  productTag: string;
  issuedAt: string;
  publicKey: string;
}

export function KeygenRequests() {
  const {
    admin,
    adminTokenReady,
    adminOverview,
    refreshAdminData,
    refreshCloudUser,
    requests,
    toast,
    machine,
    t,
  } = useStore();

  const [log, setLog] = useState<IssueLogEntry[]>([]);
  const [issuing, setIssuing] = useState<string | null>(null);
  const [issuedNow, setIssuedNow] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const rows = adminOverview?.requests ?? requests;

  const loadLog = useCallback(async () => {
    try {
      const entries = await invoke<IssueLogEntry[]>("list_issued_licenses");
      setLog(entries);
    } catch {
      setLog([]);
    }
  }, []);

  useEffect(() => {
    void loadLog();
    void refreshAdminData();
  }, [loadLog, refreshAdminData]);

  const refresh = async () => {
    setLoading(true);
    await refreshAdminData();
    await loadLog();
    setLoading(false);
  };

  const approve = async (request: LicenseRequest) => {
    setIssuing(request.id);
    try {
      const issued = await invoke<IssuedLicense>("generate_license", {
        machineId: request.machineId,
        productTag: request.productTag,
        nickname: request.nickname,
        pluginTitle: request.pluginTitle,
      });

      await approveRequest(request, issued.key);
      await copyText(issued.key);

      setIssuedNow((prev) => ({ ...prev, [request.id]: issued.key }));
      await refreshAdminData();
      await refreshCloudUser();
      await loadLog();

      toast({
        kind: "success",
        title: t("Ключ выдан и скопирован"),
        message: `${request.nickname} · ${issued.key.slice(0, 26)}…`,
      });
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось выдать ключ"), message: String(error) });
    } finally {
      setIssuing(null);
    }
  };

  const reject = async (request: LicenseRequest) => {
    try {
      await rejectRequest(request);
      await refreshAdminData();
      toast({ kind: "info", title: t("Заявка отклонена") });
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось отклонить"), message: String(error) });
    }
  };

  const copy = async (value: string, title: string) => {
    const ok = await copyText(value);
    toast({ kind: ok ? "success" : "error", title: ok ? title : t("Не удалось скопировать") });
  };

  if (!admin.enabled) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="icon">
            <ShieldCheck size={22} />
          </div>
          <h3>{t("Creator mode закрыт")}</h3>
          <p>{t("На этом устройстве нет приватного ключа.")}</p>
        </div>
      </div>
    );
  }

  const pending = rows.filter((row) => row.status === "pending");
  const resolved = rows.filter((row) => row.status !== "pending");

  return (
    <div className="page">
      <div className="admin-hero">
        <div className="seal">
          <KeyRound size={19} />
        </div>
        <div className="copy">
          <h2>Keygen & Requests</h2>
          <p>
            Ed25519 · BLAKE2b · {t("совместимо с")} <code>AetherVocal Strip</code>.{" "}
            {t("Ключ подписывает Machine ID и не переносится.")}
          </p>
        </div>
        <span className="chip green">
          <ShieldCheck size={9} /> {pending.length} PENDING
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={12} className={loading ? "spin" : ""} /> {t("Обновить")}
        </button>
      </div>

      {!adminTokenReady ? (
        <div className="notice">
          <AlertTriangle size={15} />
          <div>
            <b>{cloudEnabled ? t("Облако только для чтения.") : t("Локальный режим.")}</b>{" "}
            {t(
              "Ключи выдаются и проверяются локально, журнал пишется в папку приложения. Чтобы ключ автоматически появился у пользователя, подключите Supabase и токен админа.",
            )}
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.55fr) minmax(300px, 0.85fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div>
          <div className="admin-card glass">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3>{t("Входящие заявки")}</h3>
                <p className="sub" style={{ marginBottom: 12 }}>
                  {t(
                    "Одобрение генерирует подпись приватным ключом и отправляет ключ в профиль пользователя.",
                  )}
                </p>
              </div>
              <span className="chip gold">
                {t("{count} ждут", { count: pending.length })}
              </span>
            </div>

            {pending.length ? (
              <div className="request-grid" style={{ gridTemplateColumns: "1fr" }}>
                {pending.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    busy={issuing === request.id}
                    issuedKey={issuedNow[request.id]}
                    onApprove={() => void approve(request)}
                    onReject={() => void reject(request)}
                    onCopy={copy}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="icon">
                  <UserCheck size={20} />
                </div>
                <h3>{t("Все заявки обработаны")}</h3>
                <p>{t("Новые появятся здесь автоматически после запроса из плагина.")}</p>
              </div>
            )}
          </div>

          {resolved.length ? (
            <div className="admin-card glass">
              <h3>{t("История заявок")}</h3>
              <p className="sub">{t("Последние решения.")}</p>
              {resolved.map((request) => (
                <div className="req-item" key={request.id}>
                  <Avatar name={request.nickname} src={request.avatarUrl} size={28} />
                  <div className="info" style={{ flex: 1 }}>
                    <b>{request.nickname}</b>
                    <span>
                      {request.pluginTitle} · {timeAgo(request.createdAt)}
                    </span>
                  </div>
                  {request.key ? (
                    <button
                      className="row-icon"
                      onClick={() => void copy(request.key!, t("Ключ скопирован"))}
                      title={t("Скопировать ключ")}
                    >
                      <Copy size={12} />
                    </button>
                  ) : null}
                  <span className={`req-status ${request.status}`}>
                    {request.status === "approved" ? t("одобрено") : t("отклонено")}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-card glass">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={14} style={{ color: "var(--pink)" }} />
              <h3 style={{ margin: 0 }}>{t("Ключ создателя")}</h3>
            </div>
            <div className="field">
              <label>Private key</label>
              <code
                style={{
                  fontSize: 9,
                  color: "var(--muted)",
                  background: "rgba(5,4,10,.5)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: 8,
                  wordBreak: "break-all",
                  userSelect: "text",
                }}
              >
                {admin.privateKeyPath}
              </code>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Public key</label>
              <code
                style={{
                  fontSize: 9,
                  color: "var(--dim)",
                  background: "rgba(5,4,10,.5)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: 8,
                  wordBreak: "break-all",
                  userSelect: "text",
                }}
              >
                {admin.publicKey}
              </code>
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const parent = admin.privateKeyPath?.replace(/[\\/][^\\/]+$/, "");
                  if (parent) void openFolder(parent);
                }}
              >
                {t("Открыть папку ключа")}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void copy(machine.formatted, t("Machine ID скопирован"))}
              >
                <Copy size={11} /> {t("Мой Machine ID")}
              </button>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 9.5, color: "var(--dim)", lineHeight: 1.6 }}>
              {t(
                "Приватный ключ никогда не покидает это устройство и не попадает в сборку. Публичная часть зашита в плагин.",
              )}
            </p>
          </div>

          <div className="admin-card glass">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3>{t("Журнал выдачи")}</h3>
              <span className="chip">{log.length}</span>
            </div>
            <p className="sub">{t("Локальный журнал, последние 200 ключей.")}</p>

            {log.length ? (
              <div className="issue-log">
                {log.map((entry, index) => (
                  <div className="issue-item" key={`${entry.key}-${index}`}>
                    <div className="who">
                      <b>{entry.nickname || "unknown"}</b>
                      <span>
                        {entry.productTag} · {formatDate(entry.issuedAt)}
                      </span>
                    </div>
                    <button
                      className="row-icon"
                      onClick={() => void copy(entry.key, t("Ключ скопирован"))}
                      title={t("Скопировать")}
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 10.5, color: "var(--dim)", lineHeight: 1.6, margin: 0 }}>
                {t(
                  "Пока ни одного ключа. Выданные ключи появятся здесь и в профиле пользователя.",
                )}
              </p>
            )}
          </div>

          <div className="admin-card glass">
            <h3>{t("Связь")}</h3>
            <p className="sub">
              {t("Пользователь получает ключ автоматически, но может написать в Telegram.")}
            </p>
            <button className="btn btn-soft" onClick={() => void openExternal(TELEGRAM_URL)}>
              <ExternalLink size={13} /> @whofriends1
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestCard({
  request,
  busy,
  issuedKey,
  onApprove,
  onReject,
  onCopy,
}: {
  request: LicenseRequest;
  busy: boolean;
  issuedKey?: string;
  onApprove: () => void;
  onReject: () => void;
  onCopy: (value: string, title: string) => Promise<void>;
}) {
  const { t } = useStore();
  return (
    <div className="request-card">
      <div className="request-top">
        <Avatar name={request.nickname} src={request.avatarUrl} size={36} />
        <div className="who">
          <b>{request.nickname}</b>
          <span>
            {request.pluginTitle} · {timeAgo(request.createdAt)}
          </span>
        </div>
        <span className="req-status pending">{t("ждёт")}</span>
      </div>

      <div className="request-line">
        <KeyRound size={11} />
        <b className="mono" style={{ fontSize: 10 }}>
          {request.machineId}
        </b>
        <button
          className="row-icon"
          style={{ marginLeft: "auto", width: 24, height: 24 }}
          onClick={() => void onCopy(request.machineId, t("Machine ID скопирован"))}
        >
          <Copy size={11} />
        </button>
      </div>

      {issuedKey ? (
        <div className="license-active">
          <div className="top">
            <Check size={11} /> {t("Ключ выдан")}
          </div>
          <div className="key-box">{issuedKey}</div>
          <button
            className="btn btn-soft btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => void onCopy(issuedKey, t("Ключ скопирован"))}
          >
            <Copy size={11} /> {t("Скопировать ещё раз")}
          </button>
        </div>
      ) : (
        <div className="request-actions">
          <button className="btn btn-primary btn-sm" onClick={onApprove} disabled={busy}>
            {busy ? <Loader2 size={12} className="spin" /> : <KeyRound size={12} />}
            {t("Одобрить и выдать ключ")}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onReject} disabled={busy}>
            <X size={12} /> {t("Отклонить")}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void onCopy(request.machineId, t("Machine ID скопирован"))}
          >
            <Copy size={12} /> ID
          </button>
        </div>
      )}

      <div className="request-line" style={{ marginTop: 2 }}>
        <ShieldCheck size={10} /> product tag: {request.productTag}
      </div>
    </div>
  );
}
