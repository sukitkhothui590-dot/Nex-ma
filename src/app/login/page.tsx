import LoginView from "./login-view";

/** ไม่ static prerender — หลีกเลี่ยงบั๊ก Next.js 16 + useSearchParams บนหน้า client เท่านั้น */
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginView />;
}
