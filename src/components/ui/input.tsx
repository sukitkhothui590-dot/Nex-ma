import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 transition focus:ring-2",
      className,
    )}
    {...props}
  />
);
