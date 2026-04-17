import { AdminIntegrationsView } from "@/components/admin/group/admin-integrations-view";
import { fetchAdminIntegrationsPageData } from "@/lib/data/fetch-admin-integrations-page";

export default async function AdminIntegrationsPage() {
  const data = await fetchAdminIntegrationsPageData();
  return <AdminIntegrationsView {...data} />;
}
