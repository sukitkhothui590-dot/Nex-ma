"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { alerts as mockAlerts } from "@/lib/mock-data/fixtures";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AlertStatus } from "@/types/models";

export type AlertMutationResult = { ok: true } | { ok: false; message: string };

export async function getNewAlertsCountAction(): Promise<number> {
  if (!isSupabaseConfigured()) {
    return mockAlerts.filter((a) => a.status === "new").length;
  }
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) return 0;
  return count ?? 0;
}

export async function updateAlertStatusAction(input: {
  id: string;
  status: Extract<AlertStatus, "acknowledged" | "resolved">;
}): Promise<AlertMutationResult> {
  const id = input.id?.trim();
  if (!id) return { ok: false, message: "ไม่พบรหัสแจ้งเตือน" };

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล — ใช้โหมดจำลองในหน้านี้เท่านั้น" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error: readErr } = await supabase.from("alerts").select("status").eq("id", id).maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!row) return { ok: false, message: "ไม่พบแจ้งเตือน" };

  const cur = row.status as string;
  if (input.status === "acknowledged") {
    if (cur !== "new") {
      return { ok: false, message: "รับทราบได้เฉพาะแจ้งเตือนสถานะ «ใหม่»" };
    }
  }
  if (input.status === "resolved" && cur === "resolved") {
    return { ok: true };
  }

  const { error } = await supabase.from("alerts").update({ status: input.status }).eq("id", id);
  if (error) return { ok: false, message: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await writeAuditLog(supabase, {
    severity: "notice",
    category: "alert",
    action: `alert.status_${input.status}`,
    targetType: "alert",
    targetId: id,
    meta: { previousStatus: cur },
    userId: user?.id ?? null,
  });

  revalidatePath("/admin/alerts");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/monitor");
  revalidatePath("/admin/audit");
  return { ok: true };
}
