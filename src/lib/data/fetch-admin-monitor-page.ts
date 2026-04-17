import type { Alert, Customer, ServiceSubscription, Website } from "@/types/models";
import { dataService } from "@/lib/services/data-service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapAlertRow,
  mapCustomerRow,
  mapServiceSubscriptionRow,
  mapWebsiteRow,
  type AlertRow,
  type CustomerRow,
  type ServiceSubscriptionRow,
  type WebsiteRow,
} from "@/lib/supabase/mappers";

export type AdminMonitorPageData = {
  websites: Website[];
  alerts: Alert[];
  subscriptions: ServiceSubscription[];
  customers: Customer[];
  fromDatabase: boolean;
};

export async function fetchAdminMonitorPageData(): Promise<AdminMonitorPageData> {
  if (!isSupabaseConfigured()) {
    const [websites, alerts, subscriptions, customers] = await Promise.all([
      dataService.getWebsites(),
      dataService.getAlerts(),
      dataService.getSubscriptions(),
      dataService.getCustomers(),
    ]);
    return { websites, alerts, subscriptions, customers, fromDatabase: false };
  }

  const supabase = await createSupabaseServerClient();
  const [wRes, aRes, sRes, cRes] = await Promise.all([
    supabase.from("websites").select("*").order("created_at", { ascending: false }),
    supabase.from("alerts").select("*").order("created_at", { ascending: false }),
    supabase.from("service_subscriptions").select("*").order("expiry_date", { ascending: true }),
    supabase.from("customers").select("*").order("name", { ascending: true }),
  ]);

  if (wRes.error) throw new Error(wRes.error.message);
  if (aRes.error) throw new Error(aRes.error.message);
  if (sRes.error) throw new Error(sRes.error.message);
  if (cRes.error) throw new Error(cRes.error.message);

  return {
    websites: (wRes.data ?? []).map((r) => mapWebsiteRow(r as WebsiteRow)),
    alerts: (aRes.data ?? []).map((r) => mapAlertRow(r as AlertRow)),
    subscriptions: (sRes.data ?? []).map((r) => mapServiceSubscriptionRow(r as ServiceSubscriptionRow)),
    customers: (cRes.data ?? []).map((r) => mapCustomerRow(r as CustomerRow)),
    fromDatabase: true,
  };
}
