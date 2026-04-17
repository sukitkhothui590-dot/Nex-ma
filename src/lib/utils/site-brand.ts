/**
 * ดึง URL รูปจาก meta (og / twitter) — ใช้กับเว็บสำเร็จรูปที่โลโก้อยู่ CDN แยกจากโดเมน
 */

const MAX_HTML_BYTES = 512_000;

/** ป้องกัน SSRF เบื้องต้น — อนุญาตเฉพาะ http(s) สาธารณะ */
export function isUrlSafeForServerSideFetch(urlString: string): boolean {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "[::1]" || host === "127.0.0.1") return false;
  const parts = host.split(".").filter(Boolean);
  if (parts.length === 4 && /^\d+$/.test(parts[0] ?? "")) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  return true;
}

function tryResolveImageUrl(raw: string, basePageUrl: string): string | null {
  const t = raw.trim();
  if (!t || t.startsWith("data:")) return null;
  try {
    const abs = new URL(t, basePageUrl).href;
    if (/^https?:\/\//i.test(abs) && isUrlSafeForServerSideFetch(abs)) return abs;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * แยก og:image / twitter:image จาก HTML (ไม่พึ่ง DOM parser ภายนอก)
 */
export function extractSocialPreviewImageFromHtml(html: string, pageUrl: string): string | null {
  const patterns: RegExp[] = [
    /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
    /<meta\s+[^>]*property=["']og:image:url["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["'][^>]*>/i,
    /<meta\s+[^>]*name=["']twitter:image:src["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const resolved = tryResolveImageUrl(m[1], pageUrl);
      if (resolved) return resolved;
    }
  }
  return null;
}

/**
 * แยก `<link rel="icon" | "shortcut icon" | "apple-touch-icon">` จาก HTML
 * — มักเป็นไอคอนจริงที่เว็บประกาศ (เช่น CDN ของ MakeWebEasy)
 */
export function extractIconLinksFromHtml(html: string, pageUrl: string): string[] {
  const links: string[] = [];
  const linkTagRe = /<link\s+[^>]*>/gi;
  const relRe = /\brel=["']([^"']+)["']/i;
  const hrefRe = /\bhref=["']([^"']+)["']/i;
  const sizesRe = /\bsizes=["']([^"']+)["']/i;
  const found: { href: string; rank: number; size: number }[] = [];

  const tagMatches = html.match(linkTagRe);
  if (!tagMatches) return [];

  for (const tag of tagMatches) {
    const rel = (tag.match(relRe)?.[1] ?? "").toLowerCase();
    if (!rel) continue;
    const relTokens = rel.split(/\s+/).filter(Boolean);
    const isAppleTouch = relTokens.includes("apple-touch-icon") || relTokens.includes("apple-touch-icon-precomposed");
    const isIcon =
      relTokens.includes("icon") || relTokens.includes("shortcut") || relTokens.includes("mask-icon");
    if (!isAppleTouch && !isIcon) continue;

    const href = tag.match(hrefRe)?.[1];
    if (!href) continue;
    const resolved = tryResolveImageUrl(href, pageUrl);
    if (!resolved) continue;

    const sizes = tag.match(sizesRe)?.[1] ?? "";
    const firstSize = Number.parseInt(sizes.split("x")[0] ?? "", 10);
    const size = Number.isFinite(firstSize) ? firstSize : 0;
    const rank = isAppleTouch ? 0 : 1;
    found.push({ href: resolved, rank, size });
  }

  found.sort((a, b) => a.rank - b.rank || b.size - a.size);
  for (const f of found) if (!links.includes(f.href)) links.push(f.href);
  return links;
}

export function sliceHtmlBuffer(buf: ArrayBuffer): string {
  const n = Math.min(buf.byteLength, MAX_HTML_BYTES);
  const slice = n === buf.byteLength ? buf : buf.slice(0, n);
  return new TextDecoder("utf-8", { fatal: false }).decode(slice);
}
