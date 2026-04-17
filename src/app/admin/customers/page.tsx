import { AdminCustomerManagementView } from "@/components/admin/admin-customer-management-view";
import { fetchAdminCustomersPageData } from "@/lib/data/fetch-admin-customers-page";

export default async function AdminCustomersPage() {
  const { customers, websites, subscriptions, fromDatabase } = await fetchAdminCustomersPageData();

  return (
    <AdminCustomerManagementView
      customers={customers}
      websites={websites}
      subscriptions={subscriptions}
      fromDatabase={fromDatabase}
    />
  );
}
