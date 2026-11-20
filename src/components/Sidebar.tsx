import { motion } from "framer-motion";
import {
  Boxes,
  Drum,
  Home,
  KeyRound,
  LifeBuoy,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Globe2,
  LockKeyhole,
} from "lucide-react";
import type { Category, View } from "../types";
import { useStore } from "../lib/store";
import { openExternal, TELEGRAM_URL } from "../lib/desktop";

interface Props {
  view: View;
  onNavigate: (view: View) => void;
  onOpenSettings: () => void;
}

const NAV = [
  { key: "home", label: "Главное меню", icon: Home },
  { key: "plugins", label: "Plugins", icon: Boxes },
  { key: "drumkits", label: "Drumkits", icon: Drum },
  { key: "presets", label: "Presets", icon: SlidersHorizontal },
] as const;

export function Sidebar({ view, onNavigate, onOpenSettings }: Props) {
  const { releases, admin, catalogSource, installs, requests, profile, t } = useStore();

  const counts = {
    plugins: releases.filter((r) => r.category === "plugins").length,
    drumkits: releases.filter((r) => r.category === "drumkits").length,
    presets: releases.filter((r) => r.category === "presets").length,
  };

  const pending = requests.filter((r) => r.status === "pending").length;
  const installedCount = Object.keys(installs).length;

  const isActive = (key: string) => {
    if (key === "home") return view.name === "home";
    return view.name === "category" && view.category === key;
  };

  const navigate = (key: string) => {
    if (key === "home") onNavigate({ name: "home" });
    else onNavigate({ name: "category", category: key as Category });
  };

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <motion.button
          className="logo-button"
          onClick={() => onNavigate({ name: "home" })}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          title={t("Главное меню")}
          aria-label={`Aether Hub — ${t("Главное меню")}`}
        >
          <img src="/logo.png" alt="" draggable={false} />
        </motion.button>
        <div className="brand-name">
          <strong>AETHER HUB</strong>
          <span>plugins · kits · presets</span>
        </div>
      </div>

      <div className="nav-group">
        <div className="nav-label">{t("Библиотека")}</div>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.key);
          const count = counts[item.key as keyof typeof counts];
          return (
            <button
              key={item.key}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => navigate(item.key)}
            >
              <Icon size={17} />
              <span>{t(item.label)}</span>
              {count ? <span className="nav-count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {admin.enabled ? (
        <div className="nav-group">
          <div className="nav-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LockKeyhole size={9} /> Creator mode
          </div>
          <button
            className={`nav-item ${
              view.name === "admin" || view.name === "keygen" ? "" : ""
            } ${view.name === "admin" ? "active" : ""}`}
            onClick={() => onNavigate({ name: "admin" })}
          >
            <Sparkles size={17} />
            <span>Admin Studio</span>
            <span className="nav-badge">LIVE</span>
          </button>
          <button
            className={`nav-item ${view.name === "keygen" ? "active" : ""}`}
            onClick={() => onNavigate({ name: "keygen" })}
          >
            <KeyRound size={17} />
            <span>Keygen & Requests</span>
            {pending ? <span className="nav-badge">{pending}</span> : null}
          </button>
        </div>
      ) : null}

      <div className="sidebar-spacer" />

      <div className="side-status">
        <div className="row">
          <span
            className={`status-dot ${
              admin.enabled ? "admin" : catalogSource === "cloud" ? "" : "offline"
            }`}
          />
          {admin.enabled ? "Creator mode" : catalogSource === "cloud" ? "Cloud linked" : "Local demo"}
          <span style={{ marginLeft: "auto", color: "var(--dim)", letterSpacing: "0.05em" }}>
            {profile.nickname.split(" ")[0]}
          </span>
        </div>
        <div className="hint">
          {admin.enabled
            ? t("Приватный ключ найден. Панель создателя активна.")
            : catalogSource === "cloud"
              ? t("Каталог синхронизирован с облаком.")
              : t("Облако не подключено — каталог работает локально.")}
        </div>
        <div className="hint" style={{ color: "var(--muted)" }}>
          {installedCount ? `${t("{count} установлено", { count: installedCount })} · ` : ""}v1.1.0
        </div>
      </div>

      <div className="side-actions">
        <button className="side-action" onClick={onOpenSettings}>
          <Settings2 size={14} />
          {t("Настройки")}
        </button>
        <button className="side-action" onClick={() => void openExternal(TELEGRAM_URL)}>
          <LifeBuoy size={14} />
          {t("Telegram")}
        </button>
      </div>
    </aside>
  );
}

export function CloudBadge({ source }: { source: "cloud" | "cache" | "demo" }) {
  if (source === "cloud") {
    return (
      <span className="chip green">
        <Globe2 size={9} /> CLOUD
      </span>
    );
  }
  return (
    <span className="chip gold">
      <ShieldCheck size={9} /> {source === "cache" ? "CACHE" : "DEMO"}
    </span>
  );
}
