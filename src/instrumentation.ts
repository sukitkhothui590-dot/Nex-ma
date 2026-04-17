/**
 * Next.js instrumentation — เรียกครั้งเดียวตอน server start
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startWebsiteStatusTicker } = await import("@/lib/automation/website-status-ticker");
  startWebsiteStatusTicker();
}
