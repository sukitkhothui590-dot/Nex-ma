"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Alert, Customer, ServiceSubscription, Website } from "@/types/models";
import { AdminRenewalsPanel } from "@/components/admin/group/admin-renewals-panel";
import { WebsiteLogo } from "@/components/ui/website-logo";
import { StatusChip } from "@/components/ui/status-chip";
import { siteDisplayHostname } from "@/lib/utils/website-urls";
import type { MonitorProbeItem } from "@/lib/monitor/types";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { MonitorProbeDetailPanel, MonitorProbeMockHint } from "@/components/admin/group/monitor-probe-detail-panel";

const severityLabel = (s: Alert["severity"]) =>
  ({ high: "สูง", medium: "กลาง", low: "ต่ำ" } as const)[s];

const severityTone = (s: Alert["severity"]) => {
  if (s === "high") return "danger" as const;
  if (s === "medium") return "warning" as const;
  return "neutral" as const;
};

const severityDot = (s: Alert["severity"]) => {
  if (s === "high") return "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.55)]";
  if (s === "medium") return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]";
  return "bg-slate-400";
};

/** ค่า latency จำลองคงที่ต่อ id — ใช้เมื่อไม่ได้เชื่อมฐานข้อมูลหรือก่อนผล probe กลับมา */
const mockLatencyMs = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h + id.charCodeAt(i) * (i + 3)) % 420;
  }
  return 48 + h;
};

const latencyBarClass = (ms: number, online: boolean) => {
  if (!online) return "bg-slate-200";
  if (ms > 280) return "bg-amber-500";
  if (ms > 180) return "bg-amber-400/90";
  return "bg-emerald-500";
};

const latencyBarWidth = (ms: number, online: boolean) => {
  if (!online) return 8;
  return Math.min(100, Math.max(18, 100 - ms / 6));
};

type SiteFilter = "all" | "offline" | "incident";

type ProbeBatchMeta = {
  checkedAt?: string;
  userAgent?: string;
  probeFlow?: string;
};

/** ตรวจสอบสถานะซ้ำอัตโนมัติเมื่อเปิดหน้ามอนิเตอร์ (เรียลไทม์ร่วมกับ Supabase Realtime) */
const MONITOR_POLL_MS = 45_000;

