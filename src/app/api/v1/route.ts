import { apiJson } from "@/lib/api/response";
import { API_ENDPOINTS, APP_VERSION } from "@/lib/api/catalog";

export const dynamic = "force-dynamic";

/** API discovery — รายการ endpoint ที่มีในระบบ */
export async function GET() {
  return apiJson({
    ok: true,
    service: "web-management-ma-alert-system",
    version: APP_VERSION,
    docs: "ดูรายละเอียดแต่ละเส้นใน src/lib/api/catalog.ts และ comment ใน route",
    endpoints: API_ENDPOINTS,
  });
}
