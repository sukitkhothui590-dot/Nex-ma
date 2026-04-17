"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { runIntegrationPing } from "@/lib/integrations/run-ping";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type IntegrationActionResult = { ok: true; message: string } | { ok: false; message: string };

const IDS = new Set(["discord", "line", "teams", "webhook"]);

export async function updateIntegrationEnabledAction(input: { id: string; enabled: boolean }): Promise<IntegrationActionResult> {
  const id = input.id?.trim();
  if (!id || !IDS.has(id)) return { ok: false, message: "ไม่รู้จักการเชื่อมต่อ" };
  if (!isSupabaseConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("integration_providers")
    .update({ enabled: input.enabled, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  await writeAuditLog(supabase, {
    severity: "notice",
    category: "integration",
    action: input.enabled ? "integration.enable" : "integration.disable",
    targetType: "integration_provider",
    targetId: id,
    userId: user?.id ?? null,
  });
  revalidatePath("/admin/integrations");
  revalidatePath("/admin/audit");
  return { ok: true, message: "บันทึกแล้ว" };
}

export async function saveIntegrationSecretAction(input: { id: string; secret: string }): Promise<IntegrationActionResult> {
  const id = input.id?.trim();
  if (!id || !IDS.has(id)) return { ok: false, message: "ไม่รู้จักการเชื่อมต่อ" };
  if (!isSupabaseConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };

  const secret = input.secret?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("integration_providers")
    .update({
      secret: secret.length > 0 ? secret : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  await writeAuditLog(supabase, {
    severity: "warning",
    category: "integration",
    action: secret.length > 0 ? "integration.secret_set" : "integration.secret_cleared",
    targetType: "integration_provider",
    targetId: id,
    userId: user?.id ?? null,
  });
  revalidatePath("/admin/integrations");
  revalidatePath("/admin/audit");
  return { ok: true, message: secret.length > 0 ? "บันทึก URL/token แล้ว" : "ล้างการตั้งค่าแล้ว" };
}

export async function testIntegrationPingAction(input: { id: string }): Promise<IntegrationActionResult> {
  const id = input.id?.trim();
  if (!id || !IDS.has(id)) return { ok: false, message: "ไม่รู้จักการเชื่อมต่อ" };
  if (!isSupabaseConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ต้องล็อกอิน" };

  const { data: row, error: readErr } = await supabase.from("integration_providers").select("secret").eq("id", id).maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  const secret = (row?.secret as string | null)?.trim() ?? "";
  if (!secret) return { ok: false, message: "ยังไม่ได้บันทึก URL หรือ token — เปิดตั้งค่าก่อน" };

  const result = await runIntegrationPing(id, secret);
  const now = new Date().toISOString();

  await supabase.from("integration_providers").update({
    last_ping_at: now,
    last_ping_ok: result.ok,
    last_ping_detail: result.detail.slice(0, 500),
    updated_at: now,
  }).eq("id", id);

  await supabase.from("integration_ping_log").insert({
    provider_id: id,
    ok: result.ok,
    detail: result.detail.slice(0, 500),
  });

  await writeAuditLog(supabase, {
    severity: "info",
    category: "integration",
    action: "integration.ping_test",
    targetType: "integration_provider",
    targetId: id,
    detail: result.detail.slice(0, 500),
    meta: { ok: result.ok },
    userId: user.id,
  });

  revalidatePath("/admin/integrations");
  revalidatePath("/admin/audit");
  return result.ok ? { ok: true, message: result.detail } : { ok: false, message: result.detail };
}
