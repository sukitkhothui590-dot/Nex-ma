import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AutomationRuleRow = {
  id: string;
  name: string;
  triggerSummary: string;
  actionSummary: string;
  enabled: boolean;
  lastRun: string | null;
  /** ตั้งค่ากฎ (เช่น intervalMinutes) */
  config: Record<string, unknown> | null;
};

export type AutomationJobRunRow = {
  id: string;
  kind: string;
  status: string;
  detail: string | null;
  createdAt: string;
};

export type AdminAutomationPageData = {
  rules: AutomationRuleRow[];
  jobs: AutomationJobRunRow[];
  fromDatabase: boolean;
  failedJobs24h: number;
};

function formatTh(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

export async function fetchAdminAutomationPageData(): Promise<AdminAutomationPageData> {
  if (!isSupabaseConfigured()) {
    return { rules: [], jobs: [], fromDatabase: false, failedJobs24h: 0 };
  }

  const supabase = await createSupabaseServerClient();
  const [rulesRes, jobsRes, failRes] = await Promise.all([
    supabase.from("automation_rules").select("*").order("id", { ascending: true }),
    supabase.from("automation_job_runs").select("*").order("created_at", { ascending: false }).limit(20),
    supabase
      .from("automation_job_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (rulesRes.error) throw new Error(rulesRes.error.message);
  if (jobsRes.error) throw new Error(jobsRes.error.message);
  if (failRes.error) {
    console.warn("[fetch-admin-automation] failed count:", failRes.error.message);
  }

  const rules: AutomationRuleRow[] = (rulesRes.data ?? []).map((r: Record<string, unknown>) => {
    const cfg = r.config;
    return {
      id: String(r.id),
      name: String(r.name),
      triggerSummary: String(r.trigger_summary),
      actionSummary: String(r.action_summary),
      enabled: Boolean(r.enabled),
      lastRun: formatTh(r.last_run_at as string | null),
      config: cfg && typeof cfg === "object" && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : null,
    };
  });

  const jobs: AutomationJobRunRow[] = (jobsRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    kind: String(r.kind),
    status: String(r.status),
    detail: r.detail != null ? String(r.detail) : null,
    createdAt: String(r.created_at),
  }));

  return {
    rules,
    jobs,
    fromDatabase: true,
    failedJobs24h: failRes.error ? 0 : (failRes.count ?? 0),
  };
}
