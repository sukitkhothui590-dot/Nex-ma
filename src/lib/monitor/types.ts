export type MonitorProbeItem = {
  id: string;
  /** URL ที่ใช้ตรวจ (หลังใส่สคีมา) */
  url: string;
  online: boolean;
  latencyMs: number;
  statusCode?: number;
  method: "HEAD" | "GET";
  /** URL สุดท้ายหลัง redirect */
  finalUrl?: string;
  redirected: boolean;
  error?: string;
};
