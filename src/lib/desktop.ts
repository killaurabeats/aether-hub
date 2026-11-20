import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./store";

export async function openExternal(url: string): Promise<void> {
  if (isTauri) {
    await invoke("open_url", { url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function openFolder(path: string): Promise<void> {
  if (!isTauri) return;
  await invoke("open_folder", { path });
}

export async function fileStat(path: string): Promise<{ size: number; name: string } | null> {
  if (!isTauri) return null;
  try {
    return await invoke("file_stat", { path });
  } catch {
    return null;
  }
}

export async function readImageDataUrl(path: string): Promise<string | null> {
  if (!isTauri) return null;
  try {
    return await invoke("read_image_data_url", { path });
  } catch {
    return null;
  }
}

/** Support / licence contact. */
export const TELEGRAM_URL = "https://t.me/whofriends1";
/** Public Aether plugins channel. */
export const TELEGRAM_CHANNEL_URL = "https://t.me/aetherplugins";
