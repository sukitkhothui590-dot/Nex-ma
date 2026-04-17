export const getHostname = (urlString: string): string => {
  try {
    return new URL(urlString).hostname;
  } catch {
    return urlString;
  }
};

/**
 * แปลง path รูปแบบ `/logo.png` ให้เป็น URL เต็มจากโดเมนเว็บ (หน้าบ้าน/หลังบ้าน)
 * — ถ้าเป็น `https://...` หรือ `data:` อยู่แล้วจะคืนตามเดิม
 */
export function resolveSiteMediaUrl(asset: string, baseUrl: string): string {
  const a = asset.trim();
  if (!a) return "";
  if (a.startsWith("data:")) return a;
  if (/^https?:\/\//i.test(a)) return a;
  if (a.startsWith("//")) return `https:${a}`;
  const b = baseUrl.trim();
  if (!b) return "";
  const withProto = /^https?:\/\//i.test(b) ? b : `https://${b}`;
  try {
    const out = new URL(a, withProto).href;
    if (/^https?:\/\//i.test(out)) return out;
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * ขนาดพิกเซลที่ขอจาก Google s2 favicons ให้พอสำหรับลงในกล่อง CSS `displayCssPx` บนจอ Retina
 * (ไม่พึ่ง `window` — ใช้ได้ทั้ง SSR และ client)
 */
export function faviconFetchSizePx(displayCssPx: number): number {
  const target = Math.ceil(displayCssPx * 3);
  if (target <= 64) return 64;
  if (target <= 128) return 128;
  return 256;
}

/** URL favicon จาก Google s2 (โดเมนเป็น hostname ล้วน) */
export function googleFaviconSrc(hostname: string, sizePx: number): string {
  const h = hostname.trim().toLowerCase();
  if (!h) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=${sizePx}`;
}

/**
 * URL รูปที่ลองต่อโดเมน (ตามลำดับ)
 *
 * ลำดับ: รูปจริงบนโดเมนก่อน → DuckDuckGo (คืน 404 เมื่อไม่พบ) → Google s2 เป็นตัวสุดท้าย
 * หมายเหตุ: Google s2 คืน 200 เสมอ (ถ้าไม่พบจะคืนรูป "ลูกโลกเริ่มต้น") จึงต้องอยู่ท้ายสุด
 * ไม่เช่นนั้น onError จะไม่ฟายร์ และ fallback ต่อไป (og:image) จะไม่ถูกเรียก
 */
export function faviconCandidateUrls(hostnames: string[], sizePx: number): string[] {
  const out: string[] = [];
  const push = (u: string) => {
    const t = u.trim();
    if (!t || out.includes(t)) return;
    out.push(t);
  };
  for (const raw of hostnames) {
    const h = raw.trim().toLowerCase().split(":")[0];
    if (!h) continue;
    push(`https://${h}/favicon.ico`);
    push(`https://${h}/logo.png`);
    push(`https://icons.duckduckgo.com/ip3/${h}.ico`);
    push(googleFaviconSrc(h, sizePx));
  }
  return out;
}

/** รายการ hostname ไม่ซ้ำ — หน้าบ้านก่อน แล้วหลังบ้าน (ใช้ลอง favicon ทีละโดเมน) */
export function uniqueFaviconHosts(frontendUrl: string, backendUrl?: string | null): string[] {
  const hosts: string[] = [];
  const push = (url: string) => {
    const t = url.trim();
    if (!t) return;
    const host = getHostname(t).split(":")[0].toLowerCase();
    if (!host || hosts.includes(host)) return;
    hosts.push(host);
  };
  push(frontendUrl);
  if (backendUrl) push(backendUrl);
  return hosts;
}

/** แหล่งรูปแรกสำหรับแสดง — `logoUrl` ถ้ามี ไม่เช่นนั้น favicon โดเมนแรกจากหน้าบ้าน/หลังบ้าน */
export const getWebsiteLogoSrc = (
  w: { logoUrl?: string | null; frontendUrl: string; backendUrl?: string | null },
  sizePx = 128,
): string => {
  const trimmed = w.logoUrl?.trim();
  if (trimmed) {
    const base = [w.frontendUrl, w.backendUrl].find((x) => x?.trim()) ?? "";
    const resolved = resolveSiteMediaUrl(trimmed, base);
    if (resolved) return resolved;
  }
  const hosts = uniqueFaviconHosts(w.frontendUrl, w.backendUrl);
  const urls = faviconCandidateUrls(hosts, sizePx);
  return urls[0] ?? "";
};
