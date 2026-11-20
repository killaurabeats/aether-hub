import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Check,
  Cloud,
  Copy,
  Download,
  HardDriveDownload,
  KeyRound,
  Music4,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Unplug,
} from "lucide-react";
import type { Release, View } from "../types";
import { useStore } from "../lib/store";
import { copyText, formatBytes } from "../lib/format";
import { openExternal, TELEGRAM_URL } from "../lib/desktop";
import { ReleaseCard } from "./ReleaseCard";
import { InstallButton } from "./InstallButton";

export function HomeView({
  onNavigate,
  onOpenRelease,
  onOpenSettings,
}: {
  onNavigate: (view: View) => void;
  onOpenRelease: (release: Release) => void;
  onOpenSettings: () => void;
}) {
  const {
    releases,
    installs,
    machine,
    licensingMachineId,
    settings,
    catalogSource,
    profile,
    licenses,
    toast,
    catalogError,
    t,
  } = useStore();

  const featured = releases.find((r) => r.featured) ?? releases[0];
  const latest = useMemo(() => releases.slice(0, 6), [releases]);
  const installedList = useMemo(
    () => releasesWithInstalls(releases, installs),
    [releases, installs],
  );

  const avgRating = releases.length
    ? releases.reduce((total, r) => total + r.ratingAvg, 0) / releases.length
    : 0;

  const copyMachine = async () => {
    const ok = await copyText(licensingMachineId);
    toast({
      kind: ok ? "success" : "error",
      title: ok ? t("Machine ID скопирован") : t("Не удалось скопировать"),
    });
  };

  return (
    <div className="page">
      {catalogSource !== "cloud" ? (
        <div className="notice violet">
          <Unplug size={15} />
          <div style={{ flex: 1 }}>
            <b>{t("Локальный каталог.")}</b>{" "}
            {t(
              "Приложение полностью работает, но рейтинги, комментарии и заявки сохраняются только на этом Mac.",
            )}{" "}
            <button className="ghost-link" onClick={onOpenSettings} style={{ fontSize: 11.5 }}>
              {t("Подключить Supabase")} <ArrowRight size={11} />
            </button>
            {catalogError ? (
              <span style={{ display: "block", marginTop: 4, color: "var(--dim)", fontSize: 10 }}>
                {catalogError.slice(0, 160)}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="hero glass">
        <div className="hero-copy">
          <span className="eyebrow">Aether Plugins · est. 2026</span>
          <h1>
            {t("Звук, который")}
            <br />
            <em>{t("не хочется трогать.")}</em>
          </h1>
          <p>
            {t(
              "Плагины, драм-киты и пресеты в одном приватном хабе. Установка в один клик, живые оценки, мгновенные обновления — без переустановки лаунчера.",
            )}
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => onNavigate({ name: "category", category: "plugins" })}
            >
              <Boxes size={15} /> {t("Смотреть плагины")}
            </button>
            {featured ? (
              <button className="btn btn-ghost btn-lg" onClick={() => onOpenRelease(featured)}>
                Featured drop <ArrowRight size={14} />
              </button>
            ) : null}
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <strong>{releases.length}</strong>
              <span>{t("релизов")}</span>
            </div>
            <div className="hero-stat">
              <strong>{Object.keys(installs).length}</strong>
              <span>{t("установлено")}</span>
            </div>
            <div className="hero-stat">
              <strong style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {avgRating.toFixed(1)} <Star size={13} style={{ color: "var(--gold)", fill: "var(--gold)" }} />
              </strong>
              <span>{t("рейтинг")}</span>
            </div>
            <div className="hero-stat">
              <strong>{licenses.length || "—"}</strong>
              <span>{t("лицензий")}</span>
            </div>
          </div>
        </div>

        <div className="hero-art">
          <div className="hero-orbit" />
          <motion.img
            src="/logo.png"
            className="hero-logo"
            alt="Aether eyes"
            initial={{ opacity: 0, scale: 0.92, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: -7 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            draggable={false}
          />
          <div className="hero-badge b1">
            <span className="status-dot" /> <b>ZERO-LATENCY</b> engine
          </div>
          <div className="hero-badge b2">
            <Download size={12} /> <b>1-click</b> install
          </div>
        </div>
      </section>

      {featured ? (
        <>
          <div className="section-head">
            <div>
              <h2>Featured drop</h2>
              <div className="sub">{t("Ручной выбор команды Aether")}</div>
            </div>
            <button className="link" onClick={() => onOpenRelease(featured)}>
              {t("Открыть")} <ArrowRight size={12} />
            </button>
          </div>
          <div
            className="featured glass"
            onClick={() => onOpenRelease(featured)}
            style={{ cursor: "pointer" }}
          >
            <div className="featured-cover">
              {featured.coverUrl ? <img src={featured.coverUrl} alt={featured.title} /> : null}
            </div>
            <div className="featured-body">
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span className="chip violet">
                  {featured.category === "plugins"
                    ? "Plugin"
                    : featured.category === "drumkits"
                      ? "Drumkit"
                      : "Presets"}
                </span>
                {featured.badge ? <span className="chip gold">{featured.badge}</span> : null}
                <span className="rating-pill">
                  <Star size={10} /> {featured.ratingAvg.toFixed(1)}
                </span>
              </div>
              <h3>{featured.title}</h3>
              <p>{featured.description}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
                <InstallButton release={featured} />
                <span className="file-meta">
                  <b>
                    {formatBytes(
                      featured.files[machine.os === "windows" ? "windows" : "macos"]?.sizeBytes,
                    )}
                  </b>
                  <span>
                    v{featured.version} ·{" "}
                    {featured.files[machine.os === "windows" ? "windows" : "macos"]
                      ? t("готово для {os}", { os: machine.platformLabel })
                      : t("другая ОС")}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="section-head">
        <div>
          <h2>{t("Свежие дропы")}</h2>
          <div className="sub">{t("Обновляется из облака при каждом запуске")}</div>
        </div>
        <button
          className="link"
          onClick={() => onNavigate({ name: "category", category: "plugins" })}
        >
          {t("Вся библиотека")} <ArrowRight size={12} />
        </button>
      </div>

      {releases.length ? (
        <div className="release-grid">
          {latest.map((release, index) => (
            <ReleaseCard key={release.id} release={release} onOpen={onOpenRelease} index={index} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="icon">
            <Cloud size={22} />
          </div>
          <h3>{t("Каталог пуст")}</h3>
          <p>{t("Нажмите «Обновить» сверху или опубликуйте первый релиз в Admin Studio.")}</p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 18,
          marginTop: 30,
        }}
      >
        <div className="glass" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <span className="icon" style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(232,121,249,.12)", color: "var(--pink)" }}>
              <KeyRound size={15} />
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t("Активация лицензии")}</div>
              <div style={{ fontSize: 10.5, color: "var(--dim)" }}>
                {settings.licenseMachineId
                  ? t("Machine ID для лицензий · из плагина")
                  : t("Machine ID для лицензий этого компьютера")}
              </div>
            </div>
            <span className="chip green" style={{ marginLeft: "auto" }}>
              <ShieldCheck size={9} /> HWID
            </span>
          </div>
          <div className="id-box">
            <span>{licensingMachineId}</span>
            <button onClick={() => void copyMachine()} title={t("Скопировать Machine ID")}>
              <Copy size={13} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button
              className="btn btn-soft btn-sm"
              onClick={() => {
                if (featured?.category === "plugins") onOpenRelease(featured);
                else {
                  const plugin = releases.find((r) => r.category === "plugins");
                  if (plugin) onOpenRelease(plugin);
                  else onOpenSettings();
                }
              }}
            >
              <KeyRound size={12} /> {t("Запросить ключ")}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => void openExternal(TELEGRAM_URL)}>
              @whofriends1
            </button>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 10.5, color: "var(--dim)", lineHeight: 1.55 }}>
            {t(
              "Ключ подписывает именно этот Machine ID. Пока админ не одобрит заявку, ключ появится в профиле со статусом «ожидает».",
            )}
          </p>
        </div>

        <div className="glass" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: "rgba(94,234,212,.1)",
                color: "var(--green)",
              }}
            >
              <HardDriveDownload size={15} />
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t("Установлено на этом Mac")}</div>
              <div style={{ fontSize: 10.5, color: "var(--dim)" }}>
                {t("{count} из {total} релизов", {
                  count: Object.keys(installs).length,
                  total: releases.length,
                })}
              </div>
            </div>
            <button className="ghost-link" style={{ marginLeft: "auto", fontSize: 11 }} onClick={onOpenSettings}>
              <Settings2 size={12} /> {t("Пути")}
            </button>
          </div>

          {installedList.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {installedList.slice(0, 4).map((release) => (
                <button
                  key={release.id}
                  onClick={() => onOpenRelease(release)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    background: "rgba(255,255,255,.02)",
                    textAlign: "left",
                  }}
                >
                  <span style={{ color: "var(--green)" }}>
                    <Check size={13} />
                  </span>
                  <span style={{ flex: 1, fontSize: 11.5 }}>{release.title}</span>
                  <span style={{ fontSize: 9.5, color: "var(--dim)" }}>
                    v{installs[release.slug]?.version}
                  </span>
                  <ArrowRight size={12} style={{ color: "var(--dim)" }} />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: "18px 0 8px", fontSize: 11.5, color: "var(--dim)", lineHeight: 1.6 }}>
              {t(
                "Пока ничего не установлено. Откройте любой релиз и нажмите «Установить» — файлы встанут в системные папки автоматически.",
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate({ name: "category", category: "drumkits" })}
            >
              <Music4 size={12} /> {t("Драм-киты")}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate({ name: "category", category: "presets" })}
            >
              <Sparkles size={12} /> {t("Пресеты")}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 26,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 20px",
          borderRadius: 16,
          border: "1px solid var(--line)",
          background: "rgba(255,255,255,.02)",
        }}
      >
        <img
          src="/logo.png"
          alt=""
          style={{ width: 38, height: 38, borderRadius: 11, objectFit: "cover" }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600 }}>Aether Plugins · by. @killaurabeats</div>
          <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>
            {t(
              "Обновления каталога приходят из облака. Сам лаунчер переустанавливать не нужно.",
            )}
          </div>
        </div>
        <span className="chip">
          <ShieldCheck size={9} /> {profile.nickname}
        </span>
        <button className="btn btn-soft btn-sm" onClick={() => void openExternal(TELEGRAM_URL)}>
          {t("Telegram")} <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

function releasesWithInstalls(releases: Release[], installs: Record<string, unknown>) {
  return releases.filter((release) => Boolean(installs[release.slug]));
}
