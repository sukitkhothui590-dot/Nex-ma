import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { MONITOR_PROBE_USER_AGENT, probeHttpUrl } from "@/lib/monitor/http-probe";
import type { MonitorProbeItem } from "@/lib/monitor/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapWebsiteRow, type WebsiteRow } from "@/lib/supabase/mappers";
import type { Website } from "@/types/models";
import { isDownAlertRuleEnabled } from "@/lib/automation/down-alert-enabled";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { notifyIntegrationsForAlert } from "@/lib/integrations/notify-on-alert";
import { primarySiteUrl } from "@/lib/utils/website-urls";

export const dynamic = "force-dynamic";

function absoluteProbeUrl(w: Website): string | null {
  const raw = primarySiteUrl(w);
  if (!raw) return null;
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

async function mapLimit<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const chunk = await Promise.all(batch.map(fn));
    out.push(...chunk);
  }
  return out;
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false as const, message: "ไม่ได้เชื่อมฐานข้อมูล" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false as const, message: "ต้องล็อกอิน" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const persist = searchParams.get("persist") !== "0";

  const wRes = await supabase.from("websites").select("*").order("created_at", { ascending: false });
  if (wRes.error) {
    return NextResponse.json({ ok: false as const, message: wRes.error.message }, { status: 500 });
  }

  const websites = (wRes.data ?? []).map((r) => mapWebsiteRow(r as WebsiteRow));

  const probes: MonitorProbeItem[] = await mapLimit(websites, 4, async (w) => {
    const url = absoluteProbeUrl(w);
    if (!url) {
      return {
        id: w.id,
        url: "",
        online: false,
        latencyMs: 0,
        method: "GET",
        redirected: false,
        error: "ไม่มี URL หลัก (frontend/backend)",
      };
    }
    const p = await probeHttpUrl(url);
    return {
      id: w.id,
      url,
      online: p.ok,
      latencyMs: p.latencyMs,
      statusCode: p.statusCode,
      method: p.method,
      finalUrl: p.responseUrl,
      redirected: p.redirected,
      error: p.error,
    };
  });

  if (persist && probes.length > 0) {
    await Promise.all(
      probes.map((p) =>
        supabase
          .from("websites")
          .update({ status: p.online ? "online" : "offline" })
          .eq("id", p.id),
      ),
    );

    const allowDownAlerts = await isDownAlertRuleEnabled(supabase);

    /** แจ้งเตือนเมื่อเพิ่งหลุดจากออนไลน์ (ลดการแจ้งซ้ำขณะยังล่มอยู่) — ไทม์ไลน์ + Realtime จะเห็นทันที · ปิดได้จากหน้าออโตเมชัน */
    if (allowDownAlerts)
    for (let i = 0; i < websites.length; i++) {
      const w = websites[i];
      const p = probes[i];
      const wasOnline = w.status === "online";
      if (!wasOnline || p.online) continue;

      const parts: string[] = [];
      if (p.statusCode != null) parts.push(`HTTP ${p.statusCode}`);
      if (p.error) parts.push(p.error);
      if (!p.url) parts.push("ไม่มี URL หลัก");
      const detail = parts.length > 0 ? parts.join(" · ") : "ไม่ตอบสนองหรือไม่ผ่านเกณฑ์พร้อมใช้งาน";
      const alertMessage = `มอนิเตอร์: เว็บไม่พร้อมใช้งาน — ${detail}`;

      const { error: insErr } = await supabase.from("alerts").insert({
        website_id: w.id,
        message: alertMessage,
        severity: "high",
        status: "new",
      });
      if (insErr) {
        console.error("[monitor/probe] insert alert:", insErr.message);
      } else {
        await writeAuditLog(supabase, {
          severity: "warning",
          category: "alert",
          action: "alert.created",
          targetType: "website",
          targetId: w.id,
          detail: alertMessage.slice(0, 2000),
          meta: { source: "monitor.probe", severity: "high" },
          userId: user.id,
        });
        await notifyIntegrationsForAlert(supabase, {
          severity: "high",
          message: alertMessage,
          actorUserId: user.id,
        });
      }
    }

    revalidatePath("/admin/websites");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/monitor");
    revalidatePath("/admin/alerts");
    revalidatePath("/admin/audit");
  }

  return NextResponse.json({
    ok: true as const,
    checkedAt: new Date().toISOString(),
    userAgent: MONITOR_PROBE_USER_AGENT,
    probeFlow:
      "เบราว์เซอร์ → GET /api/monitor/probe (เซิร์ฟเวอร์แอปนี้) → fetch HEAD/GET ไปยัง URL ของเว็บ · บันทึก websites.status",
    probes,
    persisted: persist,
  });
}
