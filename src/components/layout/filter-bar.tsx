import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export const FilterBar = ({
  children,
  className,
  dense = false,
}: {
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) => (
  <div
    className={cn(
      "rounded-2xl border border-slate-200/80 bg-white shadow-sm",
      dense ? "p-3" : "p-4",
      className,
    )}
  >
    <div className={cn("grid gap-3", dense ? "md:grid-cols-3" : "md:grid-cols-4")}>{children}</div>
  </div>
);
