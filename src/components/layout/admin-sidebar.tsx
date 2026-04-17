"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getNewAlertsCountAction } from "@/app/admin/alerts/actions";
import { ADMIN_ALERTS_CHANGED_EVENT } from "@/lib/admin-events";
import { useAdminMobileNav } from "@/components/layout/admin-mobile-nav-context";
import { cn } from "@/lib/utils/cn";
import { useMinWidthMd } from "@/lib/utils/use-min-width-md";

const STORAGE_KEY = "admin-sidebar-collapsed";

interface MainNavItem {
  href: string;
  label: string;
  icon: "home" | "users" | "globe" | "bell";
  badge?: number;
}

interface GroupNavItem {
  href: string;
  label: string;
  dotClass: string;
}

const groupNav: GroupNavItem[] = [
  { href: "/admin/automation", label: "ออโตเมชัน", dotClass: "bg-slate-400" },
  { href: "/admin/integrations", label: "เชื่อมต่อระบบ", dotClass: "bg-amber-400" },
  { href: "/admin/monitor", label: "มอนิเตอร์", dotClass: "bg-cyan-400" },
  { href: "/admin/audit", label: "Audit log", dotClass: "bg-violet-500" },
];

function NavIcon({
  name,
  className,
}: {
  name: MainNavItem["icon"];
  className?: string;
}) {
  const c = cn("h-5 w-5 shrink-0", className);
  switch (name) {
    case "home":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1V9.5z" strokeLinejoin="round" />
        </svg>
      );
    case "users":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "globe":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
        </svg>
      );
    case "bell":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    default:
      return null;
  }
}

