// ============================================================================
//  Aether Hub - admin Edge Function
//  Deploy:  supabase functions deploy aether-admin --no-verify-jwt
//  Secret:  supabase secrets set ADMIN_TOKEN=<long-random-string>
//
//  Every privileged action requires the ADMIN_TOKEN. The token lives only in
//  the creator's local .env (VITE_AETHER_ADMIN_TOKEN) and in Supabase secrets;
//  public builds are compiled without it.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { eddsa } from "npm:@noble/curves@2.4.0/abstract/edwards.js";
import { ed25519 } from "npm:@noble/curves@2.4.0/ed25519.js";
import { blake2b } from "npm:@noble/hashes@2.4.0/blake2.js";

// Monocypher's EdDSA is Ed25519 with BLAKE2b-512 instead of SHA-512. Noble's
// Edwards arithmetic accepts a custom hash, which gives byte-identical
// signatures to src-tauri/vendor/monocypher without shipping native WASM.
const adjustScalarBytes = (bytes: Uint8Array): Uint8Array => {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
};

const monoEdDsa = eddsa(ed25519.Point, blake2b, {
  adjustScalarBytes,
  zip215: true,
});

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const KEY_VERSION = 1;
const DEFAULT_PRODUCT_TAG = "AETHER-VOCAL-STRIP";

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const base32Encode = (data: Uint8Array): string => {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of data) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
};

const normaliseMachineId = (value: unknown) =>
  String(value ?? "").toUpperCase().replace(/[^0-9A-F]/g, "");

const sanitiseTag = (value: unknown) => {
  const cleaned = String(value ?? "")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .toUpperCase()
    .slice(0, 64);
  return cleaned || DEFAULT_PRODUCT_TAG;
};

const readPrivateSeed = (raw: string | undefined): Uint8Array => {
  if (!raw) throw new Error("LICENSE_PRIVATE_KEY secret is missing");
  let value = raw.trim();
  if (value.startsWith("{")) {
    const parsed = JSON.parse(value);
    value = String(parsed.privateKey ?? parsed.private_key ?? "");
  }
  const hex = value.replace(/[^0-9a-fA-F]/g, "");
  if (hex.length < 64) throw new Error("LICENSE_PRIVATE_KEY is not valid");
  return hexToBytes(hex.slice(0, 64));
};

const issueLicenseKey = (machineId: string, productTag: string): string => {
  const canonical = normaliseMachineId(machineId);
  if (canonical.length !== 32) {
    throw new Error("Machine ID must contain exactly 32 hex characters.");
  }
  const seed = readPrivateSeed(Deno.env.get("LICENSE_PRIVATE_KEY"));
  const tag = sanitiseTag(productTag);
  const message = new TextEncoder().encode(`${tag}|v1|${canonical}`);
  const signature = monoEdDsa.sign(message, seed);
  const payload = new Uint8Array(65);
  payload[0] = KEY_VERSION;
  payload.set(signature, 1);
  const encoded = base32Encode(payload);
  return `AETHER-${encoded.match(/.{1,4}/g)?.join("-") ?? encoded}`;
};

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
  descriptionRu: row.description_ru,
  descriptionEn: row.description_en,
  coverUrl: row.cover_url,
  files: row.files ?? {},
  ratingAvg: Number(row.rating_avg ?? 0),
  ratingCount: Number(row.rating_count ?? 0),
  productTag: row.product_tag,
  pluginCategory: row.plugin_category ?? null,
  tier: row.tier === "pro" ? "pro" : row.tier === "beta" ? "beta" : "free",
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

const mapTicket = (row: Record<string, any>) => ({
  id: String(row.id),
  machineId: row.machine_id,
  nickname: row.nickname,
  avatarUrl: row.avatar_url,
  os: row.os,
  message: row.message,
  status: row.status,
  createdAt: row.created_at,
});

