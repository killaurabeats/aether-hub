import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  Check,
  CloudUpload,
  Copy,
  FileArchive,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  UploadCloud,
  Waves,
  X,
  Zap,
} from "lucide-react";
import type { Category, Comment, Release, CommunitySample, SampleStatus } from "../types";
import { SAMPLE_CATEGORY_META } from "../types";
import { CATEGORY_META } from "../types";
import { useStore } from "../lib/store";
import {
  approveAllPending,
  clearUnusedBetaInvites,
  cloudEnabled,
  createBetaInvites,
  deleteBetaInvite,
  deleteRelease,
  fetchAppConfig,
  listBetaInvites,
  listSamplesForModeration,
  moderateSample,
  saveRelease,
  setAutoApproveLicenses,
  setAutoApproveSlugs,
  type BetaInvite,
} from "../lib/cloud";
import { fileStat, readImageDataUrl } from "../lib/desktop";
import { copyText, formatBytes, formatDate, slugify, timeAgo } from "../lib/format";
import { Avatar } from "./Avatar";

type Tab = "publish" | "releases" | "moderation" | "samples" | "beta";
type OS = "macos" | "windows";

let adminSampleAudio: HTMLAudioElement | null = null;

interface Picked {
  path?: string;
  url?: string;
  name: string;
  size: number;
}

interface FormState {
  title: string;
  slug: string;
  version: string;
  category: Category;
  descriptionRu: string;
  descriptionEn: string;
  productTag: string;
  tier: "free" | "pro" | "beta";
  badge: string;
  preview: string;
  featured: boolean;
}

const emptyForm: FormState = {
  title: "",
  slug: "",
  version: "1.2",
  category: "plugins",
  descriptionRu: "",
  descriptionEn: "",
  productTag: "AETHER-VOCAL-STRIP",
  tier: "free",
  badge: "NEW",
  preview: "",
  featured: false,
};

