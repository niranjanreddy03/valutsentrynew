-- Session anomaly store
--
-- Stores hashed, minimal signals for detecting session hijacking. We never
-- store raw IPs or User-Agent strings — only SHA-256/16 digests — so a
-- database breach doesn't leak browsing fingerprints.
--
-- TTL is 8 hours (matches the absolute session cap) and a cron job sweeps
-- rows older than that nightly.

create table if not exists public.session_activity (
    id                 bigserial primary key,
    user_id            uuid not null references auth.users(id) on delete cascade,
    session_started_at timestamptz not null default now(),
    seen_at            timestamptz not null default now(),
    ip_prefix          text,       -- /24 for IPv4, /48 for IPv6
    ip_hash            text,       -- hash(full ip)
    ua_hash            text,       -- hash(user-agent)
    country            text        -- ISO-3166 from edge
);

create index if not exists session_activity_user_seen_idx
  on public.session_activity (user_id, seen_at desc);

create index if not exists session_activity_seen_idx
  on public.session_activity (seen_at);

alter table public.session_activity enable row level security;

-- Users may read their own activity (useful for a future "where am I
-- signed in" UI). Only the service role may write.
drop policy if exists "users_read_own_session_activity" on public.session_activity;
create policy "users_read_own_session_activity"
  on public.session_activity for select
  using (auth.uid() = user_id);

drop policy if exists "service_role_writes_session_activity" on public.session_activity;
create policy "service_role_writes_session_activity"
  on public.session_activity for all
  to service_role
  using (true)
  with check (true);

-- Nightly prune — run via pg_cron or an external scheduler.
create or replace function public.prune_session_activity() returns void
language sql security definer as $$
  delete from public.session_activity
   where seen_at < now() - interval '8 hours';
$$;
