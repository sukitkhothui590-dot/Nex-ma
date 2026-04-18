"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  runAutomationJobsAction,
  testDailyDigestAction,
  testWebsiteStatusAction,
  updateAutomationRuleAction,
  updateWebsiteStatusScheduleAction,
} from "@/app/admin/automation/actions";
import type { AdminAutomationPageData } from "@/lib/data/fetch-admin-automation-page";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { WebsiteStatusPinger } from "@/components/admin/website-status-pinger";
import { TimeInput24 } from "@/components/ui/time-input-24";
import { cn } from "@/lib/utils/cn";
import { normalizeScheduleTimes } from "@/lib/utils/website-status-schedule";

const KIND_LABELS: Record<string, string> = {
  ma_expiry_scan: "สแกนวันหมด MA",
  webhook_high: "Webhook ความรุนแรงสูง",
  daily_digest: "สรุปรายวัน → Integrations",
  website_status_digest: "สถานะเว็บ → Integrations",
};

const kindLabel = (k: string) => KIND_LABELS[k] ?? k;

const statusLabel = (s: string) =>
  ({ success: "สำเร็จ", failed: "ล้มเหลว", skipped: "ข้าม" } as const)[s as "success" | "failed" | "skipped"] ?? s;

export const AdminAutomationView = ({
  rules: initialRules,
  jobs,
  fromDatabase,
  failedJobs24h,
}: AdminAutomationPageData) => {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [testDigestMessage, setTestDigestMessage] = useState<string | null>(null);
  const [testWebsiteMessage, setTestWebsiteMessage] = useState<string | null>(null);
  const [intervalSavedMessage, setIntervalSavedMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRunPending, startRunTransition] = useTransition();
  const [isTestDigestPending, startTestDigestTransition] = useTransition();
  const [isTestWebsitePending, startTestWebsiteTransition] = useTransition();
  const [isIntervalPending, startIntervalTransition] = useTransition();
  const automationBusy = isPending || isRunPending || isTestDigestPending || isTestWebsitePending || isIntervalPending;

  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);

  const websiteStatusRule = useMemo(() => rules.find((r) => r.id === "website_status_digest"), [rules]);
  const defaultSlots = useMemo(() => ["09:00", "12:00", "18:00"], []);
  const [scheduleSlots, setScheduleSlots] = useState<string[]>(defaultSlots);

  /** ซิงก์จากเซิร์ฟเวอร์เมื่อค่าตารางจริงเปลี่ยน — ไม่ผูกกับ object reference ของ config */
  const digestScheduleSyncKey = useMemo(() => {
    const c = websiteStatusRule?.config;
    if (!c || typeof c !== "object") return "";
    const st = normalizeScheduleTimes((c as { scheduleTimes?: unknown }).scheduleTimes);
    return st.join("\u001f");
  }, [websiteStatusRule]);

  useEffect(() => {
    const c = websiteStatusRule?.config;
    const st = normalizeScheduleTimes(
      c && typeof c === "object" ? (c as { scheduleTimes?: unknown }).scheduleTimes : undefined,
    );
    if (st.length > 0) {
      setScheduleSlots(st);
      return;
    }
    setScheduleSlots(defaultSlots);
  }, [digestScheduleSyncKey, websiteStatusRule, defaultSlots]);

  const toggle = (id: string, next: boolean) => {
    if (!fromDatabase) return;
    setActionError(null);
    startTransition(async () => {
      const res = await updateAutomationRuleAction({ id, enabled: next });
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: next } : r)));
      router.refresh();
    });
  };

  const runNow = () => {
    if (!fromDatabase) return;
    setActionError(null);
    setRunMessage(null);
    setTestDigestMessage(null);
    setTestWebsiteMessage(null);
    setIntervalSavedMessage(null);
    startRunTransition(async () => {
      const res = await runAutomationJobsAction();
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setRunMessage(res.message);
      router.refresh();
    });
  };

  const testDailyDigest = () => {
    if (!fromDatabase) return;
    setActionError(null);
    setRunMessage(null);
    setTestDigestMessage(null);
    setTestWebsiteMessage(null);
    setIntervalSavedMessage(null);
    startTestDigestTransition(async () => {
      const res = await testDailyDigestAction();
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setTestDigestMessage(res.message);
      router.refresh();
    });
  };

  const testWebsiteStatus = () => {
    if (!fromDatabase) return;
    setActionError(null);
    setRunMessage(null);
    setTestDigestMessage(null);
    setTestWebsiteMessage(null);
    setIntervalSavedMessage(null);
    startTestWebsiteTransition(async () => {
      const res = await testWebsiteStatusAction();
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setTestWebsiteMessage(res.message);
      router.refresh();
    });
  };

  const saveWebsiteSchedule = () => {
    if (!fromDatabase) return;
    setActionError(null);
    setIntervalSavedMessage(null);
    startIntervalTransition(async () => {
      const res = await updateWebsiteStatusScheduleAction({ scheduleTimes: scheduleSlots });
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setIntervalSavedMessage(res.message);
      router.refresh();
    });
  };

  return (
    <div className="page-shell">
      <WebsiteStatusPinger />
      <PageHeader
        eyebrow="Automation"
        title="ออโตเมชัน"
        subtitle={
          fromDatabase
            ? "กฎเก็บในฐานข้อมูล — ส่งสรุปรายวัน / สถานะเว็บแต่ละตัวไป Integrations · ตั้งได้หลายเวลาต่อวัน (Asia/Bangkok) · รันสแกน MA จากปุ่ม — ตั้ง cron เรียก /api/cron/website-status"
            : "เชื่อม Supabase และรัน migration ออโตเมชันเพื่อใช้งานจริง"
        }
        crumbs={[{ href: "/admin/dashboard", label: "Admin" }, { label: "Automation" }]}
        actions={
          <>
            <button
              type="button"
              disabled={!fromDatabase || automationBusy}
              onClick={() => runNow()}
              className="interactive-soft inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isRunPending ? "กำลังรัน…" : "รันงานอัตโนมัติตอนนี้"}
            </button>
            <button
              type="button"
              disabled={!fromDatabase || automationBusy}
              onClick={() => testDailyDigest()}
              title="ส่งข้อความสรุปรายวันตัวอย่างไป Discord/LINE ฯลฯ (มีหัวข้อทดสอบ)"
              className="interactive-soft inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100 disabled:opacity-50"
            >
              {isTestDigestPending ? "กำลังส่ง…" : "ทดสอบส่งสรุปรายวัน"}
            </button>
            <button
              type="button"
              disabled={!fromDatabase || automationBusy}
              onClick={() => testWebsiteStatus()}
              title="ส่งรายการสถานะเว็บทุกตัวแบบทดสอบ (หัวข้อทดสอบ)"
              className="interactive-soft inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-950 shadow-sm hover:bg-sky-100 disabled:opacity-50"
            >
              {isTestWebsitePending ? "กำลังส่ง…" : "ทดสอบสถานะเว็บ"}
            </button>
            <Link
              href="/admin/integrations"
              className="interactive-soft inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              เชื่อมต่อระบบ
            </Link>
          </>
        }
      />

      {!fromDatabase ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          ยังไม่ได้ตั้งค่า <span className="font-mono">NEXT_PUBLIC_SUPABASE_*</span> — หน้านี้ยังไม่บันทึกกฎ
        </div>
      ) : null}

      {fromDatabase && initialRules.length === 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          ไม่พบตารางกฎ — รัน migration ออโตเมชัน (รวม{" "}
          <span className="font-mono">20260221180000_automation_website_status.sql</span>) แล้วรีเฟรช
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{actionError}</div>
      ) : null}
      {runMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{runMessage}</div>
      ) : null}
      {testDigestMessage ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
          <span className="font-semibold">ทดสอบสรุปรายวัน:</span> {testDigestMessage}
        </div>
      ) : null}
      {testWebsiteMessage ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <span className="font-semibold">ทดสอบสถานะเว็บ:</span> {testWebsiteMessage}
        </div>
      ) : null}
      {intervalSavedMessage ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">{intervalSavedMessage}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="กฎที่เปิด" value={activeCount} hint={`จากทั้งหมด ${rules.length}`} tone="primary" />
        <StatCard label="คิวล่าสุด" value={jobs.length} hint="บันทึกใน automation_job_runs" />
        <StatCard label="ล้มเหลว 24 ชม." value={failedJobs24h} hint="จากล็อกการรัน" tone={failedJobs24h > 0 ? "danger" : "neutral"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_min(100%,320px)] xl:items-start">
        <div className="min-w-0 space-y-3">
          {rules.map((r) => (
            <div
              key={r.id}
              className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${
                r.enabled ? "border-indigo-200/90 ring-1 ring-indigo-100/50" : "border-slate-200/80"
              }`}
            >
              <div
                className={`absolute bottom-2 left-0 top-2 w-1 rounded-r-full ${r.enabled ? "bg-indigo-500" : "bg-slate-200"}`}
                aria-hidden
              />
              <div className="flex flex-col gap-4 pl-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{r.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        r.enabled ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.enabled ? "เปิดใช้งาน" : "ปิด"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">ทริกเกอร์:</span> {r.triggerSummary}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">แอ็กชัน:</span> {r.actionSummary}
                  </p>
                  <p className="mt-2 font-mono text-[11px] tabular-nums text-slate-400">
                    รันล่าสุด: {r.lastRun ?? "—"}
                  </p>
                  {r.id === "website_status_digest" ? (
                    <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/80 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-700">
                          เวลาส่งของแต่ละวัน · <span className="font-semibold text-sky-700">ฟอร์แมต 24 ชม.</span>
                        </p>
                        <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">
                          TZ: Asia/Bangkok
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        ระบบจับรอบทุก 5 นาที — ตั้งเวลาใดก็ได้ (เช่น <span className="font-mono">09:00</span>,{" "}
                        <span className="font-mono">13:30</span>, <span className="font-mono">21:45</span>)
                      </p>
                      <ul className="mt-2 space-y-2">
                        {scheduleSlots.map((slot, idx) => (
                          <li key={`slot-${idx}`} className="flex flex-wrap items-center gap-2">
                            <TimeInput24
                              value={slot}
                              disabled={!fromDatabase || automationBusy}
                              onChange={(v) =>
                                setScheduleSlots((prev) => prev.map((s, i) => (i === idx ? v : s)))
                              }
                              ariaLabel={`ช่วงเวลาที่ ${idx + 1}`}
                            />
                            <button
                              type="button"
                              disabled={scheduleSlots.length <= 1 || !fromDatabase || automationBusy}
                              onClick={() => setScheduleSlots((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-[11px] font-semibold text-rose-700 hover:underline disabled:opacity-40"
                            >
                              ลบ
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={scheduleSlots.length >= 48 || !fromDatabase || automationBusy}
                          onClick={() => setScheduleSlots((prev) => [...prev, "09:00"])}
                          className="rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-sky-900 hover:bg-sky-50 disabled:opacity-50"
                        >
                          + เพิ่มช่วงเวลา
                        </button>
                        <button
                          type="button"
                          disabled={!fromDatabase || automationBusy}
                          onClick={() => saveWebsiteSchedule()}
                          className="h-9 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                        >
                          {isIntervalPending ? "บันทึก…" : "บันทึกเวลา"}
                        </button>
                      </div>
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">
                        <p className="font-semibold">ให้ทำงานแม้ไม่เปิดหน้า web:</p>
                        <ol className="mt-1 list-decimal space-y-1 pl-4">
                          <li>
                            ตั้ง env บน Vercel: <span className="font-mono">CRON_SECRET</span> (สุ่มยาวๆ) +{" "}
                            <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>
                          </li>
                          <li>
                            ใช้ Vercel Cron (ไฟล์ <span className="font-mono">vercel.json</span> พร้อมแล้ว — Pro plan)
                            หรือ external cron เช่น <span className="font-mono">cron-job.org</span> / UptimeRobot (Hobby plan)
                          </li>
                          <li>
                            ยิง <span className="font-mono">GET /api/cron/website-status</span> ทุก 5 นาที พร้อม header{" "}
                            <span className="font-mono">Authorization: Bearer &lt;CRON_SECRET&gt;</span>
                          </li>
                        </ol>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <span className="text-xs font-medium text-slate-600">เปิด/ปิด</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.enabled}
                    disabled={!fromDatabase || automationBusy}
                    aria-label={`สลับ ${r.name}`}
                    onClick={() => toggle(r.id, !r.enabled)}
                    className={cn(
                      "relative h-8 w-14 shrink-0 rounded-full transition-colors",
                      r.enabled ? "bg-indigo-600" : "bg-slate-200",
                      (!fromDatabase || automationBusy) && "opacity-50",
                    )}
                  >
                    <span
                      className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        r.enabled ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">ล็อกการรันล่าสุด</h3>
            <p className="mt-1 text-xs text-slate-500">จากตาราง automation_job_runs</p>
            {jobs.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">ยังไม่มี — กด «รันงานอัตโนมัติตอนนี้»</p>
            ) : (
              <ul className="mt-3 max-h-[min(60vh,420px)] space-y-3 overflow-y-auto pr-1">
                {jobs.map((q) => {
                  const t = new Date(q.createdAt).toLocaleString("th-TH", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <li key={q.id} className="border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] tabular-nums text-slate-400">{t}</span>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            q.status === "success"
                              ? "bg-emerald-100 text-emerald-900"
                              : q.status === "failed"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-950"
                          }`}
                        >
                          {statusLabel(q.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-indigo-800">{kindLabel(q.kind ?? "")}</p>
                      {q.detail ? <p className="mt-1 text-xs leading-snug text-slate-600">{q.detail}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-sm font-semibold text-slate-800">คำแนะนำ</h3>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs text-slate-600">
              <li>กฎ «เว็บออฟไลน์» ควบคุมว่ามอนิเตอร์จะสร้างแจ้งเตือนหรือไม่</li>
              <li>กฎ «MA» สร้างแจ้งเตือนเมื่อเหลือ ≤14 วันหรือหมดแล้ว (ไม่ซ้ำภายใน 7 วัน/เว็บ)</li>
              <li>สถานะเว็บ: เปิดกฎแล้วตั้งช่วงเวลา — เรียก cron ไปที่ /api/cron/website-status</li>
            </ul>
          </div>
        </aside>
      </div>

      <p className="text-center text-[11px] text-slate-500">
        {fromDatabase
          ? "ข้อมูลกฎและล็อกมาจาก Supabase — ตั้ง Vercel / Supabase cron เรียกรันงานเป็นระยะได้ในขั้นถัดไป"
          : "โหมดนี้ยังไม่บันทึกกฎ"}
      </p>
    </div>
  );
};
