"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { MonitorProbeItem } from "@/lib/monitor/types";
import { cn } from "@/lib/utils/cn";

type ProbeMeta = {
  checkedAt?: string;
  userAgent?: string;
  probeFlow?: string;
};

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniPulse({ online }: { online: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {online ? (
        <>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </>
      ) : (
        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
      )}
    </span>
  );
}

function FieldCard({
  label,
  children,
  accent = "slate",
}: {
  label: string;
  children: ReactNode;
  accent?: "indigo" | "emerald" | "rose" | "amber" | "slate";
}) {
  const bar =
    accent === "indigo"
      ? "from-indigo-500 to-violet-500"
      : accent === "emerald"
        ? "from-emerald-500 to-teal-500"
        : accent === "rose"
          ? "from-rose-500 to-orange-500"
          : accent === "amber"
            ? "from-amber-500 to-yellow-500"
            : "from-slate-400 to-slate-500";

  return (
    <div className="group/field relative overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/90 p-3 shadow-sm">
      <div className={cn("absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b opacity-90", bar)} aria-hidden />
      <p className="pl-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-1.5 pl-2 text-sm text-slate-900">{children}</div>
    </div>
  );
}

function CodeLine({ children, variant = "light" }: { children: ReactNode; variant?: "light" | "dark" }) {
  return (
    <div
      className={cn(
        "rounded-lg px-2.5 py-2 font-mono text-[11px] leading-relaxed break-all",
        variant === "dark"
          ? "border border-slate-700/80 bg-slate-900 text-emerald-300/95 shadow-inner"
          : "border border-slate-200/80 bg-slate-50 text-slate-800",
      )}
    >
      {children}
    </div>
  );
}

function MonitorProbeDetailBody({
  live,
  probeMeta,
  probeLoading,
}: {
  live: MonitorProbeItem | undefined;
  probeMeta: ProbeMeta | null;
  probeLoading: boolean;
}) {
  if (live) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-indigo-200/80 bg-indigo-50/30 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            <span className="rounded-md bg-white px-1.5 py-0.5 shadow-sm ring-1 ring-slate-200/80">เบราว์เซอร์</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <span className="rounded-md bg-indigo-100/80 px-1.5 py-0.5 text-indigo-900">API นี้</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <span className="truncate rounded-md bg-violet-100/80 px-1.5 py-0.5 text-violet-900">เว็บลูกค้า</span>
          </div>
          <p className="text-[9px] leading-snug text-slate-500 sm:max-w-[45%] sm:text-right">
            วัดเวลาที่เซิร์ฟเวอร์แอป — ไม่ใช่ในเครื่องคุณโดยตรง
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <FieldCard label="คำขอที่ส่งไปปลายทาง" accent="indigo">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {live.method}
                </span>
              </div>
              <CodeLine>{live.url || "—"}</CodeLine>
            </div>
          </FieldCard>

          <FieldCard label="ตอบกลับ" accent={live.online ? "emerald" : "rose"}>
            {live.error ? (
              <p className="text-sm font-medium text-rose-700">{live.error}</p>
            ) : live.statusCode != null ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-lg font-bold tabular-nums text-slate-900">HTTP {live.statusCode}</span>
                {!live.online ? <span className="text-[11px] text-slate-500">ไม่ผ่านเกณฑ์พร้อมใช้งาน</span> : null}
              </div>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </FieldCard>
        </div>

        {probeMeta?.userAgent ? (
          <FieldCard label="User-Agent → ปลายทาง" accent="slate">
            <CodeLine variant="dark">{probeMeta.userAgent}</CodeLine>
          </FieldCard>
        ) : null}

        {live.finalUrl && live.finalUrl !== live.url ? (
          <FieldCard label="หลัง redirect (Response.url)" accent="amber">
            <CodeLine>{live.finalUrl}</CodeLine>
          </FieldCard>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <FieldCard label="Redirect" accent="amber">
            <span className={live.redirected ? "font-semibold text-amber-800" : "text-slate-600"}>
              {live.redirected ? "มีการเปลี่ยน URL" : "ไม่มี / เท่าเดิม"}
            </span>
          </FieldCard>
          <FieldCard label="เวลาตอบสนอง" accent="emerald">
            <span className="font-mono text-lg font-bold tabular-nums text-emerald-800">{live.latencyMs} ms</span>
          </FieldCard>
        </div>

        {probeMeta?.probeFlow ? (
          <p className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-[10px] leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-700">เส้นทางรวม: </span>
            {probeMeta.probeFlow}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-3 text-[11px] text-amber-950">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700" aria-hidden>
        <svg className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4Z" />
        </svg>
      </span>
      <p>
        {probeLoading
          ? "กำลังรอผลตรวจรอบแรกจากเซิร์ฟเวอร์…"
          : "ยังไม่มีผลในเซสชันนี้ — กด «รีเฟรชสถานะ» ที่หัวหน้าเพื่อดึงรายละเอียด"}
      </p>
    </div>
  );
}

export function MonitorProbeDetailPanel({
  websiteName,
  live,
  probeMeta,
  probeLoading,
}: {
  websiteName: string;
  live: MonitorProbeItem | undefined;
  probeMeta: ProbeMeta | null;
  probeLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const onClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);

  const modal =
    mounted && open
      ? createPortal(
          <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity"
              aria-label="ปิดหน้าต่าง"
              onClick={onClose}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={cn(
                "relative z-[201] flex max-h-[min(92vh,800px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl shadow-indigo-950/25",
                "sm:rounded-2xl",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/80 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p id={titleId} className="truncate text-base font-bold tracking-tight text-slate-900">
                    รายละเอียดการตรวจ HTTP
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-indigo-700">{websiteName}</p>
                  {live ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tabular-nums text-indigo-800 shadow-sm ring-1 ring-indigo-100">
                        <MiniPulse online={live.online} />
                        {live.latencyMs} ms
                      </span>
                      {live.statusCode != null ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1",
                            live.online
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                              : "bg-rose-50 text-rose-800 ring-rose-200",
                          )}
                        >
                          HTTP {live.statusCode}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  className="interactive-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
                  aria-label="ปิด"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
                <MonitorProbeDetailBody live={live} probeMeta={probeMeta} probeLoading={probeLoading} />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group/trigger mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200/60 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/50 px-3 py-2.5 text-left shadow-sm",
          "transition hover:border-indigo-300/80 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M15 3h4v4M9 21H5v-4M21 9v4h-4M3 15v-4h4" strokeLinecap="round" />
              <path d="M9 9h6v6H9z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900">ดูรายละเอียดการตรวจ</p>
            <p className="text-[10px] text-slate-500">เปิดในหน้าต่างลอย</p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-white/80 px-2 py-1 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-100 group-hover/trigger:bg-indigo-50">
          เปิด
        </span>
      </button>
      {modal}
    </>
  );
}

export function MonitorProbeMockHint() {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-2.5 py-2 text-[10px] leading-relaxed text-slate-500">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-slate-400" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <span>
        โหมดจำลอง — ไม่มีการเรียก <span className="rounded bg-slate-200/80 px-1 font-mono text-slate-700">/api/monitor/probe</span>
      </span>
    </div>
  );
}
