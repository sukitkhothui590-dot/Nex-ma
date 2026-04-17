import { AdminLayoutClient } from "./admin-layout-client";

/** โหลดแบบ dynamic — หน้า admin ใช้ cookies (Supabase) บนเซิร์ฟเวอร์ */
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
