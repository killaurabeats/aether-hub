import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export const isUpdaterAvailable = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type { Update };

export async function checkForUpdate(): Promise<Update | null> {
  if (!isUpdaterAvailable()) return null;
  return check();
}

export interface UpdateCandidate {
  version: string;
  currentVersion: string;
  body?: string | null;
  native?: Update;
  downloadUrl?: string | null;
  source: "native" | "config";
}

export interface UpdateCheckStatus {
  currentVersion: string;
  latestVersion: string | null;
  error: string | null;
  checkedAt: string;
  source: "native" | "config" | "none";
}

function versionParts(value: string): number[] {
  return value
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10) || 0);
}

/** Strictly newer semantic-ish version check used for the Supabase fallback. */
export function isVersionNewer(latest: string, current: string): boolean {
  if (!latest.trim() || !current.trim()) return false;
  const a = versionParts(latest);
  const b = versionParts(current);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}

/** Direct installer asset in the public aether-hub-releases repository. */
export function installerUrlFor(version: string, os: string): string {
  const clean = version.replace(/^v/i, "");
  const tag = `v${clean}`;
  const base = `https://github.com/killaurabeats/aether-hub-releases/releases/download/${tag}`;
  return os === "windows"
    ? `${base}/Aether.Hub_${clean}_x64-setup.exe`
    : `${base}/Aether.Hub_${clean}_universal.dmg`;
}

export interface UpdateProgress {
  percent: number;
  received: number;
  total: number;
}

export const UPDATE_PENDING_KEY = "aether.update.pending.v1";
export const UPDATE_NOTICE_KEY = "aether.update.notice.v1";

/** Downloads, verifies and installs an update, then relaunches the app. */
export async function installUpdate(
  update: Update,
  onProgress: (progress: UpdateProgress) => void,
): Promise<void> {
  let received = 0;
  let total = 0;

  await update.downloadAndInstall((event: any) => {
    if (event.event === "Started") {
      total = Number(event.data?.contentLength ?? 0);
      onProgress({ percent: 0, received: 0, total });
    } else if (event.event === "Progress") {
      received += Number(event.data?.chunkLength ?? 0);
      const percent = total > 0 ? Math.min(99, (received / total) * 100) : 0;
      onProgress({ percent, received, total });
    } else if (event.event === "Finished") {
      onProgress({ percent: 100, received: total, total });
    }
  });

  // Persist the short user-facing release body so the next launch can add a
  // compact "Updated to vX" card to the notification bell.
  try {
    const pending = {
      version: String(update.version ?? "").replace(/^v/i, ""),
      body: String(update.body ?? "").trim().slice(0, 280),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(UPDATE_PENDING_KEY, JSON.stringify(pending));
  } catch {
    // localStorage can be unavailable in hardened webviews; updating still works.
  }

  await relaunch();
}
