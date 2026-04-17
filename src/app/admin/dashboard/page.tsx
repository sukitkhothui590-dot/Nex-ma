import { AdminDashboardHome } from "@/components/admin/admin-dashboard-home";
import { fetchAdminDashboardPageData } from "@/lib/data/fetch-admin-dashboard-page";

export default async function AdminDashboardPage() {
  const { summary, websites, alerts, subscriptions, customers } = await fetchAdminDashboardPageData();

  return (
    <AdminDashboardHome
      summary={summary}
      websites={websites}
      alerts={alerts}
      subscriptions={subscriptions}
      customers={customers}
    />
  );
}
