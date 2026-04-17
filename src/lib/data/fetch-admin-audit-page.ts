import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuditLogRowDTO = {
  id: string;
  severity: string;
  category: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  userId: string | null;
};

export type AdminAuditPageData = {
  rows: AuditLogRowDTO[];
  fromDatabase: boolean;
  missingTable: boolean;
};

function isMissingAuditTableError(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("audit_log") && (m.includes("schema cache") || m.includes("does not exist") || m.includes("undefined_table"));
}

export async function fetchAdminAuditPageData(): Promise<AdminAuditPageData> {
  if (!isSupabaseConfigured()) {
    return { rows: [], fromDatabase: false, missingTable: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, severity, category, action, target_type, target_id, detail, meta, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    if (isMissingAuditTableError(error)) {
      return { rows: [], fromDatabase: true, missingTable: true };
    }
    throw new Error(error.message);
  }

  const rows: AuditLogRowDTO[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    severity: String(r.severity),
    category: String(r.category),
    action: String(r.action),
    targetType: r.target_type != null ? String(r.target_type) : null,
    targetId: r.target_id != null ? String(r.target_id) : null,
    detail: r.detail != null ? String(r.detail) : null,
    meta: r.meta && typeof r.meta === "object" ? (r.meta as Record<string, unknown>) : null,
    createdAt: String(r.created_at),
    userId: r.user_id != null ? String(r.user_id) : null,
  }));

  return { rows, fromDatabase: true, missingTable: false };
}
