-- วันหมดอายุสัญญา/บริการต่อเว็บ — ใช้กับแดชบอร์ดและแจ้งเตือน (ไม่บังคับกรอก)
alter table public.websites
  add column if not exists contract_expiry_date date;

comment on column public.websites.contract_expiry_date is 'วันหมดอายุสัญญา MA/โฮสต์ตามเว็บ — ว่างได้';
