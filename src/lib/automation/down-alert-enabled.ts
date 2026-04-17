import type { SupabaseClient } from "@supabase/supabase-js";

/** ถ้าไม่มีแถวหรือเปิดอยู่ → สร้างแจ้งเตือนตอนเว็บหลุดออนไลน์ (มอนิเตอร์) */
export async function isDownAlertRuleEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.from("automation_rules").select("enabled").eq("id", "down_alert").maybeSingle();
  if (error) {
    console.warn("[automation] down_alert rule read:", error.message);
    return true;
  }
  return data?.enabled !== false;
}
