-- กฎออโตเมชัน (เปิด/ปิด) + ล็อกการรันงาน
create table if not exists public.automation_rules (
  id text primary key,
  name text not null,
  trigger_summary text not null,
  action_summary text not null,
  enabled boolean not null default true,
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_job_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id text,
  kind text not null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists automation_job_runs_created_idx on public.automation_job_runs (created_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_job_runs enable row level security;

create policy "automation_rules_authenticated_all"
  on public.automation_rules for all to authenticated using (true) with check (true);

create policy "automation_job_runs_authenticated_all"
  on public.automation_job_runs for all to authenticated using (true) with check (true);

insert into public.automation_rules (id, name, trigger_summary, action_summary, enabled)
values
  (
    'down_alert',
    'แจ้งเตือนเมื่อเว็บออฟไลน์',
    'มอนิเตอร์พบสถานะเปลี่ยนจากออนไลน์ → ออฟไลน์',
    'สร้างแจ้งเตือนในระบบ (ความรุนแรงสูง)',
    true
  ),
  (
    'ma_expiry_14',
    'เตือน MA / สัญญาใกล้หมด (≤14 วัน)',
    'วันหมดสัญญาในระบบ (contract_expiry_date) เหลือไม่เกิน 14 วัน หรือหมดแล้ว',
    'สร้างแจ้งเตือนในระบบ (ปานกลาง) — ไม่ซ้ำภายใน 7 วันต่อเว็บ',
    true
  ),
  (
    'webhook_high',
    'Webhook เมื่อมีแจ้งเตือน severity สูง',
    'มีแจ้งเตือนใหม่ระดับสูง',
    'POST ไป URL ที่ตั้งในเชื่อมต่อระบบ (เมื่อรองรับ)',
    false
  ),
  (
    'daily_digest',
    'สรุปรายวันไปอีเมลทีม',
    'ทุกวันเวลากำหนด (ต้องตั้ง cron ภายนอก)',
    'อีเมลสรุปแดชบอร์ด',
    false
  )
on conflict (id) do nothing;
