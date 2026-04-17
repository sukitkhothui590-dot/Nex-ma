"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AdminAuditPageData, AuditLogRowDTO } from "@/lib/data/fetch-admin-audit-page";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";

const SEVERITIES = ["all", "debug", "info", "notice", "warning", "error", "critical"] as const;
const CATEGORIES = ["all", "integration", "alert", "automation", "monitor", "website", "customer", "system"] as const;

function severityBadgeClass(s: string): string {
  switch (s) {
    case "debug":
      return "bg-slate-100 text-slate-800 ring-slate-200";
    case "info":
      return "bg-sky-100 text-sky-900 ring-sky-200";
    case "notice":
      return "bg-indigo-100 text-indigo-900 ring-indigo-200";
    case "warning":
      return "bg-amber-100 text-amber-950 ring-amber-200";
    case "error":
      return "bg-rose-100 text-rose-900 ring-rose-200";
    case "critical":
      return "bg-red-600 text-white ring-red-700";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function formatMeta(meta: Record<string, unknown> | null): string {
  if (!meta || Object.keys(meta).length === 0) return "—";
  try {
    return JSON.stringify(meta, null, 0).slice(0, 280);
  } catch {
    return "—";
  }
}

export const AdminAuditView = ({
  rows: initialRows,
  fromDatabase,
  missingTable,
  initialSeverity,
  initialCategory,
}: AdminAuditPageData & {
  initialSeverity: string;
  initialCategory: string;
}) => {
  const router = useRouter();
  const [severity, setSeverity] = useState(initialSeverity);
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    setSeverity(initialSeverity);
    setCategory(initialCategory);
  }, [initialSeverity, initialCategory]);

  const filtered = useMemo(() => {
    return initialRows.filter((r) => {
      if (severity !== "all" && r.severity !== severity) return false;
      if (category !== "all" && r.category !== category) return false;
      return true;
    });
  }, [initialRows, severity, category]);

  const syncUrl = (nextSev: string, nextCat: string) => {
    const p = new URLSearchParams();
    if (nextSev !== "all") p.set("severity", nextSev);
    if (nextCat !== "all") p.set("category", nextCat);
    const q = p.toString();
    router.replace(q ? `/admin/audit?${q}` : "/admin/audit", { scroll: false });
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Audit"
        title="Audit log"
        subtitle="บันทึกการกระทำตามระดับ (severity) และหมวด (category) — รายการล่าสุดก่อน"
        crumbs={[{ href: "/admin/dashboard", label: "Admin" }, { label: "Audit log" }]}
      />

      {!fromDatabase ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          ยังไม่ได้เชื่อมฐานข้อมูล — ไม่มี audit log
        </div>
      ) : null}

      {fromDatabase && missingTable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          <p className="font-semibold">ยังไม่มีตาราง audit_log</p>
          <p className="mt-1">
            รัน migration ไฟล์{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">20260221160000_audit_log.sql</code> แล้วรีเฟรช
          </p>
        </div>
      ) : null}

      {fromDatabase && !missingTable ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">ระดับ</span>
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSeverity(s);
                  syncUrl(s, category);
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 transition",
                  severity === s ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {s === "all" ? "ทั้งหมด" : s}
              </button>
            ))}
          </div>
          <span className="ml-2 text-xs font-semibold text-slate-500">หมวด</span>
          <select
            value={category}
            onChange={(e) => {
              const v = e.target.value;
              setCategory(v);
              syncUrl(severity, v);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "ทั้งหมด" : c}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">
            แสดง {filtered.length} / {initialRows.length}
          </span>
        </div>
      ) : null}

      {fromDatabase && !missingTable ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="min-w-0 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">เวลา</th>
                <th className="px-3 py-2.5">ระดับ</th>
                <th className="px-3 py-2.5">หมวด</th>
                <th className="px-3 py-2.5">การกระทำ</th>
                <th className="px-3 py-2.5">เป้าหมาย</th>
                <th className="px-3 py-2.5">รายละเอียด</th>
                <th className="px-3 py-2.5">meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    ไม่มีรายการตามตัวกรอง
                  </td>
                </tr>
              ) : (
                filtered.map((row) => <AuditRow key={row.id} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-slate-500">
        {fromDatabase && !missingTable
          ? "ความลับ (เช่น webhook token) ไม่ถูกบันทึกใน audit — มีแค่เหตุการณ์ว่าเปลี่ยน/ล้างค่า"
          : null}
      </p>
    </div>
  );
};

function AuditRow({ row }: { row: AuditLogRowDTO }) {
  const t = new Date(row.createdAt).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const target =
    row.targetType || row.targetId ? [row.targetType, row.targetId].filter(Boolean).join(" · ") : "—";

  return (
    <tr className="align-top hover:bg-slate-50/80">
      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600">{t}</td>
      <td className="px-3 py-2">
        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ring-1", severityBadgeClass(row.severity))}>
          {row.severity}
        </span>
      </td>
      <td className="px-3 py-2 text-xs font-medium text-slate-700">{row.category}</td>
      <td className="max-w-[180px] px-3 py-2 font-mono text-xs text-slate-900">{row.action}</td>
      <td className="max-w-[180px] break-all px-3 py-2 font-mono text-[11px] text-slate-600">{target}</td>
      <td className="max-w-md px-3 py-2 text-xs leading-snug text-slate-700">{row.detail ?? "—"}</td>
      <td className="max-w-[180px] px-3 py-2 font-mono text-[10px] text-slate-500">{formatMeta(row.meta)}</td>
    </tr>
  );
}
