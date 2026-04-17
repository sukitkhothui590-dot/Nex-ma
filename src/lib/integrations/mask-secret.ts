/** แสดง URL/token แบบมาสก์ — ไม่โชว์เต็มใน UI */
export function maskIntegrationSecret(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "ยังไม่ได้ตั้งค่า";
  if (s.length <= 12) return "••••••••";
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}
