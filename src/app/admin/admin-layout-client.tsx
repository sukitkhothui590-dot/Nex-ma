"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminMobileNavBackdrop, AdminMobileNavProvider } from "@/components/layout/admin-mobile-nav-context";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminMainHeader } from "@/components/layout/admin-main-header";
import { AdminRealtimeBridge } from "@/components/layout/admin-realtime-bridge";
import { ProtectedShell } from "@/components/layout/protected-shell";

export function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <ProtectedShell expectedRole="admin">
      <AdminRealtimeBridge />
      <AdminMobileNavProvider>
        <div className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-[100vw] flex-1 flex-row overflow-hidden bg-slate-50">
          <AdminMobileNavBackdrop />
          <AdminSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <AdminMainHeader />
            <main className="scrollbar-none flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
              <div className="w-full flex-1 px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8">
                <div className="mx-auto w-full max-w-[min(100%,1680px)]">{children}</div>
              </div>
            </main>
          </div>
        </div>
      </AdminMobileNavProvider>
    </ProtectedShell>
  );
}
