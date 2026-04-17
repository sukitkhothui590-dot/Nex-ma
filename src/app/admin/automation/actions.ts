"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { runDailyDigestToIntegrations } from "@/lib/automation/run-daily-digest";
import { runMaExpiryScan } from "@/lib/automation/run-ma-expiry-scan";
import {
  runWebsiteStatusToIntegrations,
  runWebsiteStatusDigestIfDue,
} from "@/lib/automation/run-website-status-digest";
import { clampIntervalMinutes } from "@/lib/utils/automation-interval";
import { normalizeScheduleTimes } from "@/lib/utils/website-status-schedule";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AutomationActionResult = { ok: true; message: string } | { ok: false; message: string };

export async function updateAutomationRuleAction(input: { id: string; enabled: boolean }): Promise<AutomationActionResult> {
  const id = input.id?.trim();
  if (!id) return { ok: false, message: "ไม่พบรหัสกฎ" };
  if (!isSupabaseConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("automation_rules")
    .update({ enabled: input.enabled, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, {
    severity: "notice",
    category: "automation",
    action: input.enabled ? "automation.rule_enable" : "automation.rule_disable",
    targetType: "automation_rule",
    targetId: id,
    userId: user?.id ?? null,
  });

  revalidatePath("/admin/automation");
  revalidatePath("/admin/monitor");
  revalidatePath("/admin/audit");
  return { ok: true, message: "บันทึกแล้ว" };
}

/** ทดสอบส่งข้อความสรุปรายวันไป Integrations (มีหัวข้อ 🧪 ทดสอบ) — ไม่รันกฎอื่น */
export async function testDailyDigestAction(): Promise<AutomationActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ต้องล็อกอิน" };

  const r = await runDailyDigestToIntegrations(supabase, { actorUserId: user.id, mode: "test" });

  revalidatePath("/admin/automation");
  revalidatePath("/admin/integrations");
  revalidatePath("/admin/audit");

  if (!r.ok && r.targets > 0) {
    return { ok: false, message: r.detail };
  }
  return { ok: true, message: r.detail };
}

/** ทดสอบส่งสถานะเว็บทุกตัวไป Integrations (หัวข้อทดสอบ) */
export async function testWebsiteStatusAction(): Promise<AutomationActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ต้องล็อกอิน" };

  const r = await runWebsiteStatusToIntegrations(supabase, { actorUserId: user.id, mode: "test" });

  revalidatePath("/admin/automation");
  revalidatePath("/admin/integrations");
  revalidatePath("/admin/audit");

  if (!r.ok && r.targets > 0) {
    return { ok: false, message: r.detail };
  }
  return { ok: true, message: r.detail };
}

/** ping ให้เซิร์ฟเวอร์ตรวจ schedule — เรียกจาก client pinger บนหน้า admin (ใช้ session ผู้ใช้แทน cron) */
export async function pollWebsiteStatusScheduleAction(): Promise<AutomationActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ต้องล็อกอิน" };
  try {
    const r = await runWebsiteStatusDigestIfDue(supabase);
    if (!r.skipped) {
      revalidatePath("/admin/automation");
    }
    return { ok: r.ok, message: r.detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ไม่ทราบสาเหตุ";
    return { ok: false, message: msg };
  }
}

