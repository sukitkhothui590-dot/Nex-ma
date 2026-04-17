-- ไม่เก็บแจ้งเตือนตัวอย่าง — ถ้าไม่มีเหตุจริงให้ตารางว่าง (ลบแถวที่เคย seed ไว้)
delete from public.alerts
where message like 'ตัวอย่าง:%';
