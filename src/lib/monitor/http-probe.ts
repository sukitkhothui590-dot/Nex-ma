/**
 * ตรวจว่า URL ตอบสนอง HTTP ได้หรือไม่ (ใช้จาก Route Handler เท่านั้น — ไม่เรียกจากเบราว์เซอร์ตรง ๆ)
 */

const DEFAULT_TIMEOUT_MS = 12_000;

/** User-Agent ที่ใช้เมื่อเซิร์ฟเวอร์นี้เรียกไปยังเว็บลูกค้า — แสดงใน UI มอนิเตอร์ได้ */
export const MONITOR_PROBE_USER_AGENT = "WebManagementMAAlert/1.0 (monitor)";

export type HttpProbeDetail = {
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  /** วิธีที่ใช้ได้ผลลัพธ์สุดท้าย */
  method: "HEAD" | "GET";
  /** URL ที่ตั้งใจตรวจ (หลัง normalize แล้ว) */
  requestUrl: string;
  /** URL สุดท้ายหลัง redirect (จาก Response.url) */
  responseUrl?: string;
  /** ถ้า responseUrl ต่างจาก requestUrl (หลัง normalize แล้ว) */
  redirected: boolean;
  /** ข้อความสั้นเมื่อออฟไลน์ (timeout / DNS / ฯลฯ) */
  error?: string;
};

function normalizeHref(u: string): string {
  try {
    return new URL(u).href;
  } catch {
    return u.trim();
  }
}

function finish(
  started: number,
  base: Omit<HttpProbeDetail, "latencyMs" | "requestUrl" | "redirected"> & { requestUrl: string },
): HttpProbeDetail {
  const responseUrl = base.responseUrl;
  const redirected =
    Boolean(responseUrl) && normalizeHref(responseUrl!) !== normalizeHref(base.requestUrl);
  return {
    ...base,
    redirected,
    latencyMs: Math.max(0, Math.round(Date.now() - started)),
  };
}

type FetchOk = { ok: true; status: number; responseUrl: string };
type FetchErr = { ok: false; error: string };

async function fetchOnce(
  url: string,
  method: "HEAD" | "GET",
  timeoutMs: number,
): Promise<FetchOk | FetchErr> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept:
          method === "HEAD"
            ? "*/*"
            : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": MONITOR_PROBE_USER_AGENT,
      },
    });
    clearTimeout(timer);
    return { ok: true, status: res.status, responseUrl: res.url };
  } catch (e) {
    clearTimeout(timer);
    const name = e instanceof Error ? e.name : "";
    if (name === "AbortError") {
      return { ok: false, error: "หมดเวลา (timeout)" };
    }
    return { ok: false, error: "เชื่อมต่อไม่ได้ (เครือข่าย/DNS/SSL)" };
  }
}

/** ถือว่า "ออนไลน์" ถ้าได้ HTTP response และสถานะ < 500 (รวม 401/403 = เซิร์ฟเวอร์ตอบได้) */
function isReachableStatus(status: number): boolean {
  return status > 0 && status < 500;
}

/**
 * ลอง HEAD ก่อน ถ้าไม่รองรับหรือล้มเหลวค่อย GET
 */
export async function probeHttpUrl(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<HttpProbeDetail> {
  const started = Date.now();

  const head = await fetchOnce(url, "HEAD", timeoutMs);
  if (!head.ok) {
    const get = await fetchOnce(url, "GET", timeoutMs);
    if (!get.ok) {
      return finish(started, {
        ok: false,
        requestUrl: url,
        method: "GET",
        error: get.error,
      });
    }
    return finish(started, {
      ok: isReachableStatus(get.status),
      statusCode: get.status,
      method: "GET",
      requestUrl: url,
      responseUrl: get.responseUrl,
    });
  }

  if (head.status === 405 || head.status === 501) {
    const get = await fetchOnce(url, "GET", timeoutMs);
    if (!get.ok) {
      return finish(started, {
        ok: false,
        requestUrl: url,
        method: "GET",
        error: get.error,
      });
    }
    return finish(started, {
      ok: isReachableStatus(get.status),
      statusCode: get.status,
      method: "GET",
      requestUrl: url,
      responseUrl: get.responseUrl,
    });
  }

  return finish(started, {
    ok: isReachableStatus(head.status),
    statusCode: head.status,
    method: "HEAD",
    requestUrl: url,
    responseUrl: head.responseUrl,
  });
}
