"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  saveIntegrationSecretAction,
  testIntegrationPingAction,
  updateIntegrationEnabledAction,
} from "@/app/admin/integrations/actions";
import type { AdminIntegrationsPageData, IntegrationProviderDTO } from "@/lib/data/fetch-admin-integrations-page";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { cn } from "@/lib/utils/cn";

function providerShort(id: string): string {
  const m: Record<string, string> = { discord: "Discord", line: "LINE", teams: "Teams", webhook: "Webhook" };
  return m[id] ?? id;
}

function Icon({ name }: { name: IntegrationProviderDTO["icon"] }) {
  const c = "h-6 w-6";
  switch (name) {
    case "discord":
      return (
        <svg className={`${c} text-[#5865F2]`} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
          />
        </svg>
      );
    case "line":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path fill="#06C755" d="M19.5 10.5c0 4-4.5 7.5-10 7.5-.8 0-1.5-.1-2.2-.3-.2-.1-.4 0-.5.1l-1.7 1c-.3.2-.7 0-.6-.4l.4-2.1c0-.2 0-.4-.2-.5C3.8 14.8 2.5 12.8 2.5 10.5 2.5 6.5 7 3 12.5 3S19.5 6.5 19.5 10.5z" />
        </svg>
      );
    case "teams":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path fill="#5558AF" d="M4 5h8v8H4V5zm10 3h6v10h-6V8zM6 15h6v4H6v-4z" />
        </svg>
      );
    default:
      return (
        <svg className={`${c} text-slate-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinejoin="round" />
        </svg>
      );
  }
}

function secretFieldLabel(id: IntegrationProviderDTO["id"]): string {
  if (id === "line") return "LINE OA (JSON) หรือ LINE Notify token";
  return "Webhook URL";
}

function secretFieldPlaceholder(id: IntegrationProviderDTO["id"]): string {
  if (id === "line") {
    return `ส่งถึงทุกคนที่แอด OA:\n{"channelAccessToken":"…","broadcast":true}\n\nหรือระบุปลายทาง:\n{"channelAccessToken":"…","to":"U…"}\n\nหรือใส่แค่ token LINE Notify (ไม่มี { })\nเว้นว่างแล้วบันทึก = ล้าง`;
  }
  return "วางค่าใหม่ที่นี่ (เว้นว่างแล้วบันทึก = ล้าง)";
}

export const AdminIntegrationsView = ({
  providers: initialProviders,
  pingLog,
  fromDatabase,
  missingTables,
  connectedCount,
  successPings24h,
  failedPings24h,
}: AdminIntegrationsPageData) => {
  const canMutate = fromDatabase && !missingTables;
  const router = useRouter();
  const [providers, setProviders] = useState(initialProviders);
  const [editing, setEditing] = useState<IntegrationProviderDTO | null>(null);
  const [secretDraft, setSecretDraft] = useState("");
  const [toast, setToast] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProviders(initialProviders);
  }, [initialProviders]);

  const successRateLabel = useMemo(() => {
    const t = successPings24h + failedPings24h;
    if (t === 0) return "—";
    return `${Math.round((successPings24h / t) * 1000) / 10}%`;
  }, [successPings24h, failedPings24h]);

  const showToast = (tone: "ok" | "err", msg: string) => {
    setToast({ tone, msg });
    window.setTimeout(() => setToast(null), 4200);
  };

  const toggle = (id: string, next: boolean) => {
    if (!canMutate) return;
    setActionError(null);
    startTransition(async () => {
      const res = await updateIntegrationEnabledAction({ id, enabled: next });
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: next } : p)));
      router.refresh();
    });
  };

  const openSettings = (p: IntegrationProviderDTO) => {
    setEditing(p);
    setSecretDraft("");
    setActionError(null);
  };

  const saveSecret = () => {
    if (!editing || !canMutate) return;
    setActionError(null);
    startTransition(async () => {
      const res = await saveIntegrationSecretAction({ id: editing.id, secret: secretDraft });
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      showToast("ok", res.message);
      setEditing(null);
      router.refresh();
    });
  };

  const runPing = (id: string) => {
    if (!canMutate) return;
    setActionError(null);
    startTransition(async () => {
      const res = await testIntegrationPingAction({ id });
      if (res.ok) {
        showToast("ok", res.message);
      } else {
        showToast("err", res.message);
      }
      router.refresh();
    });
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Integrations"
        title="เชื่อมต่อระบบ"
        subtitle={
          !fromDatabase
            ? "ตั้งค่า NEXT_PUBLIC_SUPABASE_* เพื่อบันทึกการเชื่อมต่อ"
            : missingTables
              ? "ยังไม่มีตาราง integration — รัน migration ด้านล่าง แล้วรีเฟรชหน้านี้"
              : "บันทึก URL/token ใน Supabase (RLS เฉพาะผู้ล็อกอิน) — ทดสอบส่ง ping จริงจากเซิร์ฟเวอร์แอป"
        }
        crumbs={[{ href: "/admin/dashboard", label: "Admin" }, { label: "Integrations" }]}
        actions={
          <>
            <Link
              href="/admin/automation"
              className="interactive-soft inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              ออโตเมชัน
            </Link>
            <Link
              href="/admin/alerts"
              className="interactive-soft inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              แจ้งเตือน
            </Link>
          </>
        }
      />

      {!fromDatabase ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          ยังไม่ได้เชื่อมฐานข้อมูล — หน้านี้ยังไม่บันทึกการตั้งค่า
        </div>
      ) : null}

      {fromDatabase && missingTables ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          <p className="font-semibold">ยังไม่มีตารางใน Supabase</p>
          <p className="mt-1">
            รัน migration ไฟล์{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">20260221150000_integration_providers.sql</code>{" "}
            (เช่น <span className="font-mono">supabase db push</span> หรือวาง SQL ใน SQL Editor) แล้วรีเฟรชหน้านี้
          </p>
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{actionError}</div>
      ) : null}

      {toast ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm font-medium",
            toast.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-rose-200 bg-rose-50 text-rose-900",
          )}
          role="status"
        >
          {toast.msg}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="พร้อมใช้ (เปิด + มี URL/token)" value={connectedCount} hint={`จาก ${providers.length}`} tone="primary" />
        <StatCard label="ทดสอบสำเร็จ 24 ชม." value={successPings24h} hint={`อัตรา ${successRateLabel}`} />
        <StatCard label="ทดสอบล้ม 24 ชม." value={failedPings24h} hint="จากล็อก" tone={failedPings24h > 0 ? "danger" : "neutral"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_min(100%,320px)] xl:items-start">
        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((item) => {
            const live = item.enabled && item.hasSecret;
            return (
              <div
                key={item.id}
                className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition ${
                  live ? "border-indigo-200/90 ring-1 ring-indigo-100/60" : "border-slate-200/80 hover:border-slate-300/90"
                }`}
              >
                <div
                  className={`absolute bottom-2 left-0 top-2 w-1 rounded-r-full ${live ? "bg-indigo-500" : "bg-slate-200"}`}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-3 pl-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
                      <Icon name={item.icon} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-slate-900">{item.name}</h2>
                        {live ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">พร้อม</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500">{item.desc}</p>
                      <p className="mt-2 font-mono text-[11px] text-slate-600" title={item.maskedPreview}>
                        {item.maskedPreview}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        ล่าสุด: {item.lastPingAt ?? "—"}
                        {item.lastPingOk != null ? (
                          <span className={item.lastPingOk ? " text-emerald-700" : " text-rose-700"}>
                            {" "}
                            ({item.lastPingOk ? "สำเร็จ" : "ล้มเหลว"})
                          </span>
                        ) : null}
                      </p>
                      {item.lastPingDetail ? (
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{item.lastPingDetail}</p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.enabled}
                    disabled={!canMutate || isPending}
                    aria-label={`สลับ ${item.name}`}
                    onClick={() => toggle(item.id, !item.enabled)}
                    className={cn(
                      "relative mt-0.5 h-8 w-14 shrink-0 rounded-full transition-colors",
                      item.enabled ? "bg-indigo-600" : "bg-slate-200",
                      (!canMutate || isPending) && "opacity-50",
                    )}
                  >
                    <span
                      className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        item.enabled ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 pl-2">
                  <button
                    type="button"
                    disabled={!canMutate || isPending}
                    onClick={() => openSettings(item)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    ตั้งค่า URL / token
                  </button>
                  <button
                    type="button"
                    disabled={!canMutate || isPending}
                    onClick={() => runPing(item.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {isPending ? "กำลังทดสอบ…" : "ทดสอบส่ง"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">เหตุการณ์ล่าสุด</h3>
            <p className="mt-1 text-xs text-slate-500">จาก integration_ping_log</p>
            {pingLog.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">ยังไม่มี — กดทดสอบส่ง</p>
            ) : (
              <ul className="mt-3 max-h-[min(55vh,400px)] space-y-3 overflow-y-auto pr-1">
                {pingLog.map((row) => {
                  const t = new Date(row.createdAt).toLocaleString("th-TH", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <li key={row.id} className="border-b border-slate-50 pb-3 text-sm last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-indigo-800">{providerShort(row.providerId)}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                            row.ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-800",
                          )}
                        >
                          {row.ok ? "สำเร็จ" : "ล้มเหลว"}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">{t}</p>
                      {row.detail ? <p className="mt-1 text-xs leading-snug text-slate-600">{row.detail}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-sm font-semibold text-slate-800">ความปลอดภัย</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              URL และ token เก็บในตาราง <span className="font-mono">integration_providers</span> — RLS อนุญาตเฉพาะผู้ใช้ที่ล็อกอิน
              ค่าเต็มไม่ถูกส่งไปเบราว์เซอร์ ใช้แมสก์ในการ์ดเท่านั้น
            </p>
          </div>
        </aside>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="int-edit-title">
          <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" aria-label="ปิด" onClick={() => setEditing(null)} />
          <div className="relative z-[221] w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-2xl">
            <h2 id="int-edit-title" className="text-lg font-bold text-slate-900">
              ตั้งค่า {editing.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{editing.desc}</p>
            <label className="mt-4 block text-xs font-semibold text-slate-700">{secretFieldLabel(editing.id)}</label>
            <textarea
              value={secretDraft}
              onChange={(e) => setSecretDraft(e.target.value)}
              rows={editing.id === "line" ? 8 : 4}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 outline-none ring-indigo-500/0 transition focus:border-indigo-300 focus:bg-white focus:ring-2"
              placeholder={secretFieldPlaceholder(editing.id)}
              autoComplete="off"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setEditing(null)}>
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!canMutate || isPending}
                onClick={() => saveSecret()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-slate-500">
        {!fromDatabase
          ? "โหมดนี้ยังไม่บันทึกการตั้งค่า"
          : missingTables
            ? "หลังรัน migration แล้ว ปุ่มจะใช้งานได้"
            : "การทดสอบส่งออกจากเซิร์ฟเวอร์ Next.js — ตรวจสอบ firewall/URL ปลายทางได้จากล็อก"}
      </p>
    </div>
  );
};
