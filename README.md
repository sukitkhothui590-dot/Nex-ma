# Web Management & MA Alert System - UX/UI MVP

Next.js + TypeScript + Tailwind CSS แอป Admin — ข้อมูลหน้า UI ยังมาจาก mock; **โครง Supabase พร้อมแล้ว** (client/server + middleware + SQL เริ่มต้น)

## Run Locally

```bash
npm install
cp .env.example .env.local
# แก้ .env.local ใส่ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY จาก Supabase Dashboard > Settings > API
npm run dev
```

เปิดที่ [http://localhost:3000](http://localhost:3000) — จะ redirect ไป `/login?role=admin`

### Supabase

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) แล้วคัดลอก **Project URL** และ **anon public** key ใส่ `.env.local`
2. ใน SQL Editor รันไฟล์ `supabase/migrations/20260216120000_initial_schema.sql` (หรือใช้ CLI `supabase link` + `supabase db push` ถ้าติดตั้ง Supabase CLI แล้ว)
3. โค้ดฝั่งแอป:
   - `src/lib/supabase/client.ts` — `createSupabaseBrowserClient()` สำหรับ Client Component
   - `src/lib/supabase/server.ts` — `createSupabaseServerClient()` สำหรับ Server Component / Server Actions
   - `src/middleware.ts` — refresh session cookie (ถ้ายังไม่ใส่ env จะข้ามเงียบๆ ไม่พัง build)

ขั้นถัดไป: แทนที่ `mockAuth` / `dataService` ด้วย `signInWithPassword` + query จาก `createSupabaseServerClient()` ตามลำดับหน้า

## Demo Routes

- `/` redirect ไป `/login?role=admin`
- `/login` (single login; ใช้ `?role=admin` และ `next=` เมื่อถูก redirect จาก protected route)
- `/admin/login` (legacy route -> redirect)
- `/admin/dashboard`
- `/admin/customers`
- `/admin/websites`
- `/admin/alerts`
- `/admin/monitor` (สถานะเว็บ + เหตุ + ต่ออายุบริการ)
- `/admin/automation`
- `/admin/integrations` (Discord, LINE, Teams, Webhook — mock)

## What Is Mocked

- Authentication: ถ้า **ไม่**ตั้ง `NEXT_PUBLIC_SUPABASE_*` จะใช้ mock ด้วย localStorage (`mock_role`); ถ้าตั้งแล้วใช้ **Supabase Auth** (`signInWithPassword` + session cookie)
- ข้อมูลผู้ใช้/ลูกค้า/เว็บไซต์/บริการ/alerts มาจากไฟล์ fixture
- Search/filter/sort/pagination เป็น frontend behavior เท่านั้น
- ไม่มีการบันทึกข้อมูลจริงและไม่มี external API call

## Project Structure

- `src/app` - app routes และ page-level UI
- `src/components` - reusable UI primitives และ layout components
- `src/lib/mock-data` - mock fixtures
- `src/lib/services` - service layer สำหรับ data/auth mock
- `src/lib/utils` - utility functions
- `src/types` - TypeScript contracts

## Supabase — งานถัดไป

1. แทนที่ `src/lib/services/mock-auth.ts` ด้วย Supabase Auth (`signInWithPassword`, `getUser`, sign out)
2. แทนที่ `src/lib/services/data-service.ts` ด้วย query จาก `createSupabaseServerClient()` (map row → type ใน `src/types/models.ts`)
3. อัปเดต `ProtectedShell` ให้ตรวจ session จาก Supabase แทน `localStorage`
4. (ทางเลือก) สร้าง trigger `auth.users` → `public.profiles` ตอนสมัคร user ใหม่
