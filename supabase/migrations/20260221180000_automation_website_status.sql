-- ช่วงเวลาส่งสถานะเว็บ (นาที) เก็บใน config ของกฎ
alter table public.automation_rules
  add column if not exists config jsonb not null default '{}'::jsonb;

comment on column public.automation_rules.config is 'ตั้งค่ากฎ เช่น intervalMinutes สำหรับส่งสถานะเว็บ';

insert into public.automation_rules (id, name, trigger_summary, action_summary, enabled, config)
values (
  'website_status_digest',
  'ส่งสถานะเว็บเป็นระยะ → Integrations',
  'ทุก N นาที (ตั้งในหน้าออโตเมชัน) หรือเรียก GET /api/cron/website-status พร้อม CRON_SECRET',
  'รายการเว็บทั้งหมด — ออน/ออฟ ลูกค้า URL — ไป Discord / LINE / Teams / Webhook',
  false,
  '{"intervalMinutes": 60}'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  trigger_summary = excluded.trigger_summary,
  action_summary = excluded.action_summary,
  updated_at = now();
