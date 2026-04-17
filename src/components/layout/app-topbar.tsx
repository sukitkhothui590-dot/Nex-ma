"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import type { UserRole } from "@/types/models";

export const AppTopbar = ({ title, role }: { title: string; role: UserRole }) => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<EffectiveProfile>(() => getBaselineProfile(role));

  useEffect(() => {
    const sync = () => setProfile(getEffectiveProfile(role));
    sync();
    window.addEventListener(MOCK_PROFILE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(MOCK_PROFILE_UPDATED_EVENT, sync);
  }, [role]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-profile-menu]") || t.closest("[data-profile-trigger]")) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
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
    router.push(`/login?role=${role}`);
  };

  const initial = profile.name.trim().charAt(0).toUpperCase() || "?";
  const roleLabel = "ผู้ดูแลระบบ";

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-surface px-4 py-3">
        <h2 className="min-w-0 truncate text-sm font-semibold tracking-wide text-muted">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <button
              type="button"
              data-profile-trigger
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200/80 bg-gradient-to-br from-indigo-600 to-indigo-700 text-sm font-bold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              aria-label="เปิดเมนูบัญชี"
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
                initial
              )}
            </button>
            {menuOpen ? (
              <div
                data-profile-menu
                className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-lg"
                role="dialog"
                aria-label="บัญชี"
              >
                <div className="flex items-start gap-2 px-1 py-1">
                  {profile.avatarDataUrl ? (
                    <Image
                      src={profile.avatarDataUrl}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 text-sm font-bold text-white">
                      {initial}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{profile.name}</p>
                    <p className="truncate text-xs text-slate-500">{profile.email}</p>
                    <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                      {roleLabel}
                    </span>
                  </div>
                </div>
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setMenuOpen(false);
                      setSettingsOpen(true);
                    }}
                  >
                    แก้ไขโปรไฟล์
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <Button variant="secondary" onClick={handleLogout}>
            ออกจากระบบ
          </Button>
        </div>
      </div>
      <UserProfileSettingsModal role={role} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
};
