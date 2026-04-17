import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { deliverIntegration } from "./delivery";

function truncateDetail(s: string, max = 500): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export type NotifyIntegrationsParams = {
  severity: "low" | "medium" | "high";
  message: string;
  /** ผู้ใช้ที่ทำให้เกิด alert (มอนิเตอร์ / ออโตเมชัน) */
  actorUserId?: string | null;
};

/**
 * ส่งแจ้งเตือนไปทุกช่องทางที่เปิดใช้ + มี secret (หลังสร้าง alert ในระบบแล้ว)
 * ไม่ throw — ล้มเหลวแค่ log
 */
export async function notifyIntegrationsForAlert(supabase: SupabaseClient, params: NotifyIntegrationsParams): Promise<void> {
  if (params.severity === "low") return;

  const { data: rows, error } = await supabase
    .from("integration_providers")
    .select("id, secret, enabled")
    .eq("enabled", true);

  if (error) {
    console.warn("[notifyIntegrationsForAlert]", error.message);
    return;
  }

  const targets = (rows ?? []).filter((r) => {
    const sec = (r.secret as string | null)?.trim() ?? "";
    return sec.length > 0;
  });

  if (targets.length === 0) {
    await writeAuditLog(supabase, {
      severity: "debug",
      category: "integration",
      action: "notify.alert_broadcast_skipped",
      detail: "ไม่มีช่องทางที่เปิดใช้และมี URL/token",
      meta: { alertSeverity: params.severity },
      userId: params.actorUserId ?? null,
    });
    return;
  }

  const mode = { kind: "alert" as const, severity: params.severity, message: params.message };

  const deliveryResults = await Promise.all(
    targets.map(async (row) => {
      const id = String(row.id);
      const secret = String((row.secret as string).trim());
      const result = await deliverIntegration(id, secret, mode);
      const now = new Date().toISOString();

      const { error: upErr } = await supabase
        .from("integration_providers")
        .update({
          last_ping_at: now,
          last_ping_ok: result.ok,
          last_ping_detail: result.detail.slice(0, 500),
          updated_at: now,
        })
        .eq("id", id);

      if (upErr) console.warn("[notifyIntegrationsForAlert] update provider", id, upErr.message);

      const { error: logErr } = await supabase.from("integration_ping_log").insert({
        provider_id: id,
        ok: result.ok,
        detail: truncateDetail(`แจ้งเตือน [${params.severity}]: ${params.message}`),
      });

      if (logErr) console.warn("[notifyIntegrationsForAlert] ping_log", id, logErr.message);

      return {
        providerId: id,
        ok: result.ok,
        detail: result.detail.slice(0, 300),
      };
    }),
  );

  const okCount = deliveryResults.filter((r) => r.ok).length;
  const anyFail = deliveryResults.some((r) => !r.ok);

  await writeAuditLog(supabase, {
    severity: anyFail ? "warning" : "notice",
    category: "integration",
    action: "notify.alert_broadcast",
    detail: `ส่งแจ้งเตือนภายนอก ${okCount}/${deliveryResults.length} ช่องทาง · alert ${params.severity}`,
    meta: {
      alertSeverity: params.severity,
      messagePreview: params.message.slice(0, 400),
      results: deliveryResults,
    },
    userId: params.actorUserId ?? null,
  });
}
