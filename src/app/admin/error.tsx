"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">เกิดข้อผิดพลาด</h2>
      <p className="mt-1 text-sm text-muted">ไม่สามารถแสดงหน้าผู้ดูแลได้ กรุณาลองอีกครั้ง</p>
      <Button className="mt-4" onClick={reset}>
        ลองใหม่
      </Button>
    </div>
  );
}