export const AdminMonitorView = ({
  websites,
  alerts,
  subscriptions,
  customers,
  fromDatabase = false,
}: {
  websites: Website[];
  alerts: Alert[];
  subscriptions: ServiceSubscription[];
  customers: Customer[];
  fromDatabase?: boolean;
}) => {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [siteFilter, setSiteFilter] = useState<SiteFilter>("all");
  const [probeById, setProbeById] = useState<Map<string, MonitorProbeItem>>(() => new Map());
  const [probeMeta, setProbeMeta] = useState<ProbeBatchMeta | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const runProbe = useCallback(async () => {
    if (!fromDatabase) return;
    setProbeLoading(true);
    setProbeError(null);
    try {
      const r = await fetch("/api/monitor/probe", { credentials: "include" });
      const data = (await r.json()) as {
        ok?: boolean;
        message?: string;
        probes?: MonitorProbeItem[];
        checkedAt?: string;
        userAgent?: string;
        probeFlow?: string;
      };
      if (!r.ok || !data.ok) {
        setProbeError(typeof data.message === "string" ? data.message : "ตรวจสอบล้มเหลว");
        return;
      }
      const m = new Map<string, MonitorProbeItem>();
      for (const p of data.probes ?? []) {
        m.set(p.id, p);
      }
      setProbeById(m);
      setProbeMeta({
        checkedAt: data.checkedAt,
        userAgent: data.userAgent,
        probeFlow: data.probeFlow,
      });
      routerRef.current.refresh();
    } catch {
      setProbeError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setProbeLoading(false);
    }
  }, [fromDatabase]);

  useEffect(() => {
    if (!fromDatabase) return;
    void runProbe();
  }, [fromDatabase, runProbe]);

  useEffect(() => {
    if (!fromDatabase) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void runProbe();
    };
    const id = window.setInterval(tick, MONITOR_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fromDatabase, runProbe]);

  const siteById = useMemo(() => new Map(websites.map((w) => [w.id, w])), [websites]);

  const openAlertIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) {
      if (a.status === "new" || a.status === "acknowledged") set.add(a.websiteId);
    }
    return set;
  }, [alerts]);

  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [alerts],
  );

  const stats = useMemo(() => {
    const online = websites.filter((w) => {
      const live = probeById.get(w.id);
      return live !== undefined ? live.online : w.status === "online";
    }).length;
    const offline = websites.length - online;
    const newAlerts = alerts.filter((a) => a.status === "new").length;
    const highOpen = alerts.filter((a) => a.status !== "resolved" && a.severity === "high").length;
    const pct = websites.length ? Math.round((online / websites.length) * 1000) / 10 : 0;
    return { online, offline, newAlerts, highOpen, pct };
  }, [websites, alerts, probeById]);

  const sortedSites = useMemo(() => {
    const list = [...websites];
    const onlineOf = (w: Website) => {
      const live = probeById.get(w.id);
      return live !== undefined ? live.online : w.status === "online";
    };
    const score = (w: Website) => {
      let s = 0;
      if (!onlineOf(w)) s += 100;
      if (openAlertIds.has(w.id)) s += 50;
      return s;
    };
    list.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, "th"));
    if (siteFilter === "offline") return list.filter((w) => !onlineOf(w));
    if (siteFilter === "incident") return list.filter((w) => openAlertIds.has(w.id));
    return list;
  }, [websites, siteFilter, openAlertIds, probeById]);

  const healthWidth = stats.pct;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Monitor"
        title="มอนิเตอร์"
        subtitle={
          fromDatabase
            ? "เบราว์เซอร์เรียก API ตรวจ HTTP จริง (HEAD/GET) ไปยัง URL หลักของแต่ละเว็บ — แต่ละการ์ดขยายดูว่าส่งอะไร ไปที่ไหน ได้รหัส HTTP อะไร · บันทึกลงฐานข้อมูล · อัปเดตทุก ~45 วินาที + Realtime"
            : "โหมดจำลอง — สถานะและ latency จากข้อมูลตัวอย่าง (ไม่มีรายละเอียดคำขอจริง)"
        }
        crumbs={[{ href: "/admin/dashboard", label: "Admin" }, { label: "Monitor" }]}
        actions={
          <>
            {fromDatabase ? (
              <button
                type="button"
                onClick={() => void runProbe()}
                disabled={probeLoading}
                className="interactive-soft inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                {probeLoading ? "กำลังตรวจ…" : "รีเฟรชสถานะ"}
              </button>
            ) : null}
            <Link
              href="/admin/alerts"
              className="interactive-soft inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              แจ้งเตือน
            </Link>
            <Link
              href="/admin/websites"
              className="interactive-soft inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              จัดการเว็บ
            </Link>
          </>
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:min-w-[300px]">
          <span className="shrink-0 text-xs font-medium text-slate-600">อัตราเว็บออนไลน์</span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 ease-out" style={{ width: `${healthWidth}%` }} />
          </div>
          <span className="w-14 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-slate-700">{healthWidth}%</span>
        </div>
      </PageHeader>

      {probeError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{probeError}</div>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="เว็บทั้งหมด" value={websites.length} />
        <StatCard label="ออนไลน์" value={stats.online} tone="primary" />
        <StatCard label="ออฟไลน์" value={stats.offline} tone="danger" />
        <StatCard label="แจ้งเตือนใหม่ / สูง" value={`${stats.newAlerts} / ${stats.highOpen}`} tone="warning" />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_min(100%,420px)] xl:items-start">
        {/* Sites */}
        <div className="min-w-0 space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">สถานะตามเว็บ</h2>
              {fromDatabase && probeMeta?.checkedAt ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  รอบตรวจล่าสุดจากเซิร์ฟเวอร์:{" "}
                  <span className="font-mono tabular-nums text-slate-600">
                    {new Date(probeMeta.checkedAt).toLocaleString("th-TH", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 p-1.5">
              {(
                [
                  { id: "all" as const, label: "ทั้งหมด" },
                  { id: "offline" as const, label: "ออฟไลน์" },
                  { id: "incident" as const, label: "มีเหตุเปิด" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSiteFilter(f.id)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    siteFilter === f.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {sortedSites.map((w) => {
              const live = probeById.get(w.id);
              const online = live !== undefined ? live.online : w.status === "online";
              const msForBar = live !== undefined ? live.latencyMs : mockLatencyMs(w.id);
              const barW = latencyBarWidth(msForBar, online);
              const hasOpen = openAlertIds.has(w.id);
              const latencyLabel =
                fromDatabase && probeLoading && live === undefined
                  ? "กำลังตรวจ…"
                  : online
                    ? `${live !== undefined ? live.latencyMs : mockLatencyMs(w.id)} ms`
                    : "—";
              return (
                <div
                  key={w.id}
                  className={`group relative overflow-hidden rounded-2xl border p-3 shadow-sm transition ${
                    !online
                      ? "border-rose-200/90 bg-gradient-to-br from-rose-50/50 to-white ring-1 ring-rose-100/80"
                      : hasOpen
                        ? "border-amber-200/90 bg-gradient-to-br from-amber-50/40 to-white"
                        : "border-slate-200/80 bg-white hover:border-slate-300/90"
                  }`}
                >
                  <div
                    className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl ${
                      !online ? "bg-rose-500" : hasOpen ? "bg-amber-400" : "bg-indigo-500"
                    }`}
                    aria-hidden
                  />
                  <div className="flex gap-2.5 pl-2">
                    <WebsiteLogo
                      instanceId={w.id}
                      frontendUrl={w.frontendUrl}
                      backendUrl={w.backendUrl}
                      logoUrl={w.logoUrl}
                      name={w.name}
                      className="shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="truncate text-sm font-semibold leading-tight text-slate-900">{w.name}</p>
                        <span
                          className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                            online ? "bg-indigo-500" : "bg-rose-500 dash-soft-blink"
                          }`}
                          title={online ? "ออนไลน์" : "ออฟไลน์"}
                        />
                      </div>
                      <p className="truncate font-mono text-[11px] text-slate-500">{siteDisplayHostname(w) || "—"}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${latencyBarClass(msForBar, online)}`}
                            style={{ width: `${barW}%` }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500">{latencyLabel}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <StatusChip label={online ? "ออนไลน์" : "ออฟไลน์"} tone={online ? "success" : "danger"} />
                        {hasOpen ? <StatusChip label="มีเหตุ" tone="warning" /> : null}
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {w.hostingType}
                        </span>
                      </div>

                      {fromDatabase ? (
                        <MonitorProbeDetailPanel
                          websiteName={w.name}
                          live={live}
                          probeMeta={probeMeta}
                          probeLoading={probeLoading}
                        />
                      ) : (
                        <MonitorProbeMockHint />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alert timeline */}
        <aside className="min-w-0 space-y-3 xl:sticky xl:top-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">ไทม์ไลน์เหตุ</h2>
              <p className="text-xs text-slate-500">เรียงใหม่สุดก่อน · สูงสุด 12 รายการ</p>
            </div>
            <div className="scrollbar-none max-h-[min(70vh,640px)] overflow-y-auto px-2 py-3">
              <ul className="space-y-0">
                {sortedAlerts.slice(0, 12).map((a, i, arr) => {
                  const site = siteById.get(a.websiteId);
                  const t = new Date(a.createdAt).toLocaleString("th-TH", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const last = i === arr.length - 1;
                  return (
                    <li key={a.id} className="flex gap-0">
                      <div className="flex w-8 shrink-0 flex-col items-center pt-1">
                        <span className={`z-10 h-3 w-3 rounded-full ${severityDot(a.severity)}`} />
                        {!last ? <span className="mt-0.5 w-px flex-1 min-h-[1.5rem] grow bg-slate-200" aria-hidden /> : null}
                      </div>
                      <div className={`min-w-0 flex-1 pb-4 pl-1 ${last ? "" : ""}`}>
                        <p className="text-sm font-medium leading-snug text-slate-900">{a.message}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{site?.name ?? a.websiteId}</span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="font-mono tabular-nums">{t}</span>
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <StatusChip label={severityLabel(a.severity)} tone={severityTone(a.severity)} />
                          <StatusChip
                            label={a.status === "new" ? "ใหม่" : a.status === "acknowledged" ? "รับทราบ" : "ปิด"}
                            tone={a.status === "new" ? "warning" : "neutral"}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <p className="px-1 text-center text-[11px] leading-relaxed text-slate-400">
            {fromDatabase
              ? "เรียลไทม์: การ์ดแสดงผลล่าสุดจาก API · ฐานข้อมูลอัปเดตเมื่อ probe สำเร็จ · แท็บอื่น/ผู้ใช้อื่นเห็นผ่าน Supabase Realtime"
              : "Latency เป็นค่าจำลองจากรหัสเว็บ"}
          </p>
        </aside>
      </div>

      <AdminRenewalsPanel subscriptions={subscriptions} customers={customers} websites={websites} />
    </div>
  );
};
