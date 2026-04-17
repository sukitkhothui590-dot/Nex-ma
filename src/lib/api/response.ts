import { NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Response JSON สำเร็จ — ใช้รูปแบบเดียวกันทั้ง API */
export function apiJson<T extends Record<string, unknown>>(
  body: T & { ok: true },
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE, ...init?.headers },
  });
}

/** Response JSON ข้อผิดพลาด */
export function apiError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { ok: false as const, error: message, ...extra },
    { status, headers: NO_STORE },
  );
}
