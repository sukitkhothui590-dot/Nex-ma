import { AdminMonitorView } from "@/components/admin/group/admin-monitor-view";
import { fetchAdminMonitorPageData } from "@/lib/data/fetch-admin-monitor-page";

export default async function AdminMonitorPage() {
  const { websites, alerts, subscriptions, customers, fromDatabase } = await fetchAdminMonitorPageData();

  return (
    <AdminMonitorView
      websites={websites}
      alerts={alerts}
      subscriptions={subscriptions}
      customers={customers}
      fromDatabase={fromDatabase}
    />
  );
}
