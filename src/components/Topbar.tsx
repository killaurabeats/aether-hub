import {
  ChevronDown,
  RefreshCw,
  Search,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { View } from "../types";
import { CATEGORY_META } from "../types";
import { useStore } from "../lib/store";
import { stopIntro } from "../lib/sound";

interface Props {
  view: View;
  query: string;
  onQuery: (value: string) => void;
  onOpenProfile: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

function headingFor(
  view: View,
  nickname: string,
  t: (text: string, vars?: Record<string, string | number>) => string,
): { eyebrow: string; title: string } {
  switch (view.name) {
    case "home":
      return { eyebrow: "Aether Hub", title: t("С возвращением, {name}", { name: nickname }) };
    case "category":
      return {
        eyebrow:
          view.category === "plugins"
            ? "Aether Hub · instruments & effects"
            : view.category === "drumkits"
              ? "Aether Hub · samples"
              : "Aether Hub · FL Studio",
        title: t("Библиотека"),
      };
    case "search":
      return { eyebrow: "Aether Hub", title: t("Поиск") };
    case "admin":
      return { eyebrow: "Creator mode · private", title: t("Публикация") };
    case "keygen":
      return { eyebrow: "Creator mode · licences", title: t("Лицензии") };
    default:
      return { eyebrow: "Aether Hub", title: "Aether" };
  }
}

export function Topbar({ view, query, onQuery, onOpenProfile, onRefresh, refreshing }: Props) {
  const { profile, adminVisible, settings, updateSettings, t } = useStore();
  const heading = headingFor(view, profile.nickname.split(" ")[0] || "aether", t);

  return (
    <header className="topbar">
      <div className="page-heading">
        <span className="eyebrow">{heading.eyebrow}</span>
        <h1>{heading.title}</h1>
      </div>

      <div className="topbar-spacer" />

      <div className="search-box">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t("Поиск по хабу…")}
          aria-label={t("Поиск")}
          spellCheck={false}
        />
        {query ? (
          <button onClick={() => onQuery("")} aria-label={t("Очистить")} style={{ display: "grid" }}>
            <X size={13} />
          </button>
        ) : null}
      </div>

      <button
        className="icon-button"
        onClick={() => {
          const next = !settings.soundEnabled;
          updateSettings({ soundEnabled: next });
          if (!next) stopIntro(false);
        }}
        title={settings.soundEnabled ? t("Выключить звук") : t("Включить звук")}
        aria-label={t("Звук")}
      >
        {settings.soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>

      <button
        className="icon-button"
        onClick={onRefresh}
        title={t("Обновить каталог")}
        aria-label={t("Обновить каталог")}
        disabled={refreshing}
      >
        <RefreshCw size={15} className={refreshing ? "spin" : ""} />
      </button>

      <button className="profile-chip" onClick={onOpenProfile} aria-label={t("Профиль")}>
        <span className="avatar s32">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : (profile.nickname[0] || "A").toUpperCase()}
        </span>
        <span className="nick">{profile.nickname || "aether user"}</span>
        {adminVisible ? <ShieldCheck size={13} style={{ color: "var(--pink)" }} /> : null}
        <ChevronDown size={13} />
      </button>
    </header>
  );
}
