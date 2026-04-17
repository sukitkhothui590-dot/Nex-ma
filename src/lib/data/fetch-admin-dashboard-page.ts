import type { Alert, Customer, DashboardSummary, ServiceSubscription, Website } from "@/types/models";
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

export type AdminDashboardPageData = {
  summary: DashboardSummary;
  websites: Website[];
  alerts: Alert[];
  subscriptions: ServiceSubscription[];
  customers: Customer[];
};

function summaryFromWebsites(websites: Website[]): DashboardSummary {
  return {
    totalWebsites: websites.length,
    activeWebsites: websites.filter((w) => w.contractStatus === "active").length,
    inactiveWebsites: websites.filter((w) => w.contractStatus === "inactive").length,
    downWebsites: websites.filter((w) => w.status === "offline").length,
  };
}

export async function fetchAdminDashboardPageData(): Promise<AdminDashboardPageData> {
  if (!isSupabaseConfigured()) {
    const [summary, websites, alerts, subscriptions, customers] = await Promise.all([
      dataService.getAdminSummary(),
      dataService.getWebsites(),
      dataService.getAlerts(),
      dataService.getSubscriptions(),
      dataService.getCustomers(),
    ]);
    return { summary, websites, alerts, subscriptions, customers };
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

  const websites = (wRes.data ?? []).map((r) => mapWebsiteRow(r as WebsiteRow));
  return {
    summary: summaryFromWebsites(websites),
    websites,
    alerts: (aRes.data ?? []).map((r) => mapAlertRow(r as AlertRow)),
    subscriptions: (sRes.data ?? []).map((r) => mapServiceSubscriptionRow(r as ServiceSubscriptionRow)),
    customers: (cRes.data ?? []).map((r) => mapCustomerRow(r as CustomerRow)),
  };
}
