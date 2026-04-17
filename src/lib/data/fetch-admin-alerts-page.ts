import type { Alert, Customer, Website } from "@/types/models";
import { dataService } from "@/lib/services/data-service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapAlertRow,
  mapCustomerRow,
  mapWebsiteRow,
  type AlertRow,
  type CustomerRow,
  type WebsiteRow,
} from "@/lib/supabase/mappers";

export type AdminAlertsPageData = {
  alerts: Alert[];
  websites: Website[];
  customers: Customer[];
  fromDatabase: boolean;
};

export async function fetchAdminAlertsPageData(): Promise<AdminAlertsPageData> {
  if (!isSupabaseConfigured()) {
    const [alerts, websites, customers] = await Promise.all([
      dataService.getAlerts(),
      dataService.getWebsites(),
      dataService.getCustomers(),
    ]);
    return { alerts, websites, customers, fromDatabase: false };
  }

  const supabase = await createSupabaseServerClient();
  const [aRes, wRes, cRes] = await Promise.all([
    supabase.from("alerts").select("*").order("created_at", { ascending: false }),
    supabase.from("websites").select("*").order("created_at", { ascending: false }),
    supabase.from("customers").select("*").order("name", { ascending: true }),
  ]);

  if (aRes.error) throw new Error(aRes.error.message);
  if (wRes.error) throw new Error(wRes.error.message);
  if (cRes.error) throw new Error(cRes.error.message);

  return {
    alerts: (aRes.data ?? []).map((r) => mapAlertRow(r as AlertRow)),
    websites: (wRes.data ?? []).map((r) => mapWebsiteRow(r as WebsiteRow)),
    customers: (cRes.data ?? []).map((r) => mapCustomerRow(r as CustomerRow)),
    fromDatabase: true,
  };
}
