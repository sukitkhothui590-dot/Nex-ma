"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockAuth } from "@/lib/services/mock-auth";
import { getStoredPasswordHash, sha256Hex } from "@/lib/services/mock-user-profile";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { UserRole } from "@/types/models";

const roleLandingMap: Record<UserRole, string> = {
  admin: "/admin/dashboard",
};

const resolveRoleFromUrl = (searchParams: URLSearchParams): UserRole => {
  const next = searchParams.get("next");
  if (next?.startsWith("/admin/")) {
    return "admin";
  }
  const roleParam = searchParams.get("role");
  if (roleParam === "admin") {
    return "admin";
  }
  return "admin";
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const role = resolveRoleFromUrl(searchParams);
    const next = searchParams.get("next");
    if (next && next.startsWith(`/${role}/`)) {
      return next;
    }
    return roleLandingMap[role];
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    const role = resolveRoleFromUrl(searchParams);
    const form = event.currentTarget;
    const emailField = form.elements.namedItem("email") as HTMLInputElement | null;
    const passwordField = form.elements.namedItem("password") as HTMLInputElement | null;
    const email = emailField?.value?.trim() ?? "";
    const password = passwordField?.value ?? "";

    if (isSupabaseConfigured()) {
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg =
            error.message === "Invalid login credentials"
              ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
              : error.message;
          setAuthError(msg);
          return;
        }
        router.refresh();
        router.push(nextPath);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      }
      return;
    }

    const storedHash = getStoredPasswordHash(role);
    if (storedHash) {
      const inputHash = await sha256Hex(password);
      if (inputHash !== storedHash) {
        setAuthError("รหัสผ่านไม่ถูกต้อง");
        return;
      }
    }
    mockAuth.setRole(role);
    router.push(nextPath);
  };

  return (
    <div className="app-shell scrollbar-none flex min-h-0 flex-1 items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-50 p-4 md:p-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]">
        <div className="grid min-h-[640px] lg:grid-cols-[1.1fr_1fr]">
          <section className="relative hidden overflow-hidden p-10 text-white lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-indigo-600 to-slate-900" aria-hidden />
            <div
              className="login-anim-glow absolute -left-24 top-16 h-80 w-80 rounded-full bg-lime-200/50 blur-3xl will-change-transform"
              aria-hidden
            />
            <div
              className="login-anim-glow-delayed absolute -right-16 bottom-8 h-96 w-96 rounded-full bg-teal-950/35 blur-3xl will-change-transform"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              aria-hidden
            >
              <div className="login-anim-shimmer absolute inset-y-0 left-0 w-[40%] -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent mix-blend-overlay opacity-50" />
              <div className="login-anim-float absolute right-[6%] top-[10%] h-36 w-36 rounded-full border border-white/40 bg-white/15 shadow-lg shadow-slate-950/25 backdrop-blur-md will-change-transform" />
              <div className="login-anim-drift-reverse absolute right-[26%] top-[36%] h-20 w-20 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm will-change-transform" />
              <div className="login-anim-float-slow absolute left-[8%] top-[40%] h-16 w-16 rounded-full border border-white/35 bg-indigo-100/20 backdrop-blur-sm will-change-transform" />
              <div className="login-anim-drift absolute left-[14%] bottom-[16%] h-28 w-28 rounded-full border border-white/25 bg-white/10 backdrop-blur-md will-change-transform" />
              <div className="login-anim-float absolute right-[10%] bottom-[20%] h-44 w-44 rounded-full border border-white/30 bg-indigo-300/15 backdrop-blur-lg will-change-transform [animation-delay:-1.5s]" />
              <div className="login-anim-drift absolute left-[42%] top-[18%] h-10 w-10 rounded-full border border-white/40 bg-white/20 backdrop-blur-sm will-change-transform [animation-delay:-2s]" />
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="space-y-2" aria-hidden>
                <div className="h-16 w-[240px] max-w-full rounded-xl border border-dashed border-white/40 bg-white/10" />
                <p className="text-xs text-white/75">
                  Logo <span className="text-white/55">· 240 × 64 px (แนะนำ)</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-white/90">แพลตฟอร์มจัดการเว็บและ MA</p>
                <h2 className="mt-3 max-w-xs text-4xl font-semibold leading-tight">
                  เข้าถึงศูนย์ควบคุมการดูแลเว็บและแจ้งเตือนตามสิทธิ์บัญชีของคุณ
                </h2>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center p-6 sm:p-10">
            <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
              <div className="space-y-1" aria-hidden>
                <div className="h-10 w-10 rounded-lg border border-dashed border-slate-300 bg-slate-50" />
                <p className="text-xs text-slate-500">
                  Logo <span className="text-slate-400">· 40 × 40 px (แนะนำ)</span>
                </p>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">ยินดีต้อนรับ</h1>
                <p className="mt-2 text-sm text-slate-500">
                  {isSupabaseConfigured()
                    ? "ใช้อีเมลและรหัสผ่านบัญชีที่สร้างใน Supabase Auth"
                    : "โหมดจำลอง: รหัสผ่านตามที่ตั้งในโปรไฟล์ (ถ้ามี) — ยังไม่มี Supabase env"}
                </p>
              </div>

              <div className="pt-1">
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  ชื่อผู้ใช้ / อีเมล
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                  className="h-11 rounded-xl border-slate-300"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                  รหัสผ่าน
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="รหัสผ่าน"
                  required
                  className="h-11 rounded-xl border-slate-300"
                />
                {authError ? (
                  <p className="mt-2 text-sm text-rose-600" role="alert">
                    {authError}
                  </p>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-500">
                <input type="checkbox" className="rounded border-slate-300" />
                จดจำการเข้าสู่ระบบ
              </label>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-indigo-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.35)] hover:bg-indigo-700"
              >
                เข้าสู่ระบบ
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

const LoginFallback = () => (
  <div className="app-shell scrollbar-none flex min-h-0 flex-1 items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-50 p-4 md:p-8">
    <div className="h-[min(640px,80vh)] w-full max-w-5xl animate-pulse rounded-3xl bg-white/60" />
  </div>
);

export default function LoginPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
