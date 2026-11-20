import { Check, Download, Loader2, RotateCw } from "lucide-react";
import type { Release } from "../types";
import { useStore } from "../lib/store";

export function InstallButton({
  release,
  size = "md",
  className = "",
}: {
  release: Release;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { installs, progress, install, getFileForOS, machine } = useStore();
  const record = installs[release.slug];
  const job = progress[release.slug];
  const file = getFileForOS(release);

  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";

  if (job) {
    return (
      <button
        className={`install-btn busy ${sizeClass} ${className}`}
        onClick={(event) => event.stopPropagation()}
        aria-label="Установка"
      >
        <Loader2 size={13} className="spin" />
        {Math.round(job.percent)}%
      </button>
    );
  }

  if (!file) {
    return (
      <button
        className={`install-btn busy ${sizeClass} ${className}`}
        onClick={(event) => event.stopPropagation()}
        title={`Нет сборки для ${machine.platformLabel}`}
      >
        <Download size={13} />
        {machine.os === "windows" ? "Windows soon" : "macOS soon"}
      </button>
    );
  }

  if (record) {
    const isCurrent = record.version === release.version;
    return (
      <button
        className={`install-btn ${isCurrent ? "installed" : "update"} ${sizeClass} ${className}`}
        onClick={(event) => {
          event.stopPropagation();
          if (!isCurrent) void install(release);
        }}
        aria-label={isCurrent ? "Установлено" : "Обновить"}
      >
        {isCurrent ? (
          <>
            <Check size={13} /> Установлено
          </>
        ) : (
          <>
            <RotateCw size={13} /> Обновить
          </>
        )}
      </button>
    );
  }

  return (
    <button
      className={`install-btn ${sizeClass} ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        void install(release);
      }}
    >
      <Download size={13} /> Установить
    </button>
  );
}
