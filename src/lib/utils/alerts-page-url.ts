function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export function parseAlertsUrlState(sp: Record<string, string | string[] | undefined>): { q: string; websiteId: string } {
  const q = first(sp, "q");
  const wid = first(sp, "websiteId");
  const websiteId = /^[0-9a-f-]{36}$/i.test(wid) ? wid : "";
  return { q, websiteId };
}
