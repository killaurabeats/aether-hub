import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import {
  Apple,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FolderOpen,
  KeyRound,
  Loader2,
  MessageSquare,
  Monitor,
  Send,
  Pencil,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { Release } from "../types";
import { CATEGORY_META } from "../types";
import { isTauri, useStore } from "../lib/store";
import { copyText, descriptionFor, formatBytes, formatDate, timeAgo } from "../lib/format";
import { openFolder } from "../lib/desktop";
import { Avatar } from "./Avatar";
import { Stars } from "./Stars";
import { InstallButton } from "./InstallButton";

export function ReleaseModal({
  release,
  onClose,
}: {
  release: Release;
  onClose: () => void;
}) {
  const {
    machine,
    licensingMachineId,
    updateSettings,
    refreshCloudUser,
    comments,
    myRatings,
    licenses,
    requests,
    profile,
    adminVisible,
    installs,
    progress,
    loadComments,
    loadMyRating,
    postComment,
    removeComment,
    rate,
    requestKey,
    uninstall,
    toast,
    language,
    install,
    t,
  } = useStore();

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [idEditing, setIdEditing] = useState(false);
  const [idDraft, setIdDraft] = useState(licensingMachineId);
  const [downloadingOs, setDownloadingOs] = useState<"macos" | "windows" | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const list = comments[release.id];
  const myRating = myRatings[release.id] ?? 0;
  const record = installs[release.slug];
  const job = progress[release.slug];

  const productTag = release.productTag || "AETHER-VOCAL-STRIP";
  const license = licenses.find((item) => item.productTag === productTag);
  const pending = requests.find(
    (item) => item.productTag === productTag && item.status === "pending",
  );
  const approvedRequest = requests.find(
    (item) => item.productTag === productTag && item.status === "approved" && item.key,
  );
  const activeKey = license?.key || approvedRequest?.key || null;

  useEffect(() => {
    void loadComments(release.id);
    void loadMyRating(release.id);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadComments, loadMyRating, onClose, release.id]);

  useEffect(() => {
    if (license?.key) return;
    const timer = window.setInterval(() => void refreshCloudUser(), 20_000);
    return () => window.clearInterval(timer);
  }, [license?.key, refreshCloudUser]);

  const meta = CATEGORY_META[release.category];
  const file = release.files[machine.os === "windows" ? "windows" : "macos"];
  const otherFile = release.files[machine.os === "windows" ? "macos" : "windows"];

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    await postComment(release, draft);
    setDraft("");
    setSending(false);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const copy = async (value: string, title: string) => {
    const ok = await copyText(value);
    toast({
      kind: ok ? "success" : "error",
      title: ok ? title : t("Не удалось скопировать"),
    });
  };

  const avgLabel = release.ratingAvg.toFixed(1);
  const currentOs = machine.os === "windows" ? "windows" : "macos";

  const downloadFor = async (os: "macos" | "windows") => {
    const target = release.files[os];
    if (!target) return;
    if (!isTauri) {
      toast({ kind: "info", title: t("Скачивание доступно в приложении") });
      return;
    }

    setDownloadingOs(os);
    try {
      const path = await invoke<string>("download_release", {
        request: {
          url: target.url,
          filename: target.filename || `${release.slug}-${os}.zip`,
          title: release.title,
        },
      });
      toast({
        kind: "success",
        title: t("Скачано"),
        message: t("Файл сохранён в {path}", { path }),
      });
    } catch (error) {
      toast({ kind: "error", title: t("Скачать не удалось"), message: String(error) });
    } finally {
      setDownloadingOs(null);
    }
  };

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.985 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="modal-scroll">
          <div className="detail-hero">
            {release.coverUrl ? (
              <img src={release.coverUrl} alt={release.title} draggable={false} />
            ) : (
              <div style={{ height: "100%", background: "linear-gradient(140deg,#22163c,#0a0714)" }} />
            )}

            <button className="modal-close" onClick={onClose} aria-label={t("Закрыть")} style={{ position: "absolute", top: 14, right: 14, zIndex: 5, background: "rgba(10,7,18,.55)", backdropFilter: "blur(10px)" }}>
              <X size={15} />
            </button>

            <div className="detail-hero-content">
              <div className="titles">
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span className="chip violet">{meta.singular}</span>
                  {release.badge ? <span className="chip gold">{release.badge}</span> : null}
                  {record ? (
                    <span className="chip green">
                      <Check size={9} /> {t("Установлено").toLowerCase()}
                    </span>
                  ) : null}
                </div>
                <h1>{release.title}</h1>
                <div className="detail-meta">
                  <span className="mono">v{release.version}</span>
                  <span className="dot" />
                  <span>
                    <Star size={11} style={{ color: "var(--gold)", fill: "var(--gold)" }} />
                    {avgLabel} · {release.ratingCount} {t("оценок")}
                  </span>
                  <span className="dot" />
                  <span>{formatBytes(file?.sizeBytes)}</span>
                  <span className="dot" />
                  <span>{file ? machine.platformLabel : t("сборка для другой ОС")}</span>
                  {release.createdAt ? (
                    <>
                      <span className="dot" />
                      <span>{formatDate(release.createdAt)}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <InstallButton release={release} size="lg" />
            </div>
          </div>

          <div className="detail-body">
            <div className="detail-main">
              <p className="detail-desc">{descriptionFor(release, language)}</p>

              <div className="install-panel">
                {release.category === "plugins" ? (
                  <>
                    <div className="install-panel-top">
                      <div>
                        <div className="label">{t("Выберите платформу")}</div>
                        <div className="value">{t("Установите сборку для нужной ОС")}</div>
                      </div>
                      <span className="chip green">
                        <ShieldCheck size={9} /> VST3 + AU / VST3
                      </span>
                    </div>

                    <div className="platform-grid">
                      {(["macos", "windows"] as const).map((os) => {
                        const platformFile = release.files[os];
                        const isCurrent = os === currentOs;
                        const osLabel = os === "macos" ? "macOS" : "Windows";
                        const isInstalled =
                          isCurrent && record && record.version === release.version;
                        const isUpdating = isCurrent && record && !isInstalled;
                        const busy = downloadingOs === os || (isCurrent && Boolean(job));

                        return (
                          <div
                            className={`platform-card ${isCurrent ? "current" : ""} ${
                              platformFile ? "" : "disabled"
                            }`}
                            key={os}
                          >
                            <div className="platform-head">
                              <span className="platform-icon">
                                {os === "macos" ? <Apple size={15} /> : <Monitor size={15} />}
                              </span>
                              {isCurrent ? (
                                <span className="platform-recommend">
                                  {t("Рекомендуется для вашей ОС")}
                                </span>
                              ) : (
                                <span className="platform-recommend muted">
                                  {t("Для другой ОС")}
                                </span>
                              )}
                            </div>
                            <div className="platform-title">{osLabel}</div>
                            <div className="platform-sub">
                              {os === "macos" ? "VST3 + AU" : "VST3"}
                              {platformFile ? ` · ${formatBytes(platformFile.sizeBytes)}` : ""}
                            </div>

                            <button
                              className={`btn ${isCurrent && !isInstalled ? "btn-primary" : "btn-ghost"} btn-sm platform-button`}
                              disabled={!platformFile || busy || Boolean(isInstalled)}
                              onClick={() => {
                                if (!platformFile) return;
                                if (isCurrent) {
                                  if (!isInstalled) void install(release);
                                } else {
                                  void downloadFor(os);
                                }
                              }}
                            >
                              {busy ? (
                                <Loader2 size={12} className="spin" />
                              ) : isInstalled ? (
                                <Check size={12} />
                              ) : isCurrent && isUpdating ? null : (
                                <Download size={12} />
                              )}
                              {!platformFile
                                ? t("Нет сборки")
                                : busy
                                  ? isCurrent
                                    ? t("Установка…")
                                    : t("Скачивание…")
                                  : isInstalled
                                    ? t("Установлено")
                                    : isCurrent && isUpdating
                                      ? t("Обновить")
                                      : isCurrent
                                        ? t("Установить для {os}", { os: osLabel })
                                        : t("Скачать для {os}", { os: osLabel })}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="install-panel-top">
                      <div>
                        <div className="label">{t("Установка в 1 клик")}</div>
                        <div className="value">
                          {release.category === "presets"
                            ? "FL Studio → Presets / Aether Plugins"
                            : t("Сэмплы → выбранная папка")}
                        </div>
                      </div>
                      <InstallButton release={release} />
                    </div>

                    <div className="file-row">
                      <Download size={11} />
                      {file ? (
                        <>
                          {machine.platformLabel} · {formatBytes(file.sizeBytes)} ·{" "}
                          {file.filename || "release.zip"}
                        </>
                      ) : (
                        <>{t("Сборка для {os} ещё не загружена", { os: machine.platformLabel })}</>
                      )}
                    </div>

                    {otherFile ? (
                      <div className="file-row" style={{ opacity: 0.65 }}>
                        <Download size={11} />
                        {machine.os === "windows" ? "macOS" : "Windows"} ·{" "}
                        {formatBytes(otherFile.sizeBytes)} · {t("для другой ОС")}
                      </div>
                    ) : null}
                  </>
                )}

                {record ? (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "var(--dim)" }}>
                      {t("Установлено {time}", { time: timeAgo(record.installedAt) })}
                    </span>
                    <button
                      className="ghost-link"
                      style={{ fontSize: 10.5 }}
                      onClick={() => void openFolder(record.paths[0] ?? "")}
                    >
                      <FolderOpen size={11} /> {t("Открыть папку")}
                    </button>
                    {confirmUninstall ? (
                      <>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={async () => {
                            await uninstall(release);
                            setConfirmUninstall(false);
                          }}
                        >
                          {t("Точно удалить")}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setConfirmUninstall(false)}
                        >
                          {t("Отмена")}
                        </button>
                      </>
                    ) : (
                      <button
                        className="ghost-link"
                        style={{ fontSize: 10.5, color: "var(--dim)" }}
                        onClick={() => setConfirmUninstall(true)}
                      >
                        <Trash2 size={11} /> {t("Удалить")}
                      </button>
                    )}
                  </div>
                ) : null}

                {job ? (
                  <div className="card-progress" style={{ marginTop: 10 }}>
                    {job.message || job.phase}
                    <span className="pct">{Math.round(job.percent)}%</span>
                  </div>
                ) : null}
              </div>

              <div className="rating-block">
                <h3>{t("Оценка релиза")}</h3>
                <p>
                  {myRating
                    ? t("Спасибо — ваша оценка уже учтена.")
                    : t("Поставьте от 1 до 5 звёзд, чтобы поддержать релиз.")}
                </p>
                <div className="rating-row">
                  <span className="rating-score">
                    {avgLabel}
                    <span>★</span>
                  </span>
                  <Stars
                    value={myRating}
                    onChange={(value) => void rate(release, value)}
                    size={19}
                  />
                  <span style={{ fontSize: 10.5, color: "var(--dim)" }}>
                    {myRating
                      ? t("{count} оценок · ваша {mine} ★", {
                          count: release.ratingCount,
                          mine: myRating,
                        })
                      : t("{count} оценок", { count: release.ratingCount })}
                  </span>
                </div>
              </div>

              {release.category === "plugins" && (release.tier ?? "free") === "pro" ? (
                <div className="license-card">
                  <h3>
                    <KeyRound size={14} /> {t("Лицензия Aether")}
                  </h3>
                  <p className="hint">
                    {t(
                      "Ключ подписывает Machine ID этого компьютера. Он не переносится на другое устройство и проверяется плагином каждые 7 секунд.",
                    )}
                  </p>

                  {idEditing ? (
                    <div className="field" style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={idDraft}
                          onChange={(event) => setIdDraft(event.target.value)}
                          placeholder={t("Machine ID из окна плагина")}
                          style={{ fontFamily: "var(--mono)", fontSize: 11 }}
                          spellCheck={false}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={async () => {
                            updateSettings({ licenseMachineId: idDraft.trim() || null });
                            await refreshCloudUser();
                            setIdEditing(false);
                            toast({ kind: "success", title: t("Machine ID обновлён") });
                          }}
                        >
                          OK
                        </button>
                      </div>
                      <span className="hint">
                        {t(
                          "Если плагин показывает другой ID — вставьте его сюда. Пустое поле вернёт автоматический HWID.",
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="id-box">
                      <span>{licensingMachineId}</span>
                      <button
                        onClick={() => void copy(licensingMachineId, t("Machine ID скопирован"))}
                        title={t("Скопировать Machine ID")}
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setIdDraft(licensingMachineId);
                          setIdEditing(true);
                        }}
                        title={t("Указать ID из плагина")}
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}

                  {activeKey ? (
                    <div className="license-active">
                      <div className="top">
                        <ShieldCheck size={12} /> {t("Лицензия активна")}
                      </div>
                      <div className="key-box">{activeKey}</div>
                      <div className="license-actions">
                        <button
                          className="btn btn-soft btn-sm"
                          onClick={() => void copy(activeKey, t("Ключ скопирован"))}
                        >
                          <Copy size={11} /> {t("Скопировать ключ")}
                        </button>
                        <span style={{ fontSize: 9.5, color: "var(--dim)", alignSelf: "center" }}>
                          {t("Вставьте его в окно активации плагина")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {pending ? (
                        <div className="request-status">
                          <span className="status-dot offline" />{" "}
                          {t("Заявка отправлена — ждём одобрения")}
                        </div>
                      ) : null}

                      <div className="license-actions">
                        <button
                          className="btn btn-soft btn-sm"
                          onClick={() => void requestKey(release)}
                          disabled={Boolean(pending)}
                        >
                          <KeyRound size={11} />
                          {pending ? t("Заявка на рассмотрении") : t("Запросить ключ активации")}
                        </button>
                      </div>
                      {profile.nickname ? (
                        <p style={{ margin: "10px 0 0", fontSize: 9.5, color: "var(--dim)" }}>
                          {t("Заявка уйдёт от имени {name}.", { name: profile.nickname })}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {release.category === "plugins" && (release.tier ?? "free") === "free" ? (
                <div className="license-card">
                  <h3>
                    <ShieldCheck size={14} /> {t("FREE · лицензия не требуется")}
                  </h3>
                  <p className="hint">
                    {t(
                      "Этот плагин бесплатный. Лицензия создаётся автоматически при установке и записывается в папку плагина — никаких заявок и ожиданий.",
                    )}
                  </p>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 8,
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(94,234,212,.22)",
                      background: "rgba(94,234,212,.07)",
                      color: "var(--green)",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={12} /> {t("FREE ACCESS")}
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="detail-side">
              <div className="comments-head">
                <h3>
                  <MessageSquare size={12} style={{ verticalAlign: -2, marginRight: 5 }} />
                  {t("Комментарии")}
                </h3>
                <span>{list?.length ?? 0}</span>
              </div>

              <div className="comments-list" ref={listRef}>
                {!list ? (
                  <div className="comments-empty">{t("Загружаем комментарии…")}</div>
                ) : list.length ? (
                  list.map((comment) => (
                    <div className="comment" key={comment.id}>
                      <Avatar name={comment.nickname} src={comment.avatarUrl} size={28} />
                      <div className="comment-body">
                        <div className="comment-top">
                          <b>{comment.nickname}</b>
                          <span>{timeAgo(comment.createdAt)}</span>
                        </div>
                        <p>{comment.body}</p>
                      </div>
                      {adminVisible ? (
                        <button
                          className="comment-del"
                          onClick={() => void removeComment(release.id, comment.id)}
                          title={t("Удалить комментарий")}
                        >
                          <Trash2 size={11} />
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="comments-empty">
                    {t("Пока тихо. Оставьте первый комментарий — это увидят все.")}
                  </div>
                )}
              </div>

              <div className="comment-form">
                <Avatar name={profile.nickname} src={profile.avatarUrl} size={30} />
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t("Написать комментарий…")}
                  maxLength={1200}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <button className="send-btn" onClick={() => void send()} disabled={!draft.trim() || sending} aria-label={t("Отправить")}>
                  <Send size={14} />
                </button>
              </div>
            </aside>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
