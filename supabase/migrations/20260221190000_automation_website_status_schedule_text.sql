-- อัปเดตคำอธิบายกฎสถานะเว็บ: ตารางเวลาหลายช่วงต่อวัน
update public.automation_rules
set
  trigger_summary = 'หลายช่วงเวลาต่อวัน (Asia/Bangkok) — ตั้งในหน้าออโตเมชัน · เรียก GET /api/cron/website-status พร้อม CRON_SECRET',
  updated_at = now()
where id = 'website_status_digest';
