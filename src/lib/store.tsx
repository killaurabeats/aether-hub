import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type {
  AdminStatus,
  AppPaths,
  Category,
  Comment,
  InstallProgress,
  InstallRecord,
  Installs,
  License,
  LicenseRequest,
  MachineInfo,
  Profile,
  Release,
  Settings,
  Toast,
} from "../types";
import {
  addComment as cloudAddComment,
  adminOverview,
  cloudAdminReady,
  cloudEnabled,
  fetchProfile,
  deleteComment as cloudDeleteComment,
  fetchComments,
  fetchMyLicenses,
  fetchMyRequests,
  loadCatalog,
  rateRelease as cloudRate,
  requestLicense as cloudRequestLicense,
  resetDemoCatalog,
  upsertProfile,
  type AdminOverview,
} from "./cloud";
import { formatBytes } from "./format";
import { processAvatar } from "./image";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const PROFILE_KEY = "aether.profile.v1";
const SETTINGS_KEY = "aether.settings.v1";

const defaultSettings: Settings = {
  soundEnabled: true,
  soundVolume: 0.6,
  reduceEffects: false,
  presetDir: null,
  drumkitDir: null,
  licenseMachineId: null,
  seenSplash: false,
};

const fallbackMachine: MachineInfo = {
  canonical: "A4F255039168BE032BEEEE7C450FF6A6",
  formatted: "A4F2-5503-9168-BE03-2BEE-EE7C-450F-F6A6",
  os: "macos",
  platformLabel: "macOS",
};

