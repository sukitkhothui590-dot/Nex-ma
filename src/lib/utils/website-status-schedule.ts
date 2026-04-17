/** ตารางเวลาส่งสถานะเว็บ — เวลาเป็น HH:mm ตาม timezone (ค่าเริ่ม Asia/Bangkok) */

export const WEBSITE_STATUS_DEFAULT_TZ = "Asia/Bangkok";

/** นาทีหลังเวลาที่ตั้งที่ยังถือว่าตรงรอบ (เช่น 5 = 09:00–09:04) — ตั้ง cron ถี่พอ (แนะนำทุก ≤5 นาที) */
export const SLOT_MATCH_WINDOW_MIN = 5;

export type WebsiteStatusRuleConfig = {
  /** โหมดเก่า: ทุก N นาที — ใช้เมื่อไม่มี scheduleTimes */
  intervalMinutes?: number;
  /** หลายช่วงต่อวัน เช่น ["09:00","14:30","18:00"] */
  scheduleTimes?: string[];
  timezone?: string;
  /** วันละครั้งต่อ slot — ป้องกันยิงซ้ำ */
  _firedSlots?: Record<string, string[]>;
};

export function normalizeScheduleTimes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const x of raw) {
    const s = String(x).trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) continue;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) continue;
    out.add(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return [...out].sort();
}

export function minutesFromMidnight(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** เวลาปัจจุบันใน timezone — dateKey YYYY-MM-dd, hm HH:mm */
export function getNowInTimeZone(d: Date, timeZone: string): { dateKey: string; hm: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const mo = get("month");
  const da = get("day");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const h = Number.isFinite(hour) ? String(hour).padStart(2, "0") : "00";
  const mi = Number.isFinite(minute) ? String(minute).padStart(2, "0") : "00";
  return { dateKey: `${y}-${mo}-${da}`, hm: `${h}:${mi}` };
}

/**
 * ช่วงเวลา slot ควรยิงหรือไม่ — เมื่อเวลาปัจจุบันอยู่ในช่วง [slot, slot+window) นาที
 */
export function slotMatchesNow(slotHm: string, nowHm: string, windowMin = SLOT_MATCH_WINDOW_MIN): boolean {
  const a = minutesFromMidnight(slotHm);
  const b = minutesFromMidnight(nowHm);
  if (a === null || b === null) return false;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff >= 0 && diff < windowMin;
}

export function pruneFiredSlots(
  fired: Record<string, string[]> | undefined,
  keepDateKeys: Set<string>,
): Record<string, string[]> {
  if (!fired) return {};
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(fired)) {
    if (keepDateKeys.has(k)) out[k] = fired[k]!;
  }
  return out;
}
