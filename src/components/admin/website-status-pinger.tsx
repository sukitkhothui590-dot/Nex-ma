"use client";

import { useEffect, useRef } from "react";
import { pollWebsiteStatusScheduleAction } from "@/app/admin/automation/actions";

/**
 * Client-side pinger — เรียก server action ทุก 60 วินาทีเมื่อผู้ใช้อยู่หน้า admin
 * ใช้สำรองกรณียังไม่ตั้ง external cron / SUPABASE_SERVICE_ROLE_KEY
 * ยิงเฉพาะตอน tab active (document.hidden === false) เพื่อประหยัด
 */
const TICK_MS = 60_000;

export function WebsiteStatusPinger() {
  const runningRef = useRef(false);

  useEffect(() => {
    let stopped = false;

    const tick = async () => {
      if (stopped || runningRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      runningRef.current = true;
      try {
        await pollWebsiteStatusScheduleAction();
      } catch {
        // เงียบไว้ — pinger ทำงานเบื้องหลัง
      } finally {
        runningRef.current = false;
      }
    };

    void tick();
    const id = setInterval(tick, TICK_MS);
    const onVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
