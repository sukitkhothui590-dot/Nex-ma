/** ช่วงส่งสถานะเว็บ — นาที (ขั้นต่ำ 5 นาที สูงสุด 7 วัน) */
export function clampIntervalMinutes(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 60;
  return Math.min(10080, Math.max(5, Math.round(n)));
}
