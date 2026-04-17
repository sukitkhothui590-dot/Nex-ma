"use client";

/**
 * ใช้ inline style เท่านั้น — className/Tailwind บางเคสทำให้ Next.js 16 prerender /_global-error ล้ม
 * @see https://github.com/vercel/next.js/issues/84994
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: 24,
          fontFamily: 'system-ui, "Segoe UI", sans-serif',
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }} role="alert">
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>เกิดข้อผิดพลาดในระบบ</h1>
          <p style={{ marginTop: 8, fontSize: "0.875rem", color: "#475569", lineHeight: 1.5 }}>
            {process.env.NODE_ENV === "development" ? error.message : "กรุณาลองโหลดหน้าใหม่"}
          </p>
          <button
            type="button"
            style={{
              marginTop: 24,
              border: "none",
              borderRadius: 8,
              background: "#0f172a",
              color: "#fff",
              padding: "8px 16px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
            onClick={() => reset()}
          >
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
