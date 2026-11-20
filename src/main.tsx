import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
  const write = (level: string, message: unknown) => {
    const text =
      typeof message === "string"
        ? message
        : message instanceof Error
          ? `${message.name}: ${message.message}\n${message.stack ?? ""}`
          : JSON.stringify(message);
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("frontend_log", { level, message: String(text).slice(0, 3500) }))
      .catch(() => undefined);
  };

  window.addEventListener("error", (event) => {
    write("error", `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    write("error", event.reason instanceof Error ? event.reason : String(event.reason));
  });

  // Verify that every table from supabase/schema.sql is reachable at startup.
  void import("./lib/cloudHealth")
    .then(async ({ checkCloudHealth, summarizeHealth }) => {
      const health = await checkCloudHealth();
      const broken = [
        ...health.tables.filter((table) => table.status === "missing" || table.status === "error"),
        ...(health.bucket.status === "missing" || health.bucket.status === "error"
          ? [health.bucket]
          : []),
      ];
      write(broken.length ? "warn" : "info", summarizeHealth(health));
    })
    .catch(() => undefined);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
