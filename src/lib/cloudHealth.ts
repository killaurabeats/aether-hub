import { cloudConfig, cloudEnabled, usesPublishableKey } from "./cloud";

export type CloudCheckStatus = "ok" | "secured" | "missing" | "error";

export interface CloudCheck {
  key: string;
  status: CloudCheckStatus;
  detail?: string;
}

export interface CloudHealth {
  tables: CloudCheck[];
  bucket: CloudCheck;
  checkedAt: string;
}

/**
 * Tables created by `supabase/schema.sql`. Public catalogue tables answer 200
 * for anon; sensitive tables intentionally answer 401/403 because their grants
 * are revoked and access goes through SECURITY DEFINER RPCs or the Edge
 * Function. A 404 means the schema was not applied.
 */
const TABLES = [
  "releases",
  "comments",
  "profiles",
  "ratings",
  "license_requests",
  "licenses",
  "support_tickets",
  "ticket_messages",
];

export const BUCKET = "aether-assets";

function requestHeaders(): Record<string, string> {
  const headers: Record<string, string> = { apikey: cloudConfig.anonKey };
  if (!usesPublishableKey) headers.Authorization = `Bearer ${cloudConfig.anonKey}`;
  return headers;
}

async function probe(path: string): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${cloudConfig.url}${path}`, {
      headers: requestHeaders(),
      signal: controller.signal,
    });
    return { status: response.status, body: await response.text() };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function checkCloudHealth(): Promise<CloudHealth> {
  if (!cloudEnabled) {
    return {
      tables: TABLES.map((key) => ({
        key,
        status: "missing" as const,
        detail: "Cloud is not configured",
      })),
      bucket: { key: BUCKET, status: "missing", detail: "Cloud is not configured" },
      checkedAt: new Date().toISOString(),
    };
  }

  const tables = await Promise.all(
    TABLES.map(async (key): Promise<CloudCheck> => {
      try {
        const result = await probe(`/rest/v1/${key}?select=*&limit=1`);

        if (result.status === 200) return { key, status: "ok" };
        // A 401/403 from PostgREST means the table exists but its RLS/grants
        // intentionally deny direct anon access (our secured tables).
        if (result.status === 401 || result.status === 403) {
          return { key, status: "secured" };
        }
        if (result.status === 404 || result.body.includes("PGRST205")) {
          return { key, status: "missing" };
        }
        return { key, status: "error", detail: `HTTP ${result.status}` };
      } catch (error) {
        return { key, status: "error", detail: String(error) };
      }
    }),
  );

  let bucket: CloudCheck = { key: BUCKET, status: "error" };
  try {
    const result = await probe(`/storage/v1/bucket/${BUCKET}`);
    if (result.status === 200) bucket = { key: BUCKET, status: "ok" };
    else if (result.status === 401 || result.status === 403) {
      bucket = { key: BUCKET, status: "secured" };
    } else if (result.body.includes("NoSuchBucket") || result.status === 404) {
      bucket = { key: BUCKET, status: "missing" };
    } else {
      bucket = { key: BUCKET, status: "error", detail: `HTTP ${result.status}` };
    }
  } catch (error) {
    bucket = { key: BUCKET, status: "error", detail: String(error) };
  }

  return { tables, bucket, checkedAt: new Date().toISOString() };
}

export function summarizeHealth(health: CloudHealth): string {
  const parts = health.tables.map((table) => `${table.key}=${table.status}`);
  return `cloud health · ${parts.join(" · ")} · bucket:${health.bucket.key}=${health.bucket.status}`;
}
