import { Suspense } from "react";
import { AdminAlertsManagementView } from "@/components/admin/admin-alerts-management-view";
import { fetchAdminAlertsPageData } from "@/lib/data/fetch-admin-alerts-page";
import { parseAlertsUrlState } from "@/lib/utils/alerts-page-url";

type Search = { q?: string | string[]; websiteId?: string | string[] };

export default async function AdminAlertsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { q: initialSearch, websiteId: initialWebsiteId } = parseAlertsUrlState(sp);

  const { alerts, websites, customers, fromDatabase } = await fetchAdminAlertsPageData();

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          กำลังโหลดการแจ้งเตือน…
        </div>
      }
    >
      <AdminAlertsManagementView
        alerts={alerts}
        websites={websites}
        customers={customers}
        fromDatabase={fromDatabase}
        initialSearch={initialSearch}
        initialWebsiteId={initialWebsiteId}
      />
    </Suspense>
  );
}