function ChevronRightTiny({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 shrink-0 opacity-50", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export const AdminSidebar = () => {
  const activePath = usePathname();
  const { mobileNavOpen, closeMobileNav } = useAdminMobileNav();
  const isMd = useMinWidthMd();
  const [collapsed, setCollapsed] = useState(false);
  const [alertBadge, setAlertBadge] = useState<number | null>(null);
  /** มือถือ: แสดงเมนูเต็มเสมอเมื่อเปิด drawer — ไม่ย่อไอคอนอย่างเดียว */
  const effectiveCollapsed = collapsed && isMd;

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const load = () => {
      void getNewAlertsCountAction().then(setAlertBadge);
    };
    load();
    window.addEventListener(ADMIN_ALERTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(ADMIN_ALERTS_CHANGED_EVENT, load);
  }, []);

  const mainNav = useMemo((): MainNavItem[] => {
    const n = alertBadge ?? 0;
    return [
      { href: "/admin/dashboard", label: "แดชบอร์ด", icon: "home" },
      { href: "/admin/customers", label: "ลูกค้า", icon: "users" },
      { href: "/admin/websites", label: "เว็บไซต์", icon: "globe" },
      { href: "/admin/alerts", label: "แจ้งเตือน", icon: "bell", badge: n > 0 ? n : undefined },
    ];
  }, [alertBadge]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-slate-200/80 bg-white/75 backdrop-blur-md transition-[transform,width] duration-300 ease-out max-md:bg-white max-md:backdrop-blur-none",
        "md:relative md:z-30 md:shrink-0 md:translate-x-0",
        effectiveCollapsed ? "md:w-[72px]" : "md:w-[248px]",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[min(280px,88vw)] max-md:shadow-2xl",
        mobileNavOpen ? "max-md:translate-x-0" : "max-md:pointer-events-none max-md:-translate-x-full",
      )}
    >
      <div className={cn("flex pt-1 max-md:hidden", effectiveCollapsed ? "justify-center px-2" : "justify-end px-4")}>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "flex h-9 w-9 touch-manipulation items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2",
          )}
          aria-expanded={!effectiveCollapsed}
          aria-label={effectiveCollapsed ? "ขยายเมนู" : "ย่อเมนู"}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {effectiveCollapsed ? (
              <path d="m9 18 6-6-6-6" />
            ) : (
              <g>
                <path d="m11 17-5-5 5-5" />
                <path d="m18 17-5-5 5-5" />
              </g>
            )}
          </svg>
        </button>
      </div>

      {/* Brand */}
      <div className={cn("border-b border-slate-100", effectiveCollapsed ? "px-2 py-3 max-md:px-4" : "px-4 py-3")}>
        <Link
          href="/admin/dashboard"
          onClick={() => closeMobileNav()}
          className={cn(
            "flex items-center gap-3 rounded-xl transition hover:bg-slate-50",
            effectiveCollapsed ? "justify-center p-1 max-md:justify-start" : "px-1 py-0.5",
          )}
          title="แดชบอร์ด"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-sm font-bold tracking-tight text-white shadow-sm">
            M
          </div>
          {!effectiveCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
                MA Alert <span className="text-indigo-600">&gt;</span>
              </p>
              <p className="text-xs text-slate-500">ผู้ดูแลระบบ</p>
            </div>
          ) : null}
        </Link>
      </div>

      <nav className="scrollbar-none flex min-h-0 flex-1 flex-col space-y-6 overflow-y-auto overflow-x-hidden px-2 py-4 md:px-3">
        {/* เมนูหลัก — ไอคอน + ข้อความ */}
        <div>
          <p
            className={cn(
              "mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400",
              effectiveCollapsed && "sr-only",
            )}
          >
            เมนู
          </p>
          <div className="space-y-1">
            {mainNav.map((item) => {
              const active = activePath === item.href;
              const hasAlert = item.badge != null && item.badge > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => closeMobileNav()}
                  title={effectiveCollapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex touch-manipulation items-center rounded-xl py-2.5 text-sm font-semibold transition-colors motion-safe:duration-200",
                    effectiveCollapsed ? "justify-center px-0" : "gap-3 pl-3 pr-2",
                    active
                      ? "bg-indigo-50 text-indigo-950 shadow-sm shadow-slate-900/5"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {active ? (
                    <span
                      className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-600 motion-safe:transition-transform motion-safe:duration-200"
                      aria-hidden
                    />
                  ) : null}
                  <span className={cn("relative flex shrink-0", effectiveCollapsed && hasAlert && "relative")}>
                    <NavIcon
                      name={item.icon}
                      className={cn(
                        active ? "text-indigo-700" : "text-slate-500 group-hover:text-slate-800",
                      )}
                    />
                    {effectiveCollapsed && hasAlert ? (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                  {!effectiveCollapsed ? (
                    <>
                      <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                      {hasAlert ? (
                        <span className="relative flex items-center gap-1.5">
                          {item.badge != null && item.badge > 0 ? (
                            <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                              {item.badge}
                            </span>
                          ) : null}
                          <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500 ring-2 ring-white" title="มีรายการใหม่" />
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        {/* กลุ่ม — จุดสี + chevron แบบไกด์ */}
        <div>
          <p
            className={cn(
              "mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400",
              effectiveCollapsed && "sr-only",
            )}
          >
            กลุ่ม
          </p>
          <div className="space-y-0.5">
            {groupNav.map((item) => {
              const active = activePath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => closeMobileNav()}
                  title={effectiveCollapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex touch-manipulation items-center rounded-xl py-2.5 text-sm font-semibold transition-colors motion-safe:duration-200",
                    effectiveCollapsed ? "justify-center px-0" : "gap-3 pl-3 pr-2",
                    active
                      ? "bg-indigo-50 text-indigo-950"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {active ? (
                    <span
                      className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-600 motion-safe:transition-transform motion-safe:duration-200"
                      aria-hidden
                    />
                  ) : null}
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full shadow-sm", item.dotClass)} aria-hidden />
                  {!effectiveCollapsed ? (
                    <>
                      <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                      <ChevronRightTiny className="text-slate-400 group-hover:text-slate-600" />
                    </>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

    </aside>
  );
};