const mapTicketMessage = (row: Record<string, any>) => ({
  id: String(row.id),
  ticketId: row.ticket_id,
  senderRole: row.sender_role,
  senderName: row.sender_name,
  senderAvatar: row.sender_avatar,
  message: row.message,
  createdAt: row.created_at,
});

const mapSample = (row: Record<string, any>) => ({
  id: String(row.id),
  title: row.title,
  authorHwid: row.author_hwid,
  authorName: row.author_name,
  category: row.category,
  bpm: row.bpm == null ? null : Number(row.bpm),
  musicalKey: row.musical_key,
  fileUrl: row.file_url,
  waveformPeaks: Array.isArray(row.waveform_peaks) ? row.waveform_peaks : [],
  downloadsCount: Number(row.downloads_count ?? 0),
  likesCount: Number(row.likes_count ?? 0),
  status: row.status,
  isFeatured: Boolean(row.is_featured),
  createdAt: row.created_at,
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

const issuePendingRequest = async (supabase: any, row: Record<string, any>) => {
  if (!row || row.status !== "pending") return { skipped: true };

  const key = issueLicenseKey(row.machine_id, row.product_tag);
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("license_requests")
    .update({ status: "approved", key, resolved_at: now })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) return { skipped: true };

  const { error: licenseError } = await supabase.from("licenses").upsert(
    {
      machine_id: norm(row.machine_id),
      product_tag: row.product_tag,
      plugin_title: row.plugin_title,
      key,
      nickname: row.nickname,
      issued_at: now,
    },
    { onConflict: "machine_id,product_tag" },
  );

  if (licenseError) throw licenseError;
  return { skipped: false, key };
};

const readAutoApprove = async (supabase: any): Promise<boolean> => {
  const { data, error } = await supabase
    .from("app_config")
    .select("auto_approve_licenses")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.auto_approve_licenses);
};

const readAutoApproveSlugs = async (supabase: any): Promise<string[]> => {
  const { data, error } = await supabase
    .from("app_config")
    .select("auto_approve_slugs")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  const value = data?.auto_approve_slugs;
  return Array.isArray(value) ? value.map(String) : [];
};

