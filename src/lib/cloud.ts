/**
 * Cloud layer.
 *
 * Reads use the Supabase REST API with the public anon key. Public writes
 * (ratings, comments, licence requests) use constrained RPC/inserts. Every
 * privileged action (publishing, moderation, issuing keys) goes through the
 * `aether-admin` Edge Function and requires VITE_AETHER_ADMIN_TOKEN *and* the
 * matching ADMIN_TOKEN secret in Supabase - so public builds simply don't have
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
  SupportTicket,
  TicketMessage,
  Release,
  ReleaseFile,
  Tier,
  PluginCategory,
  CommunitySample,
  SampleCategory,
  SampleStatus,
  SubmitSampleInput,
} from "../types";
import { SAMPLE_CATEGORIES } from "../types";
import { createClient } from "@supabase/supabase-js";

const env = import.meta.env as Record<string, string | undefined>;

export const ADMIN_TOKEN_STORAGE_KEY = "aether.admin.token.v1";
export const LEGACY_ADMIN_TOKEN_STORAGE_KEY = "aether_admin_token";

function readStoredAdminToken(): string {
  try {
    return (
      localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)?.trim() ||
      localStorage.getItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY)?.trim() ||
      ""
    );
  } catch {
    return "";
  }
}

/** Public builds ship with an empty token. The creator can unlock admin mode
 *  on a trusted device; the token then lives in that device's localStorage. */
const bakedAdminToken = (env.VITE_AETHER_ADMIN_TOKEN || "").trim();

export const cloudConfig: CloudConfig = {
  url: (env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY || "",
  adminToken: bakedAdminToken || readStoredAdminToken(),
};

export const cloudEnabled = Boolean(cloudConfig.url && cloudConfig.anonKey);

// Supabase Realtime still authenticates with a JWT role token. Projects that
// use the newer publishable keys can provide the public legacy anon JWT here;
// REST/RPC calls keep using the publishable key above.
const realtimeKey =
  (env.VITE_SUPABASE_REALTIME_KEY || "").trim() || cloudConfig.anonKey;

export function hasAdminToken(): boolean {
  return Boolean(cloudConfig.adminToken);
}

export function adminTokenIsBaked(): boolean {
  return Boolean(bakedAdminToken);
}

/** Saves (or clears) the device-local admin token and updates cloudConfig. */
export function storeAdminToken(token: string | null): void {
  if (bakedAdminToken) return;
  const next = (token ?? "").trim();
  cloudConfig.adminToken = next;
  try {
    if (next) {
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, next);
      localStorage.setItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY, next);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      localStorage.removeItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // localStorage can be unavailable in hardened webviews; keep the token
    // for this session only.
  }
}

