import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Boxes, Check, Dumbbell, Music4, Play, SlidersHorizontal, Star } from "lucide-react";
import type { Category, Release } from "../types";
import { CATEGORY_META } from "../types";
import { formatBytes } from "../lib/format";
import { useStore } from "../lib/store";
import { InstallButton } from "./InstallButton";

const categoryIcon: Record<Category, typeof Boxes> = {
  plugins: Boxes,
  drumkits: Music4,
  presets: SlidersHorizontal,
};

let activeAudio: HTMLAudioElement | null = null;

export function PreviewButton({ release }: { release: Release }) {
  const { settings, updateSettings } = useStore();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preview = release.previews?.[0];

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (activeAudio === audioRef.current) activeAudio = null;
    };
  }, []);

  if (!preview) return null;

  const toggle = () => {
    if (!audioRef.current) {
      const audio = new Audio(preview.url);
      audio.volume = 0.85;
      audio.onended = () => {
        setPlaying(false);
        if (activeAudio === audio) activeAudio = null;
      };
      audioRef.current = audio;
    }

    const audio = audioRef.current;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    if (!settings.soundEnabled) updateSettings({ soundEnabled: true });
    activeAudio?.pause();
    activeAudio = audio;
    audio.currentTime = 0;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <button
      className={`cover-play ${playing ? "playing" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        toggle();
      }}
      aria-label={playing ? "Пауза" : "Прослушать демо"}
    >
      {playing ? (
        <span className="bars">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : (
        <Play size={11} style={{ fill: "currentColor" }} />
      )}
      {playing ? "Playing" : "Preview"}
    </button>
  );
}

export function ReleaseCard({
  release,
  onOpen,
  index = 0,
}: {
  release: Release;
  onOpen: (release: Release) => void;
  index?: number;
}) {
  const { machine, installs, progress, getFileForOS } = useStore();
  const record = installs[release.slug];
  const job = progress[release.slug];
  const file = getFileForOS(release);
  const Icon = categoryIcon[release.category];
  const meta = CATEGORY_META[release.category];

  return (
    <motion.article
      className="release-card glass"
      onClick={() => onOpen(release)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.25), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      layout={false}
    >
      <div className="release-cover">
        {release.coverUrl ? (
          <img src={release.coverUrl} alt={release.title} loading="lazy" draggable={false} />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background:
                "radial-gradient(circle at 30% 20%, rgba(196,181,253,.28), transparent 55%), linear-gradient(140deg,#24163f,#0b0815)",
            }}
          >
            <Icon size={54} style={{ opacity: 0.4, color: "var(--lav)" }} />
          </div>
        )}

        <div className="cover-top">
          <span className="chip violet">{meta.singular}</span>
          {release.badge ? <span className="chip gold">{release.badge}</span> : null}
          <span className="spacer" />
          <span className="rating-pill" title={`${release.ratingCount} оценок`}>
            <Star size={10} /> {release.ratingAvg.toFixed(1)}
          </span>
        </div>

        {record ? (
          <span className="installed-mark">
            <Check size={10} /> УСТАНОВЛЕНО
          </span>
        ) : null}

        {release.category === "drumkits" ? <PreviewButton release={release} /> : null}
      </div>

      <div className="card-body">
        <div className="card-title-row">
          <h3>{release.title}</h3>
          <span className="ver">v{release.version}</span>
        </div>
        <p className="card-desc">{release.description}</p>

        <div className="card-foot">
          <div className="file-meta">
            <b>{file ? formatBytes(file.sizeBytes) : "—"}</b>
            <span>
              {release.category === "plugins" ? "VST3 / AU" : release.category === "presets" ? "FL / Aether" : "WAV 24-bit"} · {machine.platformLabel}
            </span>
          </div>
          <InstallButton release={release} size="sm" />
        </div>

        {job ? (
          <div className="card-progress">
            {job.message || job.phase} <span className="pct">{Math.round(job.percent)}%</span>
          </div>
        ) : null}
      </div>

      {job ? (
        <div className="progress-track">
          <span style={{ width: `${Math.max(2, job.percent)}%` }} />
        </div>
      ) : null}
    </motion.article>
  );
}

export function FeaturedRelease({
  release,
  onOpen,
}: {
  release: Release;
  onOpen: (release: Release) => void;
}) {
  const { machine } = useStore();
  const meta = CATEGORY_META[release.category];

  return (
    <motion.div
      className="featured glass"
      onClick={() => onOpen(release)}
      whileHover={{ y: -2 }}
      style={{ cursor: "pointer" }}
    >
      <div className="featured-cover">
        {release.coverUrl ? (
          <img src={release.coverUrl} alt={release.title} draggable={false} />
        ) : (
          <div style={{ height: "100%", background: "linear-gradient(140deg,#24163f,#0b0815)" }} />
        )}
      </div>
      <div className="featured-body">
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span className="chip violet">{meta.singular}</span>
          {release.badge ? <span className="chip gold">{release.badge}</span> : null}
          <span className="rating-pill" style={{ marginLeft: 2 }}>
            <Star size={10} /> {release.ratingAvg.toFixed(1)}
          </span>
        </div>
        <h3>{release.title}</h3>
        <p>{release.description}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <InstallButton release={release} size="md" />
          <span className="file-meta">
            <b>{release.files[machine.os === "windows" ? "windows" : "macos"]
              ? formatBytes(
                  release.files[machine.os === "windows" ? "windows" : "macos"]!.sizeBytes,
                )
              : "—"}</b>
            <span>
              v{release.version} · {meta.label}
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
