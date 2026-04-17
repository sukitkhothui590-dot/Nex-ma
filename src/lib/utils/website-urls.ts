import { getHostname } from "@/lib/utils/url";

/** ตัดช่องว่าง — รองรับค่า null/undefined จาก DB แบบใหม่หรือข้อมูลเก่า */
export function normalizeUrlField(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/**
 * URL หลักสำหรับลิงก์/โดเมน/ค้นหา — หน้าบ้านก่อน ถ้าไม่มีใช้หลังบ้าน
 * (สคีมาเก่า: ทั้งคู่มีค่าเสมอ — สคีมาใหม่อนุญาตให้มีอย่างใดอย่างหนึ่ง)
 */
export function primarySiteUrl(w: { frontendUrl?: string | null; backendUrl?: string | null }): string {
  const fe = normalizeUrlField(w.frontendUrl);
  const be = normalizeUrlField(w.backendUrl);
  return fe || be;
}

/** โดเมนที่แสดงจาก URL หลัก — ว่างถ้าไม่มี URL */
export function siteDisplayHostname(w: { frontendUrl?: string | null; backendUrl?: string | null }): string {
  const p = primarySiteUrl(w);
  return p ? getHostname(p) : "";
}

/**
 * สำหรับ DB แบบเก่า (frontend_url / backend_url NOT NULL):
 * ถ้าฝั่งหนึ่งเป็น null ให้สะท้อนจากอีกฝั่งที่มีค่า เพื่อให้บันทึกผ่านโดยไม่เปลี่ยนพฤติกรรมบน DB แบบใหม่ที่รองรับ null
 */
export function coerceUrlsForLegacyNotNullColumns(
  fe: string | null,
  be: string | null,
): { frontend_url: string | null; backend_url: string | null } {
  let outFe = fe;
  let outBe = be;
  if (outFe == null && outBe) outFe = outBe;
  if (outBe == null && outFe) outBe = outFe;
  return { frontend_url: outFe, backend_url: outBe };
}
