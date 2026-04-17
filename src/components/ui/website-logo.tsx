"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { faviconCandidateUrls, faviconFetchSizePx, resolveSiteMediaUrl, uniqueFaviconHosts } from "@/lib/utils/url";
import { normalizeUrlField } from "@/lib/utils/website-urls";
import { fetchSiteBrand, getCachedSiteBrand, type SiteBrandResult } from "@/lib/utils/site-brand-client";

type WebsiteLogoProps = {
  name: string;
  /** รองรับว่าง/null เมื่อบันทึกเฉพาะหลังบ้าน (สคีมาใหม่) */
  frontendUrl?: string | null;
  /** ถ้ามีและต่างโดเมนจากหน้าบ้าน จะลอง favicon จากโดเมนนี้เมื่อรูปจากหน้าบ้านโหลดไม่ได้ */
  backendUrl?: string | null;
  logoUrl?: string | null;
  /** ความกว้าง/สูงของโลโก้เป็นพิกเซล — ค่าเริ่มต้น 40×40 */
  size?: number;
  className?: string;
  /**
   * แยก state โลโก้ต่อแถว/รายการ — ส่ง id ที่ไม่ซ้ำในรายการ (เช่น website id หรือ alert id)
   */
  instanceId?: string;
};

/** ขนาดโลโก้เว็บมาตรฐานในระบบ (px) */
export const WEBSITE_LOGO_SIZE = 40;

const boxStyle = (size: number) =>
  ({
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
  }) as const;

/**
 * สร้างรายการ candidate จากโลโก้ที่ขุดได้ + fallback ตามโดเมน
 * ลำดับ (สำคัญสุด → สำคัญน้อย):
 *  1. `resolvedCustom` — จาก props logoUrl (ผู้ใช้ระบุเอง)
 *  2. `scrapedIcons` — `<link rel="icon" | "apple-touch-icon">` จาก HTML ของเว็บ (ของจริงที่เว็บประกาศ)
 *  3. `scrapedOg` — `og:image` / `twitter:image` (ภาพแบรนด์ที่เว็บใช้แชร์)
 *  4. faviconCandidateUrls — `/favicon.ico`, `/logo.png`, DDG, Google s2 (generic fallback)
 */
function buildCandidates(params: {
  resolvedCustom: string;
  scraped: SiteBrandResult | null;
  hosts: string[];
  px: number;
}): string[] {
  const { resolvedCustom, scraped, hosts, px } = params;
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    const t = (u ?? "").trim();
    if (!t || out.includes(t)) return;
    out.push(t);
  };
  push(resolvedCustom);
  if (scraped) {
    for (const u of scraped.iconUrls) push(u);
    push(scraped.imageUrl);
  }
  for (const u of faviconCandidateUrls(hosts, px)) push(u);
  return out;
}

function WebsiteLogoInner({
  name,
  frontendUrl,
  backendUrl,
  logoUrl,
  size = WEBSITE_LOGO_SIZE,
  className = "",
}: WebsiteLogoProps) {
  const fe = normalizeUrlField(frontendUrl);
  const be = normalizeUrlField(backendUrl);
  const customRaw = logoUrl?.trim() ?? "";
  const baseUrl = useMemo(() => [fe, be].find((s) => s) ?? "", [fe, be]);
  const resolvedCustom = useMemo(
    () => (customRaw ? resolveSiteMediaUrl(customRaw, baseUrl) : ""),
    [customRaw, baseUrl],
  );
  const hosts = useMemo(() => uniqueFaviconHosts(fe, be), [fe, be]);
  const px = faviconFetchSizePx(size);
  const pageUrl = fe || be;

  const [scraped, setScraped] = useState<SiteBrandResult | null>(() =>
    pageUrl ? getCachedSiteBrand(pageUrl) : null,
  );

  useEffect(() => {
    if (!pageUrl || scraped) return;
    let cancelled = false;
    void fetchSiteBrand(pageUrl).then((r) => {
      if (!cancelled) setScraped(r);
    });
    return () => {
      cancelled = true;
    };
  }, [pageUrl, scraped]);

  const candidates = useMemo(
    () => buildCandidates({ resolvedCustom, scraped, hosts, px }),
    [resolvedCustom, scraped, hosts, px],
  );

  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const lastLenRef = useRef(candidates.length);

  useEffect(() => {
    if (candidates.length > lastLenRef.current) {
      setFailed(false);
    }
    lastLenRef.current = candidates.length;
  }, [candidates.length]);

  useEffect(() => {
    setIdx(0);
    setFailed(false);
    lastLenRef.current = candidates[0] ? candidates.length : 0;
  }, [resolvedCustom, hosts, px, candidates]);

  const src = candidates[idx] ?? "";
  const initials = name.trim().slice(0, 2) || "—";

  const onImgError = useCallback(() => {
    setIdx((i) => {
      if (i < candidates.length - 1) return i + 1;
      setFailed(true);
      return i;
    });
  }, [candidates.length]);

  if (failed || !src) {
    return (
      <span
        className={`inline-flex shrink-0 self-start items-center justify-center rounded-lg border border-slate-200/80 bg-slate-100 text-[10px] font-semibold uppercase tracking-tight text-slate-600 ${className}`}
        style={boxStyle(size)}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={`box-border inline-flex shrink-0 self-start items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-white ${className}`}
      style={boxStyle(size)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote favicon; avoid next/image remotePatterns */}
      <img
        key={`${idx}-${src}`}
        src={src}
        alt=""
        className="box-border block"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "none",
          objectFit: "contain",
          objectPosition: "center",
        }}
        loading="lazy"
        decoding="async"
        onError={onImgError}
      />
    </span>
  );
}

export const WebsiteLogo = (props: WebsiteLogoProps) => {
  const { logoUrl, frontendUrl, backendUrl, size = WEBSITE_LOGO_SIZE, instanceId = "" } = props;
  const fe = normalizeUrlField(frontendUrl);
  const be = normalizeUrlField(backendUrl);
  const customRaw = logoUrl?.trim() ?? "";
  const baseUrl = [fe, be].find((s) => s) ?? "";
  const resolved = customRaw ? resolveSiteMediaUrl(customRaw, baseUrl) : "";
  const remountKey = `${instanceId}\0${customRaw}\0${resolved}\0${fe}\0${be}\0${size}`;
  return <WebsiteLogoInner key={remountKey} {...props} />;
};
