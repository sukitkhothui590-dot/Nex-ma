import type { ServiceSubscription, Website } from "@/types/models";

const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * รวมรายการ subscription กับวันหมดอายุจากเว็บ (`contractExpiryDate`) เพื่อใช้ในแดชบอร์ด / แผงต่ออายุ
 */
export function mergeSubscriptionsWithWebsiteExpiries(
  subscriptions: ServiceSubscription[],
  websites: Website[],
): ServiceSubscription[] {
  const fromWebsites: ServiceSubscription[] = websites
    .map((w) => {
      const d = w.contractExpiryDate?.trim().slice(0, 10) ?? "";
      if (!d || !isoDate(d)) return null;
      const row: ServiceSubscription = {
        id: `website-expiry:${w.id}`,
        customerId: w.customerId,
        serviceType: "ma",
        expiryDate: d,
        websiteId: w.id,
      };
      return row;
    })
    .filter((x): x is ServiceSubscription => x !== null);
  return [...subscriptions, ...fromWebsites];
}
