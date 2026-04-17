-- ปรับคำอธิบายกฎสรุปรายวัน: ส่งไป Integrations แทนอีเมล
update public.automation_rules
set
  name = 'สรุปรายวันไป Integrations',
  trigger_summary = 'กด «รันงานอัตโนมัติตอนนี้» หรือตั้ง cron ภายนอกให้รันทุกวัน',
  action_summary = 'ส่งสรุปแดชบอร์ดไป Discord / LINE / Teams / Webhook (หน้า Integrations)',
  updated_at = now()
where id = 'daily_digest';
