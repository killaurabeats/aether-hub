import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Release, View } from "./types";
import { StoreProvider, useStore } from "./lib/store";
import { Background } from "./components/Background";
import { WindowChrome } from "./components/WindowChrome";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Splash } from "./components/Splash";
import { HomeView } from "./components/HomeView";
import { CategoryView, SearchResults } from "./components/CategoryView";
import { ReleaseModal } from "./components/ReleaseModal";
import { ProfileModal } from "./components/ProfileModal";
import {
  SettingsModal,
  type SettingsSection,
} from "./components/SettingsModal";
import { AdminStudio } from "./components/AdminStudio";
import { KeygenRequests } from "./components/KeygenRequests";
import { Toasts } from "./components/Toasts";

function initialView(): View {
  const hash = window.location.hash.replace("#", "").toLowerCase();
  if (hash === "plugins" || hash === "drumkits" || hash === "presets") {
    return { name: "category", category: hash };
  }
  if (hash === "admin") return { name: "admin" };
  if (hash === "keygen") return { name: "keygen" };
  return { name: "home" };
}

function Shell() {
  const {
    settings,
    admin,
    releases,
    refreshCatalog,
    refreshCloudUser,
    refreshAdminData,
    catalogLoading,
    toast,
  } = useStore();

  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const [splash, setSplash] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("sound");
  const [refreshing, setRefreshing] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selected = selectedId ? releases.find((release) => release.id === selectedId) ?? null : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 1900);
    return () => window.clearTimeout(timer);
  }, []);

  // Optional deep link: ?release=<slug> opens the release sheet.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("release");
    if (!slug || !releases.length) return;
    const release = releases.find((item) => item.slug === slug);
    if (release) setSelectedId(release.id);
  }, [releases]);

  useEffect(() => {
    if (!admin.enabled && (view.name === "admin" || view.name === "keygen")) {
      setView({ name: "home" });
    }
  }, [admin.enabled, view.name]);

  useEffect(() => {
    const onHash = () => setView(initialView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [view, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedId) return;
      setProfileOpen(false);
      setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const navigate = (next: View) => {
    setQuery("");
    setView(next);
  };

  const openRelease = (release: Release) => setSelectedId(release.id);

  const openSettings = (section: SettingsSection = "sound") => {
    setSettingsSection(section);
    setSettingsOpen(true);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshCatalog();
      await refreshCloudUser();
      if (admin.enabled) await refreshAdminData();
      toast({ kind: "info", title: "Каталог обновлён" });
    } finally {
      setRefreshing(false);
    }
  };

  const effectiveView: View = query.trim().length > 0 ? { name: "search", query } : view;

  const pageKey =
    effectiveView.name === "category"
      ? `category-${effectiveView.category}`
      : effectiveView.name;

  const content = (() => {
    switch (effectiveView.name) {
      case "home":
        return (
          <HomeView
            onNavigate={navigate}
            onOpenRelease={openRelease}
            onOpenSettings={() => openSettings("cloud")}
          />
        );
      case "category":
        return (
          <CategoryView category={effectiveView.category} onOpenRelease={openRelease} />
        );
      case "search":
        return <SearchResults query={effectiveView.query} onOpenRelease={openRelease} />;
      case "admin":
        return admin.enabled ? <AdminStudio /> : null;
      case "keygen":
        return admin.enabled ? <KeygenRequests /> : null;
      default:
        return null;
    }
  })();

  return (
    <div className={`app-shell ${settings.reduceEffects ? "reduce-effects" : ""}`}>
      <Background />
      <WindowChrome />

      <div className="app-body">
        <Sidebar
          view={effectiveView}
          onNavigate={navigate}
          onOpenSettings={() => openSettings("sound")}
        />

        <main className="main">
          <Topbar
            view={effectiveView}
            query={query}
            onQuery={setQuery}
            onOpenProfile={() => setProfileOpen(true)}
            onRefresh={() => void refresh()}
            refreshing={refreshing || catalogLoading}
          />

          <div className="content" ref={scrollRef}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pageKey}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              >
                {content}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {selected ? (
          <ReleaseModal key="release" release={selected} onClose={() => setSelectedId(null)} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {profileOpen ? <ProfileModal key="profile" onClose={() => setProfileOpen(false)} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen ? (
          <SettingsModal
            key="settings"
            initialSection={settingsSection}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <Toasts />

      <AnimatePresence>
        {splash ? <Splash key="splash" /> : null}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
