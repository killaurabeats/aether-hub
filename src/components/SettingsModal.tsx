import { useEffect, useState } from "react";
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
  LayoutGrid,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Volume2,
  X,
} from "lucide-react";
import { useStore } from "../lib/store";
import { copyText, formatBytes } from "../lib/format";
import { openExternal, openFolder } from "../lib/desktop";
import { cloudConfig, cloudEnabled, cloudAdminReady } from "../lib/cloud";
import { playIntro, setIntroVolume } from "../lib/sound";

export type SettingsSection = "sound" | "appearance" | "install" | "cloud" | "about";

const TABS: { id: SettingsSection; label: string; icon: typeof Volume2 }[] = [
  { id: "sound", label: "Звук", icon: Volume2 },
  { id: "appearance", label: "Вид", icon: LayoutGrid },
  { id: "install", label: "Установка", icon: Boxes },
  { id: "cloud", label: "Облако", icon: Cloud },
  { id: "about", label: "О приложении", icon: Info },
];

export function SettingsModal({
  onClose,
  initialSection = "sound",
}: {
  onClose: () => void;
  initialSection?: SettingsSection;
}) {
  const {
    settings,
    updateSettings,
    paths,
    admin,
    machine,
    licensingMachineId,
    installs,
    refreshCatalog,
    catalogLoading,
    resetDemo,
    pickFolder,
    toast,
    catalogSource,
  } = useStore();

  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [confirmReset, setConfirmReset] = useState(false);
  const [version, setVersion] = useState("1.1.0");

  useEffect(() => {
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<string>("app_version"))
      .then((value) => setVersion(value))
      .catch(() => undefined);
  }, []);

  const copy = async (value: string, title = "Скопировано") => {
    const ok = await copyText(value);
    toast({ kind: ok ? "success" : "error", title: ok ? title : "Не удалось скопировать" });
  };

  const urlHost = (() => {
    try {
      return new URL(cloudConfig.url).host;
    } catch {
      return "не задан";
    }
  })();

  const installedCount = Object.keys(installs).length;

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
            <h2>Настройки</h2>
            <div className="sub">Звук, папки, облако и приватность</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">
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
                <Icon size={12} /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="modal-scroll">
          <div className="settings-body">
            {section === "sound" ? (
              <>
                <div className="setting-row">
                  <div className="text">
                    <b>Звук заставки</b>
                    <span>
                      Глубокий студийный саунд-дизайн при запуске: воздушный пэд, тёплый саб и
                      хрустальный колокольчик.
                    </span>
                  </div>
                  <button
                    className={`toggle ${settings.soundEnabled ? "on" : ""}`}
                    onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                    aria-label="Звук заставки"
                  />
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>Громкость</b>
                    <span>Применяется к заставке и превью драм-китов.</span>
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
                      toast({ kind: "info", title: "Проигрываем интро" });
                    }}
                  >
                    <Play size={11} /> Тест
                  </button>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>Плавность и эффекты</b>
                    <span>
                      Отключает backdrop-blur и фоновые анимации. Полезно на слабых GPU — интерфейс
                      остаётся полностью рабочим.
                    </span>
                  </div>
                  <button
                    className={`toggle ${settings.reduceEffects ? "on" : ""}`}
                    onClick={() => updateSettings({ reduceEffects: !settings.reduceEffects })}
                    aria-label="Уменьшить эффекты"
                  />
                </div>

                <div className="notice violet" style={{ marginTop: 18, marginBottom: 0 }}>
                  <Info size={14} />
                  <div>
                    Все анимации построены на <b>transform/opacity</b> и композитятся на GPU.
                    Целевые 60–120 FPS достигаются без нагрузки на CPU.
                  </div>
                </div>
              </>
            ) : null}

            {section === "appearance" ? (
              <>
                <div className="setting-row">
                  <div className="text">
                    <b>Фон и неон</b>
                    <span>
                      Глубокий фиолетовый градиент, стеклянные панели и мягкое свечение —
                      фирменный стиль Aether.
                    </span>
                  </div>
                  <span className="chip violet">#0A0812 · #8B5CF6</span>
                </div>
                <div className="setting-row">
                  <div className="text">
                    <b>Режим экономии</b>
                    <span>Убирает размытие стекла и анимации фона, сохраняя оформление.</span>
                  </div>
                  <button
                    className={`toggle ${settings.reduceEffects ? "on" : ""}`}
                    onClick={() => updateSettings({ reduceEffects: !settings.reduceEffects })}
                  />
                </div>
                <div className="setting-row">
                  <div className="text">
                    <b>Плотность библиотеки</b>
                    <span>Сетка карточек автоматически подстраивается под ширину окна.</span>
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
              </>
            ) : null}

            {section === "install" ? (
              <>
                <div className="setting-row" style={{ alignItems: "flex-start" }}>
                  <div className="text">
                    <b>Пресеты FL Studio</b>
                    <span>
                      Сюда распаковываются пресет-паки. По умолчанию —{" "}
                      Documents/Image-Line/FL Studio/Presets/Aether Plugins.
                    </span>
                    <div className="path-box" style={{ marginTop: 8 }}>
                      <code>{settings.presetDir || paths.presetsDir}</code>
                      <button
                        className="row-icon"
                        onClick={() => void pickFolder("presetDir")}
                        title="Выбрать папку"
                      >
                        <FolderOpen size={13} />
                      </button>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void openFolder(settings.presetDir || paths.presetsDir)}
                  >
                    Открыть
                  </button>
                </div>

                <div className="setting-row" style={{ alignItems: "flex-start" }}>
                  <div className="text">
                    <b>Драм-киты</b>
                    <span>
                      Папка для сэмплов. Можно указать свою библиотеку — установщик создаст
                      подпапку с названием кита.
                    </span>
                    <div className="path-box" style={{ marginTop: 8 }}>
                      <code>{settings.drumkitDir || paths.drumkitsDir}</code>
                      <button
                        className="row-icon"
                        onClick={() => void pickFolder("drumkitDir")}
                        title="Выбрать папку"
                      >
                        <FolderOpen size={13} />
                      </button>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void openFolder(settings.drumkitDir || paths.drumkitsDir)}
                  >
                    Открыть
                  </button>
                </div>

                <div className="setting-row" style={{ alignItems: "flex-start" }}>
                  <div className="text">
                    <b>Плагины VST3 / AU</b>
                    <span>
                      Установка идёт в системные папки плагинов. На macOS это требует прав
                      пользователя, но не администратора.
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
                    <b>Журнал установок</b>
                    <span>
                      {installedCount} релизов · {formatBytes(
                        Object.values(installs).reduce((sum, item) => sum + item.sizeBytes, 0),
                      )}{" "}
                      на диске
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void openFolder(paths.appDataDir)}
                  >
                    <Database size={11} /> Данные
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
                        Да, сбросить демо
                      </button>
                      <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                        Отмена
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
                      <RotateCcw size={13} /> Сбросить демо-каталог
                    </button>
                  )}
                </div>
              </>
            ) : null}

            {section === "cloud" ? (
              <>
                <div className="setting-row">
                  <div className="text">
                    <b>Состояние облака</b>
                    <span>
                      {cloudEnabled
                        ? `Подключено к ${urlHost}. Каталог, оценки, комментарии и заявки синхронизируются.`
                        : "Supabase не настроен — используется локальный каталог и localStorage. Все функции интерфейса доступны."}
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
                    <b>Admin API</b>
                    <span>
                      {cloudAdminReady
                        ? "Токен админа присутствует в этой сборке. Публикация и модерация включены."
                        : "Токен админа отсутствует — эта сборка безопасна для публикации. Admin Studio работает локально и через приватный ключ."}
                    </span>
                  </div>
                  <span className={`chip ${cloudAdminReady ? "violet" : ""}`}>
                    {cloudAdminReady ? "ADMIN READY" : "READ ONLY"}
                  </span>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>Каталог</b>
                    <span>
                      Источник: {catalogSource === "cloud" ? "Supabase" : catalogSource === "cache" ? "локальный кэш" : "демо-каталог"} ·
                      обновляется при запуске и по кнопке.
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
                    Обновить
                  </button>
                </div>

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
                    <b style={{ fontSize: 11.5 }}>Подключение Supabase</b>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 10.5, color: "var(--dim)", lineHeight: 1.6 }}>
                    Создайте проект на supabase.com, выполните <code>supabase/schema.sql</code>,
                    задеплойте функцию <code>aether-admin</code> и впишите ключи в{" "}
                    <code>.env</code>. Затем пересоберите приложение. Подробная инструкция — в{" "}
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
                          "Конфиг скопирован",
                        )
                      }
                    >
                      <Copy size={11} /> Копировать конфиг
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void openExternal("https://supabase.com/dashboard")}
                    >
                      Открыть Supabase
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
                    <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 3 }}>
                      v{version} · Aether Plugins · by. @killaurabeats
                    </div>
                  </div>
                  <span className="chip violet" style={{ marginLeft: "auto" }}>
                    <ShieldCheck size={9} /> Tauri + React
                  </span>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>Платформа</b>
                    <span>
                      {machine.platformLabel} · {paths.arch} · HWID {machine.canonical.slice(0, 8)}…
                    </span>
                  </div>
                  <span className="chip">v{version}</span>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>Machine ID для лицензий</b>
                    <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                      {licensingMachineId}
                      {licensingMachineId !== machine.formatted
                        ? ` · автоматический ${machine.formatted}`
                        : ""}
                    </span>
                  </div>
                  <button
                    className="row-icon"
                    onClick={() => void copy(licensingMachineId, "Machine ID скопирован")}
                  >
                    <Copy size={13} />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>Ключ создателя</b>
                    <span>
                      {admin.enabled
                        ? "Приватный Ed25519 ключ найден. Панель создателя видна только на этом устройстве."
                        : "Не найден — админ-панель скрыта. Обычный пользователь видит только библиотеку."}
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
                  <span className={`chip ${admin.enabled ? "violet" : ""}`}>
                    {admin.enabled ? "CREATOR" : "USER"}
                  </span>
                </div>

                <div className="setting-row">
                  <div className="text">
                    <b>Хранилище приложения</b>
                    <span className="mono" style={{ fontSize: 9.5, wordBreak: "break-all" }}>
                      {paths.appDataDir}
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void openFolder(paths.appDataDir)}
                  >
                    <FolderOpen size={11} /> Открыть
                  </button>
                </div>

                <div className="settings-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => void openExternal("https://t.me/whofriends1")}
                  >
                    <ShieldCheck size={13} /> Telegram @whofriends1
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => void refreshCatalog()}
                    disabled={catalogLoading}
                  >
                    <RefreshCw size={13} className={catalogLoading ? "spin" : ""} /> Проверить
                    обновления
                  </button>
                </div>

                <p style={{ margin: "18px 0 0", fontSize: 9.5, color: "var(--dim)", lineHeight: 1.6 }}>
                  Каталог и релизы обновляются из облака — переустановка лаунчера не требуется.
                  Приложение не собирает телеметрию. Аватар хранится локально и в вашем профиле
                  Supabase.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
