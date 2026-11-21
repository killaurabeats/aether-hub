import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { useStore } from "../lib/store";
import { copyText, formatDate, timeAgo } from "../lib/format";
import { openExternal, TELEGRAM_URL } from "../lib/desktop";
import { cloudEnabled, fetchBetaStatus, redeemBetaInvite } from "../lib/cloud";
import { Avatar } from "./Avatar";
import { AvatarCropper } from "./AvatarCropper";

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const {
    profile,
    machine,
    licensingMachineId,
    licenses,
    requests,
    admin,
    adminView,
    adminTokenReady,
    adminVisible,
    setAdminView,
    saveProfile,
    updateSettings,
    refreshCloudUser,
    toast,
    t,
  } = useStore();

  const [nickname, setNickname] = useState(profile.nickname);
  const [avatar, setAvatar] = useState<string | null>(profile.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [idEditing, setIdEditing] = useState(false);
  const [idDraft, setIdDraft] = useState(licensingMachineId);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [betaTester, setBetaTester] = useState(false);
  const [betaLoading, setBetaLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [activating, setActivating] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cropUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (cropUrlRef.current) URL.revokeObjectURL(cropUrlRef.current);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setBetaLoading(true);
    void fetchBetaStatus(licensingMachineId).then((value) => {
      if (alive) setBetaTester(value);
    }).finally(() => {
      if (alive) setBetaLoading(false);
    });
    return () => { alive = false; };
  }, [licensingMachineId]);

  const activateBeta = async () => {
    if (!inviteCode.trim() || activating) return;
    setActivating(true);
    const result = await redeemBetaInvite(inviteCode, licensingMachineId);
    setActivating(false);
    if (result.ok) {
      setBetaTester(true);
      setInviteCode("");
      await refreshCloudUser();
      toast({ kind: "success", title: t("BETA TESTER активирован") });
    } else {
      toast({
        kind: "error",
        title: t("Не удалось активировать инвайт"),
        message:
          result.error === "already_used"
            ? t("Этот код уже использован на другом устройстве.")
            : result.error === "not_found"
              ? t("Код не найден.")
              : result.error || "",
      });
    }
  };

  const closeCropper = () => {
    if (cropUrlRef.current) {
      URL.revokeObjectURL(cropUrlRef.current);
      cropUrlRef.current = null;
    }
    setCropperSrc(null);
  };

  const pickAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ kind: "error", title: t("Нужен файл изображения") });
      return;
    }
    if (cropUrlRef.current) URL.revokeObjectURL(cropUrlRef.current);
    const url = URL.createObjectURL(file);
    cropUrlRef.current = url;
    setCropperSrc(url);
  };

  const save = async () => {
    setSaving(true);
    await saveProfile({ nickname: nickname.trim() || "aether user", avatarUrl: avatar });
    setSaving(false);
  };

  const copy = async (value: string, title: string) => {
    const ok = await copyText(value);
    toast({ kind: ok ? "success" : "error", title: ok ? title : t("Не удалось скопировать") });
  };

  return (
    <>
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
        className="modal medium"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.99 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="modal-head">
          <div>
            <h2>{t("Профиль")}</h2>
            <div className="sub">{t("Ник, аватар и лицензии Aether")}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t("Закрыть")}>
            <X size={15} />
          </button>
        </div>

        <div className="modal-scroll">
          <div className="profile-body">
            <div className="profile-top">
              <div className="avatar-edit" onClick={() => fileRef.current?.click()}>
                <Avatar name={nickname || "aether"} src={avatar} size={96} />
                {betaTester ? (
                  <span
                    className="chip beta"
                    style={{
                      position: "absolute",
                      bottom: -11,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 3,
                      fontSize: 8,
                      letterSpacing: "0.12em",
                    }}
                  >
                    BETA
                  </span>
                ) : null}
                <div className="overlay">
                  <Camera size={20} />
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    pickAvatar(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              <div className="profile-fields">
                <div className="field">
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {t("Никнейм")}
                    {betaTester ? (
                      <span
                        className="chip beta"
                        style={{ letterSpacing: "0.12em", fontWeight: 700 }}
                      >
                        <ShieldCheck size={9} /> BETA TESTER
                      </span>
                    ) : null}
                  </label>
                  <input
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    maxLength={32}
                    placeholder="aether user"
                  />
                  <span className="hint">
                    {t(
                      "Нажмите на аватар, чтобы открыть редактор. Итог - квадрат 256 × 256 px.",
                    )}
                  </span>
                </div>

                {!betaTester && cloudEnabled && !betaLoading ? (
                  <div className="field" style={{ marginTop: 10 }}>
                    <label>{t("Инвайт-код Beta Tester")}</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={inviteCode}
                        onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                        placeholder="AETHER-BETA-XXXX"
                        spellCheck={false}
                        style={{ fontFamily: "var(--mono)" }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => void activateBeta()}
                        disabled={activating || !inviteCode.trim()}
                      >
                        {activating ? (
                          <Loader2 size={12} className="spin" />
                        ) : (
                          <ShieldCheck size={12} />
                        )}
                        {t("Активировать")}
                      </button>
                    </div>
                    <span className="hint">
                      {t("Одноразовый код привязывается к вашему Machine ID.")}
                    </span>
                  </div>
                ) : null}
              </div>
              <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                {t("Сохранить")}
              </button>
            </div>

            <div className="profile-section">
              <div className="profile-section-head">
                <h3>
                  <ShieldCheck size={13} /> Machine ID
                </h3>
                {adminVisible ? <span className="chip gold">ADMIN</span> : null}
              </div>
              {idEditing ? (
                <div className="field">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={idDraft}
                      onChange={(event) => setIdDraft(event.target.value)}
                      placeholder={t("XXXX-XXXX-… из окна плагина")}
                      spellCheck={false}
                      style={{ fontFamily: "var(--mono)" }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        updateSettings({ licenseMachineId: idDraft.trim() || null });
                        await refreshCloudUser();
                        setIdEditing(false);
                        toast({ kind: "success", title: t("Machine ID для лицензий обновлён") });
                      }}
                    >
                      {t("Сохранить")}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setIdEditing(false)}>
                      {t("Отмена")}
                    </button>
                  </div>
                  <span className="hint">
                    {t(
                      "Вставьте Machine ID, который показывает плагин в окне активации. Пустое значение - автоматический HWID этого компьютера.",
                    )}
                  </span>
                </div>
              ) : (
                <div className="id-box">
                  <span>{licensingMachineId}</span>
                  <button onClick={() => void copy(licensingMachineId, t("Machine ID скопирован"))}>
                    <Copy size={13} />
                  </button>
                  <button onClick={() => { setIdDraft(licensingMachineId); setIdEditing(true); }} title={t("Указать ID из плагина")}>
                    <Pencil size={12} />
                  </button>
                </div>
              )}
              {licensingMachineId !== machine.formatted ? (
                <span className="hint" style={{ display: "block", marginTop: 6 }}>
                  {t("Используется ID из плагина. Автоматический HWID: {id}", {
                    id: machine.formatted,
                  })}
                </span>
              ) : null}
            </div>

            {admin.enabled || adminTokenReady ? (
              <div className="profile-section">
                <div className="profile-section-head">
                  <h3>
                    <ShieldCheck size={13} /> {t("Режим интерфейса")}
                  </h3>
                  <span>{t("только для админа")}</span>
                </div>
                <div className="profile-mode-grid">
                  <div className="profile-mode-copy">
                    <b>{t("Текущий режим")}</b>
                    <span>
                      {t(
                        "Режим «Юзер» прячет Admin Studio и показывает хаб глазами обычного пользователя.",
                      )}
                    </span>
                  </div>
                  <div className="segmented profile-mode-switch">
                    <button
                      className={adminView === "admin" ? "active" : ""}
                      onClick={() => {
                        setAdminView("admin");
                        toast({ kind: "info", title: t("Режим админа включён") });
                      }}
                    >
                      {t("Админ")}
                    </button>
                    <button
                      className={adminView === "user" ? "active" : ""}
                      onClick={() => {
                        setAdminView("user");
                        toast({ kind: "info", title: t("Режим пользователя включён") });
                      }}
                    >
                      {t("Юзер")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="profile-section">
              <div className="profile-section-head">
                <h3>
                  <KeyRound size={13} /> {t("Мои лицензии")}
                </h3>
                <span>
                  {cloudEnabled ? t("синхронизировано с облаком") : t("локальный демо-режим")}
                </span>
              </div>

              {licenses.length ? (
                licenses.map((license) => (
                  <div className="license-item" key={license.id}>
                    <div className="top">
                      <b>{license.pluginTitle || license.productTag}</b>
                      <span>{formatDate(license.issuedAt)}</span>
                    </div>
                    <div className="keyline">
                      <code>{license.key}</code>
                      <button
                        className="row-icon"
                        onClick={() => void copy(license.key, t("Ключ скопирован"))}
                        title={t("Скопировать ключ")}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="notice violet" style={{ marginBottom: 0 }}>
                  <KeyRound size={14} />
                  <div>
                    {t(
                      "Пока нет выданных ключей. Откройте плагин и нажмите «Запросить ключ активации» - после одобрения ключ появится здесь автоматически.",
                    )}
                  </div>
                </div>
              )}

              {requests.length ? (
                <div style={{ marginTop: 12 }}>
                  <div className="profile-section-head">
                    <h3 style={{ fontSize: 11, color: "var(--muted)" }}>{t("Заявки")}</h3>
                  </div>
                  {requests.map((request) => (
                    <div className="req-item" key={request.id}>
                      <div className="info">
                        <b>{request.pluginTitle}</b>
                        <span>
                          {timeAgo(request.createdAt)} · {request.machineId}
                        </span>
                      </div>
                      <span className={`req-status ${request.status}`}>
                        {request.status === "pending"
                          ? t("ожидает")
                          : request.status === "approved"
                            ? t("одобрено")
                            : t("отклонено")}
                      </span>
                      {request.key ? (
                        <button
                          className="row-icon"
                          onClick={() => void copy(request.key!, t("Ключ скопирован"))}
                          title={t("Скопировать ключ")}
                        >
                          <Copy size={12} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="profile-section">
              <div className="profile-section-head">
                <h3>
                  <Mail size={13} /> {t("Связь")}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--dim)", lineHeight: 1.6 }}>
                {t("Вопросы по лицензии, приватные дропы и поддержка - Telegram")}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => void openExternal(TELEGRAM_URL)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={12}
                    height={12}
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                  </svg>
                  @whofriends1
                </button>
                <span className="chip violet">v1.3.4</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
    {cropperSrc ? (
      <AvatarCropper
        src={cropperSrc}
        onCancel={closeCropper}
        onApply={(dataUrl) => {
          setAvatar(dataUrl);
          closeCropper();
        }}
      />
    ) : null}
    </>
  );
}
