import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { fetchOrders, asList } from "@/lib/queries";
import type { Order } from "@/lib/types";
import { money, dateShort } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Table, Badge,
  LoadingBlock, EmptyState, ErrorState, Button,
} from "@/components/ui";

export default function BuyerOrders() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["orders", "buyer"],
    queryFn: () => fetchOrders(),
  });

  const orders = asList<Order>(data as any);

  return (
    <div>
      <PageHeader
        title="My Orders"
        subtitle="Every order you've placed across providers."
        actions={<Link to="/exchange" className="btn-secondary"><Store className="h-4 w-4" /> New request</Link>}
      />

      <Card>
        <div className="flex items-center justify-end border-b border-surface-border px-5 py-3">
          <p className="text-sm text-ink-muted">{orders.length} orders</p>
        </div>

        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : orders.length === 0 ? (
          <CardBody>
            <EmptyState
              title="No orders yet"
              description="Browse the catalog, add services to your cart, and check out."
              action={<Link to="/exchange" className="btn-primary btn-sm">Browse catalog</Link>}
            />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Order</th>
                <th className="th">Providers</th>
                <th className="th">Items</th>
                <th className="th text-right">Total</th>
                <th className="th">Created</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const providers = new Set((o.lines ?? []).map((l) => l.institutionId)).size;
                return (
                  <tr key={o.id} className="hover:bg-surface-subtle">
                    <td className="td font-medium text-ink">{o.code}</td>
                    <td className="td">{providers}</td>
                    <td className="td">{o.lines?.length ?? 0}</td>
                    <td className="td text-right font-medium text-ink">
                      {o.total > 0 ? money(o.total, o.currency) : <Badge tone="info">Awaiting quotes</Badge>}
                    </td>
                    <td className="td">{dateShort(o.createdAt)}</td>
                    <td className="td text-right">
                      <Link to={`/app/orders/${o.id}`}>
                        <Button variant="ghost" className="btn-sm">Open</Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
