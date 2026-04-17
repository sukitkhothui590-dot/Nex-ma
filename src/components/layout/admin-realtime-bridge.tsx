"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * สมัครรับ Supabase Realtime บนตารางที่เกี่ยวกับสถานะ/แจ้งเตือน — เมื่อมีการเปลี่ยนแปลงจะ refresh ข้อมูลเซิร์ฟเวอร์
 * ให้แดชบอร์ด / เว็บไซต์ / แจ้งเตือน / มอนิเตอร์ สอดคล้องกันแบบเรียลไทม์ (หลายแท็บหรือหลายผู้ใช้)
 */
export function AdminRealtimeBridge() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const refresh = () => {
      routerRef.current.refresh();
    };

    const channel = supabase
      .channel("admin-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "websites" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        refresh,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
