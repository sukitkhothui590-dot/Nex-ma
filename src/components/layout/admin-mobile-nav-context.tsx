"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type AdminMobileNavContextValue = {
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
};

const AdminMobileNavContext = createContext<AdminMobileNavContextValue | null>(null);

function PathnameCloseEffect() {
  const pathname = usePathname();
  const { closeMobileNav } = useAdminMobileNav();
  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);
  return null;
}

export function AdminMobileNavProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((o) => !o), []);

  const value = useMemo(
    () => ({
      mobileNavOpen,
      openMobileNav,
      closeMobileNav,
      toggleMobileNav,
    }),
    [mobileNavOpen, openMobileNav, closeMobileNav, toggleMobileNav],
  );

  return (
    <AdminMobileNavContext.Provider value={value}>
      <PathnameCloseEffect />
      {children}
    </AdminMobileNavContext.Provider>
  );
}

export function useAdminMobileNav(): AdminMobileNavContextValue {
  const ctx = useContext(AdminMobileNavContext);
  if (!ctx) {
    throw new Error("useAdminMobileNav must be used within AdminMobileNavProvider");
  }
  return ctx;
}

/** backdrop — ใช้เฉพาะเมื่อเปิดเมนูมือถือ */
export function AdminMobileNavBackdrop() {
  const { mobileNavOpen, closeMobileNav } = useAdminMobileNav();
  if (!mobileNavOpen) return null;
  return (
    <button
      type="button"
      aria-label="ปิดเมนู"
      className="fixed inset-0 z-40 touch-manipulation bg-slate-900/45 backdrop-blur-[2px] md:hidden"
      onClick={closeMobileNav}
    />
  );
}
