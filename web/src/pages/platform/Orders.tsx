import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { fetchPlatformOrders } from "@/lib/queries";
import { useConfig } from "@/lib/useConfig";
import { money, dateShort, orderLabel } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import {
  PageHeader, Card, CardBody, Table, StatusBadge, Button, Input, Select,
  LoadingBlock, EmptyState, ErrorState,
} from "@/components/ui";
import { useSort, SortHead } from "@/components/tableControls";

type OrderSortKey = "order" | "provider" | "buyer" | "service" | "created" | "status" | "amount";

const PENDING_STATUSES: OrderStatus[] = [
  "QUOTE_REQUESTED", "QUOTED", "ACCEPTED", "NDA_PENDING", "SAMPLE_AWAITED", "IN_PROGRESS", "REPORT_READY",
];
const ALL_STATUSES: OrderStatus[] = [
  "DRAFT", "QUOTE_REQUESTED", "QUOTED", "ACCEPTED", "NDA_PENDING",
  "SAMPLE_AWAITED", "IN_PROGRESS", "REPORT_READY", "COMPLETED", "CANCELLED",
];

export default function PlatformOrders() {
  const { config } = useConfig();
  const currency = config.defaultCurrency;
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { sortKey, sortDir, toggle } = useSort<OrderSortKey>("created", "desc");
  const onSort = (k: OrderSortKey) => { toggle(k); setPage(1); };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["platform-orders", status, search, page, sortKey, sortDir],
    queryFn: () => fetchPlatformOrders({ status: status || undefined, q: search || undefined, page, pageSize: 20, sort: sortKey, dir: sortDir }),
  });
  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader title="Orders" subtitle="Every service order across the network." />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={status === "" ? "primary" : "secondary"} className="btn-sm" onClick={() => { setStatus(""); setPage(1); }}>All</Button>
          {PENDING_STATUSES.map((s) => (
            <Button key={s} variant={status === s ? "primary" : "secondary"} className="btn-sm" onClick={() => { setStatus(s); setPage(1); }}>
              {orderLabel(s)}
            </Button>
          ))}
          <Select
            className="w-auto"
            value={ALL_STATUSES.includes(status as OrderStatus) && !PENDING_STATUSES.includes(status as OrderStatus) ? status : ""}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">More…</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{orderLabel(s)}</option>)}
          </Select>
        </div>
        <form className="flex flex-1 items-center gap-2 sm:justify-end" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }}>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, provider, buyer…" />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : orders.length === 0 ? (
          <CardBody>
            <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No orders" description="No orders match the current filters." />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <SortHead k="order" label="Order" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHead k="provider" label="Provider" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHead k="buyer" label="Buyer" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHead k="service" label="Service" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHead k="created" label="Created" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHead k="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHead k="amount" label="Amount" right sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium">
                    <Link to={`/platform/orders/${o.id}`} className="text-brand-700 hover:underline">{o.code}</Link>
                  </td>
                  <td className="td">
                    {o.institution
                      ? <Link to={`/platform/providers/${o.institution.id}`} className="hover:text-brand-600">{o.institution.name}</Link>
                      : "-"}
                  </td>
                  <td className="td">
                    {o.buyer
                      ? <Link to={`/platform/buyers/${o.buyer.id}`} className="hover:text-brand-600">{o.buyer.orgName || o.buyer.name}</Link>
                      : "-"}
                  </td>
                  <td className="td text-ink-muted">{o.service?.name || "-"}</td>
                  <td className="td text-ink-muted">{dateShort(o.createdAt)}</td>
                  <td className="td"><StatusBadge status={o.status} label={orderLabel(o.status)} /></td>
                  <td className="td text-right">{money(o.invoice?.total ?? o.quotedPrice, o.invoice?.currency || currency)}</td>
                  <td className="td text-right">
                    <Link to={`/platform/orders/${o.id}`} className="btn-ghost btn-sm inline-flex">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
          <span>{total} orders · page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" className="btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" className="btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
