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

export function WindowChrome() {
  const { machine } = useStore();
  const isMac = (machine.os || "macos") !== "windows";

  return (
    <div className="window-chrome" data-tauri-drag-region>
      {isMac ? (
        <div className="traffic">
          <button
            className="t-close"
            aria-label="Закрыть"
            onClick={() => call((win) => win.close())}
          >
            <span className="t-glyph">×</span>
          </button>
          <button
            className="t-min"
            aria-label="Свернуть"
            onClick={() => call((win) => win.minimize())}
          >
            <span className="t-glyph">−</span>
          </button>
          <button
            className="t-max"
            aria-label="Развернуть"
            onClick={() => call((win) => win.toggleMaximize())}
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
          Aether Hub · {isMac ? "macOS" : "Windows"} · v1.1
        </span>
      </div>

      {!isMac ? (
        <div className="win-controls">
          <button aria-label="Свернуть" onClick={() => call((win) => win.minimize())}>
            <Minimize2 size={13} />
          </button>
          <button aria-label="Развернуть" onClick={() => call((win) => win.toggleMaximize())}>
            <Maximize2 size={12} />
          </button>
          <button className="wc-close" aria-label="Закрыть" onClick={() => call((win) => win.close())}>
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
