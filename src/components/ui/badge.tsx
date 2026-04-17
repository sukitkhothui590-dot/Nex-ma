import { cn } from "@/lib/utils/cn";

export const Badge = ({ label, className }: { label: string; className?: string }) => (
  <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", className)}>{label}</span>
);
