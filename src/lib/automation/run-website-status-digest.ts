import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { deliverIntegration, type DeliverMode, type DiscordWebhookEmbed } from "@/lib/integrations/delivery";
import { clampIntervalMinutes } from "@/lib/utils/automation-interval";
import {
  getNowInTimeZone,
  minutesFromMidnight,
  normalizeScheduleTimes,
  pruneFiredSlots,
  slotMatchesNow,
  type WebsiteStatusRuleConfig,
  WEBSITE_STATUS_DEFAULT_TZ,
} from "@/lib/utils/website-status-schedule";

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

type SiteRow = {
  id: string;
  name: string;
  status: string;
  frontend_url: string | null;
  backend_url: string | null;
  contract_status: string;
  customer_name: string;
};

function statusLabelTh(s: string): string {
  return s === "online" ? "ออนไลน์" : "ออฟไลน์";
}

function statusEmoji(s: string): string {
  return s === "online" ? "🟢" : "🔴";
}

function shortUrl(u: string | null): string {
  const t = (u ?? "").trim();
  if (!t) return "—";
  return t.length > 48 ? `${t.slice(0, 45)}…` : t;
}

function buildDiscordWebsiteEmbeds(
  sites: SiteRow[],
  isTest: boolean,
): DiscordWebhookEmbed[] {
  const online = sites.filter((w) => w.status === "online").length;
  const offline = sites.length - online;
  const color = offline > 0 ? 0xef4444 : 0x22c55e;

  const chunks: SiteRow[][] = [];
  for (let i = 0; i < sites.length; i += 25) {
    chunks.push(sites.slice(i, i + 25));
  }
  if (chunks.length === 0) {
    chunks.push([]);
  }

  return chunks.slice(0, 10).map((chunk, idx) => {
    const fields = chunk.map((w) => ({
      name: w.name.slice(0, 256),
      value: [
        `${statusEmoji(w.status)} **${statusLabelTh(w.status)}** · ลูกค้า ${w.customer_name}`,
        `สัญญา: ${w.contract_status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}`,
        `หน้า: ${shortUrl(w.frontend_url)}`,
        `หลัง: ${shortUrl(w.backend_url)}`,
      ].join("\n"),
      inline: false,
    }));

    return {
      title: idx === 0 ? (isTest ? "🧪 ทดสอบ — สถานะเว็บ" : "📡 สถานะเว็บ") : `📡 สถานะเว็บ (ต่อ ${idx + 1})`,
      description:
        idx === 0
          ? `**MA Alert System**\n🕐 ${formatThNow()}\nออนไลน์ **${online}** · ออฟไลน์ **${offline}** · รวม **${sites.length}** เว็บ`
          : undefined,
      color,
      fields,
      footer: {
        text: isTest ? "ทดสอบ · Integrations" : "กฎสถานะเว็บ · Integrations",
      },
      timestamp: new Date().toISOString(),
    };
  });
}

