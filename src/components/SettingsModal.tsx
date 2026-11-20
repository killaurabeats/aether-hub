import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Boxes,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  FolderOpen,
  Info,
  KeyRound,
  Languages,
  LayoutGrid,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Volume2,
  X,
} from "lucide-react";
import { useStore } from "../lib/store";
import { copyText, formatBytes } from "../lib/format";
import { openExternal, openFolder } from "../lib/desktop";
import { cloudConfig, cloudEnabled } from "../lib/cloud";
import { checkCloudHealth, type CloudHealth } from "../lib/cloudHealth";
import { playIntro, setIntroVolume, stopIntro } from "../lib/sound";

export type SettingsSection = "general" | "appearance" | "install" | "cloud" | "about";

const TABS: { id: SettingsSection; label: string; icon: typeof Volume2 }[] = [
  { id: "general", label: "Общие", icon: Settings2 },
  { id: "appearance", label: "Вид", icon: LayoutGrid },
  { id: "install", label: "Установка", icon: Boxes },
  { id: "cloud", label: "Облако", icon: Cloud },
  { id: "about", label: "О приложении", icon: Info },
];

export function SettingsModal({
  onClose,
  initialSection = "general",
  onAdminUnlocked,
}: {
  onClose: () => void;
  initialSection?: SettingsSection;
  onAdminUnlocked: () => void;
}) {
  const {
    settings,
    updateSettings,
    paths,
    admin,
    adminVisible,
    adminTokenReady,
    adminTokenBaked,
    unlockAdminToken,
    lockAdminToken,
    machine,
    licensingMachineId,
    installs,
    refreshCatalog,
    catalogLoading,
    resetDemo,
    pickFolder,
    toast,
    catalogSource,
    t,
  } = useStore();

  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [confirmReset, setConfirmReset] = useState(false);
  const [version, setVersion] = useState("1.1.0");
  const [health, setHealth] = useState<CloudHealth | null>(null);
  const [checkingCloud, setCheckingCloud] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const [secretValue, setSecretValue] = useState("");
  const [secretBusy, setSecretBusy] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const versionClicks = useRef({ count: 0, last: 0 });

  const handleVersionClick = () => {
    const now = Date.now();
    if (now - versionClicks.current.last > 700) versionClicks.current.count = 0;
    versionClicks.current.last = now;
    versionClicks.current.count += 1;
    if (versionClicks.current.count >= 5) {
      versionClicks.current.count = 0;
      setSecretValue("");
      setSecretError(null);
      setSecretOpen(true);
    }
  };

  const submitSecret = async () => {
    setSecretBusy(true);
    setSecretError(null);
    const result = await unlockAdminToken(secretValue);
    setSecretBusy(false);
    if (!result.ok) {
      setSecretError(result.error ? `${t("Неверный ключ")} · ${result.error}` : t("Неверный ключ"));
      return;
    }
    setSecretOpen(false);
    setSecretValue("");
    onAdminUnlocked();
  };

  const runHealthCheck = async () => {
    setCheckingCloud(true);
    try {
      setHealth(await checkCloudHealth());
    } finally {
      setCheckingCloud(false);
    }
  };

  useEffect(() => {
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<string>("app_version"))
      .then((value) => setVersion(value))
      .catch(() => undefined);
  }, []);

  const copy = async (value: string, title?: string) => {
    const ok = await copyText(value);
    toast({
      kind: ok ? "success" : "error",
      title: ok ? title ?? t("Скопировано") : t("Не удалось скопировать"),
    });
  };

  const urlHost = (() => {
    try {
      return new URL(cloudConfig.url).host;
    } catch {
      return "—";
    }
  })();

  const installedCount = Object.keys(installs).length;
  const totalInstalledSize = Object.values(installs).reduce(
    (sum, item) => sum + item.sizeBytes,
    0,
  );

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
        className="modal medium"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.99 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="modal-head">
          <div>
            <h2>{t("Настройки")}</h2>
            <div className="sub">{t("Звук, папки, облако и приватность")}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t("Закрыть")}>
            <X size={15} />
          </button>
        </div>

        <div className="segmented" style={{ margin: "14px 22px 0", flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={section === tab.id ? "active" : ""}
                onClick={() => setSection(tab.id)}
              >
                <Icon size={12} /> {t(tab.label)}
              </button>
            );
          })}
        </div>

        <div className="modal-scroll">
          <div className="settings-body">
            {section === "general" ? (
              <>
                <div className="setting-row">
                  <div className="text">
                    <b>
                      <Languages size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                      {t("Язык / Language")}
                    </b>
                    <span>{t("Мгновенно переключает весь интерфейс лаунчера.")}</span>
                  </div>
                  <div className="segmented" style={{ margin: 0 }}>
                    {(["ru", "en"] as const).map((lang) => (
                      <button
                        key={lang}
                        className={settings.language === lang ? "active" : ""}
                        onClick={() => updateSettings({ language: lang })}
                        aria-label={lang === "ru" ? t("Русский") : "English"}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Звук заставки")}</b>
                    <span>
                      {t(
                        "Глубокий студийный саунд-дизайн при запуске: мягкий аккорд Am9, тёплый саб и бархатный хвост. Громкость — ровно −15 dBFS.",
                      )}
                    </span>
                  </div>
                  <button
                    className={`toggle ${settings.soundEnabled ? "on" : ""}`}
                    onClick={() => {
                      const next = !settings.soundEnabled;
                      updateSettings({ soundEnabled: next });
                      if (!next) stopIntro(false);
                    }}
                    aria-label={t("Звук заставки")}
                  />
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Громкость")}</b>
                    <span>{t("Применяется к заставке и превью драм-китов.")}</span>
                  </div>
                  <input
                    className="slider"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.soundVolume * 100)}
                    onChange={(event) => {
                      const volume = Number(event.target.value) / 100;
                      updateSettings({ soundVolume: volume });
                      setIntroVolume(volume);
                    }}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      playIntro(settings.soundVolume || 0.6);
                      toast({ kind: "info", title: t("Проигрываем интро") });
                    }}
                  >
                    <Play size={11} /> {t("Тест")}
                  </button>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Эффекты стекла / Glass Blur")}</b>
                    <span>
                      {t(
                        "Включает размытие фона на карточках и всплывающих окнах. Выключите для максимального FPS на слабых GPU: размытие заменится на плотные тёмные градиенты.",
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="chip">{settings.glassBlur ? t("Включено") : t("Выключено")}</span>
                    <button
                      className={`toggle ${settings.glassBlur ? "on" : ""}`}
                      onClick={() => updateSettings({ glassBlur: !settings.glassBlur })}
                      aria-label={t("Эффекты стекла / Glass Blur")}
                    />
                  </div>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Анимации фона")}</b>
                    <span>
                      {t(
                        "Медленный дрейф неоновых пятен и парящий логотип. Отключите для экономии батареи.",
                      )}
                    </span>
                  </div>
                  <button
                    className={`toggle ${!settings.reduceEffects ? "on" : ""}`}
                    onClick={() => updateSettings({ reduceEffects: !settings.reduceEffects })}
                    aria-label={t("Анимации фона")}
                  />
                </div>

                <div className="notice violet" style={{ marginTop: 18, marginBottom: 0 }}>
                  <Info size={14} />
                  <div>
                    {t(
                      "Все анимации построены на transform/opacity и композитятся на GPU. Целевые 60–120 FPS достигаются без нагрузки на CPU.",
                    )}
                  </div>
                </div>

                <p style={{ margin: "14px 0 0", fontSize: 10, color: "var(--dim)" }}>
                  {t("Параметры сохраняются автоматически в localStorage.")}
                </p>
              </>
            ) : null}

            {section === "appearance" ? (
              <>
                <div className="setting-row">
                  <div className="text">
                    <b>{t("Фон и неон")}</b>
                    <span>
                      {t(
                        "Глубокий фиолетовый градиент, стеклянные панели и мягкое свечение — фирменный стиль Aether.",
                      )}
                    </span>
                  </div>
                  <span className="chip violet">#0A0812 · #8B5CF6</span>
                </div>
                <div className="setting-row">
                  <div className="text">
                    <b>{t("Плотность библиотеки")}</b>
                    <span>{t("Сетка карточек автоматически подстраивается под ширину окна.")}</span>
                  </div>
                  <span className="chip">adaptive</span>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 8,
                  }}
                >
                  {["#0A0812", "#120E22", "#8B5CF6", "#C4B5FD"].map((color) => (
                    <div
                      key={color}
                      style={{
                        height: 54,
                        borderRadius: 10,
                        background: color,
                        border: "1px solid rgba(255,255,255,.1)",
                        display: "grid",
                        placeItems: "end center",
                        paddingBottom: 7,
                        fontSize: 8,
                        letterSpacing: ".08em",
                        color: color === "#C4B5FD" ? "#241a3d" : "rgba(255,255,255,.6)",
                      }}
                    >
                      {color}
                    </div>
                  ))}
                </div>

                <div className="notice violet" style={{ marginTop: 18, marginBottom: 0 }}>
                  <Info size={14} />
                  <div>
                    {t(
                      "Для максимального FPS отключите «Эффекты стекла» на вкладке «Общие» — интерфейс заменит blur на плотные тёмные градиенты.",
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {section === "install" ? (
              <>
                <div className="setting-row" style={{ alignItems: "flex-start" }}>
                  <div className="text">
                    <b>{t("Пресеты FL Studio")}</b>
                    <span>
                      {t(
                        "Сюда распаковываются пресет-паки. По умолчанию — Documents/Image-Line/FL Studio/Presets/Aether Plugins.",
                      )}
                    </span>
                    <div className="path-box" style={{ marginTop: 8 }}>
                      <code>{settings.presetDir || paths.presetsDir}</code>
                      <button
                        className="row-icon"
                        onClick={() => void pickFolder("presetDir")}
                        title={t("Выбрать папку")}
                      >
                        <FolderOpen size={13} />
                      </button>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void openFolder(settings.presetDir || paths.presetsDir)}
                  >
                    {t("Открыть")}
                  </button>
                </div>

                <div className="setting-row" style={{ alignItems: "flex-start" }}>
                  <div className="text">
                    <b>{t("Драм-киты")}</b>
                    <span>
                      {t(
                        "Папка для сэмплов. Можно указать свою библиотеку — установщик создаст подпапку с названием кита.",
                      )}
                    </span>
                    <div className="path-box" style={{ marginTop: 8 }}>
                      <code>{settings.drumkitDir || paths.drumkitsDir}</code>
                      <button
                        className="row-icon"
                        onClick={() => void pickFolder("drumkitDir")}
                        title={t("Выбрать папку")}
                      >
                        <FolderOpen size={13} />
                      </button>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void openFolder(settings.drumkitDir || paths.drumkitsDir)}
                  >
                    {t("Открыть")}
                  </button>
                </div>

                <div className="setting-row" style={{ alignItems: "flex-start" }}>
                  <div className="text">
                    <b>{t("Плагины VST3 / AU")}</b>
                    <span>
                      {t(
                        "Установка идёт в системные папки плагинов. На macOS это требует прав пользователя, но не администратора.",
                      )}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                      <code style={{ fontSize: 9.5, color: "var(--dim)" }}>{paths.vst3Dir}</code>
                      <code style={{ fontSize: 9.5, color: "var(--dim)" }}>
                        {paths.componentsDir}
                      </code>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void openFolder(paths.vst3Dir)}
                  >
                    VST3
                  </button>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Журнал установок")}</b>
                    <span>
                      {t("{count} релизов · {size} на диске", {
                        count: installedCount,
                        size: formatBytes(totalInstalledSize),
                      })}
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void openFolder(paths.appDataDir)}
                  >
                    <Database size={11} /> {t("Данные")}
                  </button>
                </div>

                <div className="settings-actions">
                  {confirmReset ? (
                    <>
                      <button
                        className="btn btn-danger"
                        onClick={async () => {
                          await resetDemo();
                          setConfirmReset(false);
                        }}
                      >
                        {t("Да, сбросить демо")}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                        {t("Отмена")}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
                      <RotateCcw size={13} /> {t("Сбросить демо-каталог")}
                    </button>
                  )}
                </div>
              </>
            ) : null}

            {section === "cloud" ? (
              <>
                <div className="setting-row">
                  <div className="text">
                    <b>{t("Состояние облака")}</b>
                    <span>
                      {cloudEnabled
                        ? t("Подключено к {host}. Каталог, оценки, комментарии и заявки синхронизируются.", {
                            host: urlHost,
                          })
                        : t(
                            "Supabase не настроен — используется локальный каталог и localStorage. Все функции интерфейса доступны.",
                          )}
                    </span>
                  </div>
                  <span className={`chip ${cloudEnabled ? "green" : "gold"}`}>
                    {cloudEnabled ? (
                      <>
                        <CheckCircle2 size={9} /> LINKED
                      </>
                    ) : (
                      "LOCAL"
                    )}
                  </span>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Admin API")}</b>
                    <span>
                      {adminTokenReady
                        ? t(
                            "Токен админа активен на этом ПК. Публикация и модерация включены.",
                          )
                        : t(
                            "Токен админа не задан — эта сборка безопасна для публикации. Admin Studio работает локально и через приватный ключ.",
                          )}
                    </span>
                  </div>
                  <span className={`chip ${adminTokenReady ? "violet" : ""}`}>
                    {adminTokenReady ? "ADMIN READY" : "READ ONLY"}
                  </span>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Каталог")}</b>
                    <span>
                      {t("Источник: {source} · обновляется при запуске и по кнопке.", {
                        source:
                          catalogSource === "cloud"
                            ? t("Supabase")
                            : catalogSource === "cache"
                              ? t("локальный кэш")
                              : t("демо-каталог"),
                      })}
                    </span>
                  </div>
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={() => void refreshCatalog()}
                    disabled={catalogLoading}
                  >
                    {catalogLoading ? (
                      <Loader2 size={12} className="spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    {t("Обновить")}
                  </button>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Таблицы и Storage")}</b>
                    <span>
                      {health
                        ? t("Проверено: {time}", {
                            time: new Date(health.checkedAt).toLocaleTimeString(),
                          })
                        : t("Проверьте, что схема supabase/schema.sql применена к проекту.")}
                    </span>
                  </div>
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={() => void runHealthCheck()}
                    disabled={checkingCloud || !cloudEnabled}
                  >
                    {checkingCloud ? (
                      <Loader2 size={12} className="spin" />
                    ) : (
                      <Database size={12} />
                    )}
                    {t("Проверить")}
                  </button>
                </div>

                {health ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginBottom: 18,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--line)",
                      background: "rgba(5,4,10,.35)",
                    }}
                  >
                    {[...health.tables, health.bucket].map((item) => (
                      <div
                        key={item.key}
                        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5 }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 99,
                            flexShrink: 0,
                            background:
                              item.status === "ok" || item.status === "secured"
                                ? "var(--green, #4ade80)"
                                : "var(--gold, #f0b429)",
                          }}
                        />
                        <code style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{item.key}</code>
                        <span style={{ marginLeft: "auto", color: "var(--dim)" }}>
                          {item.status === "ok"
                            ? t("доступна")
                            : item.status === "secured"
                              ? t("защищена · RPC")
                              : item.status === "missing"
                                ? t("не найдена")
                                : item.detail ?? t("ошибка")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  style={{
                    marginTop: 18,
                    padding: 16,
                    borderRadius: 14,
                    border: "1px solid var(--line)",
                    background: "rgba(5,4,10,.35)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <KeyRound size={13} style={{ color: "var(--violet)" }} />
                    <b style={{ fontSize: 11.5 }}>{t("Подключение Supabase")}</b>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 10.5, color: "var(--dim)", lineHeight: 1.6 }}>
                    {t("Создайте проект на supabase.com, выполните")} <code>supabase/schema.sql</code>,{" "}
                    {t("задеплойте функцию")} <code>aether-admin</code>{" "}
                    {t("и впишите ключи в")} <code>.env</code>.{" "}
                    {t("Затем пересоберите приложение. Подробная инструкция — в")}{" "}
                    <code>README.md</code>.
                  </p>
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 9,
                      background: "rgba(255,255,255,.03)",
                      border: "1px solid var(--line)",
                      fontFamily: "var(--mono)",
                      fontSize: 9.5,
                      lineHeight: 1.7,
                      color: "var(--muted)",
                      userSelect: "text",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_AETHER_ADMIN_TOKEN=...   # only on your Mac`}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        void copy(
                          `VITE_SUPABASE_URL=${cloudConfig.url || "https://xxxx.supabase.co"}\nVITE_SUPABASE_ANON_KEY=${
                            cloudConfig.anonKey || "eyJhbGciOi..."
                          }`,
                          t("Конфиг скопирован"),
                        )
                      }
                    >
                      <Copy size={11} /> {t("Копировать конфиг")}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void openExternal("https://supabase.com/dashboard")}
                    >
                      {t("Открыть Supabase")}
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {section === "about" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                  <img
                    src="/logo.png"
                    alt=""
                    style={{ width: 64, height: 64, borderRadius: 17, objectFit: "cover" }}
                  />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 620 }}>Aether Hub</div>
                    <div
                      onClick={handleVersionClick}
                      style={{
                        fontSize: 10.5,
                        color: "var(--dim)",
                        marginTop: 3,
                        userSelect: "none",
                        cursor: "default",
                      }}
                    >
                      v{version} · Aether Plugins · by. @killaurabeats
                    </div>
                  </div>
                  <span className="chip violet" style={{ marginLeft: "auto" }}>
                    <ShieldCheck size={9} /> Tauri + React
                  </span>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Платформа")}</b>
                    <span>
                      {machine.platformLabel} · {paths.arch} · HWID {machine.canonical.slice(0, 8)}…
                    </span>
                  </div>
                  <span
                    className="chip"
                    onClick={handleVersionClick}
                    style={{ userSelect: "none", cursor: "default" }}
                  >
                    v{version}
                  </span>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Machine ID для лицензий")}</b>
                    <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                      {licensingMachineId}
                      {licensingMachineId !== machine.formatted
                        ? ` · ${t("автоматический HWID")} ${machine.formatted}`
                        : ""}
                    </span>
                  </div>
                  <button
                    className="row-icon"
                    onClick={() => void copy(licensingMachineId, t("Machine ID скопирован"))}
                    title={t("Скопировать Machine ID")}
                  >
                    <Copy size={13} />
                  </button>
                </div>

                {adminVisible ? (
                <div className="setting-row">
                    <div className="text">
                      <b>{t("Ключ создателя")}</b>
                      <span>
                        {admin.enabled
                          ? t(
                              "Приватный Ed25519 ключ найден. Панель создателя видна только на этом устройстве.",
                            )
                          : adminTokenReady
                            ? t(
                                "Admin Token активен на этом ПК — Admin Studio и Support Tickets открыты.",
                              )
                            : t(
                                "Не найден — админ-панель скрыта. Обычный пользователь видит только библиотеку.",
                              )}
                      </span>
                      {admin.privateKeyPath ? (
                        <code
                          style={{
                            display: "block",
                            marginTop: 6,
                            fontSize: 9,
                            color: "var(--dim)",
                            wordBreak: "break-all",
                            userSelect: "text",
                          }}
                        >
                          {admin.privateKeyPath}
                        </code>
                      ) : null}
                    </div>
                    <span className={`chip ${admin.enabled || adminTokenReady ? "violet" : ""}`}>
                      {admin.enabled ? "CREATOR" : adminTokenReady ? "ADMIN TOKEN" : "USER"}
                    </span>
                  </div>
  
                  ) : null}

                <div className="setting-row">
                  <div className="text">
                    <b>{t("Хранилище приложения")}</b>
                    <span className="mono" style={{ fontSize: 9.5, wordBreak: "break-all" }}>
                      {paths.appDataDir}
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void openFolder(paths.appDataDir)}
                  >
                    <FolderOpen size={11} /> {t("Открыть")}
                  </button>
                </div>

                <div className="settings-actions" style={{ justifyContent: "flex-start" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => void refreshCatalog()}
                    disabled={catalogLoading}
                  >
                    <RefreshCw size={13} className={catalogLoading ? "spin" : ""} />{" "}
                    {t("Проверить обновления")}
                  </button>
                </div>

                <p style={{ margin: "18px 0 0", fontSize: 9.5, color: "var(--dim)", lineHeight: 1.6 }}>
                  {t(
                    "Каталог и релизы обновляются из облака — переустановка лаунчера не требуется. Приложение не собирает телеметрию. Аватар хранится локально и в вашем профиле Supabase.",
                  )}
                </p>
              </>
            ) : null}
          </div>
        </div>
      </motion.div>

      {secretOpen ? (
        <div
          className="modal-backdrop"
          style={{ zIndex: 140 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSecretOpen(false);
          }}
        >
          <div className="modal narrow">
            <div className="modal-head">
              <div>
                <h2>{t("Ключ создателя (Admin Token)")}</h2>
                <div className="sub">{t("Скрытый вход в админ-панель на этом ПК")}</div>
              </div>
              <button
                className="modal-close"
                onClick={() => setSecretOpen(false)}
                aria-label={t("Закрыть")}
              >
                <X size={15} />
              </button>
            </div>
            <div className="modal-scroll" style={{ padding: "18px 20px 20px" }}>
              <div className="field">
                <label>ADMIN_TOKEN</label>
                <input
                  type="password"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={secretValue}
                  placeholder="AETHER_…"
                  onChange={(event) => {
                    setSecretValue(event.target.value);
                    if (secretError) setSecretError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && secretValue.trim() && !secretBusy) {
                      void submitSecret();
                    }
                  }}
                />
                <div className="hint">
                  {t(
                    "Ключ сохраняется только в localStorage этого ПК и не попадает в публичную сборку.",
                  )}
                </div>
                {secretError ? (
                  <div style={{ fontSize: 10.5, color: "#ff8d8d", lineHeight: 1.5 }}>
                    {secretError}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 16,
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                {adminTokenReady && !adminTokenBaked ? (
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      lockAdminToken();
                      setSecretOpen(false);
                    }}
                  >
                    {t("Удалить ключ")}
                  </button>
                ) : null}
                <button className="btn btn-ghost" onClick={() => setSecretOpen(false)}>
                  {t("Отмена")}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => void submitSecret()}
                  disabled={secretBusy || !secretValue.trim()}
                >
                  {secretBusy ? (
                    <Loader2 size={12} className="spin" />
                  ) : (
                    <KeyRound size={12} />
                  )}{" "}
                  {t("Включить админ-режим")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
