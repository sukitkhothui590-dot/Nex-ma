-- รันใน Supabase SQL Editor หรือผ่าน Supabase CLI (`supabase db push`)
-- โดเมนข้อมูลสอดคล้องกับ src/types/models.ts (admin-only app)

-- ลูกค้า
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text not null,
  status text not null check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- เว็บไซต์
create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null,
  logo_url text,
  frontend_url text not null,
  backend_url text not null,
  provider text not null default '',
  hosting_type text not null default '',
  status text not null check (status in ('online', 'offline')),
  contract_status text not null check (contract_status in ('active', 'inactive')),
  api_key_masked text not null default '—',
  created_at timestamptz not null default now()
);

create index if not exists websites_customer_id_idx on public.websites (customer_id);

-- แจ้งเตือน
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  message text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null check (status in ('new', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists alerts_website_id_idx on public.alerts (website_id);
create index if not exists alerts_status_created_idx on public.alerts (status, created_at desc);

-- สัญญา / ต่ออายุบริการ
create table if not exists public.service_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_type text not null check (service_type in ('domain', 'hosting', 'cloud', 'ma')),
  expiry_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists service_subscriptions_customer_id_idx on public.service_subscriptions (customer_id);
create index if not exists service_subscriptions_expiry_idx on public.service_subscriptions (expiry_date);

-- โปรไฟล์ผูก auth.users (ขยายเมื่อเปิดใช้ Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.websites enable row level security;
alter table public.alerts enable row level security;
alter table public.service_subscriptions enable row level security;
alter table public.profiles enable row level security;

-- MVP: ผู้ที่ล็อกอินแล้วเข้าถึงข้อมูลแอปได้ทั้งหมด (ค่อยรัดเป็น role/tenant ทีหลัง)
create policy "customers_authenticated_all"
  on public.customers for all to authenticated using (true) with check (true);

create policy "websites_authenticated_all"
  on public.websites for all to authenticated using (true) with check (true);

create policy "alerts_authenticated_all"
  on public.alerts for all to authenticated using (true) with check (true);

create policy "service_subscriptions_authenticated_all"
  on public.service_subscriptions for all to authenticated using (true) with check (true);

create policy "profiles_select_own"
  on public.profiles for select to authenticated using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
