import { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Crumb = { href?: string; label: string };

export const PageHeader = ({
  title,
  subtitle,
  eyebrow,
  crumbs,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) => (
  <header className={cn("space-y-5", className)}>
    {crumbs?.length ? (
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {crumbs.map((c, idx) => {
          const last = idx === crumbs.length - 1;
          const el = c.href ? (
            <Link href={c.href} className="hover:text-slate-800 hover:underline">
              {c.label}
            </Link>
          ) : (
            <span className={cn(last ? "text-slate-700" : "")}>{c.label}</span>
          );
          return (
            <span key={`${c.label}-${idx}`} className="inline-flex items-center gap-1.5">
              {el}
              {!last ? <span className="text-slate-300">/</span> : null}
            </span>
          );
        })}
      </nav>
    ) : null}

    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        ) : null}
        <h1 className="truncate text-[22px] font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">{actions}</div> : null}
    </div>

    {children ? <div className="mt-5 rounded-2xl bg-slate-50/70 p-3 sm:p-4">{children}</div> : null}
  </header>
);
