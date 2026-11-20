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

/**
 * The bucket metadata endpoint (`GET /storage/v1/bucket/:id`) answers 404
 * NoSuchBucket for publishable keys even when the bucket exists, so we ask for
 * an object listing instead: an existing bucket returns 200 (even when empty),
 * a missing one returns NoSuchBucket/404, and a private bucket returns 401/403.
 */
async function probeBucket(): Promise<CloudCheck> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${cloudConfig.url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...requestHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        prefix: "",
        limit: 1,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      }),
      signal: controller.signal,
    });
    const body = await response.text();

    if (response.status === 200) return { key: BUCKET, status: "ok" };
    if (response.status === 401 || response.status === 403) {
      return { key: BUCKET, status: "secured" };
    }
    if (response.status === 404 || body.includes("NoSuchBucket")) {
      return { key: BUCKET, status: "missing" };
    }
    return { key: BUCKET, status: "error", detail: `HTTP ${response.status}` };
  } catch (error) {
    return { key: BUCKET, status: "error", detail: String(error) };
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

  const bucket = await probeBucket();

  return { tables, bucket, checkedAt: new Date().toISOString() };
}

export function summarizeHealth(health: CloudHealth): string {
  const parts = health.tables.map((table) => `${table.key}=${table.status}`);
  return `cloud health · ${parts.join(" · ")} · bucket:${health.bucket.key}=${health.bucket.status}`;
}