export function AdminStudio() {
  const {
    admin,
    adminTokenReady,
    releases,
    refreshCatalog,
    refreshAdminData,
    adminOverview: overview,
    toast,
    removeComment,
    t,
  } = useStore();

  const [tab, setTab] = useState<Tab>("publish");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [files, setFiles] = useState<Partial<Record<OS, Picked>>>({});
  const [cover, setCover] = useState<(Picked & { preview?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<
    Array<Comment & { releaseTitle?: string }> | null
  >(null);
  const slugTouched = useRef(false);
  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [autoSlugs, setAutoSlugs] = useState<string[]>([]);
  const [autoPending, setAutoPending] = useState(0);
  const [autoBusy, setAutoBusy] = useState(false);
  const [approveAllBusy, setApproveAllBusy] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [betaInvites, setBetaInvites] = useState<BetaInvite[]>([]);
  const [betaNote, setBetaNote] = useState("");
  const [betaCount, setBetaCount] = useState(5);
  const [betaBusy, setBetaBusy] = useState(false);
  const [betaLoading, setBetaLoading] = useState(false);
  const [confirmClearBeta, setConfirmClearBeta] = useState(false);
  const [slugBusy, setSlugBusy] = useState<string | null>(null);
  const [adminSamples, setAdminSamples] = useState<CommunitySample[]>([]);
  const [samplesStatus, setSamplesStatus] = useState<SampleStatus | "all">("pending");
  const [samplesBusy, setSamplesBusy] = useState(false);
  const [sampleActionBusy, setSampleActionBusy] = useState<string | null>(null);
  const [playingSample, setPlayingSample] = useState<string | null>(null);

  const loadBeta = useCallback(async () => {
    if (!cloudEnabled || !adminTokenReady) return;
    setBetaLoading(true);
    try {
      setBetaInvites(await listBetaInvites());
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось загрузить бета-инвайты"), message: String(error) });
    } finally {
      setBetaLoading(false);
    }
  }, [adminTokenReady, t, toast]);

  const loadAdminSamples = useCallback(
    async (status: SampleStatus | "all" = samplesStatus) => {
      if (cloudEnabled && !adminTokenReady) {
        setAdminSamples([]);
        return;
      }
      setSamplesBusy(true);
      try {
        setAdminSamples(await listSamplesForModeration(status));
      } catch (error) {
        toast({
          kind: "error",
          title: t("Не удалось загрузить сэмплы"),
          message: String(error),
        });
      } finally {
        setSamplesBusy(false);
      }
    },
    [adminTokenReady, samplesStatus, t, toast],
  );

  useEffect(() => {
    if (tab === "beta") void loadBeta();
    if (tab === "samples") void loadAdminSamples();
  }, [loadAdminSamples, loadBeta, tab]);

  const moderate = async (
    sample: CommunitySample,
    mode: "approve" | "reject" | "feature" | "unfeature" | "delete",
  ) => {
    setSampleActionBusy(sample.id);
    try {
      await moderateSample(sample.id, mode);
      await loadAdminSamples();
      toast({
        kind: "success",
        title:
          mode === "approve"
            ? t("Сэмпл одобрен")
            : mode === "reject"
              ? t("Сэмпл отклонён")
              : mode === "feature"
                ? t("Добавлено в выбор комьюнити")
                : mode === "unfeature"
                  ? t("Убрано из выбора комьюнити")
                  : t("Сэмпл удалён"),
      });
    } catch (error) {
      toast({ kind: "error", title: t("Действие не выполнено"), message: String(error) });
    } finally {
      setSampleActionBusy(null);
    }
  };

  const generateBeta = async () => {
    setBetaBusy(true);
    try {
      const created = await createBetaInvites(betaNote.trim(), betaCount);
      setBetaNote("");
      await loadBeta();
      toast({
        kind: "success",
        title: t("Создано инвайтов: {count}", { count: created.length }),
        message: created.length ? created.slice(0, 3).join(" · ") : undefined,
      });
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось создать инвайты"), message: String(error) });
    } finally {
      setBetaBusy(false);
    }
  };

  const copyBeta = async (value: string) => {
    const ok = await copyText(value);
    toast({
      kind: ok ? "success" : "error",
      title: ok ? t("Инвайт скопирован") : t("Не удалось скопировать"),
    });
  };

  const removeBeta = async (code: string) => {
    try {
      await deleteBetaInvite(code);
      await loadBeta();
      toast({ kind: "success", title: t("Инвайт удалён") });
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось удалить инвайт"), message: String(error) });
    }
  };

  const clearBeta = async () => {
    try {
      const deleted = await clearUnusedBetaInvites();
      await loadBeta();
      setConfirmClearBeta(false);
      toast({ kind: "success", title: t("Удалено свободных инвайтов: {count}", { count: deleted }) });
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось очистить инвайты"), message: String(error) });
    }
  };

  const toggleSamplePlayback = (sample: CommunitySample) => {
    if (playingSample === sample.id) {
      adminSampleAudio?.pause();
      adminSampleAudio = null;
      setPlayingSample(null);
      return;
    }
    adminSampleAudio?.pause();
    const source = sample.fileUrl.startsWith("local:")
      ? convertFileSrc(sample.fileUrl.slice("local:".length))
      : sample.fileUrl;
    const audio = new Audio(source);
    audio.volume = 0.85;
    audio.onended = () => setPlayingSample(null);
    adminSampleAudio = audio;
    audio
      .play()
      .then(() => setPlayingSample(sample.id))
      .catch(() => setPlayingSample(null));
  };

  const loadAutomation = useCallback(async () => {
    if (!cloudEnabled || !adminTokenReady) {
      setAutoApprove(false);
      setAutoPending(0);
      return;
    }
    try {
      const config = await fetchAppConfig();
      setAutoApprove(config.autoApproveLicenses);
      setAutoSlugs(config.autoApproveSlugs ?? []);
      setAutoPending(config.pending);
      setAutoError(null);
    } catch (error) {
      setAutoError(String(error));
    }
  }, [adminTokenReady]);

  useEffect(() => {
    void refreshAdminData();
    void loadAutomation();
  }, [loadAutomation, refreshAdminData]);

  const toggleAutoApprove = async () => {
    if (!adminTokenReady || autoApprove === null) return;
    setAutoBusy(true);
    setAutoError(null);
    try {
      const config = await setAutoApproveLicenses(!autoApprove);
      setAutoApprove(config.autoApproveLicenses);
      setAutoSlugs(config.autoApproveSlugs ?? []);
      setAutoPending(config.pending);
      toast({
        kind: "success",
        title: config.autoApproveLicenses
          ? t("Автовыдача лицензий включена")
          : t("Автовыдача лицензий выключена"),
      });
    } catch (error) {
      setAutoError(String(error));
      toast({ kind: "error", title: t("Не удалось изменить автовыдачу"), message: String(error) });
    } finally {
      setAutoBusy(false);
    }
  };

  const toggleSlug = async (slug: string) => {
    if (!adminTokenReady || slugBusy) return;
    setSlugBusy(slug);
    setAutoError(null);
    try {
      const next = autoSlugs.includes(slug)
        ? autoSlugs.filter((value) => value !== slug)
        : [...autoSlugs, slug];
      const config = await setAutoApproveSlugs(next);
      setAutoSlugs(config.autoApproveSlugs ?? next);
      setAutoApprove(config.autoApproveLicenses);
      setAutoPending(config.pending);
      toast({
        kind: "success",
        title: next.includes(slug)
          ? t("Автовыдача включена для {name}", { name: slug })
          : t("Автовыдача выключена для {name}", { name: slug }),
      });
    } catch (error) {
      setAutoError(String(error));
      toast({ kind: "error", title: t("Не удалось изменить плагин"), message: String(error) });
    } finally {
      setSlugBusy(null);
    }
  };

  const approveAll = async () => {
    setApproveAllBusy(true);
    try {
      const result = await approveAllPending();
      await refreshAdminData();
      await loadAutomation();
      toast({
        kind: result.approved ? "success" : "info",
        title: t("Одобрено заявок: {count}", { count: result.approved }),
        message:
          result.failed > 0
            ? t("Не удалось подписать: {count}", { count: result.failed })
            : t("Очередь обработана."),
      });
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось одобрить заявки"), message: String(error) });
    } finally {
      setApproveAllBusy(false);
    }
  };

  const comments = overview?.comments ?? [];

  const loadPicked = async (path: string, withPreview = false): Promise<Picked & { preview?: string }> => {
    const stat = await fileStat(path);
    const picked: Picked & { preview?: string } = {
      path,
      name: stat?.name ?? path.split(/[\\/]/).pop() ?? "file",
      size: stat?.size ?? 0,
    };
    if (withPreview) {
      const preview = await readImageDataUrl(path);
      if (preview) picked.preview = preview;
    }
    return picked;
  };

  const handlePaths = useCallback(
    async (paths: string[]) => {
      for (const path of paths) {
        const lower = path.toLowerCase();
        const name = path.split(/[\\/]/).pop() ?? path;

        if (/\.(png|jpe?g|webp|gif)$/.test(lower)) {
          const picked = await loadPicked(path, true);
          setCover(picked);
          continue;
        }

        if (!lower.endsWith(".zip") && !lower.endsWith(".rar")) {
          toast({
            kind: "info",
            title: t("Неподдерживаемый файл"),
            message: t("{name}: нужен ZIP-архив или изображение обложки.", { name }),
          });
          continue;
        }

        const target: OS = /win|windows/.test(lower)
          ? "windows"
          : /mac|osx|darwin|universal/.test(lower)
            ? "macos"
            : !files.macos
              ? "macos"
              : "windows";

        const picked = await loadPicked(path);
        setFiles((prev) => ({
          ...prev,
          [target]: picked,
        }));
        toast({
          kind: "success",
          title: t("ZIP добавлен: {os}", { os: target === "macos" ? "macOS" : "Windows" }),
          message: name,
        });
      }
    },
    [files.macos, toast],
  );

  useEffect(() => {
    const disposers: Array<() => void> = [];

    (async () => {
      try {
        disposers.push(
          await listen("tauri://drag-enter", () => setDragActive(true)),
          await listen("tauri://drag-leave", () => setDragActive(false)),
          await listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
            setDragActive(false);
            void handlePaths(event.payload.paths ?? []);
          }),
        );
      } catch {
        // Drag & drop is only available in the desktop runtime.
      }
    })();

    return () => disposers.forEach((dispose) => dispose());
  }, [handlePaths]);

  useEffect(() => {
    if (overview) setLocalComments(overview.comments);
  }, [overview]);

  const browseZip = async (target: OS) => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "ZIP archive", extensions: ["zip"] }],
    });
    if (typeof selected === "string") {
      const picked = await loadPicked(selected);
      setFiles((prev) => ({ ...prev, [target]: picked }));
    }
  };

  const browseCover = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Cover image", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (typeof selected === "string") {
      setCover(await loadPicked(selected, true));
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFiles({});
    setCover(null);
    slugTouched.current = false;
  };

  const startEdit = (release: Release) => {
    setEditingId(release.id);
    setForm({
      title: release.title,
      slug: release.slug,
      version: release.version,
      category: release.category,
      descriptionRu: release.descriptionRu || release.description,
      descriptionEn: release.descriptionEn || release.description,
      productTag: release.productTag || "AETHER-VOCAL-STRIP",
      tier: release.tier ?? "free",
      badge: release.badge || "",
      preview: release.previews?.[0]?.url || "",
      featured: Boolean(release.featured),
    });
    setFiles({
      macos: release.files.macos
        ? {
            url: release.files.macos.url,
            name: release.files.macos.filename ?? `${release.slug}-macos.zip`,
            size: release.files.macos.sizeBytes,
          }
        : undefined,
      windows: release.files.windows
        ? {
            url: release.files.windows.url,
            name: release.files.windows.filename ?? `${release.slug}-windows.zip`,
            size: release.files.windows.sizeBytes,
          }
        : undefined,
    });
    setCover(
      release.coverUrl
        ? { url: release.coverUrl, name: "cover", size: 0, preview: release.coverUrl }
        : null,
    );
    slugTouched.current = true;
    setTab("publish");
    document.querySelector(".content")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onTitle = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: !editingId && !slugTouched.current ? slugify(value) : prev.slug,
    }));
  };

  const publish = async () => {
    if (!form.title.trim()) {
      toast({ kind: "error", title: t("Нужно название релиза") });
      return;
    }
    if (!form.slug.trim()) {
      toast({ kind: "error", title: t("Нужен slug") });
      return;
    }
    if (!files.macos && !files.windows) {
      toast({ kind: "error", title: t("Добавьте хотя бы один ZIP"), message: t("macOS или Windows сборку.") });
      return;
    }

    const editingRelease = editingId ? releases.find((r) => r.id === editingId) : undefined;
    const useCloud = cloudEnabled && adminTokenReady;

    setBusy(true);
    setStep(useCloud ? t("Подготовка облака…") : t("Сохранение локального каталога…"));

    try {
      const nextFiles: Release["files"] = {};

      for (const os of ["macos", "windows"] as OS[]) {
        const picked = files[os];
        if (!picked) continue;

        if (useCloud && picked.path) {
          setStep(t("Загрузка {os} сборки…", { os: os === "macos" ? "macOS" : "Windows" }));
          const filename = `${form.slug}-${os}-${Date.now()}.zip`;
          const result = await import("../lib/cloud").then(({ adminUpload }) =>
            adminUpload({
              localPath: picked.path!,
              storagePath: `releases/${form.slug}/${filename}`,
              contentType: "application/zip",
            }),
          );
          nextFiles[os] = {
            url: result.publicUrl,
            sizeBytes: picked.size,
            filename: picked.name,
          };
        } else if (picked.path) {
          nextFiles[os] = {
            url: `local:${picked.path}`,
            sizeBytes: picked.size,
            filename: picked.name,
          };
        } else if (picked.url) {
          nextFiles[os] = {
            url: picked.url,
            sizeBytes: picked.size,
            filename: picked.name,
          };
        }
      }

      let coverUrl = editingRelease?.coverUrl ?? null;

      if (cover?.path) {
        if (useCloud) {
          setStep(t("Загрузка обложки…"));
          const filename = `${form.slug}-cover-${Date.now()}.jpg`;
          const { adminUpload } = await import("../lib/cloud");
          const result = await adminUpload({
            localPath: cover.path,
            storagePath: `covers/${form.slug}/${filename}`,
            contentType: /\.png$/i.test(cover.name) ? "image/png" : "image/jpeg",
          });
          coverUrl = result.publicUrl;
        } else {
          coverUrl = cover.preview || null;
        }
      } else if (cover?.url) {
        coverUrl = cover.url;
      }

      setStep(t("Публикация в каталог…"));

      const saved = await saveRelease({
        id: editingId ?? undefined,
        slug: form.slug.trim(),
        category: form.category,
        title: form.title.trim(),
        version: form.version.trim() || "1.0",
        description: (form.descriptionEn || form.descriptionRu).trim(),
        descriptionRu: form.descriptionRu.trim() || null,
        descriptionEn: form.descriptionEn.trim() || null,
        coverUrl,
        files: nextFiles,
        productTag: form.category === "plugins" ? form.productTag : null,
        tier: form.category === "plugins" ? form.tier : "free",
        featured: form.featured,
        badge: form.badge.trim() || null,
        previews: form.preview.trim()
          ? [{ name: "Demo", url: form.preview.trim() }]
          : [],
      });

      await refreshCatalog();
      await refreshAdminData();
      toast({
        kind: "success",
        title: editingId ? t("Релиз обновлён") : t("Релиз опубликован"),
        message: useCloud
          ? t("{name} уже доступен всем пользователям.", { name: saved.title })
          : t("{name} сохранён в локальном каталоге (облако не подключено).", { name: saved.title }),
      });
      resetForm();
      setTab("releases");
      document.querySelector(".content")?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast({ kind: "error", title: t("Публикация не удалась"), message: String(error) });
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  const remove = async (release: Release) => {
    try {
      await deleteRelease(release.id);
      await refreshCatalog();
      await refreshAdminData();
      setConfirmDelete(null);
      toast({ kind: "success", title: t("{name} удалён", { name: release.title }) });
      if (editingId === release.id) resetForm();
    } catch (error) {
      toast({ kind: "error", title: t("Удаление не удалось"), message: String(error) });
    }
  };

  const pendingRequests = (overview?.requests ?? []).filter((r) => r.status === "pending").length;
  const pendingTotal = Math.max(autoPending, pendingRequests);
  const proPlugins = releases.filter(
    (release) => release.category === "plugins" && (release.tier ?? "free") === "pro",
  );
  const freeBetaCount = betaInvites.filter((invite) => !invite.usedByHwid).length;

  return (
    <div className="page">
      <div className="admin-hero">
        <div className="seal">
          <ShieldCheck size={19} />
        </div>
        <div className="copy">
          <h2>{t("Creator mode · только это устройство")}</h2>
          <p>
            {t("Приватный ключ:")} <code>{admin.privateKeyPath?.split(/[\\/]/).slice(-2).join("/")}</code>{" "}
            · <code>{adminTokenReady ? "cloud write enabled" : cloudEnabled ? "cloud read-only" : "local mode"}</code>
          </p>
        </div>
        <span className={`chip ${adminTokenReady ? "green" : "gold"}`}>
          {adminTokenReady ? "LIVE CLOUD" : cloudEnabled ? "CLOUD RO" : "LOCAL"}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            void refreshAdminData();
            void refreshCatalog();
            void loadAutomation();
          }}
        >
          <RefreshCw size={12} /> {t("Обновить")}
        </button>
      </div>

      {!adminTokenReady ? (
        <div className="notice">
          <AlertTriangle size={15} />
          <div>
            <b>{t("Публикация только локально.")}</b>{" "}
            {t(
              "Чтобы релизы видели все пользователи, добавьте Supabase URL, anon key и",
            )}{" "}
            <code>VITE_AETHER_ADMIN_TOKEN</code> {" "}
            {t(
              "задеплойте Edge Function и пересоберите приложение. Сейчас изменения сохраняются в локальный каталог этого устройства.",
            )}
          </div>
        </div>
      ) : null}

      <div
        className="admin-card glass"
        style={{ marginBottom: 16, padding: "18px 20px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="seal" style={{ width: 44, height: 44, borderRadius: 14, flex: "0 0 auto" }}>
            <Zap size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>{t("Автовыдача лицензий (Auto-Approve)")}</h3>
              <span className={`chip ${autoApprove ? "green" : ""}`}>
                {autoApprove === null ? "…" : autoApprove ? "ALL ON" : "OFF"}
              </span>
              {pendingTotal > 0 ? (
                <span className="chip gold">
                  {t("{count} ждут", { count: pendingTotal })}
                </span>
              ) : null}
            </div>
            <p className="sub" style={{ margin: "5px 0 0" }}>
              {t(
                "Общий режим одобряет все заявки. Ниже можно включить автовыдачу только для выбранных PRO-плагинов.",
              )}
            </p>
            {!cloudEnabled || !adminTokenReady ? (
              <p style={{ margin: "5px 0 0", fontSize: 10, color: "var(--gold)" }}>
                {t("Для автовыдачи нужен Cloud admin token.")}
              </p>
            ) : null}
            {autoError ? (
              <p style={{ margin: "5px 0 0", fontSize: 10, color: "var(--red)", wordBreak: "break-word" }}>
                {autoError}
              </p>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8, letterSpacing: "0.18em", color: "var(--dim)" }}>
              {t("ВСЕ")}
            </span>
            <button
              className={`toggle ${autoApprove ? "on" : ""}`}
              onClick={() => void toggleAutoApprove()}
              disabled={!cloudEnabled || !adminTokenReady || autoBusy || autoApprove === null}
              aria-pressed={Boolean(autoApprove)}
              aria-label={t("Автовыдача всех лицензий")}
              title={t("Автовыдача всех лицензий")}
            />
          </div>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => void approveAll()}
            disabled={!cloudEnabled || !adminTokenReady || approveAllBusy || pendingTotal === 0}
          >
            {approveAllBusy ? (
              <Loader2 size={12} className="spin" />
            ) : (
              <ListChecks size={12} />
            )}
            {t("Одобрить все ожидающие")}
            {pendingTotal > 0 ? ` · ${pendingTotal}` : ""}
          </button>
        </div>

        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <div>
              <b style={{ fontSize: 11 }}>{t("Автовыдача по PRO-плагинам")}</b>
              <p className="sub" style={{ margin: "3px 0 0" }}>
                {t("Переключатель действует на новые заявки выбранного плагина.")}
              </p>
            </div>
            <span className={`chip ${proPlugins.length ? "gold" : ""}`}>
              {proPlugins.length} PRO
            </span>
          </div>

          {proPlugins.length ? (
            <div className="release-list">
              {proPlugins.map((plugin) => {
                const slug = plugin.slug;
                const on = autoSlugs.includes(slug);
                return (
                  <div className="release-row" key={plugin.id} style={{ padding: "10px 12px" }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        display: "grid",
                        placeItems: "center",
                        background: on ? "rgba(94,234,212,.08)" : "rgba(255,210,122,.06)",
                        border: `1px solid ${on ? "rgba(94,234,212,.24)" : "rgba(255,210,122,.18)"}`,
                        color: on ? "var(--green)" : "var(--gold)",
                        flex: "0 0 auto",
                      }}
                    >
                      <Zap size={15} />
                    </div>
                    <div className="info" style={{ flex: 1, minWidth: 0 }}>
                      <b>{plugin.title}</b>
                      <span>
                        {slug} · v{plugin.version}
                      </span>
                    </div>
                    <span className={`chip ${on ? "green" : "gold"}`}>
                      {on ? t("АВТО") : "PRO"}
                    </span>
                    <button
                      className={`toggle ${on ? "on" : ""}`}
                      onClick={() => void toggleSlug(slug)}
                      disabled={!cloudEnabled || !adminTokenReady || slugBusy === slug}
                      aria-pressed={on}
                      aria-label={t("Автовыдача для {name}", { name: plugin.title })}
                      title={t("Автовыдача для {name}", { name: plugin.title })}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="notice"
              style={{ marginBottom: 0, borderColor: "rgba(196,181,253,.16)" }}
            >
              <Zap size={14} />
              <div>
                {t(
                  "Нет PRO-плагинов - переключатели появятся здесь автоматически при публикации PRO-версий.",
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="segmented">
        <button className={tab === "publish" ? "active" : ""} onClick={() => setTab("publish")}>
          <Plus size={12} /> {editingId ? t("Редактирование") : t("Новый релиз")}
        </button>
        <button className={tab === "releases" ? "active" : ""} onClick={() => setTab("releases")}>
          <Sparkles size={12} /> {t("Релизы")}{" "}
          <span style={{ opacity: 0.55 }}>{releases.length}</span>
        </button>
        <button className={tab === "moderation" ? "active" : ""} onClick={() => setTab("moderation")}>
          <MessageSquare size={12} /> {t("Модерация")}{" "}
          <span style={{ opacity: 0.55 }}>{comments.length}</span>
        </button>
        <button className={tab === "samples" ? "active" : ""} onClick={() => setTab("samples")}>
          <Waves size={12} /> {t("Модерация сэмплов")}
          {adminSamples.length ? (
            <span style={{ opacity: 0.55 }}>{adminSamples.length}</span>
          ) : null}
        </button>
        <button className={tab === "beta" ? "active" : ""} onClick={() => setTab("beta")}>
          <Ticket size={12} /> {t("Beta-инвайты")}
          {betaInvites.length ? (
            <span style={{ opacity: 0.55 }}>{betaInvites.length}</span>
          ) : null}
        </button>
      </div>

      {tab === "publish" ? (
        <>
          <div
            className="admin-card glass"
            style={
              dragActive
                ? { borderColor: "rgba(196,181,253,.55)", boxShadow: "0 0 0 1px rgba(139,92,246,.25), 0 0 70px -20px rgba(139,92,246,.7)" }
                : undefined
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>{editingId ? t("Живое редактирование") : t("Публикация релиза")}</h3>
              {editingId ? <span className="chip violet">EDIT</span> : null}
              {dragActive ? (
                <span className="chip green" style={{ marginLeft: "auto" }}>
                  <UploadCloud size={9} /> {t("Отпустите файлы")}
                </span>
              ) : null}
            </div>
            <p className="sub">
              {t(
                "Перетащите ZIP-архивы и обложку прямо в это окно (или выберите файлы). Для macOS положите в архив",
              )}{" "}
              <code>.vst3</code> / <code>.component</code>, {t("для Windows -")}{" "}
              <code>.vst3</code>.
            </p>

            <div className="drop-zones">
              <button className="drop-zone" onClick={() => void browseZip("macos")} type="button">
                {files.macos ? (
                  <>
                    <span className="dz-label">
                      <Check size={9} /> macOS
                    </span>
                    <span className="dz-title">{files.macos.name}</span>
                    <span className="dz-hint">
                      {files.macos.path ? formatBytes(files.macos.size) : t("уже в облаке")} · ZIP
                    </span>
                    <span
                      className="dz-clear"
                      role="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFiles((prev) => ({ ...prev, macos: undefined }));
                      }}
                    >
                      <X size={11} />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="dz-label">
                      <FileArchive size={9} /> macOS
                    </span>
                    <span className="dz-title">{t("Перетащите ZIP")}</span>
                    <span className="dz-hint">VST3 + AU, universal</span>
                  </>
                )}
              </button>

              <button className="drop-zone" onClick={() => void browseZip("windows")} type="button">
                {files.windows ? (
                  <>
                    <span className="dz-label">
                      <Check size={9} /> Windows
                    </span>
                    <span className="dz-title">{files.windows.name}</span>
                    <span className="dz-hint">
                      {files.windows.path ? formatBytes(files.windows.size) : t("уже в облаке")} · ZIP
                    </span>
                    <span
                      className="dz-clear"
                      role="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFiles((prev) => ({ ...prev, windows: undefined }));
                      }}
                    >
                      <X size={11} />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="dz-label">
                      <FileArchive size={9} /> Windows
                    </span>
                    <span className="dz-title">{t("Перетащите ZIP")}</span>
                    <span className="dz-hint">VST3 x64</span>
                  </>
                )}
              </button>

              <button
                className="drop-zone cover"
                onClick={() => void browseCover()}
                type="button"
              >
                {cover?.preview ? (
                  <img src={cover.preview} alt="" />
                ) : null}
                <div className="cover-copy" style={{ position: "relative" }}>
                  <span className="dz-label">
                    <ImageIcon size={9} /> {t("Обложка")}
                  </span>
                  <span className="dz-title" style={{ display: "block" }}>
                    {cover?.name === "cover"
                      ? t("Текущая обложка")
                      : cover?.name || t("Перетащите JPG")}
                  </span>
                  <span className="dz-hint">1200×750 · JPG / PNG</span>
                </div>
                {cover ? (
                  <span
                    className="dz-clear"
                    role="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setCover(null);
                    }}
                  >
                    <X size={11} />
                  </span>
                ) : null}
              </button>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>{t("Название")}</label>
                <input value={form.title} onChange={(event) => onTitle(event.target.value)} placeholder="AetherVocal Strip" />
              </div>
              <div className="field">
                <label>Slug</label>
                <input
                  value={form.slug}
                  onChange={(event) => {
                    slugTouched.current = true;
                    setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }));
                  }}
                  placeholder="aether-vocal-strip"
                />
              </div>
              <div className="field">
                <label>{t("Версия")}</label>
                <input
                  value={form.version}
                  onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))}
                  placeholder="1.2"
                />
              </div>
              <div className="field">
                <label>{t("Категория")}</label>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, category: event.target.value as Category }))
                  }
                >
                  <option value="plugins">Plugins</option>
                  <option value="drumkits">Drumkits</option>
                  <option value="presets">Presets</option>
                </select>
              </div>
              {form.category === "plugins" ? (
                <div className="field">
                  <label>{t("Тип доступа")}</label>
                  <div className="segmented" style={{ margin: 0 }}>
                    <button
                      type="button"
                      className={form.tier === "free" ? "active" : ""}
                      onClick={() => setForm((prev) => ({ ...prev, tier: "free" }))}
                    >
                      FREE
                    </button>
                    <button
                      type="button"
                      className={form.tier === "pro" ? "active" : ""}
                      onClick={() => setForm((prev) => ({ ...prev, tier: "pro" }))}
                    >
                      PRO
                    </button>
                    <button
                      type="button"
                      className={`beta ${form.tier === "beta" ? "active" : ""}`}
                      onClick={() => setForm((prev) => ({ ...prev, tier: "beta" }))}
                    >
                      BETA
                    </button>
                  </div>
                  <span className="hint">
                    {form.tier === "free"
                      ? t("Без лицензии: ключ создаётся автоматически при установке.")
                      : form.tier === "pro"
                        ? t("С лицензией: пользователь запрашивает ключ по Machine ID.")
                        : t(
                            "Ранний доступ: установка только для HWID с активированным Beta-инвайтом, лицензия выдаётся автоматически.",
                          )}
                  </span>
                </div>
              ) : null}
              <div className="field">
                <label>{t("Product tag (лицензия)")}</label>
                <input
                  value={form.productTag}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, productTag: event.target.value.toUpperCase() }))
                  }
                  placeholder="AETHER-VOCAL-STRIP"
                  disabled={form.category !== "plugins"}
                />
              </div>
              <div className="field">
                <label>{t("Бейдж")}</label>
                <input
                  value={form.badge}
                  onChange={(event) => setForm((prev) => ({ ...prev, badge: event.target.value }))}
                  placeholder="NEW / FREE / PACK"
                />
              </div>
              <div className="field span2">
                <label>Preview URL (MP3 / WAV)</label>
                <input
                  value={form.preview}
                  onChange={(event) => setForm((prev) => ({ ...prev, preview: event.target.value }))}
                  placeholder={t("https://…/demo.mp3 - для мини-плеера в карточке драм-кита")}
                />
              </div>
              <div className="field span2">
                <label>{t("Описание (RU)")}</label>
                <textarea
                  value={form.descriptionRu}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, descriptionRu: event.target.value }))
                  }
                  placeholder={t("Что внутри, для кого, чем отличается версия…")}
                  rows={3}
                />
              </div>
              <div className="field span2">
                <label>{t("Описание (EN)")}</label>
                <textarea
                  value={form.descriptionEn}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, descriptionEn: event.target.value }))
                  }
                  placeholder={t("What's inside, who it's for and what changed…")}
                  rows={3}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 18,
                flexWrap: "wrap",
              }}
            >
              <button
                className={`toggle ${form.featured ? "on" : ""}`}
                onClick={() => setForm((prev) => ({ ...prev, featured: !prev.featured }))}
                aria-label="Featured"
              />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("Featured на главной")}</span>

              <div style={{ flex: 1 }} />

              {busy ? (
                <span style={{ fontSize: 10.5, color: "var(--lav)", display: "flex", alignItems: "center", gap: 7 }}>
                  <Loader2 size={13} className="spin" /> {step}
                </span>
              ) : null}

              {editingId ? (
                <button className="btn btn-ghost" onClick={resetForm} disabled={busy}>
                  {t("Отмена")}
                </button>
              ) : null}

              <button className="btn btn-primary" onClick={() => void publish()} disabled={busy}>
                {busy ? <Loader2 size={14} className="spin" /> : <CloudUpload size={14} />}
                {editingId ? t("Сохранить в облако") : t("Опубликовать")}
              </button>
            </div>
          </div>

          <div className="admin-card glass">
            <h3>{t("Быстрые факты")}</h3>
            <p className="sub">{t("Так релиз увидят пользователи прямо сейчас.")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <div className="glass-soft" style={{ padding: 14 }}>
                <div className="label" style={{ fontSize: 9, color: "var(--dim)", letterSpacing: ".16em", textTransform: "uppercase" }}>
                  Apple Silicon / Intel
                </div>
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {files.macos ? formatBytes(files.macos.size) : t("не задано")}
                </div>
              </div>
              <div className="glass-soft" style={{ padding: 14 }}>
                <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: ".16em", textTransform: "uppercase" }}>
                  Windows x64
                </div>
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {files.windows ? formatBytes(files.windows.size) : t("не задано")}
                </div>
              </div>
              <div className="glass-soft" style={{ padding: 14 }}>
                <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: ".16em", textTransform: "uppercase" }}>
                  {t("Аудитория")}
                </div>
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {pendingRequests
                    ? t("{count} заявок ждут", { count: pendingRequests })
                    : t("нет новых заявок")}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {tab === "releases" ? (
        <div className="admin-card glass">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <h3>{t("Живой каталог")}</h3>
              <p className="sub" style={{ marginBottom: 10 }}>
                {t(
                  "Карандаш открывает live-редактирование. Изменения уходят в облако сразу после сохранения.",
                )}
              </p>
            </div>
            <button className="btn btn-soft btn-sm" onClick={() => setTab("publish")}>
              <Plus size={12} /> {t("Новый")}
            </button>
          </div>

          <div className="release-list">
            {releases.map((release) => {
              const mac = release.files.macos?.sizeBytes ?? 0;
              const win = release.files.windows?.sizeBytes ?? 0;
              return (
                <div className="release-row" key={release.id}>
                  {release.coverUrl ? (
                    <img src={release.coverUrl} alt="" />
                  ) : (
                    <div style={{ width: 62, height: 42, borderRadius: 8, background: "#151024", flex: "0 0 auto" }} />
                  )}
                  <div className="info">
                    <b>{release.title}</b>
                    <span>
                      {CATEGORY_META[release.category].singular} · v{release.version} · macOS{" "}
                      {mac ? formatBytes(mac) : "-"} · Win {win ? formatBytes(win) : "-"}
                    </span>
                  </div>
                  {release.category === "plugins" ? (
                    <span
                      className={`chip ${
                        release.tier === "beta"
                          ? "beta"
                          : release.tier === "pro"
                            ? "gold"
                            : "green"
                      }`}
                    >
                      {(release.tier ?? "free").toUpperCase()}
                    </span>
                  ) : null}
                  {release.featured ? <span className="chip gold">FEATURED</span> : null}
                  <span className="chip violet">{release.ratingAvg.toFixed(1)} ★</span>
                  <div className="row-actions">
                    <button className="row-icon" onClick={() => startEdit(release)} title={t("Редактировать")}>
                      <Pencil size={13} />
                    </button>
                    {confirmDelete === release.id ? (
                      <>
                        <button className="row-icon danger" onClick={() => void remove(release)} title={t("Подтвердить")}>
                          <Check size={13} />
                        </button>
                        <button className="row-icon" onClick={() => setConfirmDelete(null)} title={t("Отмена")}>
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <button className="row-icon danger" onClick={() => setConfirmDelete(release.id)} title={t("Удалить")}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!releases.length ? (
            <div className="empty-state" style={{ marginTop: 14 }}>
              <div className="icon">
                <Sparkles size={20} />
              </div>
              <h3>{t("Каталог пуст")}</h3>
              <p>{t("Опубликуйте первый релиз - он сразу появится у всех пользователей.")}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "moderation" ? (
        <div className="admin-card glass">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3>{t("Модерация комментариев")}</h3>
              <p className="sub" style={{ marginBottom: 12 }}>
                {t("Удаление мгновенно убирает комментарий из облака у всех пользователей.")}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => void refreshAdminData()}>
              <RefreshCw size={12} /> {t("Обновить")}
            </button>
          </div>

          {(localComments ?? comments).map((comment) => (
            <div className="mod-row" key={comment.id}>
              <Avatar name={comment.nickname} src={comment.avatarUrl} size={30} />
              <div className="body">
                <div style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
                  <b style={{ fontSize: 11.5 }}>{comment.nickname}</b>
                  <span style={{ fontSize: 9, color: "var(--dim)" }}>
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <p>{comment.body}</p>
                <div className="meta">{comment.releaseTitle ?? "release"}</div>
              </div>
              <button
                className="row-icon danger"
                onClick={() => {
                  setLocalComments((prev) => (prev ?? comments).filter((c) => c.id !== comment.id));
                  void removeComment(comment.releaseId, comment.id);
                }}
                title={t("Удалить комментарий")}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {!(localComments ?? comments).length ? (
            <div className="empty-state" style={{ marginTop: 8 }}>
              <div className="icon">
                <MessageSquare size={20} />
              </div>
              <h3>{t("Комментариев нет")}</h3>
              <p>{t("Здесь появятся все сообщения пользователей для модерации.")}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "samples" ? (
        <div className="admin-card glass">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3>
                <Waves size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
                {t("Модерация Samples & Loops")}
              </h3>
              <p className="sub" style={{ marginBottom: 10 }}>
                {t(
                  "Прослушайте загрузку и одобрите её, добавьте в выбор комьюнити или отклоните.",
                )}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div className="filter-row">
                {(["pending", "approved", "rejected", "all"] as const).map((status) => (
                  <button
                    key={status}
                    className={`filter-pill ${samplesStatus === status ? "active" : ""}`}
                    onClick={() => {
                      setSamplesStatus(status);
                      void loadAdminSamples(status);
                    }}
                  >
                    {status === "pending"
                      ? t("На модерации")
                      : status === "approved"
                        ? t("Одобренные")
                        : status === "rejected"
                          ? t("Отклонённые")
                          : t("Все")}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void loadAdminSamples()}
                disabled={samplesBusy}
              >
                <RefreshCw size={12} className={samplesBusy ? "spin" : ""} /> {t("Обновить")}
              </button>
            </div>
          </div>

          {adminSamples.length ? (
            <div className="admin-sample-list">
              {adminSamples.map((sample) => (
                <div className="admin-sample-row" key={sample.id}>
                  <button
                    className={`sample-play ${playingSample === sample.id ? "playing" : ""}`}
                    onClick={() => toggleSamplePlayback(sample)}
                    aria-label={t("Прослушать")}
                  >
                    {playingSample === sample.id ? <Pause size={13} /> : <Play size={13} />}
                  </button>

                  <div className="admin-sample-main">
                    <div className="admin-sample-title">
                      <b>{sample.title}</b>
                      <span className={`chip ${sample.isFeatured ? "beta" : ""}`}>
                        {sample.isFeatured
                          ? t("FEATURED")
                          : t(SAMPLE_CATEGORY_META[sample.category]?.short ?? "СЭМПЛ")}
                      </span>
                      <span className={`chip ${sample.status === "approved" ? "green" : sample.status === "rejected" ? "" : "gold"}`}>
                        {sample.status === "approved"
                          ? t("ОДОБРЕН")
                          : sample.status === "rejected"
                            ? t("ОТКЛОНЁН")
                            : t("ОЖИДАЕТ")}
                      </span>
                    </div>
                    <div className="admin-sample-meta">
                      {sample.authorName} · {sample.bpm ? `${sample.bpm} BPM` : "-"} ·{" "}
                      {sample.musicalKey || "-"} · {timeAgo(sample.createdAt)}
                    </div>
                    <div className="sample-wave small">
                      {(sample.waveformPeaks.length
                        ? sample.waveformPeaks
                        : Array.from({ length: 48 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7)) * 0.7)
                      ).map((peak, index) => (
                        <i key={index} style={{ height: `${Math.max(8, peak * 100)}%` }} />
                      ))}
                    </div>
                  </div>

                  <div className="admin-sample-actions">
                    {sample.status !== "approved" ? (
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={() => void moderate(sample, "approve")}
                        disabled={sampleActionBusy === sample.id}
                      >
                        <Check size={11} /> {t("Одобрить")}
                      </button>
                    ) : null}
                    {sample.status === "pending" ? (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => void moderate(sample, "reject")}
                        disabled={sampleActionBusy === sample.id}
                      >
                        <X size={11} /> {t("Отклонить")}
                      </button>
                    ) : null}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void moderate(sample, sample.isFeatured ? "unfeature" : "feature")}
                      disabled={sampleActionBusy === sample.id}
                    >
                      <Star size={11} />{" "}
                      {sample.isFeatured ? t("Убрать из выбора") : t("В выбор комьюнити")}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => void moderate(sample, "delete")}
                      disabled={sampleActionBusy === sample.id}
                    >
                      <Trash2 size={11} /> {t("Удалить")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: 8 }}>
              <div className="icon">
                <Waves size={20} />
              </div>
              <h3>{t("Очередь пуста")}</h3>
              <p>{t("Новые загрузки комьюнити появятся здесь для премодерации.")}</p>
            </div>
          )}
        </div>
      ) : null}

      {tab === "beta" ? (
        <div className="admin-card glass">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <h3>
                <Ticket size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
                {t("Beta-инвайты")}
              </h3>
              <p className="sub" style={{ marginBottom: 10 }}>
                {t(
                  "Одноразовые коды AETHER-BETA-XXXX. Активированный код закрепляется за HWID и даёт бейдж BETA TESTER в профиле.",
                )}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {confirmClearBeta ? (
                <>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => void clearBeta()}
                  >
                    {t("Удалить свободные")}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmClearBeta(false)}
                  >
                    {t("Отмена")}
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmClearBeta(true)}
                  disabled={betaLoading || freeBetaCount === 0}
                >
                  <Trash2 size={12} /> {t("Очистить свободные")}
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => void loadBeta()} disabled={betaLoading}>
                <RefreshCw size={12} className={betaLoading ? "spin" : ""} /> {t("Обновить")}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-end",
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label>{t("Заметка (например, имя тестера)")}</label>
              <input
                value={betaNote}
                onChange={(event) => setBetaNote(event.target.value)}
                placeholder="vip tester · telegram @…"
                maxLength={160}
              />
            </div>
            <div className="field" style={{ width: 110 }}>
              <label>{t("Сколько")}</label>
              <input
                type="number"
                min={1}
                max={100}
                value={betaCount}
                onChange={(event) => {
                  const next = Math.floor(Number(event.target.value));
                  setBetaCount(Math.max(1, Math.min(100, Number.isFinite(next) ? next : 1)));
                }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => void generateBeta()}
              disabled={betaBusy}
            >
              {betaBusy ? <Loader2 size={13} className="spin" /> : <Plus size={13} />}
              {t("Сгенерировать")}
            </button>
          </div>

          {betaInvites.length ? (
            <div className="release-list">
              {betaInvites.map((invite) => (
                <div className="release-row" key={invite.code}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      display: "grid",
                      placeItems: "center",
                      background: invite.usedByHwid
                        ? "rgba(255,210,122,.08)"
                        : "rgba(94,234,212,.08)",
                      border: `1px solid ${invite.usedByHwid ? "rgba(255,210,122,.22)" : "rgba(94,234,212,.22)"}`,
                      color: invite.usedByHwid ? "var(--gold)" : "var(--green)",
                      flex: "0 0 auto",
                    }}
                  >
                    <Ticket size={16} />
                  </div>
                  <div className="info" style={{ flex: 1, minWidth: 0 }}>
                    <b className="mono" style={{ fontSize: 11 }}>{invite.code}</b>
                    <span>
                      {invite.note || t("без заметки")} · {formatDate(invite.createdAt)}
                      {invite.usedByHwid ? ` · ${invite.usedByHwid}` : ""}
                    </span>
                  </div>
                  <span className={`chip ${invite.usedByHwid ? "gold" : "green"}`}>
                    {invite.usedByHwid ? t("АКТИВИРОВАН") : t("СВОБОДЕН")}
                  </span>
                  <button
                    className="row-icon"
                    onClick={() => void copyBeta(invite.code)}
                    title={t("Скопировать код")}
                  >
                    <Copy size={13} />
                  </button>
                  {!invite.usedByHwid ? (
                    <button
                      className="row-icon danger"
                      onClick={() => void removeBeta(invite.code)}
                      title={t("Удалить свободный инвайт")}
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: 8 }}>
              <div className="icon">
                <Ticket size={20} />
              </div>
              <h3>{t("Инвайтов пока нет")}</h3>
              <p>{t("Сгенерируйте первую партию кодов для закрытого теста.")}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
