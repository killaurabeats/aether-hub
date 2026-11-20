import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export const isUpdaterAvailable = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type { Update };

export async function checkForUpdate(): Promise<Update | null> {
  if (!isUpdaterAvailable()) return null;
  return check();
}

export interface UpdateProgress {
  percent: number;
  received: number;
  total: number;
}

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

  await relaunch();
}