const fallbackPaths: AppPaths = {
  os: "macos",
  arch: "arm64",
  home: "",
  documents: "",
  presetsDir: "Documents/Image-Line/FL Studio/Presets/Aether Plugins",
  drumkitsDir: "Documents/Aether Hub/Drumkits",
  vst3Dir: "~/Library/Audio/Plug-Ins/VST3",
  componentsDir: "~/Library/Audio/Plug-Ins/Components",
  resourceDir: "",
  appDataDir: "",
  installsFile: "",
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function makeProfile(): Profile {
  return {
    id: `user_${Math.random().toString(36).slice(2, 12)}`,
    nickname: "aether user",
    avatarUrl: null,
    machineId: "",
  };
}

interface StoreValue {
  ready: boolean;
  machine: MachineInfo;
  paths: AppPaths;
  admin: AdminStatus;
  releases: Release[];
  catalogSource: "cloud" | "cache" | "demo";
  catalogError: string | null;
  catalogLoading: boolean;
  installs: Installs;
  progress: Record<string, InstallProgress>;
  profile: Profile;
  settings: Settings;
  licensingMachineId: string;
  comments: Record<string, Comment[]>;
  myRatings: Record<string, number>;
  requests: LicenseRequest[];
  licenses: License[];
  toasts: Toast[];
  adminOverview: AdminOverview | null;
  install: (release: Release) => Promise<void>;
  uninstall: (release: Release) => Promise<void>;
  loadComments: (releaseId: string, force?: boolean) => Promise<void>;
  postComment: (release: Release, body: string) => Promise<void>;
  removeComment: (releaseId: string, commentId: string) => Promise<void>;
  rate: (release: Release, value: number) => Promise<void>;
  loadMyRating: (releaseId: string) => Promise<void>;
  saveProfile: (patch: Partial<Profile>, avatarFile?: File | null) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  refreshCatalog: () => Promise<void>;
  refreshCloudUser: () => Promise<void>;
  refreshAdminData: () => Promise<AdminOverview | null>;
  resetDemo: () => Promise<void>;
  requestKey: (release: Release) => Promise<void>;
  pickFolder: (kind: "presetDir" | "drumkitDir") => Promise<void>;
  toast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  getFileForOS: (release: Release) => { url: string; sizeBytes: number } | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [machine, setMachine] = useState<MachineInfo>(fallbackMachine);
  const [paths, setPaths] = useState<AppPaths>(fallbackPaths);
  const [admin, setAdmin] = useState<AdminStatus>({ enabled: false });
  const [releases, setReleases] = useState<Release[]>([]);
  const [catalogSource, setCatalogSource] = useState<"cloud" | "cache" | "demo">("demo");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [installs, setInstalls] = useState<Installs>({});
  const [progress, setProgress] = useState<Record<string, InstallProgress>>({});
  const [profile, setProfile] = useState<Profile>(makeProfile);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [requests, setRequests] = useState<LicenseRequest[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [adminData, setAdminData] = useState<AdminOverview | null>(null);

  const licensingMachineId = useMemo(
    () => settings.licenseMachineId?.trim() || machine.formatted,
    [settings.licenseMachineId, machine.formatted],
  );

  const booted = useRef(false);
  const timers = useRef<number[]>([]);
  const machineRef = useRef(machine);
  machineRef.current = machine;

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, "id">) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...input, id }]);
      const timer = window.setTimeout(() => dismissToast(id), 4600);
      timers.current.push(timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const getFileForOS = useCallback(
    (release: Release) => {
      const key = machine.os === "windows" ? "windows" : "macos";
      return release.files[key] ?? release.files.macos ?? release.files.windows ?? null;
    },
    [machine.os],
  );

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const result = await loadCatalog();
      setReleases(result.releases);
      setCatalogSource(result.source);
      setCatalogError(result.error ?? null);
      if (result.source === "demo" && cloudEnabled && result.error) {
        toast({
          kind: "error",
          title: "Облако недоступно",
          message: "Показан резервный каталог. Проверьте интернет и ключи Supabase.",
        });
      }
    } catch (error) {
      toast({ kind: "error", title: "Не удалось загрузить каталог", message: String(error) });
    } finally {
      setCatalogLoading(false);
    }
  }, [toast]);

  const refreshCloudUser = useCallback(async () => {
    if (!licensingMachineId) return;

    try {
      const [nextRequests, nextLicenses] = await Promise.all([
        fetchMyRequests(licensingMachineId),
        fetchMyLicenses(licensingMachineId),
      ]);
      setRequests(nextRequests);
      setLicenses(nextLicenses);
    } catch {
      // Offline or cloud not configured — keep the local UI usable.
    }
  }, [licensingMachineId]);

  const refreshAdminData = useCallback(async () => {
    if (cloudEnabled && !cloudAdminReady) return null;

    try {
      const data = await adminOverview();
      setAdminData(data);
      setRequests(data.requests);
      return data;
    } catch (error) {
      toast({ kind: "error", title: "Не удалось обновить панель", message: String(error) });
      return null;
    }
  }, [toast]);

  // Boot -------------------------------------------------------------------
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const savedProfile = readJson<Profile>(PROFILE_KEY, makeProfile());
    const savedSettings = readJson<Settings>(SETTINGS_KEY, defaultSettings);
    setSettings(savedSettings);
    setProfile(savedProfile);

    (async () => {
      let nextMachine = fallbackMachine;
      let nextPaths = fallbackPaths;
      let nextAdmin: AdminStatus = { enabled: false };

      if (isTauri) {
        const results = await Promise.allSettled([
          invoke<MachineInfo>("machine_id"),
          invoke<AppPaths>("app_paths"),
          invoke<AdminStatus>("admin_status"),
          invoke<Installs>("check_installs"),
        ]);

        if (results[0].status === "fulfilled") nextMachine = results[0].value;
        if (results[1].status === "fulfilled") nextPaths = results[1].value;
        if (results[2].status === "fulfilled") nextAdmin = results[2].value;
        if (results[3].status === "fulfilled") setInstalls(results[3].value);
      } else if (new URLSearchParams(window.location.search).get("previewAdmin") === "1") {
        // Browser-only design preview: never reachable inside the Tauri app.
        nextAdmin = {
          enabled: true,
          privateKeyPath: "~/PRIVATE_KEYGEN_DO_NOT_SHARE/private_key",
          publicKey: "2005bfd33f91c2d8cd34913e41bed432713d06379a9163224619755d65ba1e48",
          source: "preview",
        };
      }

      setMachine(nextMachine);
      setPaths(nextPaths);
      setAdmin(nextAdmin);

      const mergedProfile: Profile = {
        ...savedProfile,
        machineId: nextMachine.formatted,
        nickname: savedProfile.nickname || "aether user",
      };
      setProfile(mergedProfile);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(mergedProfile));

      setReady(true);
      void refreshCatalog();
      void refreshCloudUser();
      if (nextAdmin.enabled) void refreshAdminData();

      if (cloudEnabled) {
        const identity = savedSettings.licenseMachineId?.trim() || nextMachine.formatted;
        void fetchProfile(identity).then((remote) => {
          if (!remote) return;
          setProfile((prev) => {
            const merged: Profile = {
              ...prev,
              id: remote.id || prev.id,
              nickname: remote.nickname || prev.nickname,
              avatarUrl: remote.avatarUrl ?? prev.avatarUrl,
              machineId: nextMachine.formatted,
            };
            localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
            return merged;
          });
        });
      }

      if (isTauri) {
        void invoke("frontend_log", {
          level: "info",
          message: `boot ok · platform=${nextMachine.platformLabel} · hwid=${nextMachine.formatted} · admin=${nextAdmin.enabled} · cloud=${cloudEnabled} · paths=${nextPaths.appDataDir}`,
        }).catch(() => undefined);
      }
    })();
  }, [refreshAdminData, refreshCatalog, refreshCloudUser]);

  // Install progress events -------------------------------------------------
  useEffect(() => {
    if (!isTauri) return;
    let dispose: (() => void) | undefined;

    listen<InstallProgress>("install-progress", (event) => {
      const payload = event.payload;
      setProgress((prev) => ({ ...prev, [payload.slug]: payload }));
    }).then((unlisten) => {
      dispose = unlisten;
    });

    return () => dispose?.();
  }, []);

  useEffect(() => {
    if (ready) void refreshCloudUser();
  }, [ready, licensingMachineId, refreshCloudUser]);

  // Cloud polling ------------------------------------------------------------
  useEffect(() => {
    if (!ready || !cloudEnabled) return;
    const interval = window.setInterval(() => void refreshCloudUser(), 45_000);
    const onFocus = () => void refreshCloudUser();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, refreshCloudUser]);

  const install = useCallback(
    async (release: Release) => {
      const file = getFileForOS(release);
      if (!file) {
        toast({
          kind: "error",
          title: "Нет сборки для этой ОС",
          message: `${release.title} пока не собран для ${machine.platformLabel}.`,
        });
        return;
      }

      if (!isTauri) {
        toast({ kind: "info", title: "Установка доступна в приложении", message: "Запустите Aether Hub.app." });
        return;
      }

      setProgress((prev) => ({
        ...prev,
        [release.slug]: {
          slug: release.slug,
          phase: "preparing",
          received: 0,
          total: file.sizeBytes,
          percent: 1,
          message: "Подготовка…",
        },
      }));

      try {
        const record = await invoke<InstallRecord>("install_release", {
          request: {
            slug: release.slug,
            title: release.title,
            category: release.category,
            version: release.version,
            url: file.url,
            presetDir: settings.presetDir,
            drumkitDir: settings.drumkitDir,
          },
        });

        setInstalls((prev) => ({ ...prev, [release.slug]: record }));
        toast({
          kind: "success",
          title: `${release.title} установлен`,
          message:
            release.category === "plugins"
              ? "VST3 / AU скопированы в системные папки плагинов."
              : `${formatBytes(record.sizeBytes)} распакованы.`,
        });

        window.setTimeout(() => {
          setProgress((prev) => {
            const next = { ...prev };
            delete next[release.slug];
            return next;
          });
        }, 1600);
      } catch (error) {
        setProgress((prev) => {
          const next = { ...prev };
          delete next[release.slug];
          return next;
        });
        toast({
          kind: "error",
          title: "Установка не удалась",
          message: String(error),
        });
      }
    },
    [getFileForOS, machine.platformLabel, settings.drumkitDir, settings.presetDir, toast],
  );

  const uninstall = useCallback(
    async (release: Release) => {
      if (!isTauri) return;
      try {
        const next = await invoke<Installs>("uninstall_release", { slug: release.slug });
        setInstalls(next);
        toast({ kind: "info", title: `${release.title} удалён` });
      } catch (error) {
        toast({ kind: "error", title: "Не удалось удалить", message: String(error) });
      }
    },
    [toast],
  );

  const loadComments = useCallback(async (releaseId: string, force = false) => {
    if (!force && comments[releaseId]) return;
    try {
      const items = await fetchComments(releaseId);
      setComments((prev) => ({ ...prev, [releaseId]: items }));
    } catch (error) {
      setComments((prev) => ({ ...prev, [releaseId]: prev[releaseId] ?? [] }));
    }
  }, [comments]);

  const postComment = useCallback(
    async (release: Release, body: string) => {
      const text = body.trim();
      if (!text) return;
      if (!profile.nickname.trim()) {
        toast({ kind: "info", title: "Сначала задайте никнейм в профиле" });
        return;
      }

      try {
        const comment = await cloudAddComment({
          releaseId: release.id,
          nickname: profile.nickname.trim(),
          avatarUrl: profile.avatarUrl,
          body: text,
          machineId: machine.formatted,
        });
        setComments((prev) => ({
          ...prev,
          [release.id]: [comment, ...(prev[release.id] ?? [])],
        }));
      } catch (error) {
        toast({ kind: "error", title: "Комментарий не отправлен", message: String(error) });
      }
    },
    [machine.formatted, profile.avatarUrl, profile.nickname, toast],
  );

  const removeComment = useCallback(
    async (releaseId: string, commentId: string) => {
      try {
        await cloudDeleteComment(commentId);
        setComments((prev) => ({
          ...prev,
          [releaseId]: (prev[releaseId] ?? []).filter((c) => c.id !== commentId),
        }));
        setAdminData((prev) =>
          prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : prev,
        );
        toast({ kind: "success", title: "Комментарий удалён" });
      } catch (error) {
        toast({ kind: "error", title: "Не удалось удалить", message: String(error) });
      }
    },
    [toast],
  );

  const rate = useCallback(
    async (release: Release, value: number) => {
      try {
        const result = await cloudRate(release.id, machine.formatted, value);
        setMyRatings((prev) => ({ ...prev, [release.id]: value }));
        setReleases((prev) =>
          prev.map((r) =>
            r.id === release.id
              ? { ...r, ratingAvg: result.avg, ratingCount: result.count }
              : r,
          ),
        );
        toast({ kind: "success", title: `Оценка ${value} ★ сохранена` });
      } catch (error) {
        toast({ kind: "error", title: "Оценка не сохранена", message: String(error) });
      }
    },
    [machine.formatted, toast],
  );

  const loadMyRating = useCallback(
    async (releaseId: string) => {
      if (myRatings[releaseId]) return;
      try {
        const { fetchMyRating } = await import("./cloud");
        const value = await fetchMyRating(releaseId, machine.formatted);
        if (value) setMyRatings((prev) => ({ ...prev, [releaseId]: value }));
      } catch {
        // ignore
      }
    },
    [machine.formatted, myRatings],
  );

  const saveProfile = useCallback(
    async (patch: Partial<Profile>, avatarFile?: File | null) => {
      let avatarUrl = patch.avatarUrl ?? profile.avatarUrl;
      if (avatarFile) {
        avatarUrl = await processAvatar(avatarFile, 256);
      }

      const next: Profile = {
        ...profile,
        ...patch,
        avatarUrl,
        machineId: licensingMachineId,
      };

      setProfile(next);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));

      try {
        await upsertProfile(next);
        toast({ kind: "success", title: "Профиль сохранён" });
      } catch (error) {
        toast({ kind: "error", title: "Профиль сохранён локально", message: String(error) });
      }
    },
    [licensingMachineId, profile, toast],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const requestKey = useCallback(
    async (release: Release) => {
      if (!profile.nickname.trim()) {
        toast({ kind: "info", title: "Сначала задайте никнейм в профиле" });
        return;
      }

      try {
        await cloudRequestLicense({
          machineId: licensingMachineId,
          nickname: profile.nickname.trim(),
          avatarUrl: profile.avatarUrl,
          pluginSlug: release.slug,
          pluginTitle: release.title,
          productTag: release.productTag || "AETHER-VOCAL-STRIP",
        });
        await refreshCloudUser();
        toast({
          kind: "success",
          title: "Заявка отправлена",
          message: "Ключ появится в профиле, как только его одобрят.",
        });
      } catch (error) {
        toast({ kind: "error", title: "Заявка не отправлена", message: String(error) });
      }
    },
    [licensingMachineId, profile.avatarUrl, profile.nickname, refreshCloudUser, toast],
  );

  const pickFolder = useCallback(
    async (kind: "presetDir" | "drumkitDir") => {
      if (!isTauri) return;
      try {
        const selected = await openDialog({
          directory: true,
          multiple: false,
          title: kind === "presetDir" ? "Папка пресетов" : "Папка драм-китов",
          defaultPath: kind === "presetDir" ? paths.presetsDir : paths.drumkitsDir,
        });
        if (typeof selected === "string") {
          updateSettings({ [kind]: selected } as Partial<Settings>);
        }
      } catch (error) {
        toast({ kind: "error", title: "Не удалось выбрать папку", message: String(error) });
      }
    },
    [paths.drumkitsDir, paths.presetsDir, toast, updateSettings],
  );

  const resetDemo = useCallback(async () => {
    const next = resetDemoCatalog();
    setReleases(next);
    setCatalogSource("demo");
    setComments({});
    toast({ kind: "info", title: "Демо-каталог восстановлен" });
  }, [toast]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      machine,
      paths,
      admin,
      releases,
      catalogSource,
      catalogError,
      catalogLoading,
      installs,
      progress,
      profile,
      settings,
      licensingMachineId,
      comments,
      myRatings,
      requests,
      licenses,
      toasts,
      adminOverview: adminData,
      install,
      uninstall,
      loadComments,
      postComment,
      removeComment,
      rate,
      loadMyRating,
      saveProfile,
      updateSettings,
      refreshCatalog,
      refreshCloudUser,
      refreshAdminData,
      resetDemo,
      requestKey,
      pickFolder,
      toast,
      dismissToast,
      getFileForOS,
    }),
    [
      ready,
      machine,
      paths,
      admin,
      releases,
      catalogSource,
      catalogError,
      catalogLoading,
      installs,
      progress,
      profile,
      settings,
      licensingMachineId,
      comments,
      myRatings,
      requests,
      licenses,
      toasts,
      adminData,
      install,
      uninstall,
      loadComments,
      postComment,
      removeComment,
      rate,
      loadMyRating,
      saveProfile,
      updateSettings,
      refreshCatalog,
      refreshCloudUser,
      refreshAdminData,
      resetDemo,
      requestKey,
      pickFolder,
      toast,
      dismissToast,
      getFileForOS,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
