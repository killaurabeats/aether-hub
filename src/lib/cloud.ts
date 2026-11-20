/**
 * Cloud layer.
 *
 * Reads use the Supabase REST API with the public anon key. Public writes
 * (ratings, comments, licence requests) use constrained RPC/inserts. Every
 * privileged action (publishing, moderation, issuing keys) goes through the
 * `aether-admin` Edge Function and requires VITE_AETHER_ADMIN_TOKEN *and* the
 * matching ADMIN_TOKEN secret in Supabase — so public builds simply don't have
 * admin access.
 *
 * With no .env keys the app runs in fully functional local mode: the same
 * catalog, ratings, comments and licence workflow persisted in localStorage.
 */

import type {
  AdminStatus,
  Category,
  CloudConfig,
  Comment,
  IssueLogEntry,
  License,
  LicenseRequest,
  Profile,
  Release,
  ReleaseFile,
} from "../types";

const env = import.meta.env as Record<string, string | undefined>;

export const cloudConfig: CloudConfig = {
  url: (env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY || "",
  adminToken: env.VITE_AETHER_ADMIN_TOKEN || "",
};

export const cloudEnabled = Boolean(cloudConfig.url && cloudConfig.anonKey);
export const cloudAdminReady = Boolean(cloudEnabled && cloudConfig.adminToken);

export const DEMO_STORAGE_KEY = "aether.demo.v1";

const nowMinus = (hours: number) =>
  new Date(Date.now() - hours * 3600_000).toISOString();

// ---------------------------------------------------------------------------
// Seed catalog (also used as a graceful fallback when the cloud is unreachable)
// ---------------------------------------------------------------------------

export function seedReleases(): Release[] {
  return [
    {
      id: "rel_aether_vocal_strip",
      slug: "aether-vocal-strip",
      category: "plugins",
      title: "AetherVocal Strip",
      version: "1.1",
      description:
        "A complete vocal channel strip: gate, 7-band air EQ, FET 1176, LA-2A, tube saturation and a −0.3 dBFS limiter. Zero-latency by default, 4× oversampling in Studio mode. VST3 + AU, universal macOS build and Windows x64.",
      coverUrl: "/covers/aether-vocal-strip-v1-1.jpg",
      files: {
        macos: {
          url: "/releases/aether-vocal-strip-macos.zip",
          sizeBytes: 6_795_587,
          filename: "AetherVocal_Strip_macOS.zip",
        },
        windows: {
          url: "/releases/aether-vocal-strip-windows.zip",
          sizeBytes: 3_083_811,
          filename: "AetherVocal_Strip_Windows.zip",
        },
      },
      ratingAvg: 4.9,
      ratingCount: 128,
      productTag: "AETHER-VOCAL-STRIP",
      featured: true,
      badge: "NEW",
      createdAt: nowMinus(20),
    },
    {
      id: "rel_vocal_chain",
      slug: "aether-vocal-chain-presets",
      category: "presets",
      title: "Aether Vocal Chain",
      version: "1.1",
      description:
        "Three mix-ready chains for AetherVocal Strip — Clean Vocal, Airy Lead and Rap Forward. Installs straight into FL Studio's Presets folder, with every module value documented.",
      coverUrl: "/covers/presets.jpg",
      files: {
        macos: { url: "/releases/aether-vocal-chain-presets.zip", sizeBytes: 1_680 },
        windows: { url: "/releases/aether-vocal-chain-presets.zip", sizeBytes: 1_680 },
      },
      ratingAvg: 5.0,
      ratingCount: 21,
      featured: true,
      badge: "PACK",
      createdAt: nowMinus(68),
    },
  ];
}

function seedComments(): Comment[] {
  return [
    {
      id: "c1",
      releaseId: "rel_aether_vocal_strip",
      nickname: "nova",
      body: "The air band on this is unreal. Put it on a whisper vocal and it just opens up.",
      createdAt: nowMinus(3),
      avatarUrl: null,
    },
    {
      id: "c2",
      releaseId: "rel_aether_vocal_strip",
      nickname: "killaurabeats",
      body: "v1.1 is the one — no-latency mode finally makes it usable while tracking.",
      createdAt: nowMinus(9),
      avatarUrl: null,
    },
    {
      id: "c3",
      releaseId: "rel_aether_vocal_strip",
      nickname: "mira.wav",
      body: "Bought a key yesterday, activation took ten seconds. Sounds crazy on ad-libs.",
      createdAt: nowMinus(26),
      avatarUrl: null,
    },
    {
      id: "c5",
      releaseId: "rel_vocal_chain",
      nickname: "mira.wav",
      body: "Rap Forward + a touch of reverb = done. Best free chains I've found.",
      createdAt: nowMinus(31),
      avatarUrl: null,
    },
  ];
}

function seedRequests(): LicenseRequest[] {
  return [
    {
      id: "req_demo_1",
      machineId: "4F2A-91BC-77D0-3E15-8AC6-0B44-19EE-5D73",
      nickname: "novaafterdark",
      avatarUrl: null,
      pluginSlug: "aether-vocal-strip",
      pluginTitle: "AetherVocal Strip",
      productTag: "AETHER-VOCAL-STRIP",
      status: "pending",
      key: null,
      createdAt: nowMinus(2),
    },
    {
      id: "req_demo_2",
      machineId: "B18D-02F4-6C11-9AE0-4D77-5C22-9011-3FE8",
      nickname: "prodbysage",
      avatarUrl: null,
      pluginSlug: "aether-vocal-strip",
      pluginTitle: "AetherVocal Strip",
      productTag: "AETHER-VOCAL-STRIP",
      status: "pending",
      key: null,
      createdAt: nowMinus(7),
    },
  ];
}

// ---------------------------------------------------------------------------
// Local (demo) store
// ---------------------------------------------------------------------------

interface DemoState {
  releases: Release[];
  comments: Comment[];
  ratings: Record<string, Record<string, number>>;
  requests: LicenseRequest[];
  licenses: License[];
}

function demoState(): DemoState {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (Array.isArray(parsed.releases) && parsed.releases.length > 0) {
        // Migration: the old bundled demo drumkit is no longer part of the
        // default catalog. Remove it (and its comments) for existing installs.
        const releases = parsed.releases.filter(
          (release) => release.id !== "rel_808_essentials",
        );
        const comments = (parsed.comments ?? []).filter(
          (comment) => comment.releaseId !== "rel_808_essentials",
        );

        const migrated: DemoState = {
          releases,
          comments,
          ratings: parsed.ratings ?? {},
          requests: parsed.requests ?? [],
          licenses: parsed.licenses ?? [],
        };

        if (releases.length !== parsed.releases.length || comments.length !== (parsed.comments ?? []).length) {
          saveDemo(migrated);
        }

        if (releases.length > 0) {
          return migrated;
        }
      }
    }
  } catch {
    // fall through to seed
  }

  const state: DemoState = {
    releases: seedReleases(),
    comments: seedComments(),
    ratings: {},
    requests: seedRequests(),
    licenses: [],
  };
  saveDemo(state);
  return state;
}

