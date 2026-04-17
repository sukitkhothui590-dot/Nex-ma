-- Audit log หลายระดับ (severity) — ติดตามการกระทำในระบบ
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  severity text not null
    check (severity in ('debug', 'info', 'notice', 'warning', 'error', 'critical')),
  category text not null
    check (category in ('integration', 'alert', 'automation', 'monitor', 'website', 'customer', 'system')),
  action text not null,
  target_type text,
  target_id text,
  detail text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_severity_idx on public.audit_log (severity);
create index if not exists audit_log_category_idx on public.audit_log (category);

alter table public.audit_log enable row level security;

create policy "audit_log_authenticated_all"
  on public.audit_log for all to authenticated using (true) with check (true);