/** ตั้งหลายเวลาต่อวัน (HH:mm) — timezone Asia/Bangkok ฝั่งเซิร์ฟเวอร์ */
export async function updateWebsiteStatusScheduleAction(input: {
  scheduleTimes: string[];
}): Promise<AutomationActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ต้องล็อกอิน" };

  const scheduleTimes = normalizeScheduleTimes(input.scheduleTimes);
  if (scheduleTimes.length === 0) {
    return { ok: false, message: "ต้องมีอย่างน้อยหนึ่งช่วงเวลา" };
  }
  if (scheduleTimes.length > 48) {
    return { ok: false, message: "ตั้งได้สูงสุด 48 ช่วงต่อวัน" };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("automation_rules")
    .select("config")
    .eq("id", "website_status_digest")
    .maybeSingle();
  if (fetchErr) return { ok: false, message: fetchErr.message };

  const prev = (row?.config ?? {}) as Record<string, unknown>;
  const intervalMinutes =
    typeof prev.intervalMinutes === "number" ? clampIntervalMinutes(prev.intervalMinutes) : undefined;

  const { error } = await supabase
    .from("automation_rules")
    .update({
      config: {
        ...prev,
        scheduleTimes,
        timezone: typeof prev.timezone === "string" && prev.timezone.trim() ? prev.timezone.trim() : "Asia/Bangkok",
        ...(intervalMinutes !== undefined ? { intervalMinutes } : {}),
        _firedSlots: {},
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", "website_status_digest");

  if (error) return { ok: false, message: error.message };

  await writeAuditLog(supabase, {
    severity: "notice",
    category: "automation",
    action: "automation.website_status_schedule",
    detail: `ตั้งเวลาส่งสถานะเว็บ: ${scheduleTimes.join(", ")}`,
    userId: user.id,
  });

  revalidatePath("/admin/automation");
  revalidatePath("/admin/audit");
  return { ok: true, message: `บันทึกแล้ว — ${scheduleTimes.length} ช่วงต่อวัน (${scheduleTimes.join(", ")})` };
}

export async function runAutomationJobsAction(): Promise<AutomationActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ต้องล็อกอิน" };

  const { data: rules, error: rulesErr } = await supabase.from("automation_rules").select("id, enabled");
  if (rulesErr) return { ok: false, message: rulesErr.message };

  const enabled = new Map((rules ?? []).map((r) => [r.id as string, Boolean(r.enabled)]));

  const parts: string[] = [];

  if (enabled.get("ma_expiry_14")) {
    try {
      const r = await runMaExpiryScan(supabase, { actorUserId: user.id });
      const detail = `สร้าง ${r.created} รายการ · ข้าม ${r.skipped} รายการ${r.errorMessages.length ? ` · ${r.errorMessages.slice(0, 3).join("; ")}` : ""}`;
      const status = r.errorMessages.length > 0 && r.created === 0 ? "failed" : "success";
      await supabase.from("automation_job_runs").insert({
        rule_id: "ma_expiry_14",
        kind: "ma_expiry_scan",
        status,
        detail,
      });
      await supabase
        .from("automation_rules")
        .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", "ma_expiry_14");
      parts.push(`สแกน MA: ${detail}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ไม่ทราบสาเหตุ";
      await supabase.from("automation_job_runs").insert({
        rule_id: "ma_expiry_14",
        kind: "ma_expiry_scan",
        status: "failed",
        detail: msg,
      });
      parts.push(`สแกน MA ล้มเหลว: ${msg}`);
    }
  } else {
    await supabase.from("automation_job_runs").insert({
      rule_id: "ma_expiry_14",
      kind: "ma_expiry_scan",
      status: "skipped",
      detail: "ปิดกฎ «เตือน MA» อยู่",
    });
    parts.push("สแกน MA: ข้าม (กฎปิด)");
  }

  if (enabled.get("webhook_high")) {
    await supabase.from("automation_job_runs").insert({
      rule_id: "webhook_high",
      kind: "webhook_high",
      status: "success",
      detail: "แจ้งเตือนไป Discord/LINE/Teams/Webhook ส่งอัตโนมัติตอนสร้าง alert (หน้า Integrations — เปิดใช้และบันทึก URL/token)",
    });
    parts.push("Webhook: พร้อม (ส่งพร้อมเหตุการณ์ alert)");
  }

  if (enabled.get("daily_digest")) {
    try {
      const r = await runDailyDigestToIntegrations(supabase, { actorUserId: user.id });
      const jobStatus = r.targets === 0 || r.sent > 0 ? "success" : "failed";
      await supabase.from("automation_job_runs").insert({
        rule_id: "daily_digest",
        kind: "daily_digest",
        status: jobStatus,
        detail: r.detail,
      });
      await supabase
        .from("automation_rules")
        .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", "daily_digest");
      parts.push(`สรุปรายวัน: ${r.detail}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ไม่ทราบสาเหตุ";
      await supabase.from("automation_job_runs").insert({
        rule_id: "daily_digest",
        kind: "daily_digest",
        status: "failed",
        detail: msg,
      });
      parts.push(`สรุปรายวัน ล้มเหลว: ${msg}`);
    }
  } else {
    await supabase.from("automation_job_runs").insert({
      rule_id: "daily_digest",
      kind: "daily_digest",
      status: "skipped",
      detail: "ปิดกฎ «สรุปรายวัน» อยู่",
    });
    parts.push("สรุปรายวัน: ข้าม (กฎปิด)");
  }

  if (enabled.get("website_status_digest")) {
    try {
      const r = await runWebsiteStatusToIntegrations(supabase, { actorUserId: user.id, mode: "production" });
      const jobStatus = r.targets === 0 || r.sent > 0 ? "success" : "failed";
      await supabase.from("automation_job_runs").insert({
        rule_id: "website_status_digest",
        kind: "website_status_digest",
        status: jobStatus,
        detail: r.detail,
      });
      await supabase
        .from("automation_rules")
        .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", "website_status_digest");
      parts.push(`สถานะเว็บ: ${r.detail}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ไม่ทราบสาเหตุ";
      await supabase.from("automation_job_runs").insert({
        rule_id: "website_status_digest",
        kind: "website_status_digest",
        status: "failed",
        detail: msg,
      });
      parts.push(`สถานะเว็บ ล้มเหลว: ${msg}`);
    }
  } else {
    await supabase.from("automation_job_runs").insert({
      rule_id: "website_status_digest",
      kind: "website_status_digest",
      status: "skipped",
      detail: "ปิดกฎ «ส่งสถานะเว็บ» อยู่",
    });
    parts.push("สถานะเว็บ: ข้าม (กฎปิด)");
  }

  await writeAuditLog(supabase, {
    severity: "info",
    category: "automation",
    action: "automation.jobs_run",
    detail: parts.join(" · ").slice(0, 4000),
    userId: user.id,
  });

  revalidatePath("/admin/automation");
  revalidatePath("/admin/alerts");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/integrations");
  revalidatePath("/admin/audit");
  return { ok: true, message: parts.join(" · ") || "รันงานแล้ว" };
}
