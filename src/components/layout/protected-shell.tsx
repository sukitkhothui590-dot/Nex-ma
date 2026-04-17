"use client";

import { ReactNode, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { mockAuth } from "@/lib/services/mock-auth";
import { UserRole } from "@/types/models";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const ProtectedShell = ({
  children,
  expectedRole,
}: {
  children: ReactNode;
  expectedRole: UserRole;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useLayoutEffect(() => {
    let cancelled = false;

    const goLogin = () => {
      router.replace(`/login?role=${expectedRole}&next=${encodeURIComponent(pathname)}`);
    };

    if (!isSupabaseConfigured()) {
      if (mockAuth.getRole() !== expectedRole) {
        goLogin();
        queueMicrotask(() => {
          setReady(true);
          setAllowed(false);
        });
        return;
      }
      queueMicrotask(() => {
        setAllowed(true);
        setReady(true);
      });
      return;
    }

    let subscription: { unsubscribe: () => void } | undefined;

    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          goLogin();
          setReady(true);
          setAllowed(false);
          return;
        }
        setAllowed(true);
        setReady(true);

        const {
          data: { subscription: sub },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          if (!session?.user) goLogin();
        });
        subscription = sub;
      } catch {
        if (!cancelled) {
          goLogin();
          setReady(true);
          setAllowed(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [expectedRole, pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">
        กำลังตรวจสอบสิทธิ์…
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
};
