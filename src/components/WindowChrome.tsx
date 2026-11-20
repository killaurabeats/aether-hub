import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minimize2, X } from "lucide-react";
import { isTauri, useStore } from "../lib/store";

function call(action: (win: ReturnType<typeof getCurrentWindow>) => Promise<unknown>) {
  if (!isTauri) return;
  try {
    action(getCurrentWindow()).catch(() => undefined);
  } catch {
    // Browser preview has no native window.
  }
}

async function toggleFullscreen() {
  if (!isTauri) return;
  try {
    const win = getCurrentWindow();
    const fullscreen = await win.isFullscreen();
    await win.setFullscreen(!fullscreen);
  } catch {
    // Ignore native window errors (preview / restricted session).
  }
}

export function WindowChrome() {
  const { machine, t } = useStore();
  const isMac = (machine.os || "macos") !== "windows";

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    const win = getCurrentWindow();

    const syncFullscreenClass = () => {
      win
        .isFullscreen()
        .then((fullscreen) => document.documentElement.classList.toggle("is-fullscreen", fullscreen))
        .catch(() => undefined);
    };

    syncFullscreenClass();
    win
      .onResized(syncFullscreenClass)
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const macFullscreen = event.ctrlKey && event.metaKey && event.key.toLowerCase() === "f";
      if (event.key === "F11" || macFullscreen) {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="window-chrome" data-tauri-drag-region>
      {isMac ? (
        <div className="traffic">
          <button
            className="t-close"
            aria-label={t("Закрыть")}
            onClick={() => call((win) => win.close())}
          >
            <span className="t-glyph">×</span>
          </button>
          <button
            className="t-min"
            aria-label={t("Свернуть")}
            onClick={() => call((win) => win.minimize())}
          >
            <span className="t-glyph">−</span>
          </button>
          <button
            className="t-max"
            aria-label={t("Полный экран")}
            title={t("Полный экран")}
            onClick={() => void toggleFullscreen()}
          >
            <span className="t-glyph">+</span>
          </button>
        </div>
      ) : (
        <div style={{ width: 10 }} />
      )}

      <div
        className="chrome-drag"
        data-tauri-drag-region
        onDoubleClick={() => call((win) => win.toggleMaximize())}
      >
        <span className="chrome-title" data-tauri-drag-region>
          Aether Hub · {isMac ? "macOS" : "Windows"} · v1.2.2
        </span>
      </div>

      {!isMac ? (
        <div className="win-controls">
          <button aria-label={t("Свернуть")} onClick={() => call((win) => win.minimize())}>
            <Minimize2 size={13} />
          </button>
          <button aria-label={t("Развернуть")} onClick={() => call((win) => win.toggleMaximize())}>
            <Maximize2 size={12} />
          </button>
          <button className="wc-close" aria-label={t("Закрыть")} onClick={() => call((win) => win.close())}>
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
