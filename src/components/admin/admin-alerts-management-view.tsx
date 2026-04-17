"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Alert, Customer, Website } from "@/types/models";
import { updateAlertStatusAction } from "@/app/admin/alerts/actions";
import { ADMIN_ALERTS_CHANGED_EVENT } from "@/lib/admin-events";
import { WebsiteLogo } from "@/components/ui/website-logo";
import { StatusChip } from "@/components/ui/status-chip";
import { Modal } from "@/components/ui/modal";
import { TableScrollRegion } from "@/components/ui/table-scroll-region";

export interface AdminAlertsManagementViewProps {
  alerts: Alert[];
  websites: Website[];
  customers: Customer[];
  /** true = ข้อมูลจาก Supabase, รับทราบ/ปิดเรื่องบันทึกลง DB */
  fromDatabase?: boolean;
  initialSearch?: string;
  /** กรองตามเว็บ — จาก query ?websiteId= */
  initialWebsiteId?: string;
}

const pageSize = 10;

const severityLabel = (s: Alert["severity"]) =>
  s === "high" ? "สูง" : s === "medium" ? "ปานกลาง" : "ต่ำ";

const alertStatusLabel = (s: Alert["status"]) =>
  s === "new" ? "ใหม่" : s === "acknowledged" ? "รับทราบ" : "ปิดแล้ว";

const severityTone = (s: Alert["severity"]): "danger" | "warning" | "neutral" =>
  s === "high" ? "danger" : s === "medium" ? "warning" : "neutral";

const statusTone = (s: Alert["status"]): "success" | "danger" | "warning" =>
  s === "resolved" ? "success" : s === "new" ? "danger" : "warning";

const formatThDateTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const escapeCsv = (value: string) => {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

const dispatchAlertsChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_ALERTS_CHANGED_EVENT));
  }
};

