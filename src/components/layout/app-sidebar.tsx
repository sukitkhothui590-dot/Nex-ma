import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface Item {
  href: string;
  label: string;
}

export const AppSidebar = ({
  items,
  activePath,
}: {
  items: Item[];
  activePath: string;
}) => (
  <aside className="scrollbar-none w-full shrink-0 border-r bg-surface p-4 md:h-full md:min-h-0 md:w-64 md:overflow-y-auto md:self-stretch">
    <p className="mb-4 text-lg font-semibold">MA Alert System</p>
    <nav className="space-y-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "block rounded-lg px-3 py-2 text-sm",
            activePath === item.href ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  </aside>
);
