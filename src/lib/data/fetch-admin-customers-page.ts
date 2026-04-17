import type { Customer, ServiceSubscription, Website } from "@/types/models";
import { dataService } from "@/lib/services/data-service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapCustomerRow,
  mapServiceSubscriptionRow,
  mapWebsiteRow,
  type CustomerRow,
  type ServiceSubscriptionRow,
  type WebsiteRow,
} from "@/lib/supabase/mappers";

export type AdminCustomersPageData = {
  customers: Customer[];
  websites: Website[];
  subscriptions: ServiceSubscription[];
  fromDatabase: boolean;
};

export async function fetchAdminCustomersPageData(): Promise<AdminCustomersPageData> {
  if (!isSupabaseConfigured()) {
    const [customers, websites, subscriptions] = await Promise.all([
      dataService.getCustomers(),
      dataService.getWebsites(),
      dataService.getSubscriptions(),
    ]);
    return { customers, websites, subscriptions, fromDatabase: false };
  }

  const supabase = await createSupabaseServerClient();

  const [cRes, wRes, sRes] = await Promise.all([
    supabase.from("customers").select("*").order("name", { ascending: true }),
    supabase.from("websites").select("*").order("created_at", { ascending: false }),
    supabase.from("service_subscriptions").select("*").order("expiry_date", { ascending: true }),
  ]);

  if (cRes.error) throw new Error(cRes.error.message);
  if (wRes.error) throw new Error(wRes.error.message);
  if (sRes.error) throw new Error(sRes.error.message);

  return {
    customers: (cRes.data ?? []).map((r) => mapCustomerRow(r as CustomerRow)),
    websites: (wRes.data ?? []).map((r) => mapWebsiteRow(r as WebsiteRow)),
    subscriptions: (sRes.data ?? []).map((r) => mapServiceSubscriptionRow(r as ServiceSubscriptionRow)),
    fromDatabase: true,
  };
}
