let formatLanguage: "ru" | "en" = "ru";

export function setFormatLanguage(language: "ru" | "en") {
  formatLanguage = language;
}

function locale() {
  return formatLanguage === "en" ? "en-US" : "ru-RU";
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${Math.round(mb)} MB`;
  if (mb >= 10) return `${mb.toFixed(1)} MB`;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${Math.round(kb)} KB`;
}

export function formatExactBytes(bytes: number): string {
  return `${bytes.toLocaleString(locale())} ${formatLanguage === "en" ? "bytes" : "байт"}`;
}

export function timeAgo(iso: string): string {
  const date = new Date(iso).getTime();
  if (!Number.isFinite(date)) return "";

  const diff = Date.now() - date;
  const minutes = Math.floor(diff / 60_000);

  if (formatLanguage === "en") {
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hoursEn = Math.floor(minutes / 60);
    if (hoursEn < 24) return `${hoursEn} h ago`;
    const daysEn = Math.floor(hoursEn / 24);
    if (daysEn === 1) return "yesterday";
    if (daysEn < 30) return `${daysEn} d ago`;
    return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }

  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 30) return `${days} дн назад`;

  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function osLabel(os: string): string {
  return os === "macos" ? "macOS" : "Windows";
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AE";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}
