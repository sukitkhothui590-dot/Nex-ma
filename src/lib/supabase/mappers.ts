import type { Alert, Customer, ServiceSubscription, Website } from "@/types/models";

export type CustomerRow = {
  id: string;
  name: string;
  contact_email: string;
  status: string;
};

export type WebsiteRow = {
  id: string;
  customer_id: string;
  name: string;
  logo_url: string | null;
  frontend_url: string | null;
  backend_url: string | null;
  provider: string;
  hosting_type: string;
  status: string;
  contract_status: string;
  contract_expiry_date?: string | null;
  api_key_masked: string;
  created_at: string;
};

export type ServiceSubscriptionRow = {
  id: string;
  customer_id: string;
  service_type: string;
  expiry_date: string;
};

export type AlertRow = {
  id: string;
  website_id: string;
  message: string;
  severity: string;
  status: string;
  created_at: string;
};

export function mapCustomerRow(row: CustomerRow): Customer {
  const status = row.status === "inactive" ? "inactive" : "active";
  return {
    id: row.id,
    name: row.name,
    contactEmail: row.contact_email,
    status,
  };
}

export function mapWebsiteRow(row: WebsiteRow): Website {
  const exp = row.contract_expiry_date?.trim();
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    logoUrl: row.logo_url,
    frontendUrl: row.frontend_url?.trim() ?? "",
    backendUrl: row.backend_url?.trim() ?? "",
    provider: row.provider,
    hostingType: row.hosting_type,
    status: row.status === "offline" ? "offline" : "online",
    contractStatus: row.contract_status === "inactive" ? "inactive" : "active",
    contractExpiryDate: exp && exp.length >= 8 ? exp.slice(0, 10) : null,
    apiKeyMasked: row.api_key_masked ?? "—",
    createdAt: row.created_at,
  };
}

export function mapAlertRow(row: AlertRow): Alert {
  const sev = row.severity;
  const severity: Alert["severity"] =
    sev === "high" || sev === "medium" || sev === "low" ? sev : "low";
  const st = row.status;
  const status: Alert["status"] =
    st === "new" || st === "acknowledged" || st === "resolved" ? st : "new";
  return {
    id: row.id,
    websiteId: row.website_id,
    message: row.message,
    severity,
    status,
    createdAt: row.created_at,
  };
}

export function mapServiceSubscriptionRow(row: ServiceSubscriptionRow): ServiceSubscription {
  const st = row.service_type;
  const serviceType: ServiceSubscription["serviceType"] =
    st === "domain" || st === "hosting" || st === "cloud" || st === "ma" ? st : "domain";
  return {
    id: row.id,
    customerId: row.customer_id,
    serviceType,
    expiryDate: row.expiry_date.includes("T") ? row.expiry_date.slice(0, 10) : row.expiry_date,
  };
}
