/**
 * ทดสอบส่ง ping ไปยังผู้ให้บริการ — เรียกจาก Server Action เท่านั้น
 */
import { deliverIntegration, type PingResult } from "./delivery";

export type { PingResult };

export async function runIntegrationPing(providerId: string, secret: string): Promise<PingResult> {
  return deliverIntegration(providerId, secret, { kind: "test" });
}
