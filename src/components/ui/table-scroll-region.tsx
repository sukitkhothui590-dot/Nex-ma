import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type TableScrollRegionProps = {
  children: ReactNode;
  /** แสดงใต้ตารางเฉพาะจอมือถือ — ช่วยให้รู้ว่ามีคอลัมน์เลื่อนได้ */
  mobileScrollHint?: string;
  className?: string;
};

export function TableScrollRegion({ children, mobileScrollHint, className }: TableScrollRegionProps) {
  const hint = mobileScrollHint ?? "เลื่อนซ้าย-ขวาเพื่อดูทุกคอลัมน์";
  return (
    <div className={cn("min-w-0", className)}>
      <div className="w-full overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] sm:scrollbar-none">
        {children}
      </div>
      <p className="mt-2 flex items-start gap-1.5 px-0.5 text-[11px] leading-snug text-slate-500 md:hidden">
        <svg
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
        <span>{hint}</span>
      </p>
    </div>
  );
}
