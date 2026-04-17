import { NextResponse } from "next/server";
import { runWebsiteStatusDigestIfDue } from "@/lib/automation/run-website-status-digest";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * เรียกเป็นระยะจาก Vercel Cron / Supabase pg_cron / ปลั๊กอิน scheduler
 * Headers: Authorization: Bearer <CRON_SECRET>
 * Env: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "missing Supabase service role — ตั้ง SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    );
  }

  const r = await runWebsiteStatusDigestIfDue(supabase);
  return NextResponse.json({
    ok: r.ok,
    skipped: r.skipped ?? false,
    detail: r.detail,
    sent: r.sent,
    targets: r.targets,
  });
}
