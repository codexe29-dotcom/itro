import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, asList } from "@/lib/queries";
import type { Invoice } from "@/lib/types";
import { money, dateShort } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Table, StatusBadge,
  LoadingBlock, EmptyState, ErrorState, Button,
} from "@/components/ui";

export default function AdminInvoices() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });
  const invoices = asList<Invoice>(data as any);
  const outstanding = invoices.filter((i) => i.status !== "PAID" && i.status !== "VOID")
    .reduce((sum, i) => sum + (i.total || 0), 0);
  const collected = invoices.filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + (i.total || 0), 0);
  const currency = invoices[0]?.currency;

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Billing across your engagements." />

      {!isLoading && !isError && invoices.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Invoices" value={String(invoices.length)} />
          <SummaryCard label="Outstanding" value={money(outstanding, currency)} />
          <SummaryCard label="Collected" value={money(collected, currency)} />
        </div>
      )}

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : invoices.length === 0 ? (
          <CardBody><EmptyState title="No invoices yet" description="Invoices are created when buyers accept quotes." /></CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Invoice</th>
                <th className="th">Order</th>
                <th className="th text-right">Subtotal</th>
                <th className="th text-right">Tax</th>
                <th className="th text-right">Total</th>
                <th className="th">Status</th>
                <th className="th">Issued</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium text-ink">{inv.number}</td>
                  <td className="td">{inv.order?.code ?? "-"}</td>
                  <td className="td text-right">{money(inv.subtotal, inv.currency)}</td>
                  <td className="td text-right">{money(inv.taxAmount, inv.currency)}</td>
                  <td className="td text-right font-medium text-ink">{money(inv.total, inv.currency)}</td>
                  <td className="td"><StatusBadge status={inv.status} /></td>
                  <td className="td">{dateShort(inv.issuedAt)}</td>
                  <td className="td text-right">
                    {inv.orderId && (
                      <Link to={`/admin/orders/${inv.orderId}`}>
                        <Button variant="ghost" className="btn-sm">Order</Button>
                      </Link>
                    )}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="p-5">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="stat-value mt-1">{value}</p>
      </div>
    </Card>
  );
}