const pendingCount = async (supabase: any): Promise<number> => {
  const { count, error } = await supabase
    .from("license_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
};

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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // FREE products may be activated without the admin token. The server still
  // checks that the product is actually marked as free in the catalogue.
  if (action === "free_license") {
    const productTag = sanitiseTag(payload.productTag);
    const machine = normaliseMachineId(payload.machineId);
    if (machine.length !== 32) return json({ error: "Invalid Machine ID" }, 400);

    const { data: releaseRow, error: releaseError } = await supabase
      .from("releases")
      .select("tier, title")
      .eq("product_tag", productTag)
      .eq("published", true)
      .limit(1)
      .maybeSingle();
    if (releaseError) return json({ error: releaseError.message }, 400);
    if (!releaseRow || releaseRow.tier !== "free") {
      return json({ error: "This product requires a licence" }, 403);
    }

    try {
      const key = issueLicenseKey(machine, productTag);
      const now = new Date().toISOString();
      const { error: licenseError } = await supabase.from("licenses").upsert(
        {
          machine_id: machine,
          product_tag: productTag,
          plugin_title: releaseRow.title,
          key,
          nickname: String(payload.nickname ?? "aether user").slice(0, 40),
          issued_at: now,
        },
        { onConflict: "machine_id,product_tag" },
      );
      if (licenseError) return json({ error: licenseError.message }, 400);
      return json({ key, productTag });
    } catch (error) {
      return json({ error: String(error) }, 500);
    }
  }

  // BETA products are free for invited testers. The invite is bound to the
  // Machine ID, so the same HWID check that unlocks the UI also gates the key.
  if (action === "beta_license") {
    const productTag = sanitiseTag(payload.productTag);
    const machine = normaliseMachineId(payload.machineId);
    if (machine.length !== 32) return json({ error: "Invalid Machine ID" }, 400);

    const { data: releaseRow, error: releaseError } = await supabase
      .from("releases")
      .select("tier, title")
      .eq("product_tag", productTag)
      .eq("published", true)
      .limit(1)
      .maybeSingle();
    if (releaseError) return json({ error: releaseError.message }, 400);
    if (!releaseRow || releaseRow.tier !== "beta") {
      return json({ error: "This product is not in beta" }, 403);
    }

    const { data: invite } = await supabase
      .from("beta_invites")
      .select("code")
      .eq("used_by_hwid", machine)
      .limit(1)
      .maybeSingle();

    // Creators can install BETA builds without burning an invite. Accept the
    // admin token from the app, or a HWID listed in the ADMIN_HWIDS secret.
    const adminHwids = String(Deno.env.get("ADMIN_HWIDS") ?? "")
      .split(/[,;\s]+/)
      .map(normaliseMachineId)
      .filter(Boolean);
    const isAdminToken = Boolean(
      payload.adminToken && adminToken && String(payload.adminToken) === adminToken,
    );
    const isAdminHwid = adminHwids.includes(machine);

    if (!invite && !isAdminToken && !isAdminHwid) {
      return json({ error: "Beta invite required" }, 403);
    }

    try {
      const key = issueLicenseKey(machine, productTag);
      const now = new Date().toISOString();
      const { error: licenseError } = await supabase.from("licenses").upsert(
        {
          machine_id: machine,
          product_tag: productTag,
          plugin_title: releaseRow.title,
          key,
          nickname: String(payload.nickname ?? "aether user").slice(0, 40),
          issued_at: now,
        },
        { onConflict: "machine_id,product_tag" },
      );
      if (licenseError) return json({ error: licenseError.message }, 400);
      return json({ key, productTag });
    } catch (error) {
      return json({ error: String(error) }, 500);
    }
  }

  if (!token || token !== adminToken) {
    return json({ error: "Invalid admin token" }, 401);
  }

  try {
    switch (action) {
      // ----------------------------------------------------- auto-approve ----
      case "config": {
        const { data: cfg } = await supabase
          .from("app_config")
          .select("latest_launcher_version, update_notice, update_url")
          .eq("id", true)
          .maybeSingle();
        return json({
          autoApproveLicenses: await readAutoApprove(supabase),
          autoApproveSlugs: await readAutoApproveSlugs(supabase),
          pending: await pendingCount(supabase),
          latestVersion: cfg?.latest_launcher_version ?? null,
          updateNotice: cfg?.update_notice ?? null,
          updateUrl: cfg?.update_url ?? null,
        });
      }

      case "set_auto_approve": {
        const enabled = Boolean(payload.enabled);
        const { data, error } = await supabase
          .from("app_config")
          .upsert(
            {
              id: true,
              auto_approve_licenses: enabled,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          )
          .select("auto_approve_licenses")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({
          autoApproveLicenses: Boolean(data?.auto_approve_licenses),
          autoApproveSlugs: await readAutoApproveSlugs(supabase),
          pending: await pendingCount(supabase),
        });
      }

      case "set_auto_approve_slugs": {
        const slugs = Array.isArray(payload.slugs)
          ? [...new Set(payload.slugs.map((slug: unknown) => String(slug).trim()).filter(Boolean))].slice(0, 200)
          : [];
        const { data, error } = await supabase
          .from("app_config")
          .upsert(
            {
              id: true,
              auto_approve_slugs: slugs,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          )
          .select("auto_approve_slugs")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({
          autoApproveLicenses: await readAutoApprove(supabase),
          autoApproveSlugs: Array.isArray(data?.auto_approve_slugs)
            ? data.auto_approve_slugs.map(String)
            : slugs,
          pending: await pendingCount(supabase),
        });
      }

      case "auto_approve_request": {
        const id = String(payload.id ?? "");
        if (!id) return json({ error: "id required" }, 400);

        const { data: requestRow, error: reqError } = await supabase
          .from("license_requests")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (reqError) return json({ error: reqError.message }, 400);
        if (!requestRow) return json({ skipped: true });

        const enabled = await readAutoApprove(supabase);
        const autoSlugs = await readAutoApproveSlugs(supabase);
        if (!enabled && !autoSlugs.includes(String(requestRow.plugin_slug ?? ""))) {
          return json({ skipped: true });
        }

        const result = await issuePendingRequest(supabase, requestRow);
        return json({ ok: true, ...result });
      }

      case "approve_all_pending": {
        const { data: rows, error } = await supabase
          .from("license_requests")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(200);
        if (error) return json({ error: error.message }, 400);

        let approved = 0;
        const failures: string[] = [];
        for (const row of rows ?? []) {
          try {
            const result = await issuePendingRequest(supabase, row);
            if (!result.skipped) approved += 1;
          } catch (error) {
            failures.push(`${row.id}: ${String(error)}`);
          }
        }

        return json({
          approved,
          failed: failures.length,
          errors: failures.slice(0, 10),
          pending: await pendingCount(supabase),
        });
      }

      // ---------------------------------------------------------- beta ------
      case "beta_list": {
        const { data, error } = await supabase
          .from("beta_invites")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) return json({ error: error.message }, 400);
        return json({
          invites: (data ?? []).map((row: any) => ({
            code: row.code,
            note: row.note,
            usedByHwid: row.used_by_hwid,
            usedAt: row.used_at,
            createdAt: row.created_at,
          })),
        });
      }

      case "beta_create": {
        const note = String(payload.note ?? "").trim().slice(0, 160) || null;
        const count = Math.max(1, Math.min(100, Number(payload.count ?? 1) || 1));
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const created: string[] = [];

        for (let i = 0; i < count; i += 1) {
          let inserted = false;
          for (let attempt = 0; attempt < 6 && !inserted; attempt += 1) {
            const random = crypto.getRandomValues(new Uint8Array(6));
            const suffix = Array.from(random, (byte) => alphabet[byte % alphabet.length]).join("");
            const code = `AETHER-BETA-${suffix}`;
            const { error } = await supabase.from("beta_invites").insert({ code, note });
            if (!error) {
              created.push(code);
              inserted = true;
            } else if (!String(error.message).toLowerCase().includes("duplicate")) {
              return json({ error: error.message }, 400);
            }
          }
        }

        return json({ created });
      }

      case "beta_delete": {
        const code = String(payload.code ?? "").trim();
        if (!code) return json({ error: "code required" }, 400);
        const { data, error } = await supabase
          .from("beta_invites")
          .delete()
          .eq("code", code)
          .is("used_by_hwid", null)
          .select("code")
          .maybeSingle();
        if (error) return json({ error: error.message }, 400);
        return json({ deleted: Boolean(data), code });
      }

      case "beta_clear_unused": {
        const { data, error } = await supabase
          .from("beta_invites")
          .delete()
          .is("used_by_hwid", null)
          .select("code");
        if (error) return json({ error: error.message }, 400);
        return json({ deleted: (data ?? []).length });
      }

      // ----------------------------------------------------- community samples
      case "samples_list": {
        const status = ["pending", "approved", "rejected"].includes(String(payload.status))
          ? String(payload.status)
          : null;
        let query = supabase
          .from("community_samples")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300);
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return json({ error: error.message }, 400);
        return json((data ?? []).map(mapSample));
      }

      case "sample_moderate": {
        const id = String(payload.id ?? "");
        const actionName = String(payload.mode ?? payload.sampleAction ?? "");
        if (!id) return json({ error: "id required" }, 400);

        if (actionName === "delete") {
          const { error } = await supabase.from("community_samples").delete().eq("id", id);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true, deleted: true });
        }

        const patch: Record<string, any> = {};
        if (actionName === "approve") {
          patch.status = "approved";
        } else if (actionName === "reject") {
          patch.status = "rejected";
          patch.is_featured = false;
        } else if (actionName === "feature") {
          patch.is_featured = true;
          patch.status = "approved";
        } else if (actionName === "unfeature") {
          patch.is_featured = false;
        } else {
          return json({ error: "Unknown moderation action" }, 400);
        }

        const { data, error } = await supabase
          .from("community_samples")
          .update(patch)
          .eq("id", id)
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json(mapSample(data));
      }

      // ---------------------------------------------------------- uploads ----
      case "sign_upload": {
        const bucket = String(payload.bucket ?? "aether-assets");
        if (bucket !== "aether-assets" && bucket !== "aether-samples") {
          return json({ error: "Bucket not allowed" }, 403);
        }

        const path = String(payload.path ?? "").replace(/^\/+/, "");
        if (!path || path.includes("..") || path.length > 300) {
          return json({ error: "Invalid storage path" }, 400);
        }

        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUploadUrl(path, { upsert: true });

        if (error) return json({ error: error.message }, 400);

        // supabase-js may return either an absolute upload URL or a path such
        // as `/object/upload/sign/...`; only prefix the path form once.
        const signedUrl = data.signedUrl.startsWith("http")
          ? data.signedUrl
          : `${supabaseUrl}/storage/v1${data.signedUrl}`;

        return json({
          bucket,
          path,
          token: data.token,
          signedUrl,
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

        const pluginCategory = ["vocal", "saturation", "compressors", "space", "mastering"].includes(
          String(release.pluginCategory ?? ""),
        )
          ? String(release.pluginCategory)
          : null;

        const row: Record<string, any> = {
          slug: String(release.slug).slice(0, 80),
          category: release.category,
          title: String(release.title).slice(0, 120),
          version: String(release.version ?? "1.0").slice(0, 24),
          description: String(release.description ?? "").slice(0, 6000),
          description_ru: release.descriptionRu ?? null,
          description_en: release.descriptionEn ?? null,
          cover_url: release.coverUrl ?? null,
          files,
          product_tag: release.productTag ? String(release.productTag).slice(0, 64) : null,
          plugin_category: pluginCategory,
          tier: release.tier === "pro" ? "pro" : release.tier === "beta" ? "beta" : "free",
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

      // ------------------------------------------------------- support tickets
      case "tickets": {
        const { data, error } = await supabase
          .from("support_tickets")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) return json({ error: error.message }, 400);
        return json((data ?? []).map(mapTicket));
      }

      case "ticket_messages": {
        const ticketId = String(payload.ticketId ?? "");
        if (!ticketId) return json({ error: "ticketId required" }, 400);
        const { data, error } = await supabase
          .from("ticket_messages")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true })
          .limit(500);
        if (error) return json({ error: error.message }, 400);
        return json((data ?? []).map(mapTicketMessage));
      }

      case "send_ticket_message": {
        const ticketId = String(payload.ticketId ?? "");
        const senderRole = payload.senderRole === "user" ? "user" : "admin";
        const senderName = String(payload.senderName ?? "aether").slice(0, 80);
        const message = String(payload.message ?? "").trim();
        if (!ticketId || !message) {
          return json({ error: "ticketId and message are required" }, 400);
        }
        if (message.length > 4000) {
          return json({ error: "message is too long" }, 400);
        }
        const { data, error } = await supabase
          .from("ticket_messages")
          .insert({
            ticket_id: ticketId,
            sender_role: senderRole,
            sender_name: senderName,
            sender_avatar: payload.senderAvatar ?? null,
            message,
          })
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json(mapTicketMessage(data));
      }

      case "ticket_status": {
        const id = String(payload.id ?? "");
        const status = payload.status === "closed" ? "closed" : "open";
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await supabase
          .from("support_tickets")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "delete_ticket": {
        const id = String(payload.id ?? "");
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await supabase.from("support_tickets").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "clear_closed_tickets": {
        const { error } = await supabase
          .from("support_tickets")
          .delete()
          .eq("status", "closed");
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
