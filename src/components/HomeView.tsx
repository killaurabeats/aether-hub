import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Cloud,
  Star,
  Unplug,
} from "lucide-react";
import type { Release, View } from "../types";
import { useStore } from "../lib/store";
import { descriptionFor, formatBytes } from "../lib/format";
import { openExternal, TELEGRAM_CHANNEL_URL } from "../lib/desktop";
import { cloudEnabled } from "../lib/cloud";
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
    licenses,
    catalogError,
    language,
    t,
  } = useStore();

  const featured = releases.find((r) => r.featured) ?? releases[0];
  const latest = useMemo(() => releases.slice(0, 6), [releases]);

  const avgRating = releases.length
    ? releases.reduce((total, r) => total + r.ratingAvg, 0) / releases.length
    : 0;

  return (
    <div className="page">
      {!cloudEnabled || catalogError ? (
        <div className="notice violet">
          <Unplug size={15} />
          <div style={{ flex: 1 }}>
            <b>{t("Локальный каталог.")}</b>{" "}
            {t(
              machine.os === "macos"
                ? "Приложение полностью работает, но рейтинги, комментарии и заявки сохраняются только на этом Mac."
                : "Приложение полностью работает, но рейтинги, комментарии и заявки сохраняются только на этом ПК.",
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
            {t("Ничего лишнего.")}
            <br />
            <em>{t("Только звук.")}</em>
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
                {t("Избранный релиз")} <ArrowRight size={14} />
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
        </div>
      </section>

      {featured ? (
        <>
          <div className="section-head">
            <div>
              <h2>{t("Избранный релиз")}</h2>
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
                {featured.tier === "beta" ? (
                  <span className="chip beta">BETA</span>
                ) : null}
                {featured.badge ? <span className="chip gold">{featured.badge}</span> : null}
                <span className="rating-pill">
                  <Star size={10} /> {featured.ratingAvg.toFixed(1)}
                </span>
              </div>
              <h3>{featured.title}</h3>
              <p>{descriptionFor(featured, language)}</p>
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
        </div>
        <button
          className="btn btn-soft btn-sm"
          onClick={() => void openExternal(TELEGRAM_CHANNEL_URL)}
          title="https://t.me/aetherplugins"
        >
          @aetherplugins <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}
