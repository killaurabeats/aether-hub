import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import {
  Check,
  Clock3,
  Download,
  Flame,
  GripVertical,
  Heart,
  HelpCircle,
  Info,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  Sparkles,
  Star,
  Upload,
  Users,
  Waves,
  X,
} from "lucide-react";
import type { CommunitySample, SampleCategory } from "../types";
import { SAMPLE_CATEGORY_META } from "../types";
import { isTauri, useStore } from "../lib/store";
import {
  cacheSamplePath,
  cloudEnabled,
  readLocalFileBase64,
  sampleDragIconPath,
  saveSamplePath,
  uploadSampleFile,
} from "../lib/cloud";
import { formatDate, timeAgo } from "../lib/format";
import { AetherSelect } from "./AetherSelect";

type SampleTab = "all" | "top" | "community";
type TypeFilter = "all" | SampleCategory;

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const MUSICAL_KEYS = [
  "Any",
  ...NOTES.flatMap((note) => [`${note} min`, `${note} maj`]),
];

const SAMPLE_CATEGORY_OPTIONS = Object.entries(SAMPLE_CATEGORY_META) as Array<
  [SampleCategory, { label: string; short: string }]
>;

const BPM_FILTERS: Array<{ id: string; label: string; test: (bpm: number | null) => boolean }> = [
  { id: "all", label: "Любой BPM", test: () => true },
  { id: "70-90", label: "70-90", test: (bpm) => bpm != null && bpm >= 70 && bpm <= 90 },
  { id: "90-110", label: "90-110", test: (bpm) => bpm != null && bpm >= 90 && bpm <= 110 },
  { id: "110-130", label: "110-130", test: (bpm) => bpm != null && bpm >= 110 && bpm <= 130 },
  { id: "130-150", label: "130-150", test: (bpm) => bpm != null && bpm >= 130 && bpm <= 150 },
  { id: "150-plus", label: "150+", test: (bpm) => bpm != null && bpm >= 150 },
];

let activeStopFn: (() => void) | null = null;

function playbackUrl(sample: CommunitySample): string {
  if (sample.fileUrl.startsWith("local:")) {
    const path = sample.fileUrl.slice("local:".length);
    return isTauri ? convertFileSrc(path) : "";
  }
  return sample.fileUrl;
}

function sampleFilename(sample: CommunitySample) {
  const extension = sample.fileUrl.toLowerCase().endsWith(".mp3") ? "mp3" : "wav";
  const safe = sample.title
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "aether-sample";
  return `${safe}-${sample.id.slice(0, 6)}.${extension}`;
}

