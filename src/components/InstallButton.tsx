import { Check, Download, Loader2, RotateCw } from "lucide-react";
import type { Release } from "../types";
import { useStore } from "../lib/store";

export function InstallButton({
  release,
  size = "md",
  className = "",
  hideInstalled = false,
}: {
  release: Release;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Cards show only the install/update action and stay empty when current. */
  hideInstalled?: boolean;
}) {
  const { installs, progress, install, getFileForOS, machine, hasBetaAccess, t } =
    useStore();
  const record = installs[release.slug];
  const job = progress[release.slug];
  const file = getFileForOS(release);
  const betaLocked = (release.tier ?? "free") === "beta" && !hasBetaAccess;

  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";

  // Beta cards already show the BETA badge and the blurred "В РАЗРАБОТКЕ"
  // cover lock. Hiding the locked install button keeps the card clean; invited
  // testers get the normal one-click install button below.
  if (betaLocked) return null;

  if (job) {
    return (
      <button
        className={`install-btn busy ${sizeClass} ${className}`}
        onClick={(event) => event.stopPropagation()}
        aria-label={t("Установка")}
      >
        <Loader2 size={13} className="spin" />
        {Math.round(job.percent)}%
      </button>
    );
  }

  if (!file) {
    if (hideInstalled) return null;
    return (
      <button
        className={`install-btn busy ${sizeClass} ${className}`}
        onClick={(event) => event.stopPropagation()}
        title={t("Нет сборки для {os}", { os: machine.platformLabel })}
      >
        <Download size={13} />
        {machine.os === "windows" ? t("Windows soon") : t("macOS soon")}
      </button>
    );
  }

  if (record) {
    const isCurrent = record.version === release.version;
    if (isCurrent && hideInstalled) return null;
    return (
      <button
        className={`install-btn ${isCurrent ? "installed" : "update"} ${sizeClass} ${className}`}
        onClick={(event) => {
          event.stopPropagation();
          if (!isCurrent) void install(release);
        }}
        aria-label={isCurrent ? t("Установлено") : t("Обновить")}
      >
        {isCurrent ? (
          <>
            <Check size={13} /> {t("Установлено")}
          </>
        ) : (
          <>
            <RotateCw size={13} /> {t("Обновить")}
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
      <Download size={13} /> {t("Установить")}
    </button>
  );
}
