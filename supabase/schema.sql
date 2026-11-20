-- ============================================================================
--  Aether Hub — Supabase schema
--  Run this once in Supabase → SQL Editor → New query → Run.
--  Safe to re-run: everything is idempotent.
-- ============================================================================

create extension if not exists pgcrypto;

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
  featured      boolean not null default false,
  badge         text,
  previews      jsonb not null default '[]'::jsonb,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.releases add column if not exists description_ru text;
alter table public.releases add column if not exists description_en text;

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
revoke all on function public.aether_my_requests(text) from public;
revoke all on function public.aether_my_licenses(text) from public;

grant execute on function public.aether_rate_release(uuid, text, integer) to anon, authenticated;
grant execute on function public.aether_my_rating(uuid, text) to anon, authenticated;
grant execute on function public.aether_upsert_profile(text, text, text, text) to anon, authenticated;
grant execute on function public.aether_request_license(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.aether_my_requests(text) to anon, authenticated;
grant execute on function public.aether_my_licenses(text) to anon, authenticated;

-- ------------------------------------------------------------------- RLS ----
alter table public.releases enable row level security;
alter table public.profiles enable row level security;
alter table public.comments enable row level security;
alter table public.ratings enable row level security;
alter table public.license_requests enable row level security;
alter table public.licenses enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

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

grant select on public.releases to anon, authenticated;
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
end;
$$;
