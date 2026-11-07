import { useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

/** Sort state + toggle for a table. */
export function useSort<K extends string>(initialKey: K, initialDir: SortDir = "asc") {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);
  const toggle = (k: K) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  return { sortKey, sortDir, toggle };
}

/** Comparator honouring direction; strings compared case-insensitively. */
export function cmp(a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDir): number {
  const av = a ?? (typeof a === "number" ? 0 : "");
  const bv = b ?? (typeof b === "number" ? 0 : "");
  const x = typeof av === "string" ? av.toLowerCase() : av;
  const y = typeof bv === "string" ? bv.toLowerCase() : bv;
  if (x < y) return dir === "asc" ? -1 : 1;
  if (x > y) return dir === "asc" ? 1 : -1;
  return 0;
}

/** Clickable, sortable table header cell. */
export function SortHead<K extends string>({
  k, label, sortKey, sortDir, onSort, right, className,
}: {
  k: K; label: string; sortKey: K; sortDir: SortDir; onSort: (k: K) => void; right?: boolean; className?: string;
}) {
  return (
    <th className={`th cursor-pointer select-none ${right ? "text-right" : ""} ${className ?? ""}`} onClick={() => onSort(k)}>
      <span className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""}`}>
        {label}
        {sortKey === k
          ? (sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)
          : <ChevronsUpDown className="h-3.5 w-3.5 text-ink-faint" />}
      </span>
    </th>
  );
}
