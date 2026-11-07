import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, ArrowRight } from "lucide-react";
import { fetchPlatformBuyers } from "@/lib/queries";
import { useConfig } from "@/lib/useConfig";
import { money } from "@/lib/format";
import type { BuyerRow } from "@/lib/types";
import {
  PageHeader, Card, CardBody, Table, Badge, Button, Input,
  LoadingBlock, EmptyState, ErrorState,
} from "@/components/ui";
import { useSort, cmp, SortHead } from "@/components/tableControls";

type BuyerSortKey = "name" | "org" | "email" | "orders" | "spend" | "status";

export default function PlatformBuyers() {
  const { config } = useConfig();
  const currency = config.defaultCurrency;
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["platform-buyers", search],
    queryFn: () => fetchPlatformBuyers(search || undefined),
  });
  const buyers = data ?? [];

  const { sortKey, sortDir, toggle } = useSort<BuyerSortKey>("name", "asc");
  const rows = useMemo(() => {
    const val = (b: BuyerRow): string | number => {
      switch (sortKey) {
        case "name": return b.name;
        case "org": return b.orgName ?? "";
        case "email": return b.email;
        case "orders": return b.orderCount;
        case "spend": return b.totalSpend;
        case "status": return b.isActive ? 1 : 0;
      }
    };
    return [...buyers].sort((a, b) => cmp(val(a), val(b), sortDir));
  }, [buyers, sortKey, sortDir]);

  return (
    <div>
      <PageHeader title="Buyers" subtitle="Industry buyers across the network." />

      <form
        className="mb-4 flex max-w-md items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, org or email…" />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : buyers.length === 0 ? (
          <CardBody>
            <EmptyState icon={<Users className="h-6 w-6" />} title="No buyers" description="Industry buyers appear here once they register." />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <SortHead k="name" label="Buyer" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="org" label="Organization" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="email" label="Email" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="orders" label="Orders" right sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="spend" label="Total spend" right sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-surface-subtle">
                  <td className="td">
                    <Link to={`/platform/buyers/${b.id}`} className="font-medium text-ink hover:text-brand-600">{b.name}</Link>
                  </td>
                  <td className="td">{b.orgName || "-"}</td>
                  <td className="td text-ink-muted">{b.email}</td>
                  <td className="td text-right">{b.orderCount}</td>
                  <td className="td text-right font-medium text-ink">{money(b.totalSpend, currency)}</td>
                  <td className="td"><Badge tone={b.isActive ? "brand" : "gray"}>{b.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td className="td text-right">
                    <Link to={`/platform/buyers/${b.id}`} className="btn-ghost btn-sm inline-flex">360 <ArrowRight className="h-4 w-4" /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
