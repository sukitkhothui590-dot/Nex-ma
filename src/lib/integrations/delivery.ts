/**
 * ส่งข้อความไปยังผู้ให้บริการภายนอก (ทดสอบหรือแจ้งเตือนจริง)
 */
export type PingResult = { ok: true; detail: string } | { ok: false; detail: string };

const TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** LINE Messaging API: ข้อความละไม่เกิน 5000 ตัวอักษร */
const LINE_MESSAGING_TEXT_MAX = 4900;
/** LINE Notify: ข้อจำกัดเดิม */
const LINE_NOTIFY_TEXT_MAX = 980;

type LineCredentials =
  | { mode: "notify"; notifyToken: string }
  | { mode: "messaging_api"; channelAccessToken: string; recipients: string[] }
  /** ส่งถึงทุกคนที่เพิ่ม OA เป็นเพื่อน (Broadcast API) */
  | { mode: "messaging_api_broadcast"; channelAccessToken: string };

function parseLineSecret(raw: string): LineCredentials | { mode: "error"; detail: string } {
  const s = raw.trim().replace(/^\uFEFF/, "");
  if (!s) return { mode: "error", detail: "ยังไม่ได้บันทึก URL หรือ token" };

  if (s.startsWith("{")) {
    try {
      const j = JSON.parse(s) as {
        channelAccessToken?: string;
        to?: string | string[];
        broadcast?: boolean | string;
      };
      const channelAccessToken = j.channelAccessToken?.trim();
      if (!channelAccessToken) {
        return { mode: "error", detail: "JSON ต้องมี channelAccessToken (Channel access token จาก LINE Developers)" };
      }

      const broadcastOn = j.broadcast === true || j.broadcast === "true";
      if (broadcastOn) {
        return { mode: "messaging_api_broadcast", channelAccessToken };
      }

      const to = j.to;
      let recipients: string[] = [];
      if (typeof to === "string") recipients = [to.trim()].filter(Boolean);
      else if (Array.isArray(to)) recipients = to.map((x) => String(x).trim()).filter(Boolean);
      if (recipients.length === 0) {
        return {
          mode: "error",
          detail:
            'ใส่ "broadcast": true เพื่อส่งถึงทุกเพื่อนของ OA — หรือใส่ to เป็น LINE User ID / กลุ่ม (C...)',
        };
      }
      if (recipients.length > 500) {
        return { mode: "error", detail: "ส่งได้สูงสุด 500 ผู้รับต่อครั้ง (ข้อจำกัด multicast)" };
      }
      return { mode: "messaging_api", channelAccessToken, recipients };
    } catch {
      return { mode: "error", detail: "รูปแบบ JSON ไม่ถูกต้อง" };
    }
  }

  return { mode: "notify", notifyToken: s };
}

async function sendLineMessagingApi(
  channelAccessToken: string,
  recipients: string[],
  text: string,
): Promise<PingResult> {
  const message = truncate(text, LINE_MESSAGING_TEXT_MAX);
  const messages = [{ type: "text" as const, text: message }];

  const pushOne = async (to: string) => {
    const res = await fetchWithTimeout("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, messages }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false as const, detail: `LINE Messaging API ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true as const, detail: "" };
  };

  if (recipients.length === 1) {
    return pushOne(recipients[0]!);
  }

  const res = await fetchWithTimeout("https://api.line.me/v2/bot/message/multicast", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: recipients, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, detail: `LINE Messaging API ${res.status}: ${t.slice(0, 200)}` };
  }
  return { ok: true, detail: "" };
}

/** ส่งถึงผู้ใช้ทุกคนที่เพิ่มบอทเป็นเพื่อน (ไม่ต้องระบุ User ID) */
async function sendLineBroadcast(channelAccessToken: string, text: string): Promise<PingResult> {
  const message = truncate(text, LINE_MESSAGING_TEXT_MAX);
  const messages = [{ type: "text" as const, text: message }];
  const res = await fetchWithTimeout("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, detail: `LINE Broadcast ${res.status}: ${t.slice(0, 200)}` };
  }
  return { ok: true, detail: "" };
}

function severityLabelTh(severity: string): string {
  if (severity === "high") return "สูง";
  if (severity === "medium") return "ปานกลาง";
  return "ต่ำ";
}

/** รูปแบบ Embed ของ Discord Incoming Webhook (subset ของ API) */
export type DiscordWebhookEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
};

export type DeliverMode =
  | { kind: "test" }
  | { kind: "alert"; severity: string; message: string }
  /** สรุปรายวัน / สถานะเว็บ — `discordEmbeds` สำหรับ Discord; `text` สำหรับ LINE/Teams */
  | {
      kind: "digest";
      text: string;
      stats?: Record<string, unknown>;
      discordEmbeds?: DiscordWebhookEmbed[];
      /** ข้อความสั้นในล็อก (เช่น สถานะเว็บ) — default สรุปรายวัน */
      digestLabel?: string;
      digestEvent?: "daily_digest" | "website_status";
    };

function alertPlainText(payload: Extract<DeliverMode, { kind: "alert" }>): string {
  return `[MA Alert · ${severityLabelTh(payload.severity)}]\n${payload.message}`;
}

