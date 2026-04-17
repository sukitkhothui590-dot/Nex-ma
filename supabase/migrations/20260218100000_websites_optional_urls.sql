-- อนุญาตให้กรอกเฉพาะ URL หน้าบ้าน หรือเฉพาะหลังบ้าน หรือทั้งคู่ (อย่างน้อยหนึ่งอย่าง)
alter table public.websites alter column frontend_url drop not null;
alter table public.websites alter column backend_url drop not null;

alter table public.websites drop constraint if exists websites_has_some_url;
alter table public.websites add constraint websites_has_some_url check (
  (frontend_url is not null and length(trim(frontend_url)) > 0)
  or (backend_url is not null and length(trim(backend_url)) > 0)
);
