-- การเชื่อมต่อภายนอก (Discord / LINE Notify / Teams / Webhook)
-- secret = URL webhook หรือ LINE token (RLS: เฉพาะ authenticated)
create table if not exists public.integration_providers (
  id text primary key check (id in ('discord', 'line', 'teams', 'webhook')),
  enabled boolean not null default false,
  secret text,
  last_ping_at timestamptz,
  last_ping_ok boolean,
  last_ping_detail text,
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_ping_log (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references public.integration_providers (id) on delete cascade,
  ok boolean not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists integration_ping_log_created_idx on public.integration_ping_log (created_at desc);

alter table public.integration_providers enable row level security;
alter table public.integration_ping_log enable row level security;

create policy "integration_providers_authenticated_all"
  on public.integration_providers for all to authenticated using (true) with check (true);

create policy "integration_ping_log_authenticated_all"
  on public.integration_ping_log for all to authenticated using (true) with check (true);

insert into public.integration_providers (id, enabled, secret)
values
  ('discord', false, null),
  ('line', false, null),
  ('teams', false, null),
  ('webhook', false, null)
on conflict (id) do nothing;
