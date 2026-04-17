import { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Select = ({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2",
      className,
    )}
    {...props}
  >
    {children}
  </select>
);
