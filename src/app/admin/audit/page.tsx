import { AdminAuditView } from "@/components/admin/group/admin-audit-view";
import { fetchAdminAuditPageData } from "@/lib/data/fetch-admin-audit-page";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const data = await fetchAdminAuditPageData();
  return (
    <AdminAuditView
      {...data}
      initialSeverity={sp.severity ?? "all"}
      initialCategory={sp.category ?? "all"}
    />
  );
}
