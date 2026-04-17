import { AdminAutomationView } from "@/components/admin/group/admin-automation-view";
import { fetchAdminAutomationPageData } from "@/lib/data/fetch-admin-automation-page";

export default async function AdminAutomationPage() {
  const data = await fetchAdminAutomationPageData();
  return <AdminAutomationView {...data} />;
}
