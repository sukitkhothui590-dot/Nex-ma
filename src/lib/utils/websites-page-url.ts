/** สถานะตัวกรองหน้า /admin/websites — sync กับ query string */

export type WebsitesUrlState = {
  q: string;
  statusFilter: "all" | "online" | "offline";
  contractFilter: "all" | "active" | "inactive";
  customerFilter: string;
  providerFilter: string;
  sortBy: "name" | "createdAt" | "domain" | "expiry";
  sortDir: "asc" | "desc";
  pageSize: 10 | 25 | 50;
  expiringOnly: boolean;
};

const DEFAULTS: WebsitesUrlState = {
  q: "",
  statusFilter: "all",
  contractFilter: "all",
  customerFilter: "all",
  providerFilter: "all",
  sortBy: "createdAt",
  sortDir: "desc",
  pageSize: 10,
  expiringOnly: false,
};

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export function parseWebsitesUrlState(sp: Record<string, string | string[] | undefined>): WebsitesUrlState {
  const q = first(sp, "q");
  const status = first(sp, "status");
  const statusFilter: WebsitesUrlState["statusFilter"] =
    status === "online" || status === "offline" ? status : "all";

  const contract = first(sp, "contract");
  const contractFilter: WebsitesUrlState["contractFilter"] =
    contract === "active" || contract === "inactive" ? contract : "all";

  const customer = first(sp, "customer");
  const customerFilter = customer && /^[0-9a-f-]{36}$/i.test(customer) ? customer : "all";

  const provider = first(sp, "provider");
  const providerFilter = provider || "all";

  const sort = first(sp, "sort");
  const sortBy: WebsitesUrlState["sortBy"] =
    sort === "name" || sort === "domain" || sort === "expiry" || sort === "createdAt" ? sort : DEFAULTS.sortBy;

  const dir = first(sp, "dir");
  const sortDir: WebsitesUrlState["sortDir"] = dir === "asc" || dir === "desc" ? dir : DEFAULTS.sortDir;

  const ps = first(sp, "ps");
  const pageSize: WebsitesUrlState["pageSize"] =
    ps === "25" ? 25 : ps === "50" ? 50 : ps === "10" ? 10 : DEFAULTS.pageSize;

  const exp = first(sp, "exp");
  const expiringOnly = exp === "1" || exp === "true";

  return {
    q,
    statusFilter,
    contractFilter,
    customerFilter,
    providerFilter: providerFilter === "all" || !providerFilter ? "all" : providerFilter,
    sortBy,
    sortDir,
    pageSize,
    expiringOnly,
  };
}

export function websitesUrlStateToSearchParams(s: WebsitesUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set("q", s.q.trim());
  if (s.statusFilter !== "all") p.set("status", s.statusFilter);
  if (s.contractFilter !== "all") p.set("contract", s.contractFilter);
  if (s.customerFilter !== "all") p.set("customer", s.customerFilter);
  if (s.providerFilter !== "all") p.set("provider", encodeURIComponent(s.providerFilter));
  if (s.sortBy !== DEFAULTS.sortBy) p.set("sort", s.sortBy);
  if (s.sortDir !== DEFAULTS.sortDir) p.set("dir", s.sortDir);
  if (s.pageSize !== DEFAULTS.pageSize) p.set("ps", String(s.pageSize));
  if (s.expiringOnly) p.set("exp", "1");
  return p;
}
