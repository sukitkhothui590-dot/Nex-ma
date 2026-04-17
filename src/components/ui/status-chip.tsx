import { cn } from "@/lib/utils/cn";

type Tone = "success" | "warning" | "danger" | "neutral";

const toneClasses: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-rose-50 text-rose-700",
  neutral: "bg-slate-100 text-slate-700",
};

export const StatusChip = ({ label, tone }: { label: string; tone: Tone }) => (
  <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", toneClasses[tone])}>{label}</span>
);
