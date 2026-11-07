import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, asList } from "@/lib/queries";
import type { Invoice } from "@/lib/types";
import { money, dateShort } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Table, StatusBadge,
  LoadingBlock, EmptyState, ErrorState, Button,
} from "@/components/ui";

export default function BuyerInvoices() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });
  const invoices = asList<Invoice>(data as any);

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Billing for your engagements." />
      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : invoices.length === 0 ? (
          <CardBody>
            <EmptyState title="No invoices yet" description="Invoices appear here once you accept a quote." />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Invoice</th>
                <th className="th">Order</th>
                <th className="th">Total</th>
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
                  <td className="td">{money(inv.total, inv.currency)}</td>
                  <td className="td"><StatusBadge status={inv.status} /></td>
                  <td className="td">{dateShort(inv.issuedAt)}</td>
                  <td className="td text-right">
                    {inv.orderId && (
                      <Link to={`/app/orders/${inv.orderId}`}>
                        <Button variant="ghost" className="btn-sm">
                          {inv.status === "PAID" ? "View" : "Pay"}
                        </Button>
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