function resolvePlainText(mode: DeliverMode): string {
  if (mode.kind === "test") return "🔔 MA Alert — ทดสอบการเชื่อมต่อจากระบบ";
  if (mode.kind === "digest") return mode.text;
  return alertPlainText(mode);
}

function digestContextLabel(mode: DeliverMode): string {
  if (mode.kind !== "digest") return "สรุปรายวัน";
  return mode.digestLabel?.trim() || "สรุปรายวัน";
}

export async function deliverIntegration(providerId: string, secret: string, mode: DeliverMode): Promise<PingResult> {
  const s = secret.trim();
  if (!s) return { ok: false, detail: "ยังไม่ได้บันทึก URL หรือ token" };

  const plain = resolvePlainText(mode);

  try {
    if (providerId === "line") {
      const creds = parseLineSecret(s);
      if (creds.mode === "error") return { ok: false, detail: creds.detail };

      if (creds.mode === "messaging_api_broadcast") {
        const r = await sendLineBroadcast(creds.channelAccessToken, plain);
        if (!r.ok) return r;
        const ctx =
          mode.kind === "test" ? "ทดสอบ" : mode.kind === "digest" ? digestContextLabel(mode) : "แจ้งเตือน";
        return { ok: true, detail: `LINE OA · broadcast ถึงทุกเพื่อน · ${ctx}` };
      }

      if (creds.mode === "messaging_api") {
        const r = await sendLineMessagingApi(creds.channelAccessToken, creds.recipients, plain);
        if (!r.ok) return r;
        const ctx =
          mode.kind === "test" ? "ทดสอบ" : mode.kind === "digest" ? digestContextLabel(mode) : "แจ้งเตือน";
        const multi = creds.recipients.length > 1 ? ` · ${creds.recipients.length} ปลายทาง` : "";
        return { ok: true, detail: `LINE OA / Messaging API · ${ctx}${multi}` };
      }

      const message = truncate(plain, LINE_NOTIFY_TEXT_MAX);
      const body = new URLSearchParams({ message });
      const res = await fetchWithTimeout("https://notify-api.line.me/api/notify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.notifyToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, detail: `LINE Notify ${res.status}: ${t.slice(0, 200)}` };
      }
      return {
        ok: true,
        detail:
          mode.kind === "test"
            ? "LINE Notify รับคำขอแล้ว"
            : mode.kind === "digest"
              ? `LINE Notify ส่ง${digestContextLabel(mode)}แล้ว`
              : "LINE Notify ส่งแล้ว",
      };
    }

    if (providerId === "discord") {
      if (mode.kind === "digest" && mode.discordEmbeds && mode.discordEmbeds.length > 0) {
        const embeds = mode.discordEmbeds.slice(0, 10);
        const res = await fetchWithTimeout(s, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embeds }),
        });
        if (!res.ok) {
          const t = await res.text();
          return { ok: false, detail: `Discord ${res.status}: ${t.slice(0, 200)}` };
        }
        return { ok: true, detail: `Discord รับ embed ${digestContextLabel(mode)}แล้ว` };
      }

      const content = truncate(plain, mode.kind === "digest" ? 1900 : 2000);
      const res = await fetchWithTimeout(s, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, detail: `Discord ${res.status}: ${t.slice(0, 200)}` };
      }
      return {
        ok: true,
        detail:
          mode.kind === "test"
            ? "Discord webhook ตอบแล้ว"
            : mode.kind === "digest"
              ? `Discord รับ${digestContextLabel(mode)}แล้ว`
              : "Discord ส่งแล้ว",
      };
    }

    if (providerId === "teams") {
      const text = truncate(plain, 28_000);
      const res = await fetchWithTimeout(s, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, detail: `Teams ${res.status}: ${t.slice(0, 200)}` };
      }
      return {
        ok: true,
        detail:
          mode.kind === "test"
            ? "Teams webhook ตอบแล้ว"
            : mode.kind === "digest"
              ? `Teams รับ${digestContextLabel(mode)}แล้ว`
              : "Teams ส่งแล้ว",
      };
    }

    if (providerId === "webhook") {
      const at = new Date().toISOString();
      const json =
        mode.kind === "test"
          ? {
              source: "ma-alert-system",
              event: "ping",
              message: "ทดสอบการเชื่อมต่อ",
              at,
            }
          : mode.kind === "digest"
            ? {
                source: "ma-alert-system",
                event: mode.digestEvent ?? "daily_digest",
                at,
                text: mode.text,
                stats: mode.stats ?? {},
                embeds: mode.discordEmbeds ?? [],
              }
            : {
                source: "ma-alert-system",
                event: "alert",
                severity: mode.severity,
                message: mode.message,
                at,
              };
      const res = await fetchWithTimeout(s, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, detail: `HTTP ${res.status}: ${t.slice(0, 200)}` };
      }
      return {
        ok: true,
        detail:
          mode.kind === "test"
            ? `ปลายทางตอบ HTTP ${res.status}`
            : mode.kind === "digest"
              ? `Webhook ${digestContextLabel(mode)} OK (HTTP ${res.status})`
              : `Webhook ส่งแล้ว (HTTP ${res.status})`,
      };
    }

    return { ok: false, detail: "ไม่รู้จัก provider" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg.includes("abort") || msg === "The operation was aborted.") {
      return { ok: false, detail: "หมดเวลา (timeout)" };
    }
    return { ok: false, detail: msg };
  }
}
