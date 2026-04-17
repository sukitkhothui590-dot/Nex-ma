import type { Alert } from "@/types/models";

/** สถิติแจ้งเตือนต่อเว็บ — นับเฉพาะที่ยังไม่ปิดเรื่อง */
export type WebsiteAlertStats = {
  open: number;
  newCount: number;
  latestAt: string | null;
};

export function aggregateAlertStatsByWebsite(alerts: Alert[]): Record<string, WebsiteAlertStats> {
  const map: Record<string, WebsiteAlertStats> = {};
  for (const a of alerts) {
    const id = a.websiteId;
    if (!map[id]) {
      map[id] = { open: 0, newCount: 0, latestAt: null };
    }
    const m = map[id]!;
    const t = new Date(a.createdAt).getTime();
    if (m.latestAt === null || t > new Date(m.latestAt).getTime()) {
      m.latestAt = a.createdAt;
    }
    if (a.status !== "resolved") {
      m.open += 1;
      if (a.status === "new") m.newCount += 1;
    }
  }
  return map;
}

/** จำนวนวันจากวันนี้ถึงวันหมดอายุ (yyyy-mm-dd) — ค่าลบ = เลยกำหนดแล้ว */
export function daysUntilDateYmd(ymd: string | null | undefined): number | null {
  if (!ymd?.trim()) return null;
  const d = new Date(`${ymd.trim().slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const t1 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((t1 - t0) / 86400000);
}

/** สัญญาใกล้หมดหรือเลยกำหนดภายใน 14 วัน (ใช้กับสัญญา active ที่มีวันหมด) */
export function isContractExpiringWithinDays(
  contractExpiryDate: string | null | undefined,
  contractStatus: "active" | "inactive",
  withinDays = 14,
): boolean {
  if (contractStatus !== "active") return false;
  const days = daysUntilDateYmd(contractExpiryDate ?? null);
  if (days === null) return false;
  return days <= withinDays;
}
