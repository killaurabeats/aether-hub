-- ============================================================================
--  Aether Hub — Supabase schema
--  Run this once in Supabase → SQL Editor → New query → Run.
--  Safe to re-run: everything is idempotent.
-- ============================================================================

create extension if not exists pgcrypto;
-- Used by the auto-approve trigger to call the aether-admin Edge Function.
create extension if not exists pg_net;

-- ---------------------------------------------------------------- tables ----
create table if not exists public.releases (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  category      text not null check (category in ('plugins', 'drumkits', 'presets')),
  title         text not null,
  version       text not null default '1.0',
  description   text not null default '',
  description_ru text,
  description_en text,
  cover_url     text,
  files         jsonb not null default '{}'::jsonb,
  rating_avg    numeric(3, 2) not null default 5.00,
  rating_count  integer not null default 0,
  product_tag   text,
  plugin_category text check (plugin_category is null or plugin_category in ('vocal', 'saturation', 'compressors', 'space', 'mastering')),
  tier          text not null default 'free' check (tier in ('free', 'pro', 'beta')),
  featured      boolean not null default false,
  badge         text,
  previews      jsonb not null default '[]'::jsonb,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.releases add column if not exists description_ru text;
alter table public.releases add column if not exists description_en text;
alter table public.releases add column if not exists tier text not null default 'free';
alter table public.releases drop constraint if exists releases_tier_check;
alter table public.releases add constraint releases_tier_check check (tier in ('free', 'pro', 'beta'));
update public.releases set tier = 'free' where tier is null;

alter table public.releases add column if not exists plugin_category text;
alter table public.releases drop constraint if exists releases_plugin_category_check;
alter table public.releases add constraint releases_plugin_category_check
  check (plugin_category is null or plugin_category in ('vocal', 'saturation', 'compressors', 'space', 'mastering'));

-- --------------------------------------------------- community samples ----
create table if not exists public.community_samples (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author_hwid     text not null,
  author_name     text not null default 'aether user',
  category        text not null check (category in ('loop', 'oneshot', 'fx', 'vocal', 'drums', 'bass', 'melody')),
  bpm             integer check (bpm is null or (bpm between 20 and 400)),
  musical_key     text,
  file_url        text not null,
  waveform_peaks  jsonb not null default '[]'::jsonb,
  downloads_count integer not null default 0,
  likes_count     integer not null default 0,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  is_featured     boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.community_samples drop constraint if exists community_samples_category_check;
alter table public.community_samples add constraint community_samples_category_check
  check (category in ('loop', 'oneshot', 'fx', 'vocal', 'drums', 'bass', 'melody'));

alter table public.community_samples add column if not exists waveform_peaks jsonb not null default '[]'::jsonb;
alter table public.community_samples add column if not exists downloads_count integer not null default 0;
alter table public.community_samples add column if not exists likes_count integer not null default 0;
alter table public.community_samples add column if not exists is_featured boolean not null default false;

create index if not exists community_samples_status_idx
  on public.community_samples (status, created_at desc);
create index if not exists community_samples_featured_idx
  on public.community_samples (is_featured, created_at desc);
create index if not exists community_samples_author_idx
  on public.community_samples (author_hwid, created_at desc);
create index if not exists community_samples_filter_idx
  on public.community_samples (status, category, bpm, created_at desc);

create table if not exists public.profiles (
  id          text primary key,
  nickname    text not null default 'aether user',
  avatar_url  text,
  machine_id  text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  release_id  uuid not null references public.releases(id) on delete cascade,
  nickname    text not null,
  avatar_url  text,
  body        text not null,
  machine_id  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  release_id  uuid not null references public.releases(id) on delete cascade,
  machine_id  text not null,
  value       integer not null check (value between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (release_id, machine_id)
);

create table if not exists public.license_requests (
  id            uuid primary key default gen_random_uuid(),
  machine_id    text not null,
  nickname      text not null default 'aether user',
  avatar_url    text,
  plugin_slug   text not null,
  plugin_title  text not null,
  product_tag   text not null default 'AETHER-VOCAL-STRIP',
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  key           text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create table if not exists public.licenses (
  id            uuid primary key default gen_random_uuid(),
  machine_id    text not null,
  product_tag   text not null,
  plugin_title  text,
  key           text not null,
  nickname      text,
  issued_at     timestamptz not null default now(),
  unique (machine_id, product_tag)
);

create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  machine_id  text not null,
  nickname    text not null default 'aether user',
  avatar_url  text,
  os          text not null default 'macOS',
  message     text not null,
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.support_tickets add column if not exists avatar_url text;

create table if not exists public.ticket_messages (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.support_tickets(id) on delete cascade,
  sender_role   text not null check (sender_role in ('user', 'admin')),
  sender_name   text not null,
  sender_avatar text,
  message       text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.beta_invites (
  code          text primary key,
  note          text,
  used_by_hwid  text,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists beta_invites_used_idx on public.beta_invites (used_by_hwid);

create table if not exists public.app_config (
  id                    boolean primary key default true check (id),
  auto_approve_licenses boolean not null default false,
  auto_approve_slugs    jsonb not null default '[]'::jsonb,
  latest_launcher_version text,
  update_notice         text,
  update_url            text,
  updated_at            timestamptz not null default now()
);

alter table public.app_config add column if not exists auto_approve_slugs jsonb not null default '[]'::jsonb;
alter table public.app_config drop constraint if exists app_config_auto_slugs_array;
alter table public.app_config add constraint app_config_auto_slugs_array
  check (jsonb_typeof(auto_approve_slugs) = 'array');
alter table public.app_config add column if not exists latest_launcher_version text;
alter table public.app_config add column if not exists update_notice text;
alter table public.app_config add column if not exists update_url text;

insert into public.app_config (id, auto_approve_licenses)
values (true, false)
on conflict (id) do nothing;

create index if not exists comments_release_idx on public.comments (release_id, created_at desc);
create index if not exists ratings_release_idx on public.ratings (release_id);
create index if not exists license_requests_machine_idx on public.license_requests (machine_id);
create index if not exists license_requests_status_idx on public.license_requests (status, created_at desc);
create index if not exists licenses_machine_idx on public.licenses (machine_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- --------------------------------------------------------------- helpers ----
create or replace function public.aether_norm_machine(p text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p, ''), '[^0-9A-Fa-f]', '', 'g'));
$$;

create or replace function public.aether_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_touch on public.support_tickets;
create trigger support_tickets_touch
  before update on public.support_tickets
  for each row execute function public.aether_touch_updated_at();

drop trigger if exists releases_touch on public.releases;
create trigger releases_touch
  before update on public.releases
  for each row execute function public.aether_touch_updated_at();

-- ------------------------------------------------------------- public RPC ---
-- Ratings: one vote per machine per release, aggregate recomputed atomically.
create or replace function public.aether_rate_release(
  p_release_id uuid,
  p_machine_id text,
  p_value integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_machine text := public.aether_norm_machine(p_machine_id);
  v_avg numeric(3, 2);
  v_count integer;
begin
  if length(v_machine) <> 32 then
    raise exception 'invalid machine id';
  end if;
  if p_value < 1 or p_value > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  insert into public.ratings (release_id, machine_id, value)
  values (p_release_id, v_machine, p_value)
  on conflict (release_id, machine_id)
  do update set value = excluded.value, created_at = now();

  select round(avg(value)::numeric, 2), count(*)
    into v_avg, v_count
    from public.ratings
   where release_id = p_release_id;

  update public.releases
     set rating_avg = coalesce(v_avg, 5.00),
         rating_count = v_count
   where id = p_release_id;

  return jsonb_build_object('avg', coalesce(v_avg, 5.00), 'count', v_count, 'mine', p_value);
end;
$$;

create or replace function public.aether_my_rating(p_release_id uuid, p_machine_id text)
returns integer
language sql
security definer
set search_path = public
as $$
  select value from public.ratings
   where release_id = p_release_id
     and machine_id = public.aether_norm_machine(p_machine_id)
   limit 1;
$$;

create or replace function public.aether_upsert_profile(
  p_id text,
  p_nickname text,
  p_avatar_url text,
  p_machine_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, avatar_url, machine_id, updated_at)
  values (
    left(coalesce(p_id, 'user_unknown'), 80),
    left(coalesce(nullif(trim(p_nickname), ''), 'aether user'), 40),
    left(p_avatar_url, 400000),
    public.aether_norm_machine(p_machine_id),
    now()
  )
  on conflict (id) do update
    set nickname = excluded.nickname,
        avatar_url = excluded.avatar_url,
        machine_id = excluded.machine_id,
        updated_at = now();
end;
$$;

create or replace function public.aether_my_profile(p_machine_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(p)
    from public.profiles p
   where p.machine_id = public.aether_norm_machine(p_machine_id)
   order by p.updated_at desc
   limit 1;
$$;

revoke all on function public.aether_my_profile(text) from public;
grant execute on function public.aether_my_profile(text) to anon, authenticated;

create or replace function public.aether_request_license(
  p_machine_id text,
  p_nickname text,
  p_avatar_url text,
  p_plugin_slug text,
  p_plugin_title text,
  p_product_tag text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_machine text := public.aether_norm_machine(p_machine_id);
  v_row public.license_requests;
begin
  if length(v_machine) <> 32 then
    raise exception 'invalid machine id';
  end if;

  select * into v_row
    from public.license_requests
   where machine_id = v_machine
     and product_tag = upper(coalesce(p_product_tag, 'AETHER-VOCAL-STRIP'))
     and status = 'pending'
   order by created_at desc
   limit 1;

  if found then
    return to_jsonb(v_row);
  end if;

  insert into public.license_requests (
    machine_id, nickname, avatar_url, plugin_slug, plugin_title, product_tag
  ) values (
    v_machine,
    left(coalesce(nullif(trim(p_nickname), ''), 'aether user'), 40),
    left(p_avatar_url, 400000),
    left(p_plugin_slug, 80),
    left(p_plugin_title, 120),
    upper(left(coalesce(p_product_tag, 'AETHER-VOCAL-STRIP'), 64))
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.aether_my_requests(p_machine_id text)
returns setof public.license_requests
language sql
security definer
set search_path = public
as $$
  select * from public.license_requests
   where machine_id = public.aether_norm_machine(p_machine_id)
   order by created_at desc
   limit 50;
$$;

create or replace function public.aether_my_licenses(p_machine_id text)
returns setof public.licenses
language sql
security definer
set search_path = public
as $$
  select * from public.licenses
   where machine_id = public.aether_norm_machine(p_machine_id)
   order by issued_at desc
   limit 50;
$$;

revoke all on function public.aether_rate_release(uuid, text, integer) from public;
revoke all on function public.aether_my_rating(uuid, text) from public;
revoke all on function public.aether_upsert_profile(text, text, text, text) from public;
revoke all on function public.aether_request_license(text, text, text, text, text, text) from public;
create or replace function public.aether_beta_status(p_machine_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.beta_invites
     where used_by_hwid = public.aether_norm_machine(p_machine_id)
  );
$$;

create or replace function public.aether_redeem_beta_invite(
  p_code text,
  p_machine_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_machine text := public.aether_norm_machine(p_machine_id);
  v_row public.beta_invites;
begin
  if v_code = '' or v_machine = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into v_row from public.beta_invites where code = v_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_row.used_by_hwid is not null then
    return jsonb_build_object(
      'ok', v_row.used_by_hwid = v_machine,
      'error', case when v_row.used_by_hwid = v_machine then null else 'already_used' end
    );
  end if;

  update public.beta_invites
     set used_by_hwid = v_machine, used_at = now()
   where code = v_code and used_by_hwid is null
   returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------- community samples ---
create or replace function public.aether_submit_sample(
  p_title text,
  p_author_hwid text,
  p_author_name text,
  p_category text,
  p_bpm integer,
  p_musical_key text,
  p_file_url text,
  p_waveform_peaks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_machine text := public.aether_norm_machine(p_author_hwid);
  v_category text := lower(trim(coalesce(p_category, '')));
  v_title text := left(trim(coalesce(p_title, '')), 80);
  v_url text := trim(coalesce(p_file_url, ''));
  v_pending integer;
  v_row public.community_samples;
begin
  if length(v_machine) <> 32 then
    raise exception 'invalid machine id';
  end if;
  if v_title = '' then
    raise exception 'title is required';
  end if;
  if v_category not in ('loop', 'oneshot', 'fx', 'vocal', 'drums', 'bass', 'melody') then
    raise exception 'invalid category';
  end if;
  if v_url = '' or (v_url not like 'http://%' and v_url not like 'https://%' and v_url not like 'local:%') then
    raise exception 'invalid file url';
  end if;

  select count(*) into v_pending
    from public.community_samples
   where author_hwid = v_machine and status = 'pending';
  if v_pending >= 12 then
    raise exception 'too many pending samples';
  end if;

  insert into public.community_samples (
    title, author_hwid, author_name, category, bpm, musical_key,
    file_url, waveform_peaks, status
  ) values (
    v_title,
    v_machine,
    left(coalesce(nullif(trim(p_author_name), ''), 'aether user'), 40),
    v_category,
    case when p_bpm is null then null else greatest(20, least(400, p_bpm)) end,
    nullif(left(trim(coalesce(p_musical_key, '')), 16), ''),
    v_url,
    case when jsonb_typeof(coalesce(p_waveform_peaks, '[]'::jsonb)) = 'array'
         then coalesce(p_waveform_peaks, '[]'::jsonb) else '[]'::jsonb end,
    'pending'
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.aether_my_samples(p_machine_id text)
returns setof public.community_samples
language sql
security definer
set search_path = public
as $$
  select * from public.community_samples
   where author_hwid = public.aether_norm_machine(p_machine_id)
   order by created_at desc
   limit 60;
$$;

create or replace function public.aether_sample_downloaded(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.community_samples
     set downloads_count = downloads_count + 1
   where id = p_id and status = 'approved'
   returning downloads_count into v_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.aether_like_sample(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.community_samples
     set likes_count = likes_count + 1
   where id = p_id and status = 'approved'
   returning likes_count into v_count;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.aether_my_requests(text) from public;
revoke all on function public.aether_my_licenses(text) from public;
revoke all on function public.aether_submit_sample(text, text, text, text, integer, text, text, jsonb) from public;
revoke all on function public.aether_my_samples(text) from public;
revoke all on function public.aether_sample_downloaded(uuid) from public;
revoke all on function public.aether_like_sample(uuid) from public;
revoke all on function public.aether_beta_status(text) from public;
revoke all on function public.aether_redeem_beta_invite(text, text) from public;
create or replace function public.aether_launcher_notice()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'latestVersion', latest_launcher_version,
    'notice', update_notice,
    'url', update_url
  )
  from public.app_config
  where id = true;
$$;
revoke all on function public.aether_launcher_notice() from public;
grant execute on function public.aether_launcher_notice() to anon, authenticated;

grant execute on function public.aether_rate_release(uuid, text, integer) to anon, authenticated;
grant execute on function public.aether_my_rating(uuid, text) to anon, authenticated;
grant execute on function public.aether_upsert_profile(text, text, text, text) to anon, authenticated;
grant execute on function public.aether_request_license(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.aether_my_requests(text) to anon, authenticated;
grant execute on function public.aether_my_licenses(text) to anon, authenticated;
grant execute on function public.aether_beta_status(text) to anon, authenticated;
grant execute on function public.aether_redeem_beta_invite(text, text) to anon, authenticated;
grant execute on function public.aether_submit_sample(text, text, text, text, integer, text, text, jsonb) to anon, authenticated;
grant execute on function public.aether_my_samples(text) to anon, authenticated;
grant execute on function public.aether_sample_downloaded(uuid) to anon, authenticated;
grant execute on function public.aether_like_sample(uuid) to anon, authenticated;

-- ------------------------------------------------------- auto-approve hook ----
-- A new license request pings the Edge Function when the admin toggle is on.
-- The admin token lives in Supabase Vault (secret name: aether_admin_token),
-- the function URL optionally in aether_functions_url. The insert never fails
-- if the hook itself is unavailable: the request simply stays pending.
create or replace function public.aether_notify_auto_approve()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  enabled boolean;
  auto_slugs jsonb;
  admin_token text;
  functions_url text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select auto_approve_licenses, auto_approve_slugs
    into enabled, auto_slugs
    from public.app_config
   where id = true;

  -- The global switch approves every request; otherwise only slugs listed in
  -- auto_approve_slugs are signed automatically.
  if not coalesce(enabled, false)
     and not coalesce(auto_slugs ? new.plugin_slug, false) then
    return new;
  end if;

  select decrypted_secret into admin_token
    from vault.decrypted_secrets
   where name = 'aether_admin_token'
   limit 1;

  select decrypted_secret into functions_url
    from vault.decrypted_secrets
   where name = 'aether_functions_url'
   limit 1;

  if admin_token is null then
    raise warning 'aether auto-approve: vault secret aether_admin_token is missing';
    return new;
  end if;

  perform net.http_post(
    url := coalesce(
      functions_url,
      'https://tniqfffgpisajjprjgmi.supabase.co/functions/v1/aether-admin'
    ),
    body := jsonb_build_object(
      'token', admin_token,
      'action', 'auto_approve_request',
      'payload', jsonb_build_object('id', new.id)
    ),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  raise warning 'aether auto-approve trigger failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.aether_notify_auto_approve() from public;

drop trigger if exists aether_auto_approve_on_request on public.license_requests;
create trigger aether_auto_approve_on_request
after insert on public.license_requests
for each row
execute function public.aether_notify_auto_approve();

-- ------------------------------------------------------------------- RLS ----
alter table public.releases enable row level security;
alter table public.profiles enable row level security;
alter table public.comments enable row level security;
alter table public.ratings enable row level security;
alter table public.license_requests enable row level security;
alter table public.licenses enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.app_config enable row level security;
alter table public.beta_invites enable row level security;
alter table public.community_samples enable row level security;

drop policy if exists releases_public_read on public.releases;
create policy releases_public_read on public.releases
  for select to anon, authenticated
  using (published = true);

drop policy if exists comments_public_read on public.comments;
create policy comments_public_read on public.comments
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.releases r
       where r.id = comments.release_id and r.published = true
    )
  );

drop policy if exists comments_public_insert on public.comments;
create policy comments_public_insert on public.comments
  for insert to anon, authenticated
  with check (
    char_length(body) between 1 and 1200
    and char_length(nickname) between 1 and 40
    and (avatar_url is null or char_length(avatar_url) < 400000)
  );

drop policy if exists community_samples_public_read on public.community_samples;
create policy community_samples_public_read on public.community_samples
  for select to anon, authenticated
  using (status = 'approved');

-- Sensitive tables are reachable only through the SECURITY DEFINER RPCs above
-- or the service role used by the Edge Function.
revoke all on public.profiles from anon, authenticated;
revoke all on public.ratings from anon, authenticated;
revoke all on public.license_requests from anon, authenticated;
revoke all on public.licenses from anon, authenticated;
revoke all on public.support_tickets from anon, authenticated;
revoke all on public.ticket_messages from anon, authenticated;
revoke all on public.comments from anon, authenticated;
revoke all on public.releases from anon, authenticated;
revoke all on public.app_config from anon, authenticated;
revoke all on public.beta_invites from anon, authenticated;
revoke all on public.community_samples from anon, authenticated;

grant select on public.releases to anon, authenticated;
grant select on public.community_samples to anon, authenticated;
grant select, insert on public.comments to anon, authenticated;

-- The Edge Function talks to PostgREST with the service role. Keep its grants
-- explicit so the admin API keeps working even if the project's default
-- privileges were changed by an older schema revision.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- -------------------------------------------------------------- storage -----
insert into storage.buckets (id, name, public)
values ('aether-assets', 'aether-assets', true)
on conflict (id) do update set public = true;

drop policy if exists aether_assets_public_read on storage.objects;
create policy aether_assets_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'aether-assets');

-- No anon insert/update/delete policies: uploads only via the admin Edge
-- Function (service role) and signed upload URLs.

-- Community samples: public read, gated community uploads (wav/mp3 only).
insert into storage.buckets (id, name, public)
values ('aether-samples', 'aether-samples', true)
on conflict (id) do update set public = true;

drop policy if exists aether_samples_public_read on storage.objects;
create policy aether_samples_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'aether-samples');

drop policy if exists aether_samples_public_insert on storage.objects;
create policy aether_samples_public_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'aether-samples'
    and name like 'samples/%'
    and lower(name) ~ '\.(wav|mp3)$'
  );

-- ------------------------------------------------------------ realtime ------
-- Optional: live comments / requests in the app.
do $$
begin
  begin
    alter publication supabase_realtime add table public.comments;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.releases;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.support_tickets;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.ticket_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.community_samples;
  exception when duplicate_object then null;
  end;
end;
$$;
