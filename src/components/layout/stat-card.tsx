import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export const StatCard = ({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "primary" | "danger" | "warning";
}) => (
  <Card
    className={cn(
      "relative overflow-hidden p-5",
      tone === "primary"
        ? "border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-white"
        : tone === "danger"
          ? "border-rose-200/80 bg-gradient-to-br from-rose-50/70 to-white"
          : tone === "warning"
            ? "border-amber-200/70 bg-gradient-to-br from-amber-50/60 to-white"
            : "",
    )}
  >
    <p className="text-xs font-medium text-slate-600">{label}</p>
    <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
    {hint ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
  </Card>
);
