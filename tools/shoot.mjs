#!/usr/bin/env node
/**
 * Visual QA helper: drives headless Chrome at the real 1280×830 window size,
 * optionally runs a JS snippet (e.g. click a card) and saves a screenshot.
 *
 *   node tools/shoot.mjs http://localhost:1420/ out.png
 *   node tools/shoot.mjs "http://localhost:1420/#plugins" out.png "document.querySelector('.release-card').click()"
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const url = process.argv[2] ?? "http://localhost:1420/";
const out = process.argv[3] ?? "/tmp/aether-shot.png";
const script = process.argv[4] ?? "";
const port = 9333;
const profile = `/tmp/aether-chrome-${process.pid}`;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1280,830",
    "--hide-scrollbars",
    "--disable-first-run-ui",
    "--no-default-browser-check",
    "--force-device-scale-factor=1",
    "--mute-audio",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  let target;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(150);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
        method: "PUT",
      });
      if (response.ok) {
        target = await response.json();
        break;
      }
    } catch {
      // Chrome is still starting.
    }
  }

  if (!target) throw new Error("Chrome did not expose a debugging target");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  };

  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      nextId += 1;
      pending.set(nextId, { resolve, reject });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 830,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url });
  await sleep(Number(process.env.WAIT ?? 2900));

  if (script) {
    await send("Runtime.evaluate", { expression: script, awaitPromise: true });
    await sleep(1100);
  }

  const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(out, Buffer.from(screenshot.data, "base64"));
  console.log(out);

  socket.close();
} finally {
  chrome.kill("SIGTERM");
  await sleep(200);
}
