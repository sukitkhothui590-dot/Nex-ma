import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  extractIconLinksFromHtml,
  extractSocialPreviewImageFromHtml,
  isUrlSafeForServerSideFetch,
  sliceHtmlBuffer,
} from "@/lib/utils/site-brand";

export const dynamic = "force-dynamic";

const FETCH_MS = 10_000;

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false as const, imageUrl: null }, { status: 503 });
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false as const, imageUrl: null }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ ok: false as const, imageUrl: null }, { status: 400 });
  }
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (!isUrlSafeForServerSideFetch(withProto)) {
    return NextResponse.json({ ok: false as const, imageUrl: null }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(withProto, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "WebManagementMAAlert/1.0 (og-image; +https://github.com/)",
      },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: true as const, imageUrl: null, iconUrls: [] as string[] });
    }
    const buf = await res.arrayBuffer();
    const html = sliceHtmlBuffer(buf);
    const finalUrl = res.url || withProto;
    const imageUrl = extractSocialPreviewImageFromHtml(html, finalUrl);
    const iconUrls = extractIconLinksFromHtml(html, finalUrl);
    return NextResponse.json({ ok: true as const, imageUrl, iconUrls });
  } catch {
    return NextResponse.json({ ok: true as const, imageUrl: null, iconUrls: [] as string[] });
  } finally {
    clearTimeout(timer);
  }
}
