import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import type { Release, View } from "./types";
import { StoreProvider, useStore } from "./lib/store";
import { Background } from "./components/Background";
import { WindowChrome } from "./components/WindowChrome";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Splash } from "./components/Splash";
import { HomeView } from "./components/HomeView";
import { CategoryView, SearchResults } from "./components/CategoryView";
import { SamplesView } from "./components/SamplesView";
import { ReleaseModal } from "./components/ReleaseModal";
import { ProfileModal } from "./components/ProfileModal";
import {
  SettingsModal,
  type SettingsSection,
} from "./components/SettingsModal";
import { AdminStudio } from "./components/AdminStudio";
import { KeygenRequests } from "./components/KeygenRequests";
import { SupportTickets } from "./components/SupportTickets";
import { Toasts } from "./components/Toasts";
import { SupportModal } from "./components/SupportModal";
import { UpdateModal } from "./components/UpdateModal";
import { getVersion } from "@tauri-apps/api/app";
import {
  checkForUpdate,
  installerUrlFor,
  isUpdaterAvailable,
  isVersionNewer,
  type UpdateCandidate,
  type UpdateCheckStatus,
} from "./lib/updater";
import { fetchLauncherNotice, subscribeLauncherNotice } from "./lib/cloud";

function initialView(): View {
  const hash = window.location.hash.replace("#", "").toLowerCase();
  if (hash === "plugins" || hash === "drumkits" || hash === "presets") {
    return { name: "category", category: hash };
  }
  if (hash === "samples") return { name: "samples" };
  if (hash === "admin") return { name: "admin" };
  if (hash === "keygen") return { name: "keygen" };
  return { name: "home" };
}