/** Verifies a candidate token against the deployed Edge Function. */
export async function verifyAdminToken(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!cloudEnabled) return { ok: false, error: "Supabase is not configured" };
  try {
    const headers: Record<string, string> = {
      apikey: cloudConfig.anonKey,
      "Content-Type": "application/json",
    };
    if (!usesPublishableKey) headers.Authorization = `Bearer ${cloudConfig.anonKey}`;

    const response = await fetch(`${cloudConfig.url}/functions/v1/aether-admin`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token: token.trim(), action: "overview" }),
    });

    if (response.status === 401) return { ok: false, error: "Invalid admin token" };
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: text || `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

/** Supabase's new publishable/secret keys are not JWTs and must go in `apikey`
 *  only. Legacy anon JWT keys also need the Authorization header. */
export const usesPublishableKey = cloudConfig.anonKey.startsWith("sb_publishable_");

export const DEMO_STORAGE_KEY = "aether.demo.v1";

const nowMinus = (hours: number) =>
  new Date(Date.now() - hours * 3600_000).toISOString();

// ---------------------------------------------------------------------------
// Seed catalog (also used as a graceful fallback when the cloud is unreachable)
// ---------------------------------------------------------------------------

export function seedReleases(): Release[] {
  return [
    {
      id: "rel_aether_saturator",
      slug: "aether-saturator",
      category: "plugins",
      title: "AetherSaturator",
      version: "1.1.0-beta",
      description:
        "A liquid-glass saturation plugin that goes from gentle warmth to aggressive drive. Four characters, controllable warmth and auto-gain for a dense, mix-ready sound.",
      descriptionEn:
        "A liquid-glass saturation plugin that goes from gentle warmth to aggressive drive. Four characters, controllable warmth and auto-gain for a dense, mix-ready sound.",
      descriptionRu:
        "Сатуратор в стиле liquid glass: от мягкого нагрева до агрессивного драйва. Четыре характера, управляемая теплота и авто-громкость для плотного, готового к миксу звука.",
      coverUrl: "/covers/aether-saturator.jpg",
      files: {
        macos: {
          url: "/releases/aether-saturator-macos.zip",
          sizeBytes: 6269066,
          filename: "AetherSaturator_macOS_VST3_AU.zip",
        },
        windows: {
          url: "/releases/aether-saturator-windows.zip",
          sizeBytes: 2281465,
          filename: "AetherSaturator_Windows_VST3.zip",
        },
      },
      ratingAvg: 0,
      ratingCount: 0,
      productTag: "AETHER-SATURATOR",
      pluginCategory: "saturation",
      tier: "beta",
      featured: false,
      badge: "BETA",
      createdAt: nowMinus(1),
    },
    {
      id: "rel_aether_vocal_strip",
      slug: "aether-vocal-strip",
      category: "plugins",
      title: "AetherVocal Strip",
      version: "1.1",
      description:
        "A vocal channel strip for clean, release-ready vocals. It combines an airy EQ, two compressors, tube saturation and an output limiter.",
      descriptionEn:
        "A vocal channel strip for clean, release-ready vocals. It combines an airy EQ, two compressors, tube saturation and an output limiter.",
      descriptionRu:
        "Вокальный комбайн для чистого, готового к релизу вокала. Эквалайзер с воздушным верхом, два компрессора, ламповая сатурация и лимитер на выходе.",
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
      pluginCategory: "vocal",
      tier: "free",
      featured: true,
      badge: "NEW",
      createdAt: nowMinus(20),
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
      body: "v1.1 is the one - no-latency mode finally makes it usable while tracking.",
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

function seedSupportTickets(): SupportTicket[] {
  return [
    {
      id: "ticket_demo_1",
      machineId: "4F2A-91BC-77D0-3E15-8AC6-0B44-19EE-5D73",
      nickname: "novaafterdark",
      avatarUrl: null,
      os: "macOS",
      message:
        "После установки плагин не появился в списке FL Studio. Папки VST3 и Components проверил - файлы на месте. Что ещё можно сделать?",
      status: "open",
      createdAt: nowMinus(3),
    },
    {
      id: "ticket_demo_2",
      machineId: "B18D-02F4-6C11-9AE0-4D77-5C22-9011-3FE8",
      nickname: "prodbysage",
      avatarUrl: null,
      os: "Windows",
      message:
        "Ключ активировался, но в FL Studio отображается старая версия 1.0. Как обновиться до 1.1 без потери пресетов?",
      status: "closed",
      createdAt: nowMinus(40),
    },
  ];
}

function seedTicketMessages(): Record<string, TicketMessage[]> {
  return {
    ticket_demo_1: [
      {
        id: "tmsg_demo_1",
        ticketId: "ticket_demo_1",
        senderRole: "user",
        senderName: "novaafterdark",
        senderAvatar: null,
        message:
          "Привет! После установки AetherVocal Strip не вижу плагин в FL Studio. Папки VST3 и Components проверил - файлы там.",
        createdAt: nowMinus(3),
      },
      {
        id: "tmsg_demo_2",
        ticketId: "ticket_demo_1",
        senderRole: "admin",
        senderName: "killaurabeats",
        senderAvatar: "/logo.png",
        message:
          "Привет! Открой Options → Manage plugins → Find more plugins и нажми Start scan. Если не появится - пришли скрин списка плагинов.",
        createdAt: nowMinus(2),
      },
      {
        id: "tmsg_demo_3",
        ticketId: "ticket_demo_1",
        senderRole: "user",
        senderName: "novaafterdark",
        senderAvatar: null,
        message: "Спасибо, после пересканирования появился. Работает отлично!",
        createdAt: nowMinus(1),
      },
    ],
    ticket_demo_2: [
      {
        id: "tmsg_demo_4",
        ticketId: "ticket_demo_2",
        senderRole: "user",
        senderName: "prodbysage",
        senderAvatar: null,
        message:
          "Ключ активировался, но в FL Studio отображается старая версия 1.0. Как обновиться до 1.1 без потери пресетов?",
        createdAt: nowMinus(41),
      },
      {
        id: "tmsg_demo_5",
        ticketId: "ticket_demo_2",
        senderRole: "admin",
        senderName: "killaurabeats",
        senderAvatar: "/logo.png",
        message:
          "Скачай новую версию из хаба и установи поверх - пресеты хранятся отдельно и не затронутся. После установки перезапусти FL Studio.",
        createdAt: nowMinus(40),
      },
    ],
  };
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
  tickets: SupportTicket[];
  ticketMessages: Record<string, TicketMessage[]>;
  samples?: CommunitySample[];
}

function demoState(): DemoState {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (Array.isArray(parsed.releases) && parsed.releases.length > 0) {
        // Migration: the old bundled demo drumkit is no longer part of the
        // default catalog. Remove it (and its comments) for existing installs.
        const demoIds = new Set(["rel_808_essentials", "rel_vocal_chain"]);
        const releases = parsed.releases.filter((release) => !demoIds.has(release.id));
        const comments = (parsed.comments ?? []).filter(
          (comment) => !demoIds.has(comment.releaseId),
        );

        const tickets = parsed.tickets ?? seedSupportTickets();
        const migrated: DemoState = {
          releases,
          comments,
          ratings: parsed.ratings ?? {},
          requests: parsed.requests ?? [],
          licenses: parsed.licenses ?? [],
          tickets,
          ticketMessages: parsed.ticketMessages ?? seedTicketMessages(),
          samples: parsed.samples ?? [],
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
    tickets: seedSupportTickets(),
    ticketMessages: seedTicketMessages(),
    samples: [],
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Seed releases (and their comments/ratings) live only in localStorage. When
 * the cloud is linked but still empty we show that demo shelf, so interactions
 * with it must stay local instead of hitting Postgres with non-UUID ids.
 */
export function isCloudReleaseId(id: string) {
  return UUID_RE.test(id);
}

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------

function headers(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {
    apikey: cloudConfig.anonKey,
    "Content-Type": "application/json",
  };

  if (!usesPublishableKey) {
    base.Authorization = `Bearer ${cloudConfig.anonKey}`;
  }

  return { ...base, ...extra };
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

const PLUGIN_CATEGORIES: PluginCategory[] = [
  "vocal",
  "saturation",
  "compressors",
  "space",
  "mastering",
];

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
    descriptionRu: row.description_ru ?? null,
    descriptionEn: row.description_en ?? null,
    coverUrl: row.cover_url ?? null,
    files: normalisedFiles,
    ratingAvg: numeric(row.rating_avg),
    ratingCount: numeric(row.rating_count),
    productTag: row.product_tag ?? null,
    pluginCategory: PLUGIN_CATEGORIES.includes(row.plugin_category)
      ? (row.plugin_category as PluginCategory)
      : null,
    tier: row.tier === "pro" ? "pro" : row.tier === "beta" ? "beta" : "free",
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

export function mapCommunitySample(row: Row): CommunitySample {
  const peaks = parseJson<unknown>(row.waveform_peaks, []);
  const category = SAMPLE_CATEGORIES.includes(row.category as SampleCategory)
    ? (row.category as SampleCategory)
    : "loop";
  return {
    id: String(row.id),
    title: row.title ?? "Untitled",
    authorHwid: row.author_hwid ?? "",
    authorName: row.author_name ?? "aether user",
    category,
    bpm: row.bpm == null ? null : numeric(row.bpm),
    musicalKey: row.musical_key ?? null,
    fileUrl: row.file_url ?? "",
    waveformPeaks: Array.isArray(peaks)
      ? peaks.map((value) => Math.max(0, Math.min(1, Number(value) || 0)))
      : [],
    downloadsCount: numeric(row.downloads_count),
    likesCount: numeric(row.likes_count),
    status: (["pending", "approved", "rejected"].includes(String(row.status))
      ? row.status
      : "pending") as SampleStatus,
    isFeatured: Boolean(row.is_featured),
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CatalogResult {
  releases: Release[];
  source: "cloud" | "cache" | "demo";
  error?: string;
  /** Cloud is reachable but has no published releases yet. */
  empty?: boolean;
}

export async function loadCatalog(): Promise<CatalogResult> {
  if (cloudEnabled) {
    try {
      const rows = await rest<Row[]>(
        "releases?select=*&published=eq.true&order=featured.desc,created_at.desc",
      );
      const releases = rows.map(mapRelease);

      // A freshly provisioned project has an empty catalogue. Keep the demo
      // shelf so the hub is never blank, without writing anything to the cloud.
      if (!releases.length) {
        return { releases: demoState().releases, source: "demo", empty: true };
      }

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
  if (cloudEnabled && isCloudReleaseId(releaseId)) {
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
  if (cloudEnabled && isCloudReleaseId(input.releaseId)) {
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
  if (cloudEnabled && isCloudReleaseId(releaseId)) {
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
  if (cloudEnabled && isCloudReleaseId(releaseId)) {
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
// Community samples
// ---------------------------------------------------------------------------

export async function fetchPublicSamples(): Promise<CommunitySample[]> {
  if (cloudEnabled) {
    try {
      const rows = await rest<Row[]>(
        "community_samples?select=*&status=eq.approved&order=is_featured.desc,created_at.desc&limit=200",
      );
      return rows.map(mapCommunitySample);
    } catch {
      return demoState().samples?.filter((s) => s.status === "approved") ?? [];
    }
  }
  return demoState().samples?.filter((s) => s.status === "approved") ?? [];
}

export async function fetchMySamples(machineId: string): Promise<CommunitySample[]> {
  if (cloudEnabled) {
    try {
      const rows = await rpc<Row[]>("aether_my_samples", { p_machine_id: machineId });
      return (rows ?? []).map(mapCommunitySample);
    } catch {
      return [];
    }
  }
  return (demoState().samples ?? []).filter(
    (sample) => sample.authorHwid.replace(/[^0-9A-F]/gi, "").toUpperCase() ===
      machineId.replace(/[^0-9A-F]/gi, "").toUpperCase(),
  );
}

export async function submitCommunitySample(
  input: SubmitSampleInput,
): Promise<CommunitySample> {
  if (cloudEnabled) {
    const row = await rpc<Row>("aether_submit_sample", {
      p_title: input.title,
      p_author_hwid: input.authorHwid,
      p_author_name: input.authorName,
      p_category: input.category,
      p_bpm: input.bpm,
      p_musical_key: input.musicalKey,
      p_file_url: input.fileUrl,
      p_waveform_peaks: input.waveformPeaks,
    });
    return mapCommunitySample(row);
  }

  const state = demoState();
  const sample: CommunitySample = {
    id: uid("sample"),
    title: input.title,
    authorHwid: input.authorHwid,
    authorName: input.authorName,
    category: input.category,
    bpm: input.bpm,
    musicalKey: input.musicalKey,
    fileUrl: input.fileUrl,
    waveformPeaks: input.waveformPeaks,
    downloadsCount: 0,
    likesCount: 0,
    status: "pending",
    isFeatured: false,
    createdAt: new Date().toISOString(),
  };
  state.samples = [sample, ...(state.samples ?? [])];
  saveDemo(state);
  return sample;
}

export async function likeCommunitySample(id: string): Promise<number> {
  if (cloudEnabled && isCloudReleaseId(id)) {
    const count = await rpc<number>("aether_like_sample", { p_id: id });
    return numeric(count);
  }
  const state = demoState();
  const sample = (state.samples ?? []).find((item) => item.id === id);
  if (sample) sample.likesCount += 1;
  saveDemo(state);
  return sample?.likesCount ?? 0;
}

export async function markSampleDownloaded(id: string): Promise<number> {
  if (cloudEnabled && isCloudReleaseId(id)) {
    const count = await rpc<number>("aether_sample_downloaded", { p_id: id });
    return numeric(count);
  }
  const state = demoState();
  const sample = (state.samples ?? []).find((item) => item.id === id);
  if (sample) sample.downloadsCount += 1;
  saveDemo(state);
  return sample?.downloadsCount ?? 0;
}

export async function uploadSampleFile(input: {
  localPath: string;
  storagePath: string;
  contentType: string;
}): Promise<{ publicUrl: string; storagePath: string }> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("cloud_upload_public", {
    config: cloudConfig,
    request: {
      localPath: input.localPath,
      bucket: "aether-samples",
      storagePath: input.storagePath,
      contentType: input.contentType,
    },
  });
}

export async function cacheSamplePath(url: string, filename: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("cache_sample_file", { url, filename });
}

export async function saveSamplePath(url: string, filename: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("save_sample_file", { url, filename });
}

export async function readLocalFileBase64(
  path: string,
  maxBytes?: number,
): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("read_file_base64", { path, maxBytes });
}

export async function sampleDragIconPath(): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("sample_drag_icon");
}

export async function listSamplesForModeration(
  status: SampleStatus | "all" = "all",
): Promise<CommunitySample[]> {
  if (cloudEnabled) {
    const rows = await adminApi<CommunitySample[]>("samples_list", {
      status: status === "all" ? null : status,
    });
    return rows;
  }
  const samples = demoState().samples ?? [];
  return (status === "all" ? samples : samples.filter((s) => s.status === status)).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

export async function moderateSample(
  id: string,
  mode: "approve" | "reject" | "feature" | "unfeature" | "delete",
): Promise<void> {
  if (cloudEnabled) {
    await adminApi("sample_moderate", { id, mode });
    return;
  }

  const state = demoState();
  const samples = state.samples ?? [];
  const sample = samples.find((item) => item.id === id);
  if (!sample) return;

  if (mode === "delete") {
    state.samples = samples.filter((item) => item.id !== id);
  } else if (mode === "approve") {
    sample.status = "approved";
  } else if (mode === "reject") {
    sample.status = "rejected";
    sample.isFeatured = false;
  } else if (mode === "feature") {
    sample.status = "approved";
    sample.isFeatured = true;
  } else if (mode === "unfeature") {
    sample.isFeatured = false;
  }
  saveDemo(state);
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  if (cloudEnabled) {
    return adminApi<SupportTicket[]>("tickets");
  }

  return [...demoState().tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function closeSupportTicket(id: string): Promise<void> {
  if (cloudEnabled) {
    await adminApi("ticket_status", { id, status: "closed" });
    return;
  }

  const state = demoState();
  const ticket = state.tickets.find((item) => item.id === id);
  if (ticket) ticket.status = "closed";
  saveDemo(state);
}

export async function deleteSupportTicket(id: string): Promise<void> {
  if (cloudEnabled) {
    await adminApi("delete_ticket", { id });
    return;
  }

  const state = demoState();
  state.tickets = state.tickets.filter((item) => item.id !== id);
  saveDemo(state);
}

export async function clearClosedSupportTickets(): Promise<void> {
  if (cloudEnabled) {
    await adminApi("clear_closed_tickets");
    return;
  }

  const state = demoState();
  state.tickets = state.tickets.filter((item) => item.status !== "closed");
  saveDemo(state);
}

export async function fetchTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  if (cloudEnabled) {
    return adminApi<TicketMessage[]>("ticket_messages", { ticketId });
  }

  return [...(demoState().ticketMessages[ticketId] ?? [])].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export async function sendTicketMessage(input: {
  ticketId: string;
  senderRole: "user" | "admin";
  senderName: string;
  senderAvatar?: string | null;
  message: string;
}): Promise<TicketMessage> {
  if (cloudEnabled) {
    return adminApi<TicketMessage>("send_ticket_message", input);
  }

  const state = demoState();
  const ticketMessage: TicketMessage = {
    id: uid("tmsg"),
    ticketId: input.ticketId,
    senderRole: input.senderRole,
    senderName: input.senderName,
    senderAvatar: input.senderAvatar ?? null,
    message: input.message,
    createdAt: new Date().toISOString(),
  };

  state.ticketMessages[input.ticketId] = [
    ...(state.ticketMessages[input.ticketId] ?? []),
    ticketMessage,
  ];
  saveDemo(state);
  return ticketMessage;
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

export interface AppConfig {
  autoApproveLicenses: boolean;
  autoApproveSlugs: string[];
  pending: number;
}

export interface ApproveAllResult {
  approved: number;
  failed: number;
  errors?: string[];
  pending: number;
}

export interface LauncherNotice {
  latestVersion: string | null;
  notice: string | null;
  url: string | null;
}

export async function fetchLauncherNotice(): Promise<LauncherNotice | null> {
  if (!cloudEnabled) return null;
  try {
    const data = await rpc<LauncherNotice>("aether_launcher_notice", {});
    return data ?? null;
  } catch {
    return null;
  }
}

let launcherRealtime: ReturnType<typeof createClient> | null = null;

/** Subscribes to `app_config` changes so a new launcher version appears without
 *  relaunching the app. Returns an unsubscribe callback, or null in local mode. */
export function subscribeLauncherNotice(
  onNotice: (notice: LauncherNotice) => void,
): (() => void) | null {
  if (!cloudEnabled) return null;

  if (!launcherRealtime) {
    launcherRealtime = createClient(cloudConfig.url, realtimeKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  const channel = launcherRealtime
    .channel("aether-launcher-config")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_config" },
      (payload) => {
        const row = (payload.new ?? {}) as Record<string, unknown>;
        onNotice({
          latestVersion: row.latest_launcher_version
            ? String(row.latest_launcher_version)
            : null,
          notice: row.update_notice ? String(row.update_notice) : null,
          url: row.update_url ? String(row.update_url) : null,
        });
      },
    )
    .subscribe();

  return () => {
    void launcherRealtime?.removeChannel(channel);
  };
}

export async function fetchAppConfig(): Promise<AppConfig> {
  if (!cloudEnabled) return { autoApproveLicenses: false, autoApproveSlugs: [], pending: 0 };
  return adminApi<AppConfig>("config");
}

export async function setAutoApproveLicenses(enabled: boolean): Promise<AppConfig> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  return adminApi<AppConfig>("set_auto_approve", { enabled });
}

export async function setAutoApproveSlugs(slugs: string[]): Promise<AppConfig> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  return adminApi<AppConfig>("set_auto_approve_slugs", { slugs });
}

export async function approveAllPending(): Promise<ApproveAllResult> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  return adminApi<ApproveAllResult>("approve_all_pending");
}

export interface BetaInvite {
  code: string;
  note: string | null;
  usedByHwid: string | null;
  usedAt: string | null;
  createdAt: string;
}

export async function listBetaInvites(): Promise<BetaInvite[]> {
  if (!cloudEnabled) return [];
  const data = await adminApi<{ invites: BetaInvite[] }>("beta_list");
  return data.invites ?? [];
}

export async function createBetaInvites(note: string, count = 1): Promise<string[]> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  const data = await adminApi<{ created: string[] }>("beta_create", { note, count });
  return data.created ?? [];
}

export async function deleteBetaInvite(code: string): Promise<boolean> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  const data = await adminApi<{ deleted: boolean }>("beta_delete", { code });
  return Boolean(data.deleted);
}

export async function clearUnusedBetaInvites(): Promise<number> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  const data = await adminApi<{ deleted: number }>("beta_clear_unused");
  return Number(data.deleted ?? 0);
}

export async function fetchBetaStatus(machineId: string): Promise<boolean> {
  if (!cloudEnabled) return false;
  try {
    return Boolean(await rpc<boolean>("aether_beta_status", { p_machine_id: machineId }));
  } catch {
    return false;
  }
}

export async function redeemBetaInvite(
  code: string,
  machineId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!cloudEnabled) return { ok: false, error: "Cloud is not configured." };
  try {
    const data = await rpc<{ ok: boolean; error?: string }>("aether_redeem_beta_invite", {
      p_code: code,
      p_machine_id: machineId,
    });
    return { ok: Boolean(data?.ok), error: data?.error };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

/** Issues a machine-bound licence for a FREE plugin (no admin token). */
export async function fetchFreeLicenseKey(
  machineId: string,
  productTag: string,
  nickname?: string,
): Promise<string> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  const headers: Record<string, string> = {
    apikey: cloudConfig.anonKey,
    "Content-Type": "application/json",
  };
  if (!usesPublishableKey) headers.Authorization = `Bearer ${cloudConfig.anonKey}`;

  const response = await fetch(`${cloudConfig.url}/functions/v1/aether-admin`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "free_license",
      payload: { machineId, productTag, nickname },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.key) {
    throw new Error(data.error || `Free licence failed (${response.status})`);
  }
  return String(data.key);
}

/** Issues a machine-bound licence for a BETA plugin, but only if the HWID has
 *  an activated Beta invite. This makes beta installs truly one-click. */
export async function fetchBetaLicenseKey(
  machineId: string,
  productTag: string,
  nickname?: string,
  adminToken?: string | null,
): Promise<string> {
  if (!cloudEnabled) throw new Error("Cloud is not configured.");
  const headers: Record<string, string> = {
    apikey: cloudConfig.anonKey,
    "Content-Type": "application/json",
  };
  if (!usesPublishableKey) headers.Authorization = `Bearer ${cloudConfig.anonKey}`;

  const response = await fetch(`${cloudConfig.url}/functions/v1/aether-admin`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "beta_license",
      payload: {
        machineId,
        productTag,
        nickname,
        adminToken: adminToken?.trim() || undefined,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.key) {
    throw new Error(data.error || `Beta licence failed (${response.status})`);
  }
  return String(data.key);
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
  if (cloudEnabled && isCloudReleaseId(commentId)) {
    await adminApi("delete_comment", { id: commentId });
    return;
  }

  const state = demoState();
  state.comments = state.comments.filter((c) => c.id !== commentId);
  saveDemo(state);
}

export async function deleteRelease(releaseId: string): Promise<void> {
  if (cloudEnabled && isCloudReleaseId(releaseId)) {
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
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  coverUrl?: string | null;
  files: Release["files"];
  productTag?: string | null;
  pluginCategory?: PluginCategory | null;
  tier?: Tier;
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
    descriptionRu: payload.descriptionRu ?? existing?.descriptionRu ?? null,
    descriptionEn: payload.descriptionEn ?? existing?.descriptionEn ?? null,
    coverUrl: payload.coverUrl ?? existing?.coverUrl ?? null,
    files: payload.files,
    ratingAvg: existing?.ratingAvg ?? 5,
    ratingCount: existing?.ratingCount ?? 1,
    productTag: payload.productTag ?? null,
    pluginCategory: payload.pluginCategory ?? existing?.pluginCategory ?? null,
    tier: payload.tier ?? "free",
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
