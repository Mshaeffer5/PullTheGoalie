import { useMemo, useState, type ReactNode } from "react";
import { cn, Tip } from "./ui";

export interface Column<T> {
  key: string;
  label: ReactNode;
  tip?: ReactNode;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
  sort?: (row: T) => number | string | null;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  /** Rows pinned above the sortable body (averages, totals). */
  pinned?: T[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  maxHeight?: number;
  rowClass?: (row: T) => string | undefined;
  caption?: ReactNode;
  rowKey: (row: T, i: number) => string;
}

export function SortableTable<T>({ columns, rows, pinned = [], initialSort, maxHeight, rowClass, caption, rowKey }: Props<T>) {
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const f = col.sort;
    return [...rows].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const c = x < y ? -1 : 1;
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, sort, columns]);

  const align = (a?: string) => (a === "right" ? "text-right tabular-nums" : a === "center" ? "text-center" : "text-left");

  return (
    <div>
      {caption && <p className="mb-2 text-[13px] text-muted">{caption}</p>}
      <div className="overflow-auto rounded-lg border border-line" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "sticky top-0 z-10 whitespace-nowrap border-b-2 border-slate-300 bg-ice px-3 py-2 font-semibold text-ink",
                      align(c.align),
                      c.sort && "cursor-pointer select-none hover:bg-slate-200",
                    )}
                    onClick={() => {
                      if (!c.sort) return;
                      setSort((s) =>
                        s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "desc" },
                      );
                    }}
                  >
                    {c.tip ? (
                      <Tip content={c.tip}>
                        <span className="border-b border-dotted border-muted">{c.label}</span>
                      </Tip>
                    ) : (
                      c.label
                    )}
                    {c.sort && <span className="ml-1 text-[11px] text-brand">{active ? (sort!.dir === "asc" ? "▲" : "▼") : ""}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pinned.map((r, i) => (
              <tr key={`pin-${i}`} className="bg-brand-light/60 font-semibold">
                {columns.map((c) => (
                  <td key={c.key} className={cn("whitespace-nowrap border-b border-line px-3 py-1.5", align(c.align), c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.map((r, i) => (
              <tr key={rowKey(r, i)} className={cn("hover:bg-slate-50", rowClass?.(r))}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("whitespace-nowrap border-b border-line px-3 py-1.5", align(c.align), c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
