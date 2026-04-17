export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className ?? ""}`} />
);
