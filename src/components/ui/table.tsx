import { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export const DataTable = <T extends { id: string }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Column<T>[];
}) => (
  <div className="scrollbar-none overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <table className="min-w-full text-left text-sm">
      <thead className="bg-surface-muted text-muted">
        <tr>
          {columns.map((column) => (
            <th key={column.key} className="px-3 py-2.5 font-semibold">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
            {columns.map((column) => (
              <td key={column.key} className="px-3 py-3">
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
