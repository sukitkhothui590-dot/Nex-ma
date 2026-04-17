import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditSeverity = "debug" | "info" | "notice" | "warning" | "error" | "critical";
export type AuditCategory = "integration" | "alert" | "automation" | "monitor" | "website" | "customer" | "system";

export type AuditLogEntry = {
  severity: AuditSeverity;
  category: AuditCategory;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: string | null;
  meta?: Record<string, unknown> | null;
  /** ถ้าไม่ส่ง จะไม่ใส่ user_id (เช่น งานระบบ) */
  userId?: string | null;
};

function isMissingAuditTableError(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("audit_log") && (m.includes("schema cache") || m.includes("does not exist") || m.includes("undefined_table"));
}

/**
 * บันทึก audit — ไม่ throw (ล้มเหลวแค่ console)
 */
export async function writeAuditLog(supabase: SupabaseClient, entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    user_id: entry.userId ?? null,
    severity: entry.severity,
    category: entry.category,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    detail: entry.detail ? entry.detail.slice(0, 4000) : null,
    meta: entry.meta ?? null,
  });

  if (error) {
    if (isMissingAuditTableError(error)) return;
    console.warn("[writeAuditLog]", error.message);
  }
}
