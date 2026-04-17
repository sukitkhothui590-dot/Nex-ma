import type { Customer, Website } from "@/types/models";
import { dataService } from "@/lib/services/data-service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapAlertRow, mapCustomerRow, mapWebsiteRow, type AlertRow, type CustomerRow, type WebsiteRow } from "@/lib/supabase/mappers";
import { aggregateAlertStatsByWebsite, type WebsiteAlertStats } from "@/lib/utils/website-alert-stats";

export type AdminWebsitesPageData = {
  websites: Website[];
  customers: Customer[];
  fromDatabase: boolean;
  /** สถิติแจ้งเตือนต่อ website id (ยังไม่ปิดเรื่อง) */
  alertStatsByWebsiteId: Record<string, WebsiteAlertStats>;
};

export async function fetchAdminWebsitesPageData(): Promise<AdminWebsitesPageData> {
  if (!isSupabaseConfigured()) {
    const [websites, customers, alerts] = await Promise.all([
      dataService.getWebsites(),
      dataService.getCustomers(),
      dataService.getAlerts(),
    ]);
    return {
      websites,
      customers,
      fromDatabase: false,
      alertStatsByWebsiteId: aggregateAlertStatsByWebsite(alerts),
    };
  }

  const supabase = await createSupabaseServerClient();

  const [wRes, cRes, aRes] = await Promise.all([
    supabase.from("websites").select("*").order("created_at", { ascending: false }),
    supabase.from("customers").select("*").order("name", { ascending: true }),
    supabase.from("alerts").select("*"),
  ]);

  if (wRes.error) throw new Error(wRes.error.message);
  if (cRes.error) throw new Error(cRes.error.message);
  if (aRes.error) throw new Error(aRes.error.message);

  const alerts = (aRes.data ?? []).map((r) => mapAlertRow(r as AlertRow));

  return {
    websites: (wRes.data ?? []).map((r) => mapWebsiteRow(r as WebsiteRow)),
    customers: (cRes.data ?? []).map((r) => mapCustomerRow(r as CustomerRow)),
    fromDatabase: true,
    alertStatsByWebsiteId: aggregateAlertStatsByWebsite(alerts),
  };
}