function Waveform({
  peaks,
  progress,
  playing,
  onToggle,
  compact = false,
  id,
}: {
  peaks: number[];
  progress: number;
  playing: boolean;
  onToggle: () => void;
  compact?: boolean;
  id: string;
}) {
  const bars = useMemo(() => {
    if (peaks.length) return peaks.slice(0, 96);
    return Array.from({ length: 64 }, (_, index) => {
      const seed = id.charCodeAt(index % id.length) || 7;
      return 0.18 + Math.abs(Math.sin((index + seed) * 1.37)) * 0.78;
    });
  }, [id, peaks]);

  return (
    <button
      className={`sample-wave ${compact ? "small" : ""} ${playing ? "playing" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={playing ? "Pause" : "Play"}
      type="button"
    >
      <span className="sample-wave-play">
        {playing ? <Pause size={11} /> : <Play size={11} />}
      </span>
      <span className="sample-wave-bars">
        {bars.map((peak, index) => {
          const filled = index / bars.length <= progress;
          return (
            <i
              key={index}
              className={filled ? "filled" : ""}
              style={{ height: `${Math.max(7, Math.round(peak * 100))}%` }}
            />
          );
        })}
      </span>
    </button>
  );
}

function SampleCard({
  sample,
  onPlayStart,
}: {
  sample: CommunitySample;
  onPlayStart: () => void;
}) {
  const { likeSample, trackSampleDownload, toast, t } = useStore();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [caching, setCaching] = useState(false);
  const [dragReady, setDragReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragPathRef = useRef<string | null>(null);
  const dragIconRef = useRef<string | null>(null);
  const primeTimer = useRef<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioRef.current?.pause();
    setPlaying(false);
    if (activeStopFn === stopRef.current) activeStopFn = null;
  }, []);

  useEffect(() => {
    return () => {
      if (primeTimer.current) window.clearTimeout(primeTimer.current);
      stop();
      audioRef.current = null;
    };
  }, [stop]);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    setProgress(duration > 0 ? Math.min(1, audio.currentTime / duration) : 0);
    if (!audio.paused) rafRef.current = window.requestAnimationFrame(tick);
  }, []);

  const toggle = () => {
    if (!isTauri && sample.fileUrl.startsWith("local:")) {
      toast({ kind: "info", title: t("Локальный файл доступен только в приложении") });
      return;
    }

    if (playing) {
      stop();
      return;
    }

    activeStopFn?.();
    onPlayStart();

    if (!audioRef.current) {
      const audio = new Audio(playbackUrl(sample));
      audio.volume = 0.86;
      audio.preload = "auto";
      audio.onended = () => {
        setPlaying(false);
        setProgress(0);
        if (activeStopFn === stopRef.current) activeStopFn = null;
      };
      audioRef.current = audio;
    }

    stopRef.current = stop;
    activeStopFn = stop;
    void audioRef.current
      .play()
      .then(() => {
        setPlaying(true);
        rafRef.current = window.requestAnimationFrame(tick);
        void primeDrag();
      })
      .catch(() => setPlaying(false));
  };

  const primeDrag = useCallback(async () => {
    if (!isTauri || dragPathRef.current) return;
    setCaching(true);
    try {
      dragPathRef.current = await cacheSamplePath(sample.fileUrl, sampleFilename(sample));
      dragIconRef.current = await sampleDragIconPath();
      setDragReady(true);
    } catch {
      // Drag still works after a successful retry; playback is unaffected.
    } finally {
      setCaching(false);
    }
  }, [sample]);

  const onPointerEnter = () => {
    if (!isTauri || dragPathRef.current || primeTimer.current) return;
    primeTimer.current = window.setTimeout(() => {
      primeTimer.current = null;
      void primeDrag();
    }, 420);
  };

  const onPointerDown = async (event: ReactPointerEvent<HTMLElement>) => {
    if (!isTauri) return;
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    if (!dragPathRef.current) {
      event.preventDefault();
      await primeDrag();
      if (dragPathRef.current) {
        toast({
          kind: "info",
          title: t("Файл готов - потяните карточку в FL Studio"),
          message: t("Локальный кэш: {path}", { path: dragPathRef.current }),
        });
      }
      return;
    }

    event.preventDefault();
    try {
      await startDrag({
        item: [dragPathRef.current],
        icon: dragIconRef.current ?? dragPathRef.current,
        mode: "copy",
      });
    } catch (error) {
      toast({
        kind: "error",
        title: t("Не удалось начать перетаскивание"),
        message: String(error),
      });
    }
  };

  const download = async () => {
    const filename = sampleFilename(sample);
    try {
      if (isTauri) {
        const path = await saveSamplePath(sample.fileUrl, filename);
        toast({
          kind: "success",
          title: t("Сэмпл сохранён"),
          message: path,
        });
      } else {
        const link = document.createElement("a");
        link.href = sample.fileUrl;
        link.download = filename;
        link.click();
      }
      void trackSampleDownload(sample);
    } catch (error) {
      toast({ kind: "error", title: t("Не удалось скачать"), message: String(error) });
    }
  };

  return (
    <motion.article
      className="sample-card glass"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onPointerEnter={onPointerEnter}
      onPointerDown={(event) => void onPointerDown(event)}
      title={t("Перетащите в FL Studio или прослушайте")}
    >
      <div className="sample-card-top">
        <span
          className={`chip ${
            sample.category === "loop"
              ? "violet"
              : sample.category === "oneshot"
                ? "green"
                : ""
          }`}
        >
          {t(SAMPLE_CATEGORY_META[sample.category]?.short ?? "СЭМПЛ")}
        </span>
        {sample.isFeatured ? (
          <span className="chip beta">
            <Star size={8} /> {t("ВЫБОР КОМЬЮНИТИ")}
          </span>
        ) : null}
        <span className="spacer" />
        <span className={`sample-drag ${dragReady ? "ready" : ""}`}>
          {caching ? (
            <Loader2 size={10} className="spin" />
          ) : (
            <GripVertical size={10} />
          )}
          {dragReady ? t("DRAG") : caching ? t("КЭШ") : t("DRAG")}
        </span>
      </div>

      <Waveform
        peaks={sample.waveformPeaks}
        progress={progress}
        playing={playing}
        onToggle={toggle}
        id={sample.id}
      />

      <div className="sample-title-row">
        <h3>{sample.title}</h3>
        <span className="sample-bpm">{sample.bpm ? `${sample.bpm} BPM` : "-"}</span>
      </div>

      <div className="sample-meta-row">
        <span>
          <Users size={9} /> {sample.authorName}
        </span>
        <span>{sample.musicalKey || "-"}</span>
        <span>{timeAgo(sample.createdAt)}</span>
      </div>

      <div className="sample-actions">
        <button
          className="sample-action"
          onClick={(event) => {
            event.stopPropagation();
            void likeSample(sample);
          }}
          title={t("Лайк")}
        >
          <Heart size={11} /> {sample.likesCount}
        </button>
        <button
          className="sample-action"
          onClick={(event) => {
            event.stopPropagation();
            void download();
          }}
          title={t("Скачать")}
        >
          <Download size={11} /> {sample.downloadsCount}
        </button>
        <span className="sample-file-date">{formatDate(sample.createdAt)}</span>
      </div>
    </motion.article>
  );
}

export function SamplesView() {
  const {
    samples,
    samplesLoading,
    machine,
    profile,
    refreshSamples,
    submitSample,
    toast,
    t,
  } = useStore();

  const [tab, setTab] = useState<SampleTab>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bpmFilter, setBpmFilter] = useState("all");
  const [exactBpm, setExactBpm] = useState("");
  const [keyFilter, setKeyFilter] = useState("Any");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [weekReset, setWeekReset] = useState(0);

  useEffect(() => {
    void refreshSamples();
  }, [refreshSamples, weekReset]);

  const filtered = useMemo(() => {
    const bpmRule = BPM_FILTERS.find((item) => item.id === bpmFilter) ?? BPM_FILTERS[0];
    let list = samples.filter((sample) => sample.status === "approved");

    if (typeFilter !== "all") {
      list = list.filter((sample) => sample.category === typeFilter);
    }
    if (bpmFilter === "exact") {
      const exact = Number(exactBpm);
      list = list.filter(
        (sample) => Number.isFinite(exact) && sample.bpm != null && sample.bpm === exact,
      );
    } else {
      list = list.filter((sample) => bpmRule.test(sample.bpm));
    }
    if (keyFilter !== "Any") {
      list = list.filter((sample) => sample.musicalKey === keyFilter);
    }
    if (tab === "community") {
      list = list.filter((sample) => sample.isFeatured);
    }

    if (tab === "top") {
      const cutoff = Date.now() - 7 * 24 * 3600_000;
      const weekly = list.filter((sample) => Date.parse(sample.createdAt) >= cutoff);
      const source = weekly.length ? weekly : list;
      return [...source].sort(
        (a, b) =>
          b.downloadsCount * 2 + b.likesCount * 3 -
          (a.downloadsCount * 2 + a.likesCount * 3),
      );
    }

    return [...list].sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [bpmFilter, exactBpm, keyFilter, samples, tab, typeFilter]);

  const counts = useMemo(
    () => ({
      all: samples.length,
      top: samples.filter((sample) => Date.parse(sample.createdAt) >= Date.now() - 7 * 24 * 3600_000)
        .length,
      community: samples.filter((sample) => sample.isFeatured).length,
    }),
    [samples],
  );

  const categoryOptions = [
    { value: "all", label: t("Все категории") },
    ...SAMPLE_CATEGORY_OPTIONS.map(([id, meta]) => ({
      value: id,
      label: t(meta.label),
    })),
  ];

  const bpmOptions = BPM_FILTERS.map((item) => ({
    value: item.id,
    label: item.label,
  }));
  if (exactBpm) {
    bpmOptions.push({
      value: "exact",
      label: t("Точный BPM: {bpm}", { bpm: exactBpm }),
    });
  }

  const keyOptions = MUSICAL_KEYS.map((key) => ({
    value: key,
    label: key === "Any" ? t("Любая тональность") : key,
  }));

  return (
    <div className="page samples-page">
      <section className="samples-hero glass">
        <div className="samples-hero-copy">
          <span className="eyebrow">Aether Community · Samples & Loops</span>
          <h1>
            {t("Звуки")} <em>{t("комьюнити.")}</em>
          </h1>
          <p>
            {t(
              "Лупы и ваншоты от продюсеров Aether. Слушайте прямо в хабе и перетаскивайте файл на плейлист FL Studio - без ручного поиска в проводнике.",
            )}
          </p>
          <div className="samples-hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setUploadOpen(true)}>
              <Upload size={15} /> {t("Загрузить сэмпл")}
            </button>
            <span className="samples-help-wrap">
              <button
                className="samples-help"
                aria-label={t("Подсказка по Samples & Loops")}
                title={t("Подсказка по Samples & Loops")}
              >
                <HelpCircle size={15} />
              </button>
              <span className="samples-help-tip">
                {t(
                  "Все загрузки проходят премодерацию. Перетаскивание работает в установленном Aether Hub: файл кэшируется локально и передаётся в DAW.",
                )}
              </span>
            </span>
            <button
              className="btn btn-ghost btn-lg"
              onClick={() => {
                setWeekReset((value) => value + 1);
                toast({ kind: "info", title: t("Библиотека обновлена") });
              }}
            >
              <Waves size={15} /> {t("Обновить")}
            </button>
          </div>
          <div className="samples-hero-stats">
            <div>
              <strong>{samples.length}</strong>
              <span>{t("сэмплов")}</span>
            </div>
            <div>
              <strong>{counts.community}</strong>
              <span>{t("выбор комьюнити")}</span>
            </div>
            <div>
              <strong>WAV · MP3</strong>
              <span>{t("мгновенный preview")}</span>
            </div>
          </div>
        </div>
        <div className="samples-hero-art">
          <span className="samples-orbit a" />
          <span className="samples-orbit b" />
          <Waves size={96} />
          <div className="samples-drag-hint">
            <GripVertical size={13} /> DRAG → FL STUDIO
          </div>
        </div>
      </section>

      <div className="samples-toolbar">
        <div className="segmented samples-tabs">
          <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
            <Waves size={12} /> {t("Все")} <span className="tab-count">{counts.all}</span>
          </button>
          <button className={tab === "top" ? "active" : ""} onClick={() => setTab("top")}>
            <Flame size={12} /> {t("Топ недели")} <span className="tab-count">{counts.top}</span>
          </button>
          <button
            className={tab === "community" ? "active" : ""}
            onClick={() => setTab("community")}
          >
            <Star size={12} /> {t("Выбор комьюнити")}{" "}
            <span className="tab-count">{counts.community}</span>
          </button>
        </div>

        <div className="samples-filters">
          <AetherSelect
            value={typeFilter}
            options={categoryOptions}
            onChange={(value) => setTypeFilter(value as TypeFilter)}
            icon={<Sparkles size={11} />}
            ariaLabel={t("Категория сэмпла")}
            className="samples-filter-select category"
          />

          <AetherSelect
            value={bpmFilter}
            options={bpmOptions}
            onChange={(value) => setBpmFilter(value)}
            icon={<Clock3 size={11} />}
            ariaLabel="BPM"
            className="samples-filter-select bpm"
            footer={
              <div className="bpm-exact-input">
                <span>{t("Точный BPM")}</span>
                <input
                  value={exactBpm}
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="128"
                  onChange={(event) => {
                    const next = event.target.value.replace(/[^0-9]/g, "");
                    setExactBpm(next);
                    setBpmFilter(next ? "exact" : "all");
                  }}
                />
              </div>
            }
          />

          <AetherSelect
            value={keyFilter}
            options={keyOptions}
            onChange={setKeyFilter}
            icon={<Music2 size={11} />}
            ariaLabel={t("Тональность")}
            className="samples-filter-select key"
          />
        </div>
      </div>

      {samplesLoading && !samples.length ? (
        <div className="release-grid">
          {[0, 1, 2, 3].map((index) => (
            <div className="glass" key={index} style={{ height: 230 }}>
              <div className="skeleton" style={{ height: 95, margin: 16, borderRadius: 14 }} />
              <div style={{ padding: "0 16px" }}>
                <div className="skeleton" style={{ height: 14, width: "60%" }} />
                <div className="skeleton" style={{ height: 10, width: "85%", marginTop: 10 }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length ? (
        <div className="sample-grid">
          {filtered.map((sample) => (
            <SampleCard key={sample.id} sample={sample} onPlayStart={() => undefined} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="icon">
            <Waves size={22} />
          </div>
          <h3>{t("Под эти фильтры пока ничего нет")}</h3>
          <p>
            {t(
              "Сбросьте фильтры или загрузите свой первый луп - после премодерации он появится здесь.",
            )}
          </p>
          <button className="btn btn-soft btn-sm" onClick={() => setUploadOpen(true)}>
            <Plus size={12} /> {t("Загрузить сэмпл")}
          </button>
        </div>
      )}

      <AnimatePresence>
        {uploadOpen ? (
          <UploadSampleModal
            onClose={() => setUploadOpen(false)}
            onSubmit={submitSample}
            machineId={machine.formatted}
            defaultNickname={profile.nickname}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function UploadSampleModal({
  onClose,
  onSubmit,
  machineId,
  defaultNickname,
}: {
  onClose: () => void;
  onSubmit: ReturnType<typeof useStore>["submitSample"];
  machineId: string;
  defaultNickname: string;
}) {
  const { toast, t } = useStore();
  const [title, setTitle] = useState("");
  const [nickname, setNickname] = useState(defaultNickname || "aether user");
  const [category, setCategory] = useState<SampleCategory>("loop");
  const [bpm, setBpm] = useState("140");
  const [musicalKey, setMusicalKey] = useState("A min");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const analyzeBuffer = async (buffer: ArrayBuffer) => {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    try {
      const decoded = await ctx.decodeAudioData(buffer.slice(0));
      const data = decoded.getChannelData(0);
      const bucket = Math.max(1, Math.floor(data.length / 96));
      const next: number[] = [];
      let max = 0;
      for (let index = 0; index < 96; index += 1) {
        let sum = 0;
        const start = index * bucket;
        const end = Math.min(data.length, start + bucket);
        for (let cursor = start; cursor < end; cursor += 1) {
          sum += Math.abs(data[cursor] ?? 0);
        }
        const value = sum / Math.max(1, end - start);
        next.push(value);
        if (value > max) max = value;
      }
      setPeaks(next.map((value) => (max > 0 ? Math.min(1, value / max) : 0)));
    } catch {
      setPeaks([]);
    } finally {
      void ctx.close();
    }
  };

  const pickFile = async () => {
    if (!isTauri) {
      inputRef.current?.click();
      return;
    }
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Audio", extensions: ["wav", "mp3"] }],
    });
    if (typeof selected !== "string") return;
    setFilePath(selected);
    setFileName(selected.split(/[\\/]/).pop() ?? "sample.wav");
    setFileObject(null);
    if (!title) {
      const base = (selected.split(/[\\/]/).pop() ?? "").replace(/\.(wav|mp3)$/i, "");
      setTitle(base.slice(0, 60));
    }
    setAnalyzing(true);
    try {
      const base64 = await readLocalFileBase64(selected, 96 * 1024 * 1024);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      await analyzeBuffer(bytes.buffer);
    } catch {
      setPeaks([]);
    } finally {
      setAnalyzing(false);
    }
  };

  const pickBrowserFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(wav|mp3)$/i.test(file.name)) {
      toast({ kind: "error", title: t("Нужен файл .wav или .mp3") });
      return;
    }
    setFileObject(file);
    setFilePath(null);
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.(wav|mp3)$/i, "").slice(0, 60));
    setAnalyzing(true);
    try {
      await analyzeBuffer(await file.arrayBuffer());
    } catch {
      setPeaks([]);
    } finally {
      setAnalyzing(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      toast({ kind: "error", title: t("Введите название сэмпла") });
      return;
    }
    if (!filePath && !fileObject) {
      toast({ kind: "error", title: t("Выберите .wav или .mp3 файл") });
      return;
    }

    setBusy(true);
    try {
      const bpmValue = bpm.trim() ? Math.max(20, Math.min(400, Number(bpm))) : null;
      let fileUrl = "";
      const originalName = fileName ?? "aether-sample.wav";
      const extension = originalName.toLowerCase().endsWith(".mp3") ? "mp3" : "wav";
      const contentType = extension === "mp3" ? "audio/mpeg" : "audio/wav";

      if (isTauri && filePath) {
        if (cloudEnabled) {
          const storagePath = `samples/${machineId.replace(/[^0-9A-Fa-f]/g, "")}/${Date.now()}-${originalName
            .replace(/[^a-zA-Z0-9._-]/g, "-")
            .slice(-80)}`;
          const uploaded = await uploadSampleFile({
            localPath: filePath,
            storagePath,
            contentType,
          });
          fileUrl = uploaded.publicUrl;
        } else {
          fileUrl = `local:${filePath}`;
        }
      } else if (fileObject && cloudEnabled) {
        const storagePath = `samples/${machineId.replace(/[^0-9A-Fa-f]/g, "")}/${Date.now()}-${fileObject.name
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .slice(-80)}`;
        const response = await fetch(
          `${cloudConfig().url}/storage/v1/object/aether-samples/${storagePath}`,
          {
            method: "POST",
            headers: {
              apikey: cloudConfig().anonKey,
              ...(cloudConfig().anonKey.startsWith("sb_publishable_")
                ? {}
                : { Authorization: `Bearer ${cloudConfig().anonKey}` }),
              "Content-Type": contentType,
              "x-upsert": "true",
            },
            body: fileObject,
          },
        );
        if (!response.ok) throw new Error(await response.text());
        fileUrl = `${cloudConfig().url}/storage/v1/object/public/aether-samples/${storagePath}`;
      } else {
        fileUrl = URL.createObjectURL(fileObject!);
      }

      const created = await onSubmit({
        title: title.trim(),
        authorHwid: machineId,
        authorName: nickname.trim() || "aether user",
        category,
        bpm: bpmValue,
        musicalKey: musicalKey === "Any" ? null : musicalKey,
        fileUrl,
        waveformPeaks: peaks,
      });
      if (created) onClose();
    } catch (error) {
      toast({ kind: "error", title: t("Загрузка не удалась"), message: String(error) });
    } finally {
      setBusy(false);
    }
  };

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
        className="modal medium sample-upload-modal"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="modal-head">
          <div>
            <h2>{t("Загрузить сэмпл")}</h2>
            <div className="sub">{t("WAV или MP3 · попадёт в очередь премодерации")}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t("Закрыть")}>
            <X size={15} />
          </button>
        </div>

        <div className="modal-scroll" style={{ padding: 22 }}>
          <button className="sample-drop" onClick={() => void pickFile()} type="button">
            <span className="sample-drop-icon">
              {analyzing ? <Loader2 size={20} className="spin" /> : <Music2 size={20} />}
            </span>
            <span>
              <b>{fileName || t("Перетащите или выберите .wav / .mp3")}</b>
              <em>
                {analyzing
                  ? t("Анализируем волновую форму…")
                  : peaks.length
                    ? t("Волновая форма готова")
                    : t("Максимум 96 МБ · WAV 24-bit или MP3 320")}
              </em>
            </span>
            <Upload size={15} />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".wav,.mp3,audio/wav,audio/mpeg"
            hidden
            onChange={(event) => {
              void pickBrowserFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />

          {peaks.length ? (
            <div className="sample-wave preview">
              <span className="sample-wave-play">
                <Waves size={11} />
              </span>
              <span className="sample-wave-bars">
                {peaks.map((peak, index) => (
                  <i key={index} style={{ height: `${Math.max(7, peak * 100)}%` }} className="filled" />
                ))}
              </span>
            </div>
          ) : null}

          <div className="form-grid" style={{ marginTop: 14 }}>
            <div className="field span2">
              <label>{t("Название сэмпла")}</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("Midnight 808 Loop")}
                maxLength={80}
              />
            </div>
            <div className="field">
              <label>{t("Никнейм")}</label>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={40}
              />
            </div>
            <div className="field">
              <label>{t("Категория")}</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as SampleCategory)}
              >
                {SAMPLE_CATEGORY_OPTIONS.map(([id, meta]) => (
                  <option key={id} value={id}>
                    {t(meta.label)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>BPM</label>
              <input
                value={bpm}
                onChange={(event) => setBpm(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="140"
                inputMode="numeric"
                maxLength={3}
              />
            </div>
            <div className="field">
              <label>{t("Тональность")}</label>
              <select value={musicalKey} onChange={(event) => setMusicalKey(event.target.value)}>
                {MUSICAL_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key === "Any" ? t("Без тональности") : key}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sample-upload-foot">
            <span>
              <Info size={11} />{" "}
              {t("Загрузка появится в разделе только после одобрения модератором.")}
            </span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t("Отмена")}
            </button>
            <button className="btn btn-primary" onClick={() => void submit()} disabled={busy || analyzing}>
              {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
              {t("Отправить на модерацию")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function cloudConfig() {
  // Kept behind a function so the browser fallback never touches Tauri APIs.
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    url: (env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
    anonKey: env.VITE_SUPABASE_ANON_KEY || "",
  };
}
