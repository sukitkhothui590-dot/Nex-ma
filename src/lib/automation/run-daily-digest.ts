import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { deliverIntegration, type DeliverMode, type DiscordWebhookEmbed } from "@/lib/integrations/delivery";
import { getDaysUntil } from "@/lib/utils/date";

function truncateDetail(s: string, max = 500): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function formatThNow(): string {
  return new Date().toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const DIGEST_FOOTER_PRODUCTION =
  "\n\n— _ส่งจากกฎออโตเมชัน «สรุปรายวัน» — ตั้งค่าช่องทางที่หน้า Integrations_";
const DIGEST_FOOTER_TEST = "\n\n— _ทดสอบจากหน้า Automation — ตั้งค่าช่องทางที่ Integrations_";

type DigestStats = {
  websitesTotal: number;
  websitesOnline: number;
  websitesOffline: number;
  contractActive: number;
  contractInactive: number;
  contractsExpiring14d: number;
  contractsOverdue: number;
  alertsNew: number;
  alertsAcknowledged: number;
  alertsResolved: number;
  customersTotal: number;
  generatedAt: string;
  test?: boolean;
};

function digestEmbedColor(s: DigestStats, isTest: boolean): number {
  if (isTest) return 0xf59e0b;
  if (s.websitesOffline > 0 || s.contractsOverdue > 0) return 0xef4444;
  if (s.contractsExpiring14d > 0 || s.alertsNew > 0) return 0xea580c;
  return 0x6366f1;
}

function buildDiscordDigestEmbeds(s: DigestStats, isTest: boolean): DiscordWebhookEmbed[] {
  const title = isTest ? "🧪 ทดสอบ — สรุปรายวัน" : "📊 สรุปรายวัน";
  const subtitle = isTest
    ? "รูปแบบเดียวกับข้อความจริง — ตรวจสอบการแสดงผลใน Discord"
    : "MA Alert System — ภาพรวมแดชบอร์ด";

  const main: DiscordWebhookEmbed = {
    title,
    description: `**${subtitle}**\n🕐 ${formatThNow()}`,
    color: digestEmbedColor(s, isTest),
    fields: [
      {
        name: "🌐 เว็บไซต์",
        value: [
          `รวม **${s.websitesTotal}** ราย`,
          `ออนไลน์ **${s.websitesOnline}** · ออฟไลน์ **${s.websitesOffline}**`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "📋 สัญญา (ตามเว็บ)",
        value: [
          `ใช้งาน **${s.contractActive}** · ไม่ใช้งาน **${s.contractInactive}**`,
          `ใกล้หมด ≤14 วัน: **${s.contractsExpiring14d}** · เลยกำหนด: **${s.contractsOverdue}**`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🔔 แจ้งเตือน",
        value: `ใหม่ **${s.alertsNew}** · รับทราบ **${s.alertsAcknowledged}** · แก้ไขแล้ว **${s.alertsResolved}**`,
        inline: true,
      },
      {
        name: "👥 ลูกค้า",
        value: `**${s.customersTotal}** ราย`,
        inline: true,
      },
    ],
    footer: {
      text: isTest
        ? "ทดสอบจาก Automation · ตั้งค่า Integrations"
        : "กฎสรุปรายวัน · หน้า Integrations",
    },
    timestamp: new Date().toISOString(),
  };

  return [main];
}

/**
 * รวบรวมตัวเลขแดชบอร์ด — ข้อความ plain (LINE/Teams) + Embed (Discord)
 */
export async function buildDailyDigestPayload(
  supabase: SupabaseClient,
  options?: { test?: boolean },
): Promise<{
  text: string;
  stats: Record<string, unknown>;
  discordEmbeds: DiscordWebhookEmbed[];
}> {
  const isTest = Boolean(options?.test);

  const [wRes, aRes, cRes] = await Promise.all([
    supabase.from("websites").select("status, contract_status, contract_expiry_date"),
    supabase.from("alerts").select("status"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  if (wRes.error) throw new Error(wRes.error.message);
  if (aRes.error) throw new Error(aRes.error.message);
  if (cRes.error) throw new Error(cRes.error.message);

  const websites = (wRes.data ?? []) as Array<{
    status: string;
    contract_status: string;
    contract_expiry_date: string | null;
  }>;
  const alerts = (aRes.data ?? []) as Array<{ status: string }>;

  const totalW = websites.length;
  const online = websites.filter((w) => w.status === "online").length;
  const offline = websites.filter((w) => w.status === "offline").length;
  const contractActive = websites.filter((w) => w.contract_status === "active").length;
  const contractInactive = websites.filter((w) => w.contract_status === "inactive").length;

  let expiringSoon = 0;
  let overdue = 0;
  for (const w of websites) {
    const d = w.contract_expiry_date?.trim().slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const days = getDaysUntil(d);
    if (days < 0) overdue += 1;
    else if (days <= 14) expiringSoon += 1;
  }

  const newAlerts = alerts.filter((a) => a.status === "new").length;
  const ackAlerts = alerts.filter((a) => a.status === "acknowledged").length;
  const resolvedAlerts = alerts.filter((a) => a.status === "resolved").length;

  const customersTotal = cRes.count ?? 0;

  const stats: DigestStats = {
    websitesTotal: totalW,
    websitesOnline: online,
    websitesOffline: offline,
    contractActive,
    contractInactive,
    contractsExpiring14d: expiringSoon,
    contractsOverdue: overdue,
    alertsNew: newAlerts,
    alertsAcknowledged: ackAlerts,
    alertsResolved: resolvedAlerts,
    customersTotal,
    generatedAt: new Date().toISOString(),
    ...(isTest ? { test: true } : {}),
  };

  const discordEmbeds = buildDiscordDigestEmbeds(stats, isTest);

  /** LINE / Teams — จัดบรรทัดให้อ่านง่ายขึ้น (ไม่มี embed) */
  const plainLines = [
    isTest ? "🧪 「ทดสอบส่งสรุปรายวัน」" : "━━━━ 📊 สรุปรายวัน ━━━━",
    "MA Alert System",
    `🕐 ${formatThNow()}`,
    "",
    "▸ เว็บไซต์",
    `   รวม ${totalW} · ออนไลน์ ${online} · ออฟไลน์ ${offline}`,
    `   สัญญา ใช้งาน ${contractActive} / ไม่ใช้งาน ${contractInactive}`,
    `   ใกล้หมด ≤14 วัน: ${expiringSoon} · เลยกำหนด: ${overdue}`,
    "",
    "▸ แจ้งเตือน",
    `   ใหม่ ${newAlerts} · รับทราบ ${ackAlerts} · แก้ไขแล้ว ${resolvedAlerts}`,
    "",
    "▸ ลูกค้า",
    `   ${customersTotal} ราย`,
  ];

  const footer = isTest ? DIGEST_FOOTER_TEST : DIGEST_FOOTER_PRODUCTION;
  const text = plainLines.join("\n") + footer;

  return {
    text,
    stats: stats as Record<string, unknown>,
    discordEmbeds,
  };
}

export type DailyDigestResult = {
  ok: boolean;
  detail: string;
  sent: number;
  targets: number;
};

/**
 * ส่งสรุปรายวันไปทุก integration ที่เปิด + มี secret
 * @param options.mode `test` = หัวข้อ/สีทดสอบ (ไม่รันกฎออโตเมชัน)
 */
export async function runDailyDigestToIntegrations(
  supabase: SupabaseClient,
  options: { actorUserId: string; mode?: "production" | "test" },
): Promise<DailyDigestResult> {
  const isTest = options.mode === "test";
  const payload = await buildDailyDigestPayload(supabase, { test: isTest });
  const { text, stats, discordEmbeds } = payload;

  const mode: DeliverMode = {
    kind: "digest",
    text,
    stats,
    discordEmbeds,
  };

  const { data: rows, error } = await supabase
    .from("integration_providers")
    .select("id, secret, enabled")
    .eq("enabled", true);

  if (error) {
    return { ok: false, detail: error.message, sent: 0, targets: 0 };
  }

  const targets = (rows ?? []).filter((r) => {
    const sec = (r.secret as string | null)?.trim() ?? "";
    return sec.length > 0;
  });

  if (targets.length === 0) {
    await writeAuditLog(supabase, {
      severity: "notice",
      category: "automation",
      action: isTest ? "automation.daily_digest_test_skipped" : "automation.daily_digest_skipped",
      detail: "ไม่มีช่อง Integrations ที่เปิดใช้และมี URL/token",
      meta: stats,
      userId: options.actorUserId,
    });
    return { ok: true, detail: "ไม่มีช่องทางที่ตั้งค่า — ข้ามการส่ง", sent: 0, targets: 0 };
  }

  const results = await Promise.all(
    targets.map(async (row) => {
      const id = String(row.id);
      const secret = String((row.secret as string).trim());
      const result = await deliverIntegration(id, secret, mode);
      const now = new Date().toISOString();

      await supabase
        .from("integration_providers")
        .update({
          last_ping_at: now,
          last_ping_ok: result.ok,
          last_ping_detail: result.detail.slice(0, 500),
          updated_at: now,
        })
        .eq("id", id);

      await supabase.from("integration_ping_log").insert({
        provider_id: id,
        ok: result.ok,
        detail: truncateDetail(`${isTest ? "ทดสอบสรุปรายวัน" : "สรุปรายวัน"}: ${result.detail}`),
      });

      return { id, ok: result.ok };
    }),
  );

  const sent = results.filter((r) => r.ok).length;
  const anyFail = results.some((r) => !r.ok);

  await writeAuditLog(supabase, {
    severity: anyFail ? "warning" : "notice",
    category: "automation",
    action: isTest ? "automation.daily_digest_test_sent" : "automation.daily_digest_sent",
    detail: `${isTest ? "ทดสอบส่งสรุปรายวัน" : "ส่งสรุปรายวัน"} ${sent}/${targets.length} ช่องทาง`,
    meta: {
      ...stats,
      delivery: results.map((x) => `${x.id}:${x.ok ? "ok" : "fail"}`).join(","),
    },
    userId: options.actorUserId,
  });

  return {
    ok: sent > 0 || !anyFail,
    detail: `ส่งสำเร็จ ${sent}/${targets.length} ช่องทาง`,
    sent,
    targets: targets.length,
  };
}