function saveDemo(state: DemoState) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

export function resetDemoCatalog() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  return demoState().releases;
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: cloudConfig.anonKey,
    Authorization: `Bearer ${cloudConfig.anonKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${cloudConfig.url}/rest/v1/${path}`, {
    ...init,
    headers: headers(init?.headers as Record<string, string> | undefined),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Cloud request failed (${response.status})`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${cloudConfig.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `RPC ${fn} failed (${response.status})`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

function numeric(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : fallback;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function mapRelease(row: Row): Release {
  const files = parseJson<Record<string, any>>(row.files, {});
  const normalisedFiles: Partial<Record<"macos" | "windows", ReleaseFile>> = {};

  for (const key of ["macos", "windows"] as const) {
    const file = files[key];
    if (file && file.url) {
      normalisedFiles[key] = {
        url: String(file.url),
        sizeBytes: numeric(file.sizeBytes ?? file.size_bytes ?? file.size, 0),
        filename: file.filename,
      };
    }
  }

  return {
    id: row.id,
    slug: row.slug,
    category: row.category as Category,
    title: row.title,
    version: row.version,
    description: row.description ?? "",
    coverUrl: row.cover_url ?? null,
    files: normalisedFiles,
    ratingAvg: numeric(row.rating_avg),
    ratingCount: numeric(row.rating_count),
    productTag: row.product_tag ?? null,
    featured: Boolean(row.featured),
    badge: row.badge ?? null,
    previews: parseJson(row.previews, []),
    createdAt: row.created_at ?? null,
  };
}

function mapComment(row: Row): Comment {
  return {
    id: String(row.id),
    releaseId: row.release_id,
    nickname: row.nickname ?? "anonymous",
    avatarUrl: row.avatar_url ?? null,
    body: row.body ?? "",
    machineId: row.machine_id ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function mapRequest(row: Row): LicenseRequest {
  return {
    id: String(row.id),
    machineId: row.machine_id,
    nickname: row.nickname ?? "anonymous",
    avatarUrl: row.avatar_url ?? null,
    pluginSlug: row.plugin_slug ?? "",
    pluginTitle: row.plugin_title ?? "",
    productTag: row.product_tag ?? "AETHER-VOCAL-STRIP",
    status: row.status ?? "pending",
    key: row.key ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    resolvedAt: row.resolved_at ?? null,
  };
}

function mapLicense(row: Row): License {
  return {
    id: String(row.id),
    machineId: row.machine_id,
    productTag: row.product_tag,
    pluginTitle: row.plugin_title ?? null,
    key: row.key,
    nickname: row.nickname ?? null,
    issuedAt: row.issued_at ?? row.created_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CatalogResult {
  releases: Release[];
  source: "cloud" | "cache" | "demo";
  error?: string;
}

export async function loadCatalog(): Promise<CatalogResult> {
  if (cloudEnabled) {
    try {
      const rows = await rest<Row[]>(
        "releases?select=*&published=eq.true&order=featured.desc,created_at.desc",
      );
      const releases = rows.map(mapRelease);
      localStorage.setItem("aether.catalog.cache", JSON.stringify(releases));
      return { releases, source: "cloud" };
    } catch (error) {
      const cached = localStorage.getItem("aether.catalog.cache");
      if (cached) {
        try {
          return {
            releases: JSON.parse(cached) as Release[],
            source: "cache",
            error: String(error),
          };
        } catch {
          // ignore broken cache
        }
      }
      return { releases: seedReleases(), source: "demo", error: String(error) };
    }
  }

  return { releases: demoState().releases, source: "demo" };
}

export async function fetchComments(releaseId: string): Promise<Comment[]> {
  if (cloudEnabled) {
    const rows = await rest<Row[]>(
      `comments?release_id=eq.${encodeURIComponent(releaseId)}&select=*&order=created_at.desc&limit=100`,
    );
    return rows.map(mapComment);
  }

  return demoState()
    .comments.filter((c) => c.releaseId === releaseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addComment(input: {
  releaseId: string;
  nickname: string;
  avatarUrl?: string | null;
  body: string;
  machineId?: string | null;
}): Promise<Comment> {
  if (cloudEnabled) {
    const rows = await rest<Row[]>("comments", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        release_id: input.releaseId,
        nickname: input.nickname.slice(0, 40),
        avatar_url: input.avatarUrl ?? null,
        body: input.body.slice(0, 1200),
        machine_id: input.machineId ?? null,
      }),
    });
    return mapComment(rows[0]);
  }

  const state = demoState();
  const comment: Comment = {
    id: uid("comment"),
    releaseId: input.releaseId,
    nickname: input.nickname,
    avatarUrl: input.avatarUrl ?? null,
    body: input.body,
    machineId: input.machineId ?? null,
    createdAt: new Date().toISOString(),
  };
  state.comments.unshift(comment);
  saveDemo(state);
  return comment;
}

export async function rateRelease(
  releaseId: string,
  machineId: string,
  value: number,
): Promise<{ avg: number; count: number; mine: number }> {
  if (cloudEnabled) {
    const result = await rpc<{ avg: number; count: number; mine: number }>(
      "aether_rate_release",
      { p_release_id: releaseId, p_machine_id: machineId, p_value: value },
    );
    return {
      avg: numeric(result.avg),
      count: numeric(result.count),
      mine: numeric(result.mine, value),
    };
  }

  const state = demoState();
  const release = state.releases.find((r) => r.id === releaseId);
  const previous = state.ratings[releaseId]?.[machineId];
  const ratings = (state.ratings[releaseId] ??= {});
  ratings[machineId] = value;

  if (release) {
    const baseTotal = release.ratingAvg * release.ratingCount;
    const total = previous != null ? baseTotal - previous + value : baseTotal + value;
    const count = previous != null ? release.ratingCount : release.ratingCount + 1;
    release.ratingCount = count;
    release.ratingAvg = Math.round((total / Math.max(1, count)) * 10) / 10;
  }

  saveDemo(state);

  return {
    avg: release?.ratingAvg ?? value,
    count: release?.ratingCount ?? 1,
    mine: value,
  };
}

export async function fetchMyRating(
  releaseId: string,
  machineId: string,
): Promise<number | null> {
  if (cloudEnabled) {
    const value = await rpc<number | null>("aether_my_rating", {
      p_release_id: releaseId,
      p_machine_id: machineId,
    });
    return value == null ? null : numeric(value, 0);
  }

  return demoState().ratings[releaseId]?.[machineId] ?? null;
}

export async function upsertProfile(profile: Profile): Promise<void> {
  if (cloudEnabled) {
    await rpc("aether_upsert_profile", {
      p_id: profile.id,
      p_nickname: profile.nickname,
      p_avatar_url: profile.avatarUrl ?? null,
      p_machine_id: profile.machineId,
    });
    return;
  }

  const state = demoState();
  saveDemo(state);
}

export async function requestLicense(input: {
  machineId: string;
  nickname: string;
  avatarUrl?: string | null;
  pluginSlug: string;
  pluginTitle: string;
  productTag: string;
}): Promise<LicenseRequest> {
  if (cloudEnabled) {
    // Avoid duplicate pending requests for the same machine + plugin.
    const existing = await fetchMyRequests(input.machineId);
    const pending = existing.find(
      (r) => r.status === "pending" && r.productTag === input.productTag,
    );
    if (pending) return pending;

    const row = await rpc<Row>("aether_request_license", {
      p_machine_id: input.machineId,
      p_nickname: input.nickname,
      p_avatar_url: input.avatarUrl ?? null,
      p_plugin_slug: input.pluginSlug,
      p_plugin_title: input.pluginTitle,
      p_product_tag: input.productTag,
    });
    return mapRequest(row);
  }

  const state = demoState();
  const existing = state.requests.find(
    (r) => r.machineId === input.machineId && r.status === "pending" && r.productTag === input.productTag,
  );
  if (existing) return existing;

  const request: LicenseRequest = {
    id: uid("req"),
    machineId: input.machineId,
    nickname: input.nickname,
    avatarUrl: input.avatarUrl ?? null,
    pluginSlug: input.pluginSlug,
    pluginTitle: input.pluginTitle,
    productTag: input.productTag,
    status: "pending",
    key: null,
    createdAt: new Date().toISOString(),
  };
  state.requests.unshift(request);
  saveDemo(state);
  return request;
}

export async function fetchMyRequests(machineId: string): Promise<LicenseRequest[]> {
  if (cloudEnabled) {
    const rows = await rpc<Row[]>("aether_my_requests", { p_machine_id: machineId });
    return (rows ?? []).map(mapRequest);
  }

  return demoState().requests.filter((r) => r.machineId === machineId);
}

export interface CloudProfile {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
}

export async function fetchProfile(machineId: string): Promise<CloudProfile | null> {
  if (!cloudEnabled) return null;

  try {
    const row = await rpc<Row | null>("aether_my_profile", { p_machine_id: machineId });
    if (!row) return null;
    return {
      id: String(row.id),
      nickname: row.nickname ?? "aether user",
      avatarUrl: row.avatar_url ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchMyLicenses(machineId: string): Promise<License[]> {
  if (cloudEnabled) {
    const rows = await rpc<Row[]>("aether_my_licenses", { p_machine_id: machineId });
    return (rows ?? []).map(mapLicense);
  }

  return demoState().licenses.filter((l) => l.machineId === machineId);
}

// ---------------------------------------------------------------------------
// Admin API (Edge Function via Rust, so uploads can stream from disk)
// ---------------------------------------------------------------------------

export async function adminApi<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  if (!cloudConfig.adminToken) throw new Error("Admin token missing from this build.");

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>("cloud_admin_api", {
    config: cloudConfig,
    action,
    payload,
  });
}

export async function adminUpload(input: {
  localPath: string;
  storagePath: string;
  bucket?: string;
  contentType?: string;
}): Promise<{ publicUrl: string; storagePath: string; bucket: string }> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  if (!cloudConfig.adminToken) throw new Error("Admin token missing from this build.");

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("cloud_upload", {
    config: cloudConfig,
    request: {
      localPath: input.localPath,
      bucket: input.bucket ?? "aether-assets",
      storagePath: input.storagePath,
      contentType: input.contentType ?? "application/octet-stream",
    },
  });
}

// ---------------------------------------------------------------------------
// Admin data helpers (local mode mirrors what the Edge Function does)
// ---------------------------------------------------------------------------

export interface AdminOverview {
  requests: LicenseRequest[];
  comments: Array<Comment & { releaseTitle?: string }>;
}

export async function adminOverview(): Promise<AdminOverview> {
  if (cloudEnabled) {
    return adminApi<AdminOverview>("overview");
  }

  const state = demoState();
  const byId = new Map(state.releases.map((r) => [r.id, r]));
  return {
    requests: [...state.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    comments: state.comments.map((c) => ({
      ...c,
      releaseTitle: byId.get(c.releaseId)?.title ?? "Unknown release",
    })),
  };
}

export async function approveRequest(
  request: LicenseRequest,
  key: string,
): Promise<void> {
  if (cloudEnabled) {
    await adminApi("approve_request", { id: request.id, key });
    return;
  }

  const state = demoState();
  const target = state.requests.find((r) => r.id === request.id);
  if (target) {
    target.status = "approved";
    target.key = key;
    target.resolvedAt = new Date().toISOString();
  }
  state.licenses.unshift({
    id: uid("lic"),
    machineId: request.machineId,
    productTag: request.productTag,
    pluginTitle: request.pluginTitle,
    key,
    nickname: request.nickname,
    issuedAt: new Date().toISOString(),
  });
  saveDemo(state);
}

export async function rejectRequest(request: LicenseRequest): Promise<void> {
  if (cloudEnabled) {
    await adminApi("reject_request", { id: request.id });
    return;
  }

  const state = demoState();
  const target = state.requests.find((r) => r.id === request.id);
  if (target) {
    target.status = "rejected";
    target.resolvedAt = new Date().toISOString();
  }
  saveDemo(state);
}

export async function deleteComment(commentId: string): Promise<void> {
  if (cloudEnabled) {
    await adminApi("delete_comment", { id: commentId });
    return;
  }

  const state = demoState();
  state.comments = state.comments.filter((c) => c.id !== commentId);
  saveDemo(state);
}

export async function deleteRelease(releaseId: string): Promise<void> {
  if (cloudEnabled) {
    await adminApi("delete_release", { id: releaseId });
    return;
  }

  const state = demoState();
  state.releases = state.releases.filter((r) => r.id !== releaseId);
  state.comments = state.comments.filter((c) => c.releaseId !== releaseId);
  saveDemo(state);
}

export interface PublishPayload {
  id?: string;
  slug: string;
  category: Category;
  title: string;
  version: string;
  description: string;
  coverUrl?: string | null;
  files: Release["files"];
  productTag?: string | null;
  featured?: boolean;
  badge?: string | null;
  previews?: Release["previews"];
}

export async function saveRelease(payload: PublishPayload): Promise<Release> {
  if (cloudEnabled) {
    const release = await adminApi<Release>("publish", { release: payload });
    return release;
  }

  const state = demoState();
  const existingIndex = state.releases.findIndex(
    (r) => (payload.id && r.id === payload.id) || r.slug === payload.slug,
  );

  const existing = existingIndex >= 0 ? state.releases[existingIndex] : undefined;

  const release: Release = {
    id: existing?.id ?? uid("rel"),
    slug: payload.slug,
    category: payload.category,
    title: payload.title,
    version: payload.version,
    description: payload.description,
    coverUrl: payload.coverUrl ?? existing?.coverUrl ?? null,
    files: payload.files,
    ratingAvg: existing?.ratingAvg ?? 5,
    ratingCount: existing?.ratingCount ?? 1,
    productTag: payload.productTag ?? null,
    featured: payload.featured ?? false,
    badge: payload.badge ?? null,
    previews: payload.previews ?? existing?.previews ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  if (existingIndex >= 0) state.releases[existingIndex] = release;
  else state.releases.unshift(release);

  saveDemo(state);
  return release;
}

export async function verifyAdminKeyLocally(
  admin: AdminStatus,
  key: string,
  machineId: string,
  productTag: string,
): Promise<boolean> {
  if (!admin.enabled || !admin.publicKey) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("verify_license", {
    key,
    machineId,
    productTag,
    publicKey: admin.publicKey,
  });
}

export async function issuedLicenses(): Promise<IssueLogEntry[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("list_issued_licenses");
}

export type { ReleaseFile };
