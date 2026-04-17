import { AdminWebsiteManagementView } from "@/components/admin/admin-website-management-view";
import { fetchAdminWebsitesPageData } from "@/lib/data/fetch-admin-websites-page";
import { parseWebsitesUrlState } from "@/lib/utils/websites-page-url";

type Search = Record<string, string | string[] | undefined>;

export default async function AdminWebsitesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const urlState = parseWebsitesUrlState(sp);

  const { websites, customers, fromDatabase, alertStatsByWebsiteId } = await fetchAdminWebsitesPageData();

  return (
    <AdminWebsiteManagementView
      websites={websites}
      customers={customers}
      fromDatabase={fromDatabase}
      alertStatsByWebsiteId={alertStatsByWebsiteId}
      initialUrlState={urlState}
      pageTitle="ข้อมูลเว็บไซต์"
      subtitle={
        fromDatabase
          ? "ตารางจัดการเว็บไซต์ของลูกค้า — ดึงจากฐานข้อมูล Supabase · แจ้งเตือนและสัญญาใกล้หมดเชื่อมกับหน้า Alerts / Monitor"
          : "ตารางนี้ใช้สำหรับจัดการข้อมูลเว็บไซต์ของลูกค้า"
      }
    />
  );
}
