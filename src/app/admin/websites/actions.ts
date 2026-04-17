"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { notifyIntegrationsForAlert } from "@/lib/integrations/notify-on-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { coerceUrlsForLegacyNotNullColumns } from "@/lib/utils/website-urls";
import type { Website } from "@/types/models";

/** คืน null ถ้าว่าง — ไม่ใส่ protocol ให้อัตโนมัติเมื่อไม่มีข้อความ */
function normalizeUrlOptional(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
}

function normalizeContractExpiry(raw: string | undefined | null): string | null {
  const t = raw?.trim().slice(0, 10) ?? "";
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

/** Postgres NOT NULL / ข้อความยอดนิยมจาก Supabase เมื่อคอลัมน์ยัง NOT NULL (สคีมาเก่า) */
function isLegacyWebsiteUrlNotNullViolation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23502") return true;
  const m = (error.message ?? "").toLowerCase();
  if (m.includes("violates not-null constraint")) return true;
  if (m.includes("null value in column") && (m.includes("frontend_url") || m.includes("backend_url"))) return true;
  return false;
}

export type WebsiteMutationResult = { ok: true } | { ok: false; message: string };

export async function createWebsiteAction(input: {
  customerId: string;
  name: string;
  includeFrontend: boolean;
  includeBackend: boolean;
  frontendUrl: string;
  backendUrl: string;
  provider: string;
  hostingType: string;
  status: Website["status"];
  contractStatus: Website["contractStatus"];
  contractExpiryDate: string | null;
}): Promise<WebsiteMutationResult> {
  const name = input.name.trim();
  if (!name || !input.customerId) {
    return { ok: false, message: "กรุณากรอกชื่อเว็บและเลือกลูกค้า" };
  }
  if (!input.includeFrontend && !input.includeBackend) {
    return { ok: false, message: "เลือกอย่างน้อยหนึ่ง URL: หน้าบ้านหรือหลังบ้าน" };
  }

  const fe = input.includeFrontend ? normalizeUrlOptional(input.frontendUrl) : null;
  const be = input.includeBackend ? normalizeUrlOptional(input.backendUrl) : null;
  if (input.includeFrontend && !fe) {
    return { ok: false, message: "กรุณากรอก URL หน้าบ้าน" };
  }
  if (input.includeBackend && !be) {
    return { ok: false, message: "กรุณากรอก URL หลังบ้าน" };
  }
  if (!fe && !be) {
    return { ok: false, message: "ต้องมี URL อย่างน้อยหนึ่งรายการ" };
  }

  const exp = normalizeContractExpiry(input.contractExpiryDate);

  const supabase = await createSupabaseServerClient();
  const baseRow = {
    customer_id: input.customerId,
    name,
    frontend_url: fe,
    backend_url: be,
    provider: input.provider.trim() || "—",
    hosting_type: input.hostingType.trim() || "—",
    status: input.status,
    contract_status: input.contractStatus,
    contract_expiry_date: exp,
    logo_url: null,
    api_key_masked: "—",
  };

  let { error } = await supabase.from("websites").insert(baseRow);

  if (error && isLegacyWebsiteUrlNotNullViolation(error)) {
    const c = coerceUrlsForLegacyNotNullColumns(fe, be);
    ({ error } = await supabase.from("websites").insert({ ...baseRow, ...c }));
  }

  if (error) return { ok: false, message: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await writeAuditLog(supabase, {
    severity: "info",
    category: "website",
    action: "website.create",
    targetType: "website",
    detail: name.slice(0, 500),
    meta: { customerId: input.customerId },
    userId: user?.id ?? null,
  });

  revalidatePath("/admin/websites");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/monitor");
  revalidatePath("/admin/audit");
  return { ok: true };
}

export async function updateWebsiteAction(input: {
  id: string;
  name: string;
  includeFrontend: boolean;
  includeBackend: boolean;
  frontendUrl: string;
  backendUrl: string;
  provider: string;
  hostingType: string;
  status: Website["status"];
  contractStatus: Website["contractStatus"];
  contractExpiryDate: string | null;
}): Promise<WebsiteMutationResult> {
  const name = input.name.trim();
  if (!input.id || !name) {
    return { ok: false, message: "ข้อมูลไม่ครบ" };
  }
  if (!input.includeFrontend && !input.includeBackend) {
    return { ok: false, message: "เลือกอย่างน้อยหนึ่ง URL: หน้าบ้านหรือหลังบ้าน" };
  }

  const fe = input.includeFrontend ? normalizeUrlOptional(input.frontendUrl) : null;
  const be = input.includeBackend ? normalizeUrlOptional(input.backendUrl) : null;
  if (input.includeFrontend && !fe) {
    return { ok: false, message: "กรุณากรอก URL หน้าบ้าน" };
  }
  if (input.includeBackend && !be) {
    return { ok: false, message: "กรุณากรอก URL หลังบ้าน" };
  }
  if (!fe && !be) {
    return { ok: false, message: "ต้องมี URL อย่างน้อยหนึ่งรายการ" };
  }

  const exp = normalizeContractExpiry(input.contractExpiryDate);

  const supabase = await createSupabaseServerClient();
  const baseUpdate = {
    name,
    frontend_url: fe,
    backend_url: be,
    provider: input.provider.trim() || "—",
    hosting_type: input.hostingType.trim() || "—",
    status: input.status,
    contract_status: input.contractStatus,
    contract_expiry_date: exp,
  };

  let { error } = await supabase.from("websites").update(baseUpdate).eq("id", input.id);

  if (error && isLegacyWebsiteUrlNotNullViolation(error)) {
    const c = coerceUrlsForLegacyNotNullColumns(fe, be);
    ({ error } = await supabase.from("websites").update({ ...baseUpdate, ...c }).eq("id", input.id));
  }

  if (error) return { ok: false, message: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await writeAuditLog(supabase, {
    severity: "notice",
    category: "website",
    action: "website.update",
    targetType: "website",
    targetId: input.id,
    detail: name.slice(0, 500),
    userId: user?.id ?? null,
  });

  revalidatePath("/admin/websites");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/monitor");
  revalidatePath("/admin/audit");
  return { ok: true };
}

/**
 * ต่อสัญญา: อัปเดตวันหมดอายุ + สถานะใช้งาน — สร้างแจ้งเตือนและส่งไป integrations (Discord ฯลฯ)
 */
export async function renewWebsiteContractAction(input: {
  websiteId: string;
  newExpiryDate: string;
}): Promise<WebsiteMutationResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "ยังไม่ได้เชื่อมฐานข้อมูล" };
  }

  const id = input.websiteId?.trim();
  const exp = normalizeContractExpiry(input.newExpiryDate);
  if (!id) return { ok: false, message: "ไม่พบเว็บไซต์" };
  if (!exp) return { ok: false, message: "วันที่หมดอายุใหม่ไม่ถูกต้อง (ใช้ yyyy-mm-dd)" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ต้องล็อกอิน" };

  const { data: site, error: readErr } = await supabase.from("websites").select("id, name").eq("id", id).maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!site) return { ok: false, message: "ไม่พบเว็บไซต์" };

  const siteName = String(site.name);

  const { error: upErr } = await supabase
    .from("websites")
    .update({
      contract_expiry_date: exp,
      contract_status: "active",
    })
    .eq("id", id);

  if (upErr) return { ok: false, message: upErr.message };

  const alertMessage = `ต่อสัญญา: ${siteName} · หมดอายุใหม่ ${exp}`;
  const { error: alertErr } = await supabase.from("alerts").insert({
    website_id: id,
    message: alertMessage,
    severity: "medium",
    status: "new",
  });

  if (alertErr) {
    return {
      ok: false,
      message: `อัปเดตวันหมดอายุแล้ว แต่สร้างแจ้งเตือนไม่สำเร็จ: ${alertErr.message}`,
    };
  }

  await notifyIntegrationsForAlert(supabase, {
    severity: "medium",
    message: alertMessage,
    actorUserId: user.id,
  });

  await writeAuditLog(supabase, {
    severity: "notice",
    category: "website",
    action: "website.contract_renew",
    targetType: "website",
    targetId: id,
    detail: alertMessage.slice(0, 500),
    meta: { newExpiryDate: exp },
    userId: user.id,
  });

  revalidatePath("/admin/websites");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/monitor");
  revalidatePath("/admin/alerts");
  revalidatePath("/admin/audit");
  return { ok: true };
}
