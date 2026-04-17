export type UserRole = "admin";

export type AlertStatus = "new" | "acknowledged" | "resolved";
export type AlertSeverity = "low" | "medium" | "high";
export type WebsiteStatus = "online" | "offline";
export type RecordStatus = "active" | "inactive";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface Customer {
  id: string;
  name: string;
  contactEmail: string;
  status: RecordStatus;
}

export interface Website {
  id: string;
  customerId: string;
  name: string;
  /** ถ้ามีจะใช้แทน favicon จากโดเมน */
  logoUrl?: string | null;
  frontendUrl: string;
  backendUrl: string;
  provider: string;
  hostingType: string;
  status: WebsiteStatus;
  contractStatus: RecordStatus;
  /** วันหมดอายุสัญญา/MA ตามเว็บ (yyyy-mm-dd) — null = ยังไม่กำหนด */
  contractExpiryDate?: string | null;
  /** ISO date string — วันที่สร้าง/ลงทะเบียนในระบบ (mock) */
  createdAt: string;
  /** ข้อความแสดงแทน API key (mock) */
  apiKeyMasked: string;
}

export interface ServiceSubscription {
  id: string;
  customerId: string;
  serviceType: "domain" | "hosting" | "cloud" | "ma";
  expiryDate: string;
  /** ถ้ามาจาก contract_expiry_date ของเว็บ — ใช้แสดงโลโก้/ชื่อเว็บในแผงต่ออายุ */
  websiteId?: string | null;
}

export interface Alert {
  id: string;
  websiteId: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
}

export interface DashboardSummary {
  totalWebsites: number;
  activeWebsites: number;
  inactiveWebsites: number;
  downWebsites: number;
}
