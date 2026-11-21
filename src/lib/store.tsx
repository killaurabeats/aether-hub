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
  CommunitySample,
  SubmitSampleInput,
  AppNotification,
} from "../types";
import {
  addComment as cloudAddComment,
  adminOverview,
  adminTokenIsBaked,
  cloudEnabled,
  fetchProfile,
  deleteComment as cloudDeleteComment,
  fetchComments,
  fetchMyLicenses,
  fetchFreeLicenseKey,
  fetchBetaLicenseKey,
  fetchMyRequests,
  fetchMySamples,
  fetchPublicSamples,
  fetchBetaStatus,
  hasAdminToken,
  loadCatalog,
  likeCommunitySample,
  markSampleDownloaded,
  rateRelease as cloudRate,
  requestLicense as cloudRequestLicense,
  resetDemoCatalog,
  submitCommunitySample,
  storeAdminToken,
  upsertProfile,
  verifyAdminToken,
  type AdminOverview,
} from "./cloud";
import { formatBytes } from "./format";
import { processAvatar } from "./image";
import { setFormatLanguage } from "./format";
import { translate, type Language } from "./i18n";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const PROFILE_KEY = "aether.profile.v1";
const SETTINGS_KEY = "aether.settings.v1";
const NOTIF_READ_KEY = "aether.notifications.read.v1";
const LICENSE_WRITTEN_KEY = "aether.licenses.written.v1";

