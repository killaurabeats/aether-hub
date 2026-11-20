export type Category = "plugins" | "drumkits" | "presets";
export type OSKey = "macos" | "windows";

export const CATEGORY_META: Record<
  Category,
  { label: string; singular: string; sub: string }
> = {
  plugins: {
    label: "Plugins",
    singular: "Plugin",
    sub: "VST3 · AU · instruments & effects",
  },
  drumkits: {
    label: "Drumkits",
    singular: "Drumkit",
    sub: "One-shots · loops · 808s",
  },
  presets: {
    label: "Presets",
    singular: "Preset",
    sub: "FL Studio · vocal chains · FX",
  },
};

export interface ReleaseFile {
  url: string;
  sizeBytes: number;
  filename?: string;
}

export interface PreviewSound {
  name: string;
  url: string;
}

export interface Release {
  id: string;
  slug: string;
  category: Category;
  title: string;
  version: string;
  description: string;
  coverUrl?: string | null;
  files: Partial<Record<OSKey, ReleaseFile>>;
  ratingAvg: number;
  ratingCount: number;
  productTag?: string | null;
  featured?: boolean;
  badge?: string | null;
  previews?: PreviewSound[];
  createdAt?: string | null;
}

export interface Comment {
  id: string;
  releaseId: string;
  nickname: string;
  avatarUrl?: string | null;
  body: string;
  machineId?: string | null;
  createdAt: string;
}

export interface Profile {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  machineId: string;
}

export interface LicenseRequest {
  id: string;
  machineId: string;
  nickname: string;
  avatarUrl?: string | null;
  pluginSlug: string;
  pluginTitle: string;
  productTag: string;
  status: "pending" | "approved" | "rejected";
  key?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface License {
  id: string;
  machineId: string;
  productTag: string;
  pluginTitle?: string | null;
  key: string;
  nickname?: string | null;
  issuedAt: string;
}

export interface IssueLogEntry {
  issuedAt: string;
  machineId: string;
  productTag: string;
  key: string;
  nickname: string;
  pluginTitle: string;
}

export interface InstallRecord {
  version: string;
  installedAt: string;
  category: Category;
  title: string;
  paths: string[];
  sizeBytes: number;
}

export type Installs = Record<string, InstallRecord>;

export interface InstallProgress {
  slug: string;
  phase: "preparing" | "downloading" | "extracting" | "installing" | "done";
  received: number;
  total: number;
  percent: number;
  message?: string | null;
}

export interface AppPaths {
  os: string;
  arch: string;
  home: string;
  documents: string;
  presetsDir: string;
  drumkitsDir: string;
  vst3Dir: string;
  componentsDir: string;
  resourceDir: string;
  appDataDir: string;
  installsFile: string;
}

export interface MachineInfo {
  canonical: string;
  formatted: string;
  os: string;
  platformLabel: string;
}

export interface AdminStatus {
  enabled: boolean;
  privateKeyPath?: string | null;
  publicKey?: string | null;
  source?: string | null;
}

export interface CloudConfig {
  url: string;
  anonKey: string;
  adminToken: string;
}

export type Language = "ru" | "en";

export interface Settings {
  language: Language;
  soundEnabled: boolean;
  soundVolume: number;
  glassBlur: boolean;
  reduceEffects: boolean;
  presetDir: string | null;
  drumkitDir: string | null;
  /** Optional override: the Machine ID shown by the plugin's activation window. */
  licenseMachineId: string | null;
  seenSplash: boolean;
}

export type View =
  | { name: "home" }
  | { name: "category"; category: Category }
  | { name: "admin" }
  | { name: "keygen" }
  | { name: "search"; query: string };

export interface Toast {
  id: string;
  kind: "success" | "error" | "info";
  title: string;
  message?: string;
}
