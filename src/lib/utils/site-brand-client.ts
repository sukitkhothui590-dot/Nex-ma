"use client";

export type SiteBrandResult = {
  iconUrls: string[];
  imageUrl: string | null;
};

const STORAGE_PREFIX = "site-brand:v2:";
const memCache = new Map<string, SiteBrandResult>();
const inflight = new Map<string, Promise<SiteBrandResult>>();

function canonicalKey(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    return u.hostname.toLowerCase();
  } catch {
    return pageUrl.trim().toLowerCase();
  }
}

function readSession(key: string): SiteBrandResult | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const obj = JSON.parse(raw) as SiteBrandResult;
    if (!obj || typeof obj !== "object") return null;
    return {
      iconUrls: Array.isArray(obj.iconUrls) ? obj.iconUrls.filter((x) => typeof x === "string") : [],
      imageUrl: typeof obj.imageUrl === "string" ? obj.imageUrl : null,
    };
  } catch {
    return null;
  }
}

function writeSession(key: string, v: SiteBrandResult): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(v));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

export function getCachedSiteBrand(pageUrl: string): SiteBrandResult | null {
  const k = canonicalKey(pageUrl);
  if (memCache.has(k)) return memCache.get(k) ?? null;
  const fromSession = readSession(k);
  if (fromSession) memCache.set(k, fromSession);
  return fromSession;
}

export function fetchSiteBrand(pageUrl: string): Promise<SiteBrandResult> {
  const k = canonicalKey(pageUrl);
  const cached = getCachedSiteBrand(pageUrl);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(k);
  if (running) return running;

  const p = (async () => {
    try {
      const r = await fetch(`/api/site-brand?url=${encodeURIComponent(pageUrl)}`);
      if (!r.ok) return { iconUrls: [], imageUrl: null } satisfies SiteBrandResult;
      const data = (await r.json()) as { iconUrls?: unknown; imageUrl?: unknown };
      const icons = Array.isArray(data.iconUrls)
        ? data.iconUrls.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : [];
      const img = typeof data.imageUrl === "string" && data.imageUrl.trim() ? data.imageUrl.trim() : null;
      const out: SiteBrandResult = { iconUrls: icons, imageUrl: img };
      memCache.set(k, out);
      writeSession(k, out);
      return out;
    } catch {
      return { iconUrls: [], imageUrl: null } satisfies SiteBrandResult;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, p);
  return p;
}
