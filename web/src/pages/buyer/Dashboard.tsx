import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock, CheckCircle2, Store, ArrowRight } from "lucide-react";
import { fetchOrders, asList } from "@/lib/queries";
import type { ServiceOrder } from "@/lib/types";
import { orderLabel, money, dateShort } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  PageHeader, StatCard, Card, CardBody, Table, StatusBadge,
  LoadingBlock, EmptyState, ErrorState, Button,
} from "@/components/ui";

const ACTIVE = new Set([
  "QUOTE_REQUESTED", "QUOTED", "ACCEPTED", "NDA_PENDING",
  "SAMPLE_AWAITED", "IN_PROGRESS", "REPORT_READY",
]);

export default function BuyerDashboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["orders", "buyer"],
    queryFn: () => fetchOrders(),
  });

  const orders = asList<ServiceOrder>(data as any);
  const active = orders.filter((o) => ACTIVE.has(o.status)).length;
  const completed = orders.filter((o) => o.status === "COMPLETED").length;
  const awaitingAction = orders.filter((o) => o.status === "QUOTED" || o.status === "NDA_PENDING").length;
  const recent = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title={`Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        subtitle="Track your requests and discover new capabilities."
        actions={<Link to="/exchange" className="btn-primary"><Store className="h-4 w-4" /> Browse catalog</Link>}
      />

      {isLoading ? (
        <LoadingBlock />
      ) : isError ? (
        <ErrorState error={error} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total orders" value={orders.length} icon={<ClipboardList className="h-5 w-5" />} />
            <StatCard label="Active" value={active} icon={<Clock className="h-5 w-5" />} />
            <StatCard label="Awaiting your action" value={awaitingAction} icon={<ArrowRight className="h-5 w-5" />} />
            <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-5 w-5" />} />
          </div>

          <Card className="mt-6">
            <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
              <h2 className="font-semibold text-ink">Recent orders</h2>
              <Link to="/app/orders" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>
            </div>
            {recent.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No orders yet"
                  description="Browse the catalog and request a quote to get started."
                  action={<Link to="/exchange" className="btn-primary btn-sm">Browse catalog</Link>}
                />
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className="th">Order</th>
                    <th className="th">Service</th>
                    <th className="th">Status</th>
                    <th className="th">Quoted</th>
                    <th className="th">Created</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-subtle">
                      <td className="td font-medium text-ink">{o.code}</td>
                      <td className="td">{o.service?.name ?? "-"}</td>
                      <td className="td"><StatusBadge status={o.status} label={orderLabel(o.status)} /></td>
                      <td className="td">{money(o.quotedPrice, o.invoice?.currency)}</td>
                      <td className="td">{dateShort(o.createdAt)}</td>
                      <td className="td text-right">
                        <Link to={`/app/orders/${o.id}`}>
                          <Button variant="ghost" className="btn-sm">Open</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
