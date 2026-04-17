import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** ใช้ใน Route Handler แบบ cron (ไม่มี session ผู้ใช้) — ต้องตั้ง SUPABASE_SERVICE_ROLE_KEY */
export function createSupabaseServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
