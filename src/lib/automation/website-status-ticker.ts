import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { runWebsiteStatusDigestIfDue } from "./run-website-status-digest";

/**
 * In-process scheduler สำหรับ Node runtime — ทำงานเมื่อมี SUPABASE_SERVICE_ROLE_KEY เท่านั้น
 * ใช้แทน external cron ในโหมด dev / self-hosted (เครื่องตัวเอง, docker, VPS)
 * หมายเหตุ: บน serverless (Vercel Functions) process ไม่ค้าง → ticker ไม่ทำงาน ใช้ Vercel Cron แทน
 */
const TICK_MS = 60_000;

type GlobalWithTicker = typeof globalThis & {
  __websiteStatusTickerStarted?: boolean;
  __websiteStatusTickerId?: ReturnType<typeof setInterval>;
};
const g = globalThis as GlobalWithTicker;

export function startWebsiteStatusTicker(): void {
  if (g.__websiteStatusTickerStarted) return;
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.warn(
      "[website-status-ticker] ข้ามการเริ่ม — ไม่มี SUPABASE_SERVICE_ROLE_KEY (ยังใช้ client pinger ในหน้า admin ได้)",
    );
    return;
  }

  g.__websiteStatusTickerStarted = true;

  const tick = async () => {
    try {
      const r = await runWebsiteStatusDigestIfDue(supabase);
      if (!r.skipped) {
        console.log(`[website-status-ticker] ${r.detail}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[website-status-ticker] error: ${msg}`);
    }
  };

  g.__websiteStatusTickerId = setInterval(tick, TICK_MS);
  void tick();
  console.log(`[website-status-ticker] เริ่มแล้ว — ตรวจทุก ${TICK_MS / 1000} วินาที`);
}
