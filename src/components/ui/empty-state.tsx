export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
    <h3 className="text-base font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-muted">{description}</p>
  </div>
);
