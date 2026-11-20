// ============================================================================
//  Aether Hub — admin Edge Function
//  Deploy:  supabase functions deploy aether-admin --no-verify-jwt
//  Secret:  supabase secrets set ADMIN_TOKEN=<long-random-string>
//
//  Every privileged action requires the ADMIN_TOKEN. The token lives only in
//  the creator's local .env (VITE_AETHER_ADMIN_TOKEN) and in Supabase secrets;
//  public builds are compiled without it.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-upsert",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const norm = (value: unknown) =>
  String(value ?? "").toUpperCase().replace(/[^0-9A-F]/g, "");

const mapRelease = (row: Record<string, any>) => ({
  id: row.id,
  slug: row.slug,
  category: row.category,
  title: row.title,
  version: row.version,
  description: row.description,
  coverUrl: row.cover_url,
  files: row.files ?? {},
  ratingAvg: Number(row.rating_avg ?? 0),
  ratingCount: Number(row.rating_count ?? 0),
  productTag: row.product_tag,
  featured: Boolean(row.featured),
  badge: row.badge,
  previews: row.previews ?? [],
  createdAt: row.created_at,
});

const mapRequest = (row: Record<string, any>) => ({
  id: String(row.id),
  machineId: row.machine_id,
  nickname: row.nickname,
  avatarUrl: row.avatar_url,
  pluginSlug: row.plugin_slug,
  pluginTitle: row.plugin_title,
  productTag: row.product_tag,
  status: row.status,
  key: row.key,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
});

const mapComment = (row: Record<string, any>, releaseTitle?: string) => ({
  id: String(row.id),
  releaseId: row.release_id,
  nickname: row.nickname,
  avatarUrl: row.avatar_url,
  body: row.body,
  machineId: row.machine_id,
  createdAt: row.created_at,
  releaseTitle,
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (request.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminToken = Deno.env.get("ADMIN_TOKEN");

  if (!supabaseUrl || !serviceKey || !adminToken) {
    return json({ error: "Function secrets are not configured" }, 500);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { token, action, payload = {} } = body ?? {};

  if (!token || token !== adminToken) {
    return json({ error: "Invalid admin token" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    switch (action) {
      // ---------------------------------------------------------- uploads ----
      case "sign_upload": {
        const bucket = String(payload.bucket ?? "aether-assets");
        if (bucket !== "aether-assets") return json({ error: "Bucket not allowed" }, 403);

        const path = String(payload.path ?? "").replace(/^\/+/, "");
        if (!path || path.includes("..") || path.length > 300) {
          return json({ error: "Invalid storage path" }, 400);
        }

        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUploadUrl(path, { upsert: true });

        if (error) return json({ error: error.message }, 400);

        return json({
          bucket,
          path,
          token: data.token,
          signedUrl: `${supabaseUrl}/storage/v1${data.signedUrl}`,
          publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
        });
      }

      // -------------------------------------------------------- publishing ---
      case "publish": {
        const release = payload.release;
        if (!release?.slug || !release?.title || !release?.category) {
          return json({ error: "release.slug, title and category are required" }, 400);
        }

        const files = release.files ?? {};
        for (const key of Object.keys(files)) {
          if (!["macos", "windows"].includes(key)) delete files[key];
        }

        const row: Record<string, any> = {
          slug: String(release.slug).slice(0, 80),
          category: release.category,
          title: String(release.title).slice(0, 120),
          version: String(release.version ?? "1.0").slice(0, 24),
          description: String(release.description ?? "").slice(0, 6000),
          cover_url: release.coverUrl ?? null,
          files,
          product_tag: release.productTag ? String(release.productTag).slice(0, 64) : null,
          featured: Boolean(release.featured),
          badge: release.badge ? String(release.badge).slice(0, 16) : null,
          previews: Array.isArray(release.previews) ? release.previews.slice(0, 12) : [],
          published: true,
          updated_at: new Date().toISOString(),
        };

        let saved;
        if (release.id) {
          const { data, error } = await supabase
            .from("releases")
            .update(row)
            .eq("id", release.id)
            .select("*")
            .single();
          if (error) return json({ error: error.message }, 400);
          saved = data;
        } else {
          const { data, error } = await supabase
            .from("releases")
            .upsert(row, { onConflict: "slug" })
            .select("*")
            .single();
          if (error) return json({ error: error.message }, 400);
          saved = data;
        }

        return json(mapRelease(saved));
      }

      case "delete_release": {
        const id = String(payload.id ?? "");
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await supabase.from("releases").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "delete_comment": {
        const id = String(payload.id ?? "");
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await supabase.from("comments").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      // ---------------------------------------------------------- overview ---
      case "overview": {
        const [{ data: requests, error: reqError }, { data: comments, error: commentError }, { data: releases, error: relError }] =
          await Promise.all([
            supabase.from("license_requests").select("*").order("created_at", { ascending: false }).limit(200),
            supabase.from("comments").select("*").order("created_at", { ascending: false }).limit(200),
            supabase.from("releases").select("id,title"),
          ]);

        if (reqError) return json({ error: reqError.message }, 400);
        if (commentError) return json({ error: commentError.message }, 400);
        if (relError) return json({ error: relError.message }, 400);

        const titles = new Map((releases ?? []).map((r: any) => [r.id, r.title]));

        return json({
          requests: (requests ?? []).map(mapRequest),
          comments: (comments ?? []).map((row: any) => mapComment(row, titles.get(row.release_id))),
        });
      }

      // -------------------------------------------------------- licensing ---
      case "approve_request": {
        const id = String(payload.id ?? "");
        const key = String(payload.key ?? "");
        if (!id || !key.startsWith("AETHER-")) {
          return json({ error: "id and a valid AETHER- key are required" }, 400);
        }

        const { data: requestRow, error: fetchError } = await supabase
          .from("license_requests")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) return json({ error: fetchError.message }, 404);

        const { error: updateError } = await supabase
          .from("license_requests")
          .update({ status: "approved", key, resolved_at: new Date().toISOString() })
          .eq("id", id);

        if (updateError) return json({ error: updateError.message }, 400);

        const { error: licenseError } = await supabase.from("licenses").upsert(
          {
            machine_id: norm(requestRow.machine_id),
            product_tag: requestRow.product_tag,
            plugin_title: requestRow.plugin_title,
            key,
            nickname: requestRow.nickname,
            issued_at: new Date().toISOString(),
          },
          { onConflict: "machine_id,product_tag" },
        );

        if (licenseError) return json({ error: licenseError.message }, 400);

        return json({ ok: true });
      }

      case "reject_request": {
        const id = String(payload.id ?? "");
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await supabase
          .from("license_requests")
          .update({ status: "rejected", resolved_at: new Date().toISOString() })
          .eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
