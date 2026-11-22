/**
 * Creator / admin hardware access.
 *
 * The machine ID is a hardware-bound value produced by the Rust side. These
 * IDs open BETA plugins without a beta invite, even in public builds that ship
 * without `VITE_AETHER_ADMIN_TOKEN`.
 */

/** Main Mac used by the creator. Canonical HWIDs are compared without dashes. */
export const ADMIN_HWIDS = [
  "A466-5503-9168-BE03-2BEE-EE7C-450F-F6A6",
] as const;

export const ADMIN_HWIDS_STORAGE_KEY = "aether.admin.hwids.v1";

/** Uppercases and strips separators so pasted and formatted IDs compare equal. */
export function canonicalHwid(value: string | null | undefined): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "");
}

function readStoredHwids(): string[] {
  try {
    const raw = localStorage.getItem(ADMIN_HWIDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((value) => canonicalHwid(String(value))).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

/** Baked creator HWIDs followed by devices added from Admin Studio. */
export function adminHwidList(): string[] {
  return [
    ...ADMIN_HWIDS.map((value) => canonicalHwid(value)),
    ...readStoredHwids(),
  ];
}

export function isAdminHwid(value: string | null | undefined): boolean {
  const target = canonicalHwid(value);
  return Boolean(target) && adminHwidList().includes(target);
}

/** Adds a device to the local Admin HWID list. Returns false for an empty ID. */
export function rememberAdminHwid(value: string | null | undefined): boolean {
  const target = canonicalHwid(value);
  if (!target) return false;
  try {
    const existing = new Set(readStoredHwids());
    existing.add(target);
    localStorage.setItem(ADMIN_HWIDS_STORAGE_KEY, JSON.stringify([...existing]));
    return true;
  } catch {
    return false;
  }
}
