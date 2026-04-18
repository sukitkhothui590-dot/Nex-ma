"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * ตัวเลือกเวลาแบบ 24 ชม. ล้วน (ไม่มี AM/PM) — ไม่พึ่ง locale ของเบราว์เซอร์
 * value/onChange เป็นสตริง HH:mm
 */
export function TimeInput24({
  value,
  onChange,
  disabled,
  minuteStep = 1,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  minuteStep?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const { h, m } = useMemo(() => parseHm(value), [value]);

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")),
    [],
  );
  const minutes = useMemo(() => {
    const step = Math.max(1, Math.min(30, Math.floor(minuteStep)));
    const arr: string[] = [];
    for (let i = 0; i < 60; i += step) arr.push(String(i).padStart(2, "0"));
    if (!arr.includes(String(m).padStart(2, "0"))) {
      arr.push(String(m).padStart(2, "0"));
      arr.sort();
    }
    return arr;
  }, [minuteStep, m]);

  const base =
    "h-9 rounded-lg border border-slate-200 bg-white px-2 font-mono text-sm tabular-nums text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="group"
      aria-label={ariaLabel ?? "เลือกเวลา (24 ชม.)"}
    >
      <select
        aria-label="ชั่วโมง"
        disabled={disabled}
        value={String(h).padStart(2, "0")}
        onChange={(e) => onChange(formatHm(Number(e.target.value), m))}
        className={base}
      >
        {hours.map((hh) => (
          <option key={hh} value={hh}>
            {hh}
          </option>
        ))}
      </select>
      <span className="text-sm text-slate-500">:</span>
      <select
        aria-label="นาที"
        disabled={disabled}
        value={String(m).padStart(2, "0")}
        onChange={(e) => onChange(formatHm(h, Number(e.target.value)))}
        className={base}
      >
        {minutes.map((mm) => (
          <option key={mm} value={mm}>
            {mm}
          </option>
        ))}
      </select>
    </div>
  );
}

function parseHm(raw: string): { h: number; m: number } {
  const s = String(raw ?? "").trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{1,2})?$/.exec(s);
  if (!match) return { h: 9, m: 0 };
  const h = clamp(Number(match[1]), 0, 23);
  const m = clamp(Number(match[2]), 0, 59);
  return { h, m };
}

function formatHm(h: number, m: number): string {
  const hh = clamp(h, 0, 23);
  const mm = clamp(m, 0, 59);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}
