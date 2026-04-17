-- เปิด Supabase Realtime สำหรับสถานะเว็บและแจ้งเตือน (ให้ AdminRealtimeBridge ได้รับการเปลี่ยนแปลงทันที)
-- ถ้า error ว่า relation is already member of publication — ข้ามได้ (เปิดไว้แล้ว)
alter publication supabase_realtime add table public.websites;
alter publication supabase_realtime add table public.alerts;
