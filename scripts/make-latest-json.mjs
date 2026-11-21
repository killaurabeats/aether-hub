#!/usr/bin/env node
/**
 * Builds the static Tauri updater manifest from signed bundle artifacts.
 *
 * Usage:
 *   node scripts/make-latest-json.mjs \
 *     --root artifacts --version 1.2.0 \
 *     --base-url https://github.com/killaurabeats/aether-hub-releases/releases/download/v1.2.0 \
 *     --notes-file release-body.md --out latest.json
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const root = path.resolve(arg("root", "artifacts"));
const version = arg("version", "").replace(/^v/, "");
const baseUrl = arg("base-url", "").replace(/\/$/, "");
const notesFile = arg("notes-file", "");
const notesFromFile = notesFile
  ? readFileSync(path.resolve(notesFile), "utf8").trim()
  : "";
const notes = (notesFromFile || arg("notes", "")).trim() || `Aether Hub v${version}`;
const out = path.resolve(arg("out", "latest.json"));

if (!version) throw new Error("--version is required");
if (!baseUrl) throw new Error("--base-url is required");

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

const files = walk(root);
const byName = new Map(files.map((file) => [path.basename(file), file]));

function signatureFor(file) {
  const sig = `${file}.sig`;
  if (!byName.has(path.basename(sig))) {
    throw new Error(`Missing signature: ${path.basename(sig)}`);
  }
  return readFileSync(sig, "utf8").trim();
}

function urlFor(file) {
  // GitHub Releases normalises spaces in uploaded asset names to dots.
  const assetName = path.basename(file).replace(/\s+/g, ".");
  return `${baseUrl}/${encodeURIComponent(assetName)}`;
}

const mac = files.find((file) => file.endsWith(".app.tar.gz"));
const windows =
  files.find((file) => /setup\.exe$/i.test(file) && byName.has(`${path.basename(file)}.sig`)) ||
  files.find((file) => /\.msi$/i.test(file) && byName.has(`${path.basename(file)}.sig`));

if (!mac && !windows) {
  throw new Error("No updater artifacts found");
}

const platforms = {};
if (mac) {
  const entry = { signature: signatureFor(mac), url: urlFor(mac) };
  // The macOS build is universal in CI; both architectures use the same bundle.
  platforms["darwin-aarch64"] = entry;
  platforms["darwin-x86_64"] = entry;
}
if (windows) {
  platforms["windows-x86_64"] = {
    signature: signatureFor(windows),
    url: urlFor(windows),
  };
}

const manifest = {
  version,
  // Tauri reads `notes`; `releaseBody` is kept as an explicit alias for tools
  // that consume the same manifest outside the updater.
  notes,
  releaseBody: notes,
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
console.log(`\n✓ ${out}`);
