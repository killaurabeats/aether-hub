#!/usr/bin/env node
/**
 * Extracts the release notes for one version from CHANGELOG.md.
 *
 * Usage:
 *   node scripts/extract-changelog.mjs --version 1.3.0
 *   node scripts/extract-changelog.mjs --tag v1.3.0 --out release-body.md
 *
 * Resolution order:
 *   1. Matching `## [1.3.0]` / `## v1.3.0` section in CHANGELOG.md
 *   2. Annotated Git tag message (when the tag is available locally)
 *   3. --fallback value
 *   4. "Aether Hub v<version>"
 *
 * Only the body of the section is printed, so the workflow can feed it straight
 * into latest.json (Tauri `notes`) and `gh release --notes-file`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const rawVersion = arg("version", "").replace(/^v/i, "").trim();
const tag = arg("tag", rawVersion ? `v${rawVersion}` : "").trim();
const version = (rawVersion || tag.replace(/^v/i, "")).trim();
const file = path.resolve(arg("file", "CHANGELOG.md"));
const fallback = arg("fallback", version ? `Aether Hub v${version}` : "Aether Hub");
const out = arg("out", "");

if (!version) {
  console.error("extract-changelog: --version or --tag is required");
  process.exit(1);
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function sectionFromFile() {
  if (!existsSync(file)) return "";
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const heading = new RegExp(
    `^##\\s+\\[?v?${escapeRegExp(version)}\\]?(?=\\s|$)`,
    "i",
  );

  const start = lines.findIndex((line) => heading.test(line.trim()));
  if (start < 0) return "";

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }

  return lines.slice(start + 1, end).join("\n").trim();
}

function sectionFromTag() {
  if (!tag) return "";
  try {
    const message = execFileSync(
      "git",
      ["tag", "-l", "--format=%(contents)", tag],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (!message) return "";
    // A tag like "v1.3.0" with only its own name as the message is not useful.
    if (message.toLowerCase() === tag.toLowerCase()) return "";
    if (message.toLowerCase() === `aether hub ${tag}`.toLowerCase()) return "";
    return message;
  } catch {
    return "";
  }
}

const body = sectionFromFile() || sectionFromTag() || fallback;

if (out) {
  const target = path.resolve(out);
  writeFileSync(target, `${body.trim()}\n`);
  console.error(`extract-changelog: wrote ${target}`);
}

console.log(body.trim());