export async function buildWebsiteStatusPayload(
  supabase: SupabaseClient,
  options?: { test?: boolean },
): Promise<{
  text: string;
  stats: Record<string, unknown>;
  discordEmbeds: DiscordWebhookEmbed[];
}> {
  const isTest = Boolean(options?.test);

  const [wRes, cRes] = await Promise.all([
    supabase
      .from("websites")
      .select("id, customer_id, name, status, frontend_url, backend_url, contract_status")
      .order("name", { ascending: true }),
    supabase.from("customers").select("id, name"),
  ]);

  if (wRes.error) throw new Error(wRes.error.message);
  if (cRes.error) throw new Error(cRes.error.message);

  const cmap = new Map((cRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

  const raw = (wRes.data ?? []) as Array<{
    id: string;
    customer_id: string;
    name: string;
    status: string;
    frontend_url: string | null;
    backend_url: string | null;
    contract_status: string;
  }>;

  const sites: SiteRow[] = raw.map((w) => ({
    id: w.id,
    name: w.name,
    status: w.status,
    frontend_url: w.frontend_url,
    backend_url: w.backend_url,
    contract_status: w.contract_status,
    customer_name: (cmap.get(w.customer_id) ?? "—").trim() || "—",
  }));

  const online = sites.filter((w) => w.status === "online").length;
  const offline = sites.length - online;

  const lines = [
    isTest ? "🧪 「ทดสอบส่งสถานะเว็บ」" : "━━━━ 📡 สถานะเว็บ ━━━━",
    "MA Alert System",
    `🕐 ${formatThNow()}`,
    `สรุป: ออนไลน์ ${online} · ออฟไลน์ ${offline} · รวม ${sites.length} เว็บ`,
    "",
    ...sites.map(
      (w) =>
        `▸ ${w.name}\n   ${statusEmoji(w.status)} ${statusLabelTh(w.status)} · ${w.customer_name}\n   หน้า ${shortUrl(w.frontend_url)} · หลัง ${shortUrl(w.backend_url)}`,
    ),
  ];

  const footer = isTest
    ? "\n\n— _ทดสอบจากหน้า Automation — ตั้งค่าช่องทางที่ Integrations_"
    : "\n\n— _ส่งจากกฎออโตเมชัน «สถานะเว็บ» — ตั้งค่าช่องทางที่ Integrations_";

  const text = lines.join("\n") + footer;

  const stats = {
    kind: "website_status",
    websitesTotal: sites.length,
    websitesOnline: online,
    websitesOffline: offline,
    generatedAt: new Date().toISOString(),
    ...(isTest ? { test: true } : {}),
  };

  const discordEmbeds = buildDiscordWebsiteEmbeds(sites, isTest);

  return { text, stats, discordEmbeds };
}

export type WebsiteStatusResult = {
  ok: boolean;
  detail: string;
  sent: number;
  targets: number;
};

export async function runWebsiteStatusToIntegrations(
  supabase: SupabaseClient,
  options: { actorUserId: string | null; mode?: "production" | "test" },
): Promise<WebsiteStatusResult> {
  const isTest = options.mode === "test";
  const payload = await buildWebsiteStatusPayload(supabase, { test: isTest });
  const { text, stats, discordEmbeds } = payload;

  const mode: DeliverMode = {
    kind: "digest",
    text,
    stats,
    discordEmbeds,
    digestLabel: "สถานะเว็บ",
    digestEvent: "website_status",
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
      action: isTest ? "automation.website_status_test_skipped" : "automation.website_status_skipped",
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
        detail: truncateDetail(`${isTest ? "ทดสอบสถานะเว็บ" : "สถานะเว็บ"}: ${result.detail}`),
      });

      return { id, ok: result.ok };
    }),
  );

  const sent = results.filter((r) => r.ok).length;
  const anyFail = results.some((r) => !r.ok);

  await writeAuditLog(supabase, {
    severity: anyFail ? "warning" : "notice",
    category: "automation",
    action: isTest ? "automation.website_status_test_sent" : "automation.website_status_sent",
    detail: `${isTest ? "ทดสอบส่งสถานะเว็บ" : "ส่งสถานะเว็บ"} ${sent}/${targets.length} ช่องทาง`,
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

/** เรียกจาก cron — โหมดตารางเวลา (หลายช่วงต่อวัน) หรือโหมดทุก N นาที (intervalMinutes) */
export async function runWebsiteStatusDigestIfDue(supabase: SupabaseClient): Promise<{
  ok: boolean;
  skipped?: boolean;
  detail: string;
  sent?: number;
  targets?: number;
}> {
  const { data: rule, error } = await supabase
    .from("automation_rules")
    .select("enabled, last_run_at, config")
    .eq("id", "website_status_digest")
    .maybeSingle();

  if (error) return { ok: false, detail: error.message };
  if (!rule || !rule.enabled) {
    return { ok: true, skipped: true, detail: "กฎส่งสถานะเว็บปิดอยู่" };
  }

  const cfg = (rule.config ?? {}) as WebsiteStatusRuleConfig;
  const scheduleTimes = normalizeScheduleTimes(cfg.scheduleTimes);

  if (scheduleTimes.length > 0) {
    const tz = cfg.timezone?.trim() || WEBSITE_STATUS_DEFAULT_TZ;
    const now = new Date();
    const { dateKey, hm } = getNowInTimeZone(now, tz);
    const yesterday = new Date(now.getTime() - 86400000);
    const yKey = getNowInTimeZone(yesterday, tz).dateKey;
    const fired = { ...(cfg._firedSlots ?? {}) };
    const firedToday = new Set(fired[dateKey] ?? []);

    const candidates = scheduleTimes
      .filter((slot) => slotMatchesNow(slot, hm) && !firedToday.has(slot))
      .sort((a, b) => (minutesFromMidnight(a) ?? 0) - (minutesFromMidnight(b) ?? 0));

    if (candidates.length === 0) {
      return {
        ok: true,
        skipped: true,
        detail: `ไม่มีช่วงเวลาที่ตรงรอบนี้ (${hm} ${tz})`,
      };
    }

    const slot = candidates[0]!;
    const r = await runWebsiteStatusToIntegrations(supabase, { actorUserId: null, mode: "production" });

    const iso = new Date().toISOString();
    /**
     * mark fired เมื่อ "พยายามยิงแล้ว" (targets > 0) — ถึงแม้ sent = 0 ก็กันซ้ำในหน้าต่างเดียวกัน
     * เหลือเคส targets = 0 (ไม่มี integration) ที่จะไม่ mark — ให้ user ไปตั้ง integration ก่อน
     */
    const shouldMarkFired = r.targets > 0;
    if (shouldMarkFired) {
      const nextFired = { ...fired };
      const nextList = [...(nextFired[dateKey] ?? []), slot];
      nextFired[dateKey] = [...new Set(nextList)];
      const pruned = pruneFiredSlots(nextFired, new Set([dateKey, yKey]));
      await supabase
        .from("automation_rules")
        .update({
          last_run_at: iso,
          updated_at: iso,
          config: {
            ...cfg,
            scheduleTimes,
            timezone: tz,
            _firedSlots: pruned,
          },
        })
        .eq("id", "website_status_digest");
    } else {
      await supabase
        .from("automation_rules")
        .update({ last_run_at: iso, updated_at: iso })
        .eq("id", "website_status_digest");
    }

    return {
      ok: r.ok,
      detail: shouldMarkFired ? `${r.detail} · ช่วง ${slot}` : r.detail,
      sent: r.sent,
      targets: r.targets,
    };
  }

  const intervalMinutes = clampIntervalMinutes(cfg.intervalMinutes);
  const lastMs = rule.last_run_at ? new Date(rule.last_run_at as string).getTime() : 0;
  const intervalMs = intervalMinutes * 60 * 1000;
  if (lastMs && Date.now() - lastMs < intervalMs) {
    return {
      ok: true,
      skipped: true,
      detail: `ยังไม่ถึงรอบ (ทุก ${intervalMinutes} นาที) — หรือตั้ง scheduleTimes เป็นเวลาต่อวัน`,
    };
  }

  const r = await runWebsiteStatusToIntegrations(supabase, { actorUserId: null, mode: "production" });

  const nowIso = new Date().toISOString();
  await supabase
    .from("automation_rules")
    .update({ last_run_at: nowIso, updated_at: nowIso })
    .eq("id", "website_status_digest");

  return { ok: r.ok, detail: r.detail, sent: r.sent, targets: r.targets };
}
