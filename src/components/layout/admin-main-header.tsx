"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getNewAlertsCountAction } from "@/app/admin/alerts/actions";
import { ADMIN_ALERTS_CHANGED_EVENT } from "@/lib/admin-events";
import { mockAuth } from "@/lib/services/mock-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getBaselineProfile,
  getEffectiveProfile,
  MOCK_PROFILE_UPDATED_EVENT,
  type EffectiveProfile,
} from "@/lib/services/mock-user-profile";
import { UserProfileSettingsModal } from "@/components/layout/user-profile-settings-modal";
import { useAdminMobileNav } from "@/components/layout/admin-mobile-nav-context";

const routeTitles: Record<string, string> = {
  "/admin/dashboard": "แดชบอร์ด",
  "/admin/customers": "ลูกค้า",
  "/admin/websites": "ข้อมูลเว็บไซต์",
  "/admin/alerts": "แจ้งเตือน",
  "/admin/automation": "ออโตเมชัน",
  "/admin/integrations": "เชื่อมต่อระบบ",
  "/admin/monitor": "มอนิเตอร์",
};

const routeSubtitles: Partial<Record<string, string>> = {
  "/admin/dashboard": "สรุปภาพรวมและงานที่ต้องลงมือ",
  "/admin/customers": "รายชื่อลูกค้าและการติดต่อ",
  "/admin/websites": "เว็บไซต์ โดเมน และลิงก์เข้าใช้งาน",
  "/admin/alerts": "ติดตามเหตุและสถานะการดำเนินการ",
  "/admin/automation": "กฎแจ้งเตือนและงานอัตโนมัติ",
  "/admin/integrations": "Discord, LINE, Teams และ Webhook",
  "/admin/monitor": "สถานะเว็บ เหตุการณ์ และต่ออายุบริการ",
};

export const AdminMainHeader = () => {
  const { openMobileNav } = useAdminMobileNav();
  const pathname = usePathname();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<EffectiveProfile>(() => getBaselineProfile("admin"));
  const [newAlertCount, setNewAlertCount] = useState(0);

  useEffect(() => {
    const load = () => {
      void getNewAlertsCountAction().then(setNewAlertCount);
    };
    load();
    window.addEventListener(ADMIN_ALERTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(ADMIN_ALERTS_CHANGED_EVENT, load);
  }, []);

  useEffect(() => {
    const sync = () => setProfile(getEffectiveProfile("admin"));
    sync();
    window.addEventListener(MOCK_PROFILE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(MOCK_PROFILE_UPDATED_EVENT, sync);
  }, []);

  const title = routeTitles[pathname] ?? "ผู้ดูแลระบบ";
  const subtitle = routeSubtitles[pathname];

  const logout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    } else {
      mockAuth.clearRole();
    }
    router.refresh();
    router.push("/login?role=admin");
  };

  const copyPageUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-profile-menu]") || t.closest("[data-profile-trigger]")) return;
      setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  const profileInitial = profile.name.trim().charAt(0).toUpperCase() || "A";

  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-start justify-between gap-2 border-b border-slate-200/80 bg-white px-3 py-2.5 sm:items-center sm:gap-3 sm:px-6 sm:py-3.5 md:z-40 md:bg-white/80 md:backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center sm:gap-3">
        <button
          type="button"
          className="mt-0.5 flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-sm md:hidden"
          onClick={openMobileNav}
          aria-label="เปิดเมนูนำทาง"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-indigo-700/90 sm:text-[11px]">
            ระบบ MA Alert · ผู้ดูแล
          </p>
          <h1 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-slate-900 sm:text-lg md:text-xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 sm:text-xs">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex max-w-[calc(100vw-12rem)] shrink-0 flex-wrap items-center justify-end gap-0.5 sm:max-w-none sm:gap-2">
        <Link
          href="/admin/alerts"
          className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2"
          aria-label={`แจ้งเตือน${newAlertCount > 0 ? ` (${newAlertCount} รายการใหม่)` : ""}`}
          title="ไปหน้าแจ้งเตือน"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {newAlertCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
              {newAlertCount > 9 ? "9+" : newAlertCount}
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={() => {
            void copyPageUrl();
          }}
          className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2"
          title="คัดลอกลิงก์หน้านี้"
          aria-label="คัดลอกลิงก์หน้านี้"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </button>
        {copied ? (
          <span className="hidden text-xs font-medium text-indigo-700 sm:inline" role="status">
            คัดลอกแล้ว
          </span>
        ) : null}

        <div className="relative shrink-0">
          <button
            type="button"
            data-profile-trigger
            onClick={() => setProfileOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-gradient-to-br from-indigo-600 to-indigo-700 text-sm font-bold text-white shadow-sm ring-offset-2 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80"
            aria-expanded={profileOpen}
            aria-haspopup="dialog"
            aria-label="เปิดโปรไฟล์ผู้ใช้"
          >
            {profile.avatarDataUrl ? (
              <Image
                src={profile.avatarDataUrl}
                alt=""
                width={36}
                height={36}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              profileInitial
            )}
          </button>
          {profileOpen ? (
            <div
              data-profile-menu
              className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,18rem)] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-lg shadow-slate-900/10"
              role="dialog"
              aria-label="โปรไฟล์ผู้ใช้"
            >
              <div className="flex items-start gap-3">
                {profile.avatarDataUrl ? (
                  <Image
                    src={profile.avatarDataUrl}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-lg font-bold text-white">
                    {profileInitial}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{profile.name}</p>
                  <p className="truncate text-sm text-slate-500">{profile.email}</p>
                  <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                    ผู้ดูแลระบบ
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setProfileOpen(false);
                    setSettingsOpen(true);
                  }}
                >
                  <span className="text-slate-400" aria-hidden>
                    ✎
                  </span>
                  แก้ไขโปรไฟล์
                </button>
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="text-slate-400" aria-hidden>
                    ✉
                  </span>
                  ส่งอีเมล
                </a>
                <Link
                  href="/admin/dashboard"
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setProfileOpen(false)}
                >
                  <span className="text-slate-400" aria-hidden>
                    ⚙
                  </span>
                  ไปแดชบอร์ด
                </Link>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">บันทึกในเบราว์เซอร์ (โหมดจำลอง)</p>
            </div>
          ) : null}
        </div>

        <UserProfileSettingsModal role="admin" open={settingsOpen} onClose={() => setSettingsOpen(false)} />

        <Button
          type="button"
          variant="secondary"
          onClick={logout}
          aria-label="ออกจากระบบ"
          className="touch-manipulation border-slate-200 px-2.5 text-xs sm:px-4 sm:text-sm"
        >
          <span className="hidden sm:inline">ออกจากระบบ</span>
          <span className="sm:hidden" aria-hidden>
            ออก
          </span>
        </Button>
      </div>
    </header>
  );
};
