"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Customer, ServiceSubscription, Website } from "@/types/models";
import { getDaysUntil, getExpiryTone } from "@/lib/utils/date";
import { mergeSubscriptionsWithWebsiteExpiries } from "@/lib/utils/renewals";
import { StatusChip } from "@/components/ui/status-chip";
import { WebsiteLogo } from "@/components/ui/website-logo";
import { StatCard } from "@/components/layout/stat-card";

const serviceLabel: Record<ServiceSubscription["serviceType"], string> = {
  domain: "โดเมน",
  hosting: "โฮสติ้ง",
  cloud: "คลาวด์",
  ma: "MA / ดูแล",
};

type WindowKey = "all" | "30" | "60" | "90";

const customerInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "—";

export const AdminRenewalsPanel = ({
  subscriptions,
  customers,
  websites,
}: {
  subscriptions: ServiceSubscription[];
  customers: Customer[];
  websites: Website[];
}) => {
  const [win, setWin] = useState<WindowKey>("all");

  const mergedSubscriptions = useMemo(
    () => mergeSubscriptionsWithWebsiteExpiries(subscriptions, websites),
    [subscriptions, websites],
  );

  const siteByCustomer = useMemo(() => {
    const m = new Map<string, Website>();
    const sorted = [...websites].sort((a, b) => a.id.localeCompare(b.id));
    for (const w of sorted) {
      if (!m.has(w.customerId)) m.set(w.customerId, w);
    }
    return m;
  }, [websites]);

  const rows = useMemo(() => {
    const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
    const enriched = mergedSubscriptions.map((s) => ({
      ...s,
      customerName: customerName(s.customerId),
      days: getDaysUntil(s.expiryDate),
    }));
    const sorted = [...enriched].sort((a, b) => a.days - b.days);
    if (win === "all") return sorted;
    const max = win === "30" ? 30 : win === "60" ? 60 : 90;
    return sorted.filter((r) => r.days >= 0 && r.days <= max);
  }, [mergedSubscriptions, customers, win]);

  const stats = useMemo(() => {
    const urgent = mergedSubscriptions.filter((s) => {
      const d = getDaysUntil(s.expiryDate);
      return d >= 0 && d <= 30;
    }).length;
    const overdue = mergedSubscriptions.filter((s) => getDaysUntil(s.expiryDate) < 0).length;
    const byType = (t: ServiceSubscription["serviceType"]) => mergedSubscriptions.filter((s) => s.serviceType === t).length;
    return {
      urgent,
      overdue,
      total: mergedSubscriptions.length,
      domain: byType("domain"),
      hosting: byType("hosting"),
      cloud: byType("cloud"),
      ma: byType("ma"),
    };
  }, [mergedSubscriptions]);

  const formatTh = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return iso;
    }
  };

  return (
    <section id="renewals" aria-labelledby="renewals-heading" className="space-y-6 border-t border-slate-200 pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="renewals-heading" className="text-base font-semibold text-slate-900">
            ต่ออายุบริการ
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            โดเมน โฮสติ้ง คลาวด์ MA และวันหมดอายุที่กำหนดต่อเว็บในหน้าเว็บไซต์
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/admin/customers"
            className="interactive-soft inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            ลูกค้า
          </Link>
          <Link
            href="/admin/websites"
            className="interactive-soft inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            เว็บไซต์
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">มุมมองตามวัน</p>
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 p-1">
          {(
            [
              { id: "all" as const, label: "ทั้งหมด" },
              { id: "30" as const, label: "≤ 30 วัน" },
              { id: "60" as const, label: "≤ 60 วัน" },
              { id: "90" as const, label: "≤ 90 วัน" },
            ] as const
          ).map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWin(w.id)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                win === w.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="เกินกำหนด" value={stats.overdue} tone="danger" />
        <StatCard label="≤ 30 วัน" value={stats.urgent} tone="warning" />
        <StatCard label="แสดงในตาราง" value={rows.length} />
        <StatCard label="ลูกค้า" value={customers.length} tone="primary" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_min(100%,300px)] xl:items-start">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">รายการบริการ</h3>
            <p className="text-xs text-slate-500">แถวจากเว็บไซต์ใช้โลโก้ของเว็บนั้น — แถวอื่นใช้เว็บแรกของลูกค้า</p>
          </div>
          <div className="scrollbar-none overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">ลูกค้า</th>
                  <th className="hidden px-4 py-3 sm:table-cell">บริการ</th>
                  <th className="px-4 py-3">หมดอายุ</th>
                  <th className="hidden px-4 py-3 md:table-cell">เหลือ</th>
                  <th className="px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                      ไม่มีรายการในช่วงที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const tone = getExpiryTone(r.expiryDate);
                    const chipTone = tone === "danger" ? "danger" : tone === "warning" ? "warning" : "success";
                    const label = r.days < 0 ? "หมดแล้ว" : r.days === 0 ? "วันนี้" : `${r.days} วัน`;
                    const site = r.websiteId
                      ? websites.find((w) => w.id === r.websiteId) ?? siteByCustomer.get(r.customerId)
                      : siteByCustomer.get(r.customerId);
                    const stripe =
                      r.days < 0 ? "bg-rose-500" : r.days <= 14 ? "bg-amber-400" : r.days <= 30 ? "bg-amber-300" : "bg-indigo-500";
                    return (
                      <tr key={r.id} className="transition hover:bg-slate-50/80">
                        <td className="relative px-4 py-3">
                          <span className={`absolute bottom-2 left-0 top-2 w-1 rounded-r-full ${stripe}`} aria-hidden />
                          <div className="flex items-center gap-3 pl-2">
                            {site ? (
                              <WebsiteLogo
                                instanceId={r.id}
                                name={site.name}
                                frontendUrl={site.frontendUrl}
                                backendUrl={site.backendUrl}
                                logoUrl={site.logoUrl}
                                className="shadow-sm"
                              />
                            ) : (
                              <span
                                className="inline-flex h-10 w-10 shrink-0 self-start items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-[11px] font-bold text-slate-600"
                                aria-hidden
                              >
                                {customerInitials(r.customerName)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">{r.customerName}</p>
                              {r.websiteId ? (
                                <p className="mt-0.5 truncate text-xs text-slate-500">{websites.find((w) => w.id === r.websiteId)?.name}</p>
                              ) : null}
                              <p className="mt-0.5 text-xs text-slate-500 sm:hidden">{serviceLabel[r.serviceType]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-slate-700 sm:table-cell">
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium">{serviceLabel[r.serviceType]}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs tabular-nums text-slate-700">{formatTh(r.expiryDate)}</p>
                          <p className="mt-1 text-[11px] tabular-nums text-slate-400 md:hidden">{label}</p>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${
                                  r.days < 0 ? "bg-rose-500" : r.days <= 14 ? "bg-amber-500" : "bg-indigo-500"
                                }`}
                                style={{ width: `${Math.min(100, r.days < 0 ? 100 : (r.days / 90) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-slate-600">{label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip
                            label={r.days < 0 ? "เกินกำหนด" : r.days <= 30 ? "เร่งด่วน" : "ปกติ"}
                            tone={chipTone === "danger" ? "danger" : chipTone === "warning" ? "warning" : "success"}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="min-w-0 space-y-3 xl:sticky xl:top-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">สรุปตามประเภท</h3>
            <p className="mt-1 text-xs text-slate-500">ทุกรายการในระบบจำลอง</p>
            <ul className="mt-4 space-y-3">
              {(
                [
                  { k: "domain" as const, label: "โดเมน", n: stats.domain, c: "bg-sky-500" },
                  { k: "hosting", label: "โฮสติ้ง", n: stats.hosting, c: "bg-violet-500" },
                  { k: "cloud", label: "คลาวด์", n: stats.cloud, c: "bg-cyan-500" },
                  { k: "ma", label: "MA / ดูแล", n: stats.ma, c: "bg-indigo-500" },
                ] as const
              ).map((x) => (
                <li key={x.k} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${x.c}`} aria-hidden />
                  <span className="flex-1 text-sm text-slate-700">{x.label}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">{x.n}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="px-1 text-center text-[11px] leading-relaxed text-slate-400">
            วันที่คำนวณจากเครื่องผู้ใช้ — เชื่อม backend แล้วจะใช้ timezone องค์กร
          </p>
        </aside>
      </div>
    </section>
  );
};
