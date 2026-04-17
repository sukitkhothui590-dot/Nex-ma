import { apiJson } from "@/lib/api/response";
import { APP_VERSION } from "@/lib/api/catalog";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * Health check — ไม่ต้อง auth (ใช้กับ load balancer / uptime monitor)
 */
export async function GET() {
  return apiJson({
    ok: true,
    service: "web-management-ma-alert-system",
    version: APP_VERSION,
    supabaseConfigured: isSupabaseConfigured(),
    timestamp: new Date().toISOString(),
  });
}