const defaultSettings: Settings = {
  language: "ru",
  theme: "purple",
  soundEnabled: true,
  soundVolume: 0.6,
  glassBlur: true,
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
  adminView: "admin" | "user";
  adminVisible: boolean;
  adminTokenReady: boolean;
  adminTokenBaked: boolean;
  setAdminView: (mode: "admin" | "user") => void;
  unlockAdminToken: (token: string) => Promise<{ ok: boolean; error?: string }>;
  lockAdminToken: () => void;
  releases: Release[];
  catalogSource: "cloud" | "cache" | "demo";
  catalogError: string | null;
  catalogLoading: boolean;
  installs: Installs;
  progress: Record<string, InstallProgress>;
  profile: Profile;
  settings: Settings;
  language: Language;
  t: (text: string, vars?: Record<string, string | number>) => string;
  licensingMachineId: string;
  comments: Record<string, Comment[]>;
  myRatings: Record<string, number>;
  requests: LicenseRequest[];
  licenses: License[];
  betaTester: boolean;
  betaLoading: boolean;
  samples: CommunitySample[];
  mySamples: CommunitySample[];
  samplesLoading: boolean;
  notifications: AppNotification[];
  unreadNotifications: number;
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
  activateLicense: (release: Release, key: string) => Promise<void>;
  refreshSamples: () => Promise<void>;
  submitSample: (input: SubmitSampleInput) => Promise<CommunitySample | null>;
  likeSample: (sample: CommunitySample) => Promise<void>;
  trackSampleDownload: (sample: CommunitySample) => Promise<void>;
  markNotificationsRead: () => void;
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
  // Runtime unlock: public builds start with no token, but a creator can enter
  // one on a trusted device. It is kept in localStorage and never bundled.
  const [adminTokenReady, setAdminTokenReady] = useState(() => hasAdminToken());
  // Creator builds start in Admin view. Switching to User view is a temporary
  // preview and resets to Admin on the next launch.
  const [adminView, setAdminViewState] = useState<"admin" | "user">("admin");
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
  const [betaTester, setBetaTester] = useState(false);
  const [betaLoading, setBetaLoading] = useState(true);
  const [samples, setSamples] = useState<CommunitySample[]>([]);
  const [mySamples, setMySamples] = useState<CommunitySample[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [notifRead, setNotifRead] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(NOTIF_READ_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [adminData, setAdminData] = useState<AdminOverview | null>(null);

  setFormatLanguage(settings.language);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const t = useCallback(
    (text: string, vars?: Record<string, string | number>) =>
      translate(settings.language, text, vars),
    [settings.language],
  );

  const licensingMachineId = useMemo(
    () => settings.licenseMachineId?.trim() || machine.formatted,
    [settings.licenseMachineId, machine.formatted],
  );

  // Either a local private key (full creator mode) or a runtime Cloud admin
  // token unlocks the panel. Keygen additionally requires admin.enabled.
  const adminVisible = (admin.enabled || adminTokenReady) && adminView === "admin";

  const setAdminView = useCallback((mode: "admin" | "user") => {
    setAdminViewState(mode);
  }, []);

  const booted = useRef(false);
  const timers = useRef<number[]>([]);
  const machineRef = useRef(machine);
  machineRef.current = machine;
  const notifIdsRef = useRef<string[]>([]);
  const writtenLicenses = useRef<Set<string>>(
    (() => {
      try {
        const raw = localStorage.getItem(LICENSE_WRITTEN_KEY);
        return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        return new Set<string>();
      }
    })(),
  );

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
      if (result.source === "demo" && cloudEnabled && result.empty) {
        toast({
          kind: "info",
          title: t("Облако пока пустое"),
          message: t("В Supabase нет опубликованных релизов — показан демо-каталог."),
        });
      } else if (result.source === "demo" && cloudEnabled && result.error) {
        toast({
          kind: "error",
          title: t("Облако недоступно"),
          message: t("Показан резервный каталог. Проверьте интернет и ключи Supabase."),
        });
      }
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось загрузить каталог"), message: String(error) });
    } finally {
      setCatalogLoading(false);
    }
  }, [toast, t]);

  const refreshCloudUser = useCallback(async () => {
    if (!licensingMachineId) return;

    try {
      const [nextRequests, nextLicenses, nextBeta, nextMySamples] = await Promise.all([
        fetchMyRequests(licensingMachineId),
        fetchMyLicenses(licensingMachineId),
        fetchBetaStatus(licensingMachineId),
        fetchMySamples(licensingMachineId),
      ]);
      setRequests(nextRequests);
      setLicenses(nextLicenses);
      setBetaTester(nextBeta);
      setMySamples(nextMySamples);
    } catch {
      // Offline or cloud not configured — keep the local UI usable.
    } finally {
      setBetaLoading(false);
    }
  }, [licensingMachineId]);

  const refreshSamples = useCallback(async () => {
    setSamplesLoading(true);
    try {
      setSamples(await fetchPublicSamples());
    } finally {
      setSamplesLoading(false);
    }
  }, []);

  const refreshAdminData = useCallback(async () => {
    if (cloudEnabled && !hasAdminToken()) return null;

    try {
      const data = await adminOverview();
      setAdminData(data);
      setRequests(data.requests);
      return data;
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось обновить панель"), message: String(error) });
      return null;
    }
  }, [toast, t]);

  const unlockAdminToken = useCallback(
    async (token: string) => {
      const trimmed = token.trim();
      if (!trimmed) return { ok: false, error: "Enter a key" };
      const check = await verifyAdminToken(trimmed);
      if (!check.ok) return check;
      storeAdminToken(trimmed);
      setAdminTokenReady(true);
      setAdminViewState("admin");
      toast({ kind: "success", title: t("Админ-режим включён") });
      void refreshAdminData();
      return { ok: true };
    },
    [refreshAdminData, t, toast],
  );

  const lockAdminToken = useCallback(() => {
    storeAdminToken("");
    const stillReady = hasAdminToken();
    setAdminTokenReady(stillReady);
    setAdminViewState("admin");
    toast({
      kind: "info",
      title: stillReady ? t("Ключ вшит в эту сборку") : t("Ключ удалён"),
    });
  }, [t, toast]);

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

      const params = new URLSearchParams(window.location.search);
      const langParam = params.get("lang");
      if (langParam === "en" || langParam === "ru") {
        const nextLanguage: Language = langParam === "en" ? "en" : "ru";
        setSettings((prev) => {
          const next = { ...prev, language: nextLanguage };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          return next;
        });
      }

      if (params.get("noblur") === "1") {
        setSettings((prev) => {
          const next = { ...prev, glassBlur: false };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          return next;
        });
      }

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
      void refreshSamples();
      if (nextAdmin.enabled || hasAdminToken()) void refreshAdminData();

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
  }, [refreshAdminData, refreshCatalog, refreshCloudUser, refreshSamples]);

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

  // Zero-copy PRO activation: as soon as a licence is approved (manually or by
  // selective auto-approval), drop license.aether into the plugin's system
  // licence folder. The webview never asks the user to copy anything.
  useEffect(() => {
    if (!ready || !isTauri) return;

    const candidates: Array<{ key: string; productTag: string; title: string }> = [];
    for (const license of licenses) {
      if (license.key) {
        candidates.push({
          key: license.key,
          productTag: license.productTag,
          title: license.pluginTitle || license.productTag,
        });
      }
    }
    for (const request of requests) {
      if (request.status === "approved" && request.key) {
        candidates.push({
          key: request.key,
          productTag: request.productTag,
          title: request.pluginTitle || request.productTag,
        });
      }
    }

    for (const candidate of candidates) {
      const tag = candidate.productTag.toUpperCase();
      const release = releases.find(
        (item) => (item.productTag || "").toUpperCase() === tag,
      );
      const tier = release?.tier ?? "free";
      if (tier !== "pro" && tier !== "beta") continue;

      const writeId = `${tag}:${candidate.key}`;
      if (writtenLicenses.current.has(writeId)) continue;
      writtenLicenses.current.add(writeId);
      localStorage.setItem(
        LICENSE_WRITTEN_KEY,
        JSON.stringify([...writtenLicenses.current].slice(-200)),
      );

      void invoke<string>("write_license_file", {
        key: candidate.key,
        productTag: candidate.productTag,
      })
        .then((path) => {
          toast({
            kind: "success",
            title: t("Лицензия записана автоматически"),
            message: t("{name} · {path}", { name: candidate.title, path }),
          });
        })
        .catch((error) => {
          writtenLicenses.current.delete(writeId);
          toast({
            kind: "error",
            title: t("Не удалось записать лицензию"),
            message: String(error),
          });
        });
    }
  }, [licenses, ready, releases, requests, t, toast]);

  const install = useCallback(
    async (release: Release) => {
      const file = getFileForOS(release);
      if (!file) {
        toast({
          kind: "error",
          title: t("Нет сборки для этой ОС"),
          message: t("{name} пока не собран для {os}.", {
            name: release.title,
            os: machine.platformLabel,
          }),
        });
        return;
      }

      if (!isTauri) {
        toast({ kind: "info", title: t("Установка доступна в приложении"), message: t("Запустите Aether Hub.app.") });
        return;
      }

      if ((release.tier ?? "free") === "beta" && !betaTester) {
        toast({
          kind: "info",
          title: t("В разработке • Доступно только Beta-тестерам"),
          message: t("Активируйте Beta-инвайт в профиле, чтобы открыть установку."),
        });
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
          message: t("Подготовка…"),
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
          title: t("{name} установлен", { name: release.title }),
          message:
            release.category === "plugins"
              ? t("VST3 / AU скопированы в системные папки плагинов.")
              : t("{size} распакованы.", { size: formatBytes(record.sizeBytes) }),
        });

        window.setTimeout(() => {
          setProgress((prev) => {
            const next = { ...prev };
            delete next[release.slug];
            return next;
          });
        }, 1600);

        // FREE plugins are licensed automatically: issue a machine-bound key
        // on the server and drop it into the plugin's Application Support
        // folder, so the user never has to request/activate anything manually.
        const tier = release.tier ?? "free";
        if (release.category === "plugins" && (tier === "free" || (tier === "beta" && betaTester))) {
          void (async () => {
            const productTag = release.productTag || "AETHER-VOCAL-STRIP";
            const key =
              tier === "beta"
                ? await fetchBetaLicenseKey(
                    licensingMachineId,
                    productTag,
                    profile.nickname,
                  )
                : await fetchFreeLicenseKey(
                    licensingMachineId,
                    productTag,
                    profile.nickname,
                  );
            const path = await invoke<string>("write_license_file", { key, productTag });
            writtenLicenses.current.add(`${productTag.toUpperCase()}:${key}`);
            toast({
              kind: "success",
              title:
                tier === "beta"
                  ? t("BETA-лицензия активирована")
                  : t("FREE-лицензия активирована"),
              message: t("Ключ записан в {path}", { path }),
            });
            await refreshCloudUser();
          })().catch((error) => {
            toast({
              kind: "error",
              title:
                tier === "beta"
                  ? t("Не удалось активировать BETA-лицензию")
                  : t("Не удалось активировать FREE-лицензию"),
              message: String(error),
            });
          });
        }
      } catch (error) {
        setProgress((prev) => {
          const next = { ...prev };
          delete next[release.slug];
          return next;
        });
        toast({
          kind: "error",
          title: t("Установка не удалась"),
          message: String(error),
        });
      }
    },
    [
      betaTester,
      getFileForOS,
      licensingMachineId,
      machine.platformLabel,
      profile.nickname,
      refreshCloudUser,
      settings.drumkitDir,
      settings.presetDir,
      toast,
      t,
    ],
  );

  const uninstall = useCallback(
    async (release: Release) => {
      if (!isTauri) return;
      try {
        const next = await invoke<Installs>("uninstall_release", { slug: release.slug });
        setInstalls(next);
        toast({ kind: "info", title: t("{name} удалён", { name: release.title }) });
      } catch (error) {
        toast({ kind: "error", title: t("Не удалось удалить"), message: String(error) });
      }
    },
    [toast, t],
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
        toast({ kind: "info", title: t("Сначала задайте никнейм в профиле") });
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
        toast({ kind: "error", title: t("Комментарий не отправлен"), message: String(error) });
      }
    },
    [machine.formatted, profile.avatarUrl, profile.nickname, toast, t],
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
        toast({ kind: "success", title: t("Комментарий удалён") });
      } catch (error) {
        toast({ kind: "error", title: t("Не удалось удалить"), message: String(error) });
      }
    },
    [toast, t],
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
        toast({ kind: "success", title: t("Оценка {value} ★ сохранена", { value }) });
      } catch (error) {
        toast({ kind: "error", title: t("Оценка не сохранена"), message: String(error) });
      }
    },
    [machine.formatted, toast, t],
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
        toast({ kind: "success", title: t("Профиль сохранён") });
      } catch (error) {
        toast({ kind: "error", title: t("Профиль сохранён локально"), message: String(error) });
      }
    },
    [licensingMachineId, profile, toast, t],
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
        toast({ kind: "info", title: t("Сначала задайте никнейм в профиле") });
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
          title: t("Заявка отправлена"),
          message: t("Ключ появится в профиле, как только его одобрят."),
        });
      } catch (error) {
        toast({ kind: "error", title: t("Заявка не отправлена"), message: String(error) });
      }
    },
    [licensingMachineId, profile.avatarUrl, profile.nickname, refreshCloudUser, toast, t],
  );

  const activateLicense = useCallback(
    async (release: Release, key: string) => {
      const productTag = release.productTag || "AETHER-VOCAL-STRIP";
      try {
        const path = await invoke<string>("write_license_file", {
          key,
          productTag,
        });
        writtenLicenses.current.add(`${productTag.toUpperCase()}:${key}`);
        localStorage.setItem(
          LICENSE_WRITTEN_KEY,
          JSON.stringify([...writtenLicenses.current].slice(-200)),
        );
        toast({
          kind: "success",
          title: t("Лицензия активирована"),
          message: t("Файл license.aether записан в {path}", { path }),
        });
      } catch (error) {
        toast({
          kind: "error",
          title: t("Не удалось записать лицензию"),
          message: String(error),
        });
      }
    },
    [toast, t],
  );

  const submitSample = useCallback(
    async (input: SubmitSampleInput) => {
      try {
        const sample = await submitCommunitySample(input);
        setMySamples((prev) => [sample, ...prev.filter((item) => item.id !== sample.id)]);
        toast({
          kind: "success",
          title: t("Сэмпл отправлен на модерацию"),
          message: t("Он появится в разделе после одобрения."),
        });
        return sample;
      } catch (error) {
        toast({
          kind: "error",
          title: t("Не удалось загрузить сэмпл"),
          message: String(error),
        });
        return null;
      }
    },
    [toast, t],
  );

  const likeSample = useCallback(
    async (sample: CommunitySample) => {
      try {
        const likes = await likeCommunitySample(sample.id);
        setSamples((prev) =>
          prev.map((item) =>
            item.id === sample.id
              ? { ...item, likesCount: likes || item.likesCount + 1 }
              : item,
          ),
        );
      } catch (error) {
        toast({ kind: "error", title: t("Не удалось поставить лайк"), message: String(error) });
      }
    },
    [toast, t],
  );

  const trackSampleDownload = useCallback(async (sample: CommunitySample) => {
    try {
      const count = await markSampleDownloaded(sample.id);
      setSamples((prev) =>
        prev.map((item) =>
          item.id === sample.id
            ? { ...item, downloadsCount: count || item.downloadsCount + 1 }
            : item,
        ),
      );
    } catch {
      // Download counting is best-effort.
    }
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifRead((prev) => {
      const next = [...prev];
      for (const id of notifIdsRef.current) {
        if (!next.includes(id)) next.push(id);
      }
      try {
        localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(next.slice(-500)));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const pickFolder = useCallback(
    async (kind: "presetDir" | "drumkitDir") => {
      if (!isTauri) return;
      try {
        const selected = await openDialog({
          directory: true,
          multiple: false,
          title: kind === "presetDir" ? t("Папка пресетов") : t("Папка драм-китов"),
          defaultPath: kind === "presetDir" ? paths.presetsDir : paths.drumkitsDir,
        });
        if (typeof selected === "string") {
          updateSettings({ [kind]: selected } as Partial<Settings>);
        }
      } catch (error) {
        toast({ kind: "error", title: t("Не удалось выбрать папку"), message: String(error) });
      }
    },
    [paths.drumkitsDir, paths.presetsDir, toast, updateSettings, t],
  );

  const resetDemo = useCallback(async () => {
    const next = resetDemoCatalog();
    setReleases(next);
    setCatalogSource("demo");
    setComments({});
    toast({ kind: "info", title: t("Демо-каталог восстановлен") });
  }, [toast, t]);

  const notifications = useMemo<AppNotification[]>(() => {
    const items: AppNotification[] = [];
    const now = Date.now();
    const recentCutoff = now - 30 * 24 * 3600_000;

    for (const release of releases) {
      const created = release.createdAt ? Date.parse(release.createdAt) : NaN;
      if (!Number.isFinite(created) || created < recentCutoff) continue;
      const isBeta = (release.tier ?? "free") === "beta";
      const details =
        (settings.language === "ru" ? release.descriptionRu : release.descriptionEn) ||
        release.descriptionEn ||
        release.descriptionRu ||
        release.description ||
        "";
      items.push({
        id: `release:${release.id}:${release.version}`,
        kind: isBeta ? "beta" : "release",
        title: isBeta
          ? t("BETA-обновление · {name}", { name: release.title })
          : t("Новый релиз · {name}", { name: release.title }),
        message: isBeta
          ? t("Версия {version} · ранний доступ для Beta-тестеров.", {
              version: release.version,
            })
          : t("Версия {version} уже в каталоге Aether Hub.", {
              version: release.version,
            }),
        details,
        createdAt: release.createdAt!,
        releaseSlug: release.slug,
        action: "plugins",
      });
    }

    for (const request of requests) {
      if (request.status === "approved") {
        items.push({
          id: `license:${request.id}`,
          kind: "license",
          title: t("PRO-лицензия одобрена"),
          message: t("{name} · ключ записан автоматически.", {
            name: request.pluginTitle,
          }),
          details: t(
            "PRO-лицензия для {name} одобрена. license.aether записан в системную папку плагина автоматически.",
            { name: request.pluginTitle },
          ),
          createdAt: request.resolvedAt || request.createdAt,
          releaseSlug: request.pluginSlug,
          action: "plugins",
        });
      } else if (request.status === "rejected") {
        items.push({
          id: `license:${request.id}`,
          kind: "license",
          title: t("Заявка на PRO-лицензию отклонена"),
          message: request.pluginTitle,
          details: t(
            "Заявка на PRO-лицензию для {name} отклонена. Можно отправить новую заявку из карточки плагина.",
            { name: request.pluginTitle },
          ),
          createdAt: request.resolvedAt || request.createdAt,
          releaseSlug: request.pluginSlug,
          action: "plugins",
        });
      }
    }

    for (const sample of mySamples) {
      if (sample.status === "approved") {
        items.push({
          id: `sample:${sample.id}:approved`,
          kind: "sample",
          title: t("Сэмпл одобрен"),
          message: t("{name} опубликован в Samples & Loops.", { name: sample.title }),
          details: t(
            "{name} от {author} прошёл модерацию и уже доступен в разделе Samples & Loops.",
            { name: sample.title, author: sample.authorName },
          ),
          createdAt: sample.createdAt,
          action: "samples",
        });
      } else if (sample.status === "rejected") {
        items.push({
          id: `sample:${sample.id}:rejected`,
          kind: "sample",
          title: t("Сэмпл отклонён модерацией"),
          message: sample.title,
          details: t(
            "{name} не прошёл премодерацию. Проверьте формат, качество и соответствие правилам комьюнити, затем загрузите новую версию.",
            { name: sample.title },
          ),
          createdAt: sample.createdAt,
          action: "samples",
        });
      }
    }

    if (betaTester) {
      items.push({
        id: "beta:tester-active",
        kind: "beta",
        title: t("Beta-доступ активен"),
        message: t("Установка BETA-плагинов открыта в один клик."),
        details: t(
          "Ваш Machine ID привязан к Beta-инвайту. BETA-плагины устанавливаются в один клик, а лицензия записывается автоматически.",
        ),
        createdAt: new Date(now - 60_000).toISOString(),
        action: "plugins",
      });
    }

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
  }, [betaTester, mySamples, releases, requests, settings.language, t]);

  notifIdsRef.current = notifications.map((item) => item.id);
  const unreadNotifications = notifications.filter(
    (item) => !notifRead.includes(item.id),
  ).length;

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      machine,
      paths,
      admin,
      adminView,
      adminVisible,
      adminTokenReady,
      adminTokenBaked: adminTokenIsBaked(),
      setAdminView,
      unlockAdminToken,
      lockAdminToken,
      releases,
      catalogSource,
      catalogError,
      catalogLoading,
      installs,
      progress,
      profile,
      settings,
      language: settings.language,
      t,
      licensingMachineId,
      comments,
      myRatings,
      requests,
      licenses,
      betaTester,
      betaLoading,
      samples,
      mySamples,
      samplesLoading,
      notifications,
      unreadNotifications,
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
      activateLicense,
      refreshSamples,
      submitSample,
      likeSample,
      trackSampleDownload,
      markNotificationsRead,
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
      adminView,
      adminVisible,
      adminTokenReady,
      setAdminView,
      unlockAdminToken,
      lockAdminToken,
      releases,
      catalogSource,
      catalogError,
      catalogLoading,
      installs,
      progress,
      profile,
      settings,
      t,
      licensingMachineId,
      comments,
      myRatings,
      requests,
      licenses,
      betaTester,
      betaLoading,
      samples,
      mySamples,
      samplesLoading,
      notifications,
      unreadNotifications,
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
      activateLicense,
      refreshSamples,
      submitSample,
      likeSample,
      trackSampleDownload,
      markNotificationsRead,
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
