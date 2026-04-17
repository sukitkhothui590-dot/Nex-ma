import Link from "next/link";
import type { Alert, Customer, DashboardSummary, ServiceSubscription, Website } from "@/types/models";
import { getDaysUntil, getExpiryTone } from "@/lib/utils/date";
import { mergeSubscriptionsWithWebsiteExpiries } from "@/lib/utils/renewals";
import { siteDisplayHostname } from "@/lib/utils/website-urls";
import { WebsiteLogo } from "@/components/ui/website-logo";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";

const primaryWebsiteForCustomer = (sites: Website[], customerId: string) =>
  sites.filter((w) => w.customerId === customerId).sort((a, b) => a.id.localeCompare(b.id))[0];

export interface AdminDashboardHomeProps {
  summary: DashboardSummary;
  websites: Website[];
  alerts: Alert[];
  subscriptions: ServiceSubscription[];
  customers: Customer[];
}

const serviceTypeTh = (t: ServiceSubscription["serviceType"]) =>
  ({ domain: "โดเมน", hosting: "โฮสติ้ง", cloud: "คลาวด์", ma: "MA" } as const)[t];

export const AdminDashboardHome = ({
  summary,
  websites,
  alerts,
  subscriptions,
  customers,
}: AdminDashboardHomeProps) => {
  const downSites = websites.filter((w) => w.status === "offline");
  const openAlerts = alerts.filter((a) => a.status !== "resolved");
  const openAlertCount = openAlerts.length;

  const mergedRenewals = mergeSubscriptionsWithWebsiteExpiries(subscriptions, websites);
  const renewalRows = mergedRenewals
    .map((sub) => ({
      ...sub,
      days: getDaysUntil(sub.expiryDate),
      tone: getExpiryTone(sub.expiryDate),
    }))
    .filter((row) => row.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  const customerById = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Overview"
        title="แดชบอร์ด"
        subtitle="ภาพรวมสถานะระบบ งานเร่งด่วน และรายการใกล้หมดอายุ — จัดลำดับให้อ่านได้ในไม่กี่วินาที"
        actions={
          <>
            <Link
              href="/admin/websites"
              className="interactive-soft inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.99]"
            >
              จัดการเว็บไซต์
            </Link>
            <Link
              href="/admin/alerts"
              className="interactive-soft inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]"
            >
              แจ้งเตือน ({openAlertCount})
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="เว็บไซต์ทั้งหมด" value={summary.totalWebsites} hint="ในระบบทั้งหมด" />
        <StatCard label="สัญญาใช้งาน" value={summary.activeWebsites} hint="สถานะสัญญาใช้งาน" tone="primary" />
        <StatCard label="ออฟไลน์ตอนนี้" value={summary.downWebsites} hint="จากการตรวจล่าสุด" tone="danger" />
        <StatCard label="แจ้งเตือนค้าง" value={openAlertCount} hint="ใหม่/รับทราบ" tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="dash-card-lift dash-enter dash-enter-delay-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">งานเร่งด่วน</h2>
            <Link href="/admin/alerts" className="text-xs font-medium text-indigo-700 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>

          {downSites.length > 0 ? (
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold tracking-wide text-rose-600">เว็บออฟไลน์</p>
              <ul className="space-y-2">
                {downSites.slice(0, 5).map((site) => (
                  <li
                    key={site.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 transition hover:border-rose-200 hover:bg-rose-50"
                  >
                    <WebsiteLogo
                      instanceId={site.id}
                      name={site.name}
                      frontendUrl={site.frontendUrl}
                      backendUrl={site.backendUrl}
                      logoUrl={site.logoUrl}
                      className="shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{site.name}</p>
                      <p className="truncate text-xs text-slate-500">{siteDisplayHostname(site) || "—"}</p>
                    </div>
                    <Link
                      href="/admin/websites"
                      className="shrink-0 text-xs font-semibold text-rose-700 hover:underline"
                    >
                      ตรวจสอบ
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500">แจ้งเตือนล่าสุด</p>
          {openAlerts.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มีแจ้งเตือนค้าง — ระบบสงบ</p>
          ) : (
            <ul className="space-y-2">
              {openAlerts.slice(0, 5).map((alert) => {
                const site = websites.find((w) => w.id === alert.websiteId);
                return (
                  <li
                    key={alert.id}
                    className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    {site ? (
                      <WebsiteLogo
                        instanceId={alert.id}
                        name={site.name}
                        frontendUrl={site.frontendUrl}
                        backendUrl={site.backendUrl}
                        logoUrl={site.logoUrl}
                        className="shadow-sm"
                      />
                    ) : (
                      <span
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-xs font-medium text-slate-400"
                        aria-hidden
                      >
                        ?
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{alert.message}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {site ? <span>{site.name}</span> : null}
                        <span className="rounded bg-white px-1.5 py-0.5 font-medium text-slate-600">
                          {alert.severity === "high" ? "สูง" : alert.severity === "medium" ? "ปานกลาง" : "ต่ำ"}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="dash-card-lift dash-enter dash-enter-delay-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">ใกล้หมดอายุ (30 วัน)</h2>
            <Link href="/admin/websites" className="text-xs font-medium text-indigo-700 hover:underline">
              ไปหน้าเว็บไซต์
            </Link>
          </div>
          {renewalRows.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มีรายการหมดอายุภายใน 30 วัน (รวมวันที่กำหนดต่อเว็บไซต์)</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {renewalRows.map((row) => {
                const brandSite = row.websiteId
                  ? websites.find((w) => w.id === row.websiteId)
                  : primaryWebsiteForCustomer(websites, row.customerId);
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 py-3 transition first:pt-0 hover:bg-slate-50/80"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {brandSite ? (
                        <WebsiteLogo
                          instanceId={row.id}
                          name={brandSite.name}
                          frontendUrl={brandSite.frontendUrl}
                          backendUrl={brandSite.backendUrl}
                          logoUrl={brandSite.logoUrl}
                          className="shadow-sm"
                        />
                      ) : (
                        <span
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-100 text-[10px] font-semibold text-slate-500"
                          aria-hidden
                        >
                          {serviceTypeTh(row.serviceType).slice(0, 1)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {serviceTypeTh(row.serviceType)}
                          {brandSite?.name ? ` · ${brandSite.name}` : ""} · {customerById(row.customerId)}
                        </p>
                        <p className="text-xs text-slate-500">หมดอายุ {row.expiryDate}</p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.tone === "danger"
                          ? "bg-red-100 text-red-800"
                          : row.tone === "warning"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-indigo-100 text-indigo-800"
                      }`}
                    >
                      {row.days < 0 ? "หมดแล้ว" : `เหลือ ${row.days} วัน`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="dash-enter dash-enter-delay-7">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">ทางลัด</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/admin/websites"
            className="group dash-card-lift rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md active:scale-[0.99]"
          >
            <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-800">ข้อมูลเว็บไซต์</p>
            <p className="mt-1 text-xs text-slate-500">ตารางครบ ลิงก์ด่วน และ API</p>
          </Link>
          <Link
            href="/admin/customers"
            className="group dash-card-lift rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md active:scale-[0.99]"
          >
            <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-800">ลูกค้า</p>
            <p className="mt-1 text-xs text-slate-500">บัญชีและการติดต่อ</p>
          </Link>
          <Link
            href="/admin/alerts"
            className="group dash-card-lift rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md active:scale-[0.99]"
          >
            <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-800">แจ้งเตือน</p>
            <p className="mt-1 text-xs text-slate-500">ดูและจัดการสถานะ</p>
          </Link>
        </div>
      </section>
    </div>
  );
};