export const AdminAlertsManagementView = ({
  alerts: initialAlerts,
  websites,
  customers,
  fromDatabase = false,
  initialSearch = "",
  initialWebsiteId = "",
}: AdminAlertsManagementViewProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const [query, setQuery] = useState(initialSearch);
  const [websiteFilter, setWebsiteFilter] = useState<"all" | string>(initialWebsiteId || "all");
  const [severityFilter, setSeverityFilter] = useState<"all" | Alert["severity"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Alert["status"]>("all");
  const [page, setPage] = useState(1);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Alert["status"]>>({});
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setWebsiteFilter(initialWebsiteId || "all");
  }, [initialWebsiteId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const curQ = searchParams.get("q") ?? "";
      const nextQ = query.trim();
      if (curQ === nextQ) return;
      const p = new URLSearchParams(searchParamsString);
      if (nextQ) p.set("q", nextQ);
      else p.delete("q");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 450);
    return () => window.clearTimeout(t);
  }, [query, pathname, router, searchParams, searchParamsString]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!actionMenuId) return;
      const t = e.target as HTMLElement;
      if (t.closest("[data-alert-menu]") || t.closest("[data-alert-menu-trigger]")) return;
      setActionMenuId(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [actionMenuId]);

  const websiteById = useCallback(
    (id: string) => websites.find((w) => w.id === id),
    [websites],
  );

  const customerName = useCallback(
    (customerId: string) => customers.find((c) => c.id === customerId)?.name ?? "—",
    [customers],
  );

  const mergedAlerts = useMemo(
    () =>
      fromDatabase
        ? initialAlerts
        : initialAlerts.map((a) => ({ ...a, status: statusOverrides[a.id] ?? a.status })),
    [fromDatabase, initialAlerts, statusOverrides],
  );

  const summary = useMemo(() => {
    const total = mergedAlerts.length;
    const fresh = mergedAlerts.filter((a) => a.status === "new").length;
    const open = mergedAlerts.filter((a) => a.status !== "resolved").length;
    return { total, fresh, open };
  }, [mergedAlerts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mergedAlerts.filter((a) => {
      if (websiteFilter !== "all" && a.websiteId !== websiteFilter) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      const w = websiteById(a.websiteId);
      const wname = w?.name.toLowerCase() ?? "";
      const cust = w ? customerName(w.customerId).toLowerCase() : "";
      return a.message.toLowerCase().includes(q) || wname.includes(q) || cust.includes(q) || a.id.toLowerCase().includes(q);
    });
  }, [mergedAlerts, query, websiteFilter, severityFilter, statusFilter, websiteById, customerName]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const startItem = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, filtered.length);

  const emptyTableHint = useMemo(() => {
    if (mergedAlerts.length > 0 && filtered.length === 0) {
      return "ไม่พบตามตัวกรองหรือคำค้น — ลองล้างตัวกรองหรือเปลี่ยนคำค้น";
    }
    if (fromDatabase && mergedAlerts.length === 0) {
      if (websites.length === 0) {
        return "ยังไม่มีเว็บไซต์ในระบบ — เพิ่มเว็บไซต์ก่อน แล้วค่อยเพิ่มแถวใน public.alerts (ผูก website_id)";
      }
      return "ยังไม่มีแจ้งเตือน — เมื่อมอนิเตอร์พบเว็บหลุดออนไลน์หรือมีการบันทึกเหตุ รายการจะปรากฏที่นี่ (หรือเพิ่มด้วยตนเองใน Supabase)";
    }
    return "ไม่พบแจ้งเตือนตามเงื่อนไข";
  }, [mergedAlerts.length, filtered.length, fromDatabase, websites.length]);

  const acknowledge = async (id: string) => {
    setActionMenuId(null);
    if (!fromDatabase) {
      setStatusOverrides((prev) => ({ ...prev, [id]: "acknowledged" }));
      return;
    }
    setActionError(null);
    setPendingId(id);
    const res = await updateAlertStatusAction({ id, status: "acknowledged" });
    setPendingId(null);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    dispatchAlertsChanged();
    router.refresh();
  };

  const resolveAlert = async (id: string) => {
    setActionMenuId(null);
    if (!fromDatabase) {
      setStatusOverrides((prev) => ({ ...prev, [id]: "resolved" }));
      return;
    }
    setActionError(null);
    setPendingId(id);
    const res = await updateAlertStatusAction({ id, status: "resolved" });
    setPendingId(null);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    dispatchAlertsChanged();
    router.refresh();
  };

  const exportCsv = () => {
    const headers = ["รหัส", "เว็บไซต์", "ลูกค้า", "ข้อความ", "ความรุนแรง", "สถานะ", "เวลา"];
    const lines = [
      headers.join(","),
      ...filtered.map((a) => {
        const w = websiteById(a.websiteId);
        return [
          escapeCsv(a.id),
          escapeCsv(w?.name ?? "—"),
          escapeCsv(w ? customerName(w.customerId) : "—"),
          escapeCsv(a.message),
          escapeCsv(severityLabel(a.severity)),
          escapeCsv(alertStatusLabel(a.status)),
          escapeCsv(formatThDateTime(a.createdAt)),
        ].join(",");
      }),
    ];
    const blob = new Blob(["\ufeff", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setWebsiteFilter("all");
    setSeverityFilter("all");
    setStatusFilter("all");
    setPage(1);
    const p = new URLSearchParams(searchParamsString);
    p.delete("websiteId");
    p.delete("q");
    setQuery("");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">แจ้งเตือน</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fromDatabase
              ? "ติดตามจากฐานข้อมูล — รับทราบและปิดเรื่องบันทึกลงระบบ"
              : "ติดตามเหตุจากเว็บไซต์ — ข้อมูลจำลอง (เปลี่ยนสถานะได้เฉพาะในเบราว์เซอร์)"}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-row flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap lg:justify-end">
          <div className="relative min-w-0 flex-1 basis-[200px] lg:flex-initial lg:basis-auto">
            <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหาข้อความ เว็บไซต์ หรือลูกค้า…"
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-indigo-500 focus:ring-2 lg:w-72"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            ส่งออก CSV
          </button>
        </div>
      </div>

      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{actionError}</div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <select
          value={websiteFilter}
          onChange={(e) => {
            const v = e.target.value;
            setWebsiteFilter(v);
            setPage(1);
            const p = new URLSearchParams(searchParamsString);
            if (v === "all") p.delete("websiteId");
            else p.set("websiteId", v);
            const qs = p.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
          }}
          className="h-10 min-w-0 max-w-full shrink rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2 sm:max-w-[260px]"
          aria-label="กรองตามเว็บไซต์"
        >
          <option value="all">เว็บไซต์ทั้งหมด</option>
          {websites.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value as typeof severityFilter);
            setPage(1);
          }}
          className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2 min-w-[160px]"
          aria-label="กรองความรุนแรง"
        >
          <option value="all">ความรุนแรงทั้งหมด</option>
          <option value="high">สูง</option>
          <option value="medium">ปานกลาง</option>
          <option value="low">ต่ำ</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2 min-w-[180px]"
          aria-label="กรองสถานะแจ้งเตือน"
        >
          <option value="all">สถานะทั้งหมด</option>
          <option value="new">ใหม่</option>
          <option value="acknowledged">รับทราบ</option>
          <option value="resolved">ปิดแล้ว</option>
        </select>
        <button
          type="button"
          onClick={resetFilters}
          className="h-10 shrink-0 rounded-xl border border-dashed border-slate-300 px-3 text-sm text-slate-600 hover:bg-white"
        >
          ล้างตัวกรอง
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-slate-500">แจ้งเตือนทั้งหมด</p>
            <p className="text-lg font-semibold text-slate-900">{summary.total} รายการ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-slate-500">สถานะใหม่</p>
            <p className="text-lg font-semibold text-slate-900">{summary.fresh} รายการ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-slate-500">ยังไม่ปิดเรื่อง</p>
            <p className="text-lg font-semibold text-slate-900">{summary.open} รายการ</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="hidden md:block">
          <TableScrollRegion>
            <table className="min-w-[920px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold text-slate-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">ลำดับ</th>
                <th className="whitespace-nowrap px-4 py-3">เว็บไซต์</th>
                <th className="min-w-[200px] px-4 py-3">ข้อความ</th>
                <th className="whitespace-nowrap px-4 py-3">ความรุนแรง</th>
                <th className="whitespace-nowrap px-4 py-3">สถานะ</th>
                <th className="whitespace-nowrap px-4 py-3">เวลา</th>
                <th className="whitespace-nowrap px-4 py-3">ดำเนินการ</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    {emptyTableHint}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const w = websiteById(row.websiteId);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-600">{(page - 1) * pageSize + index + 1}</td>
                      <td className="px-4 py-3">
                        {w ? (
                          <div className="flex items-center gap-2">
                            <WebsiteLogo
                              instanceId={row.id}
                              name={w.name}
                              frontendUrl={w.frontendUrl}
                              backendUrl={w.backendUrl}
                              logoUrl={w.logoUrl}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">{w.name}</p>
                              <Link
                                href={`/admin/websites?q=${encodeURIComponent(w.name)}`}
                                className="text-xs font-semibold text-indigo-700 hover:underline"
                              >
                                ดูเว็บไซต์
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-800">{row.message}</td>
                      <td className="px-4 py-3">
                        <StatusChip label={severityLabel(row.severity)} tone={severityTone(row.severity)} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip label={alertStatusLabel(row.status)} tone={statusTone(row.status)} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatThDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {row.status === "new" ? (
                            <button
                              type="button"
                              disabled={pendingId === row.id}
                              onClick={() => void acknowledge(row.id)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                              รับทราบ
                            </button>
                          ) : null}
                          {row.status !== "resolved" ? (
                            <button
                              type="button"
                              disabled={pendingId === row.id}
                              onClick={() => void resolveAlert(row.id)}
                              className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              ปิดเรื่อง
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="relative px-2 py-3 text-center">
                        <button
                          type="button"
                          data-alert-menu-trigger
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="เมนู"
                          aria-expanded={actionMenuId === row.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuId((id) => (id === row.id ? null : row.id));
                          }}
                        >
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {actionMenuId === row.id ? (
                          <div
                            data-alert-menu
                            className="absolute right-2 top-full z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setDetailAlert(row);
                                setActionMenuId(null);
                              }}
                            >
                              ดูรายละเอียด
                            </button>
                            {row.status === "new" ? (
                              <button
                                type="button"
                                disabled={pendingId === row.id}
                                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => void acknowledge(row.id)}
                              >
                                รับทราบ
                              </button>
                            ) : null}
                            {row.status !== "resolved" ? (
                              <button
                                type="button"
                                disabled={pendingId === row.id}
                                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => void resolveAlert(row.id)}
                              >
                                ปิดเรื่อง
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </TableScrollRegion>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">{emptyTableHint}</p>
          ) : (
            rows.map((row) => {
              const w = websiteById(row.websiteId);
              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">เว็บไซต์</p>
                      {w ? (
                        <div className="mt-1 flex items-center gap-2">
                          <WebsiteLogo
                            instanceId={row.id}
                            name={w.name}
                            frontendUrl={w.frontendUrl}
                            backendUrl={w.backendUrl}
                            logoUrl={w.logoUrl}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{w.name}</p>
                            <Link
                              href={`/admin/websites?q=${encodeURIComponent(w.name)}`}
                              className="text-xs font-semibold text-indigo-700 hover:underline"
                            >
                              ดูเว็บไซต์
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-slate-400">—</p>
                      )}
                    </div>
                    <StatusChip label={severityLabel(row.severity)} tone={severityTone(row.severity)} />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-800">{row.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusChip label={alertStatusLabel(row.status)} tone={statusTone(row.status)} />
                    <span className="text-xs text-slate-500">{formatThDateTime(row.createdAt)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {row.status === "new" ? (
                      <button
                        type="button"
                        disabled={pendingId === row.id}
                        onClick={() => void acknowledge(row.id)}
                        className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
                      >
                        รับทราบ
                      </button>
                    ) : null}
                    {row.status !== "resolved" ? (
                      <button
                        type="button"
                        disabled={pendingId === row.id}
                        onClick={() => void resolveAlert(row.id)}
                        className="min-h-10 flex-1 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:flex-none"
                      >
                        ปิดเรื่อง
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDetailAlert(row)}
                      className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                    >
                      รายละเอียด
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            แสดง {startItem}-{endItem} จาก {filtered.length} รายการ
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      <Modal title="รายละเอียดแจ้งเตือน" open={!!detailAlert} onClose={() => setDetailAlert(null)}>
        {detailAlert && websiteById(detailAlert.websiteId) ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">รหัส</dt>
              <dd className="font-mono text-xs text-slate-800">{detailAlert.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">เว็บไซต์</dt>
              <dd className="text-right font-medium text-slate-900">{websiteById(detailAlert.websiteId)?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ลูกค้า</dt>
              <dd className="text-slate-800">
                {customerName(websiteById(detailAlert.websiteId)?.customerId ?? "")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">ข้อความ</dt>
              <dd className="mt-1 text-slate-900">{detailAlert.message}</dd>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <StatusChip label={severityLabel(detailAlert.severity)} tone={severityTone(detailAlert.severity)} />
              <StatusChip label={alertStatusLabel(detailAlert.status)} tone={statusTone(detailAlert.status)} />
            </div>
            <p className="text-xs text-slate-500">เวลา: {formatThDateTime(detailAlert.createdAt)}</p>
          </dl>
        ) : detailAlert ? (
          <p className="text-sm text-slate-600">ไม่พบข้อมูลเว็บไซต์ที่ผูกกับแจ้งเตือนนี้</p>
        ) : null}
      </Modal>
    </div>
  );
};