function Shell() {
  const {
    settings,
    admin,
    adminVisible,
    adminTokenReady,
    machine,
    releases,
    refreshCatalog,
    refreshCloudUser,
    refreshAdminData,
    catalogLoading,
    toast,
    t,
  } = useStore();

  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const [splash, setSplash] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [refreshing, setRefreshing] = useState(false);
  const [update, setUpdate] = useState<UpdateCandidate | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateCheckStatus | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selected = selectedId ? releases.find((release) => release.id === selectedId) ?? null : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 3200);
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
    const blockedAdminView =
      !adminVisible ||
      (view.name === "keygen" && !admin.enabled) ||
      (view.name === "tickets" && !adminTokenReady);
    if (blockedAdminView && (view.name === "admin" || view.name === "keygen" || view.name === "tickets")) {
      setView({ name: "home" });
    }
  }, [admin.enabled, adminTokenReady, adminVisible, view.name]);

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
      setSupportOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const navigate = (next: View) => {
    setQuery("");
    setView(next);
  };

  const openRelease = (release: Release) => setSelectedId(release.id);

  const openSettings = (section: SettingsSection = "general") => {
    setSettingsSection(section);
    setSettingsOpen(true);
  };

  const handleAdminUnlocked = () => {
    setSettingsOpen(false);
    setView({ name: "admin" });
  };

  const checkUpdates = useCallback(
    async (silent = false) => {
      if (!isUpdaterAvailable()) {
        setUpdateStatus({
          currentVersion: "",
          latestVersion: null,
          error: t("Автообновление доступно только в приложении"),
          checkedAt: new Date().toISOString(),
          source: "none",
        });
        if (!silent) {
          toast({
            kind: "info",
            title: t("Автообновление доступно в приложении"),
            message: t("Запустите установленную версию Aether Hub для проверки обновлений."),
          });
        }
        return;
      }

      setCheckingUpdate(true);
      const currentVersion = await getVersion()
        .catch(() => invoke<string>("app_version"))
        .catch(() => "");

      let nativeUpdate: Awaited<ReturnType<typeof checkForUpdate>> = null;
      let nativeError: string | null = null;
      try {
        nativeUpdate = await checkForUpdate();
      } catch (error) {
        nativeError = String(error);
      }

      const notice = await fetchLauncherNotice().catch(() => null);
      const serverVersion = nativeUpdate?.version || notice?.latestVersion || null;
      const newer =
        Boolean(serverVersion) &&
        Boolean(currentVersion) &&
        isVersionNewer(String(serverVersion), currentVersion);

      setUpdateStatus({
        currentVersion,
        latestVersion: serverVersion,
        error: nativeError,
        checkedAt: new Date().toISOString(),
        source: nativeUpdate ? "native" : newer ? "config" : "none",
      });

      if (nativeUpdate) {
        setUpdate({
          version: nativeUpdate.version,
          currentVersion: nativeUpdate.currentVersion || currentVersion,
          body: nativeUpdate.body,
          native: nativeUpdate,
          source: "native",
        });
        setUpdateOpen(true);
        if (!silent) {
          toast({
            kind: "info",
            title: t("Доступно обновление v{version}", { version: nativeUpdate.version }),
            message: nativeUpdate.body || "",
          });
        }
      } else if (newer && serverVersion) {
        // Built-in updater failed or returned nothing, but Supabase knows a
        // newer public release. Open the modal with a direct installer link.
        setUpdate({
          version: String(serverVersion),
          currentVersion,
          body: notice?.notice || "",
          downloadUrl: installerUrlFor(String(serverVersion), machine.os),
          source: "config",
        });
        setUpdateOpen(true);
        if (!silent) {
          toast({
            kind: "info",
            title: t("Доступно обновление v{version}", { version: serverVersion }),
            message: t("Откроем страницу загрузки установщика для вашей ОС."),
          });
        }
      } else {
        setUpdateOpen(false);
        if (nativeError) {
          if (!silent) {
            toast({
              kind: "error",
              title: t("Не удалось проверить обновления"),
              message: nativeError,
            });
          }
        } else if (!silent) {
          toast({
            kind: "success",
            title: t("Обновлений нет"),
            message: t("Установлена последняя версия Aether Hub."),
          });
        }
      }

      setCheckingUpdate(false);
    },
    [machine.os, t, toast],
  );

  // Check for updates only after the startup intro has finished (or was
  // skipped), then let the modal animate in front of the user automatically.
  useEffect(() => {
    if (splash || !isUpdaterAvailable()) return;
    const timer = window.setTimeout(() => void checkUpdates(true), 450);
    return () => window.clearTimeout(timer);
  }, [checkUpdates, splash]);

  // Supabase Realtime: react immediately when an admin publishes a new
  // `app_config.latest_launcher_version` instead of waiting for a relaunch.
  useEffect(() => {
    if (splash || !isUpdaterAvailable()) return;
    const unsubscribe = subscribeLauncherNotice((notice) => {
      if (!notice.latestVersion) return;
      void checkUpdates(true);
    });
    return unsubscribe ?? undefined;
  }, [checkUpdates, splash]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshCatalog();
      await refreshCloudUser();
      if (adminVisible) await refreshAdminData();
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
            onOpenSettings={() => openSettings(adminVisible ? "cloud" : "general")}
          />
        );
      case "category":
        return (
          <CategoryView category={effectiveView.category} onOpenRelease={openRelease} />
        );
      case "search":
        return <SearchResults query={effectiveView.query} onOpenRelease={openRelease} />;
      case "samples":
        return <SamplesView />;
      case "admin":
        return adminVisible ? <AdminStudio /> : null;
      case "keygen":
        return adminVisible ? <KeygenRequests /> : null;
      case "tickets":
        return adminVisible ? <SupportTickets /> : null;
      default:
        return null;
    }
  })();

  return (
    <div
      className={`app-shell theme-${settings.theme} ${
        settings.reduceEffects ? "reduce-effects" : ""
      } ${settings.glassBlur ? "" : "no-blur"}`}
    >
      <Background />
      <WindowChrome />

      <div className="app-body">
        <Sidebar
          view={effectiveView}
          onNavigate={navigate}
          onOpenSupport={() => setSupportOpen(true)}
        />

        <main className="main">
          <Topbar
            view={effectiveView}
            query={query}
            onQuery={setQuery}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenSettings={() => openSettings("general")}
            onRefresh={() => void refresh()}
            onNavigate={navigate}
            onOpenRelease={(slug) => {
              const release = releases.find((item) => item.slug === slug);
              if (release) openRelease(release);
            }}
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
          <ReleaseModal
            key="release"
            release={selected}
            onClose={() => setSelectedId(null)}
            onOpenProfile={() => setProfileOpen(true)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {profileOpen ? <ProfileModal key="profile" onClose={() => setProfileOpen(false)} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {supportOpen ? <SupportModal key="support" onClose={() => setSupportOpen(false)} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen ? (
          <SettingsModal
            key="settings"
            initialSection={settingsSection}
            onClose={() => setSettingsOpen(false)}
            onAdminUnlocked={handleAdminUnlocked}
            onCheckUpdates={() => void checkUpdates(false)}
            checkingUpdate={checkingUpdate}
            updateStatus={updateStatus}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {updateOpen && update ? (
          <UpdateModal
            key="update"
            update={update}
            onClose={() => setUpdateOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <Toasts />

      <AnimatePresence>
        {splash ? <Splash key="splash" onSkip={() => setSplash(false)} /> : null}
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
