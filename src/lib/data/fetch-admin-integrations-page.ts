import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { maskIntegrationSecret } from "@/lib/integrations/mask-secret";

export type IntegrationProviderDTO = {
  id: "discord" | "line" | "teams" | "webhook";
  name: string;
  desc: string;
  icon: "discord" | "line" | "teams" | "webhook";
  enabled: boolean;
  hasSecret: boolean;
  maskedPreview: string;
  lastPingAt: string | null;
  lastPingOk: boolean | null;
  lastPingDetail: string | null;
};

export type IntegrationPingLogDTO = {
  id: string;
  providerId: string;
  ok: boolean;
  detail: string | null;
  createdAt: string;
};

export type AdminIntegrationsPageData = {
  providers: IntegrationProviderDTO[];
  pingLog: IntegrationPingLogDTO[];
  fromDatabase: boolean;
  /** ยังไม่มีตารางใน Supabase (ยังไม่รัน migration) — หน้าไม่ crash */
  missingTables: boolean;
  connectedCount: number;
  successPings24h: number;
  failedPings24h: number;
};

const META: Record<
  IntegrationProviderDTO["id"],
  { name: string; desc: string; icon: IntegrationProviderDTO["icon"] }
> = {
  discord: {
    name: "Discord",
    desc: "ส่งแจ้งเตือนไปช่องเซิร์ฟเวอร์ (Incoming Webhook)",
    icon: "discord",
  },
  line: {
    name: "LINE Official Account",
    desc: "Messaging API: JSON — broadcast ถึงทุกเพื่อน · หรือ to (User/กลุ่ม) · หรือ LINE Notify แบบเดิม",
    icon: "line",
  },
  teams: {
    name: "Microsoft Teams",
    desc: "Incoming Webhook URL",
    icon: "teams",
  },
  webhook: {
    name: "Webhook ทั่วไป",
    desc: "POST JSON เมื่อทดสอบ / เหตุการณ์",
    icon: "webhook",
  },
};

function formatTh(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

/** PostgREST / schema cache เมื่อตารางยังไม่ถูกสร้างจาก migration */
function isMissingIntegrationsTableError(err: { message?: string } | null | undefined): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return (
    m.includes("integration_providers") ||
    m.includes("integration_ping_log") ||
    m.includes("schema cache") ||
    m.includes("does not exist") ||
    m.includes("undefined_table")
  );
}

function defaultProvidersPlaceholder(): IntegrationProviderDTO[] {
  return (["discord", "line", "teams", "webhook"] as const).map((id) => {
    const m = META[id];
    return {
      id,
      name: m.name,
      desc: m.desc,
      icon: m.icon,
      enabled: false,
      hasSecret: false,
      maskedPreview: maskIntegrationSecret(null),
      lastPingAt: null,
      lastPingOk: null,
      lastPingDetail: null,
    };
  });
}

export async function fetchAdminIntegrationsPageData(): Promise<AdminIntegrationsPageData> {
  if (!isSupabaseConfigured()) {
    return {
      providers: defaultProvidersPlaceholder(),
      pingLog: [],
      fromDatabase: false,
      missingTables: false,
      connectedCount: 0,
      successPings24h: 0,
      failedPings24h: 0,
    };
  }

  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [provRes, logRes, okRes, failRes] = await Promise.all([
    supabase.from("integration_providers").select("*").order("id", { ascending: true }),
    supabase.from("integration_ping_log").select("*").order("created_at", { ascending: false }).limit(18),
    supabase
      .from("integration_ping_log")
      .select("id", { count: "exact", head: true })
      .eq("ok", true)
      .gte("created_at", since),
    supabase
      .from("integration_ping_log")
      .select("id", { count: "exact", head: true })
      .eq("ok", false)
      .gte("created_at", since),
  ]);

  if (provRes.error && isMissingIntegrationsTableError(provRes.error)) {
    return {
      providers: defaultProvidersPlaceholder(),
      pingLog: [],
      fromDatabase: true,
      missingTables: true,
      connectedCount: 0,
      successPings24h: 0,
      failedPings24h: 0,
    };
  }
  if (provRes.error) throw new Error(provRes.error.message);
  if (logRes.error && isMissingIntegrationsTableError(logRes.error)) {
    return {
      providers: defaultProvidersPlaceholder(),
      pingLog: [],
      fromDatabase: true,
      missingTables: true,
      connectedCount: 0,
      successPings24h: 0,
      failedPings24h: 0,
    };
  }
  if (logRes.error) throw new Error(logRes.error.message);

  const rows = (provRes.data ?? []) as Array<{
    id: string;
    enabled: boolean;
    secret: string | null;
    last_ping_at: string | null;
    last_ping_ok: boolean | null;
    last_ping_detail: string | null;
  }>;

  const providers: IntegrationProviderDTO[] = (["discord", "line", "teams", "webhook"] as const).map((id) => {
    const row = rows.find((r) => r.id === id);
    const m = META[id];
    const secret = row?.secret?.trim() ?? "";
    const hasSecret = secret.length > 0;
    return {
      id,
      name: m.name,
      desc: m.desc,
      icon: m.icon,
      enabled: Boolean(row?.enabled),
      hasSecret,
      maskedPreview: maskIntegrationSecret(secret || null),
      lastPingAt: formatTh(row?.last_ping_at),
      lastPingOk: row?.last_ping_ok ?? null,
      lastPingDetail: row?.last_ping_detail ?? null,
    };
  });

  const connectedCount = providers.filter((p) => p.enabled && p.hasSecret).length;

  const pingLog: IntegrationPingLogDTO[] = (logRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    providerId: String(r.provider_id),
    ok: Boolean(r.ok),
    detail: r.detail != null ? String(r.detail) : null,
    createdAt: String(r.created_at),
  }));

  return {
    providers,
    pingLog,
    fromDatabase: true,
    missingTables: false,
    connectedCount,
    successPings24h: okRes.error ? 0 : (okRes.count ?? 0),
    failedPings24h: failRes.error ? 0 : (failRes.count ?? 0),
  };
}
