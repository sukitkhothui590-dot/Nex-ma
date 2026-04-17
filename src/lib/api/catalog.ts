/** รายการ endpoint สำหรับ discovery — อัปเดตเมื่อเพิ่ม route ใหม่ */

export type ApiEndpointInfo = {
  path: string;
  methods: string[];
  auth: "none" | "session" | "bearer_cron";
  description: string;
};

export const APP_VERSION = "0.1.0";

export const API_ENDPOINTS: ApiEndpointInfo[] = [
  {
    path: "/api/health",
    methods: ["GET"],
    auth: "none",
    description: "ตรวจว่าแอปทำงานและเชื่อม Supabase (anon) ได้หรือไม่",
  },
  {
    path: "/api/v1",
    methods: ["GET"],
    auth: "none",
    description: "รายการ API (discovery)",
  },
  {
    path: "/api/cron/website-status",
    methods: ["GET"],
    auth: "bearer_cron",
    description: "รันส่งสถานะเว็บตามกำหนดเวลา — Header Authorization: Bearer CRON_SECRET",
  },
  {
    path: "/api/monitor/probe",
    methods: ["GET"],
    auth: "session",
    description: "สำรวจ HTTP ทุกเว็บ อัปเดตสถานะ และสร้าง alert เมื่อหลุดออนไลน์ — ต้องล็อกอิน",
  },
  {
    path: "/api/site-brand",
    methods: ["GET"],
    auth: "session",
    description: "ดึง og:image / favicon จาก URL — query ?url= — ต้องล็อกอิน",
  },
];
