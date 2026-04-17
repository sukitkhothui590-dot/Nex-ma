import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { notifyIntegrationsForAlert } from "@/lib/integrations/notify-on-alert";
import { mapWebsiteRow, type WebsiteRow } from "@/lib/supabase/mappers";
import { getDaysUntil } from "@/lib/utils/date";

/**
 * สแกนเว็บที่มี contract_expiry_date เหลือ ≤14 วัน หรือหมดแล้ว — สร้างแจ้งเตือนไม่เกิน 1 ครั้ง / 7 วัน / เว็บ
 */
export async function runMaExpiryScan(
  supabase: SupabaseClient,
  options?: { actorUserId?: string | null },
): Promise<{
  created: number;
  skipped: number;
  errorMessages: string[];
}> {
  const actorUserId = options?.actorUserId ?? null;
  const { data: raw, error } = await supabase.from("websites").select("*");
  if (error) throw new Error(error.message);

  let created = 0;
  let skipped = 0;
  const errorMessages: string[] = [];
  const websites = (raw ?? []).map((r) => mapWebsiteRow(r as WebsiteRow));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const w of websites) {
    const d = w.contractExpiryDate?.trim().slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      skipped += 1;
      continue;
    }
    const days = getDaysUntil(d);
    if (days > 14) {
      skipped += 1;
      continue;
    }

    const { data: dup, error: dupErr } = await supabase
      .from("alerts")
      .select("id")
      .eq("website_id", w.id)
      .in("status", ["new", "acknowledged"])
      .ilike("message", "ออโตเมชัน: สัญญา/MA%")
      .gte("created_at", weekAgo)
      .limit(1);

    if (dupErr) {
      errorMessages.push(`${w.name}: ${dupErr.message}`);
      continue;
    }
    if (dup && dup.length > 0) {
      skipped += 1;
      continue;
    }

    const label = days < 0 ? `เกินกำหนด ${-days} วัน` : `เหลือ ${days} วัน`;
    const severity = days < 0 ? "high" : "medium";
    const alertMessage = `ออโตเมชัน: สัญญา/MA ใกล้หมดหรือหมดแล้ว — ${w.name} · หมดอายุ ${d} · ${label}`;
    const { error: insErr } = await supabase.from("alerts").insert({
      website_id: w.id,
      message: alertMessage,
      severity,
      status: "new",
    });
    if (insErr) {
      errorMessages.push(`${w.name}: ${insErr.message}`);
    } else {
      created += 1;
      await writeAuditLog(supabase, {
        severity: severity === "high" ? "warning" : "notice",
        category: "alert",
        action: "alert.created",
        targetType: "website",
        targetId: w.id,
        detail: alertMessage.slice(0, 2000),
        meta: { source: "automation.ma_expiry", severity },
        userId: actorUserId,
      });
      await notifyIntegrationsForAlert(supabase, { severity, message: alertMessage, actorUserId });
    }
  }

  return { created, skipped, errorMessages };
}
