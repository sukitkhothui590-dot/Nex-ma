import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cn("interactive-soft rounded-2xl border border-slate-200/80 bg-surface p-4 shadow-sm", className)}>{children}</section>
);
