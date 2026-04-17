/** มีค่า URL + anon key จาก Supabase หรือไม่ (ใช้แยกโหมด mock vs Supabase) */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}
