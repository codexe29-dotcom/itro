import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, IndianRupee, Activity, CheckCircle2, Microscope, Gauge,
} from "lucide-react";
import { fetchAnalyticsSummary, fetchOrders, asList } from "@/lib/queries";
import type { ServiceOrder } from "@/lib/types";
import { orderLabel, money, dateShort } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { RevenueLineChart, StatusBarChart } from "@/components/charts";
import SetupChecklist from "@/components/SetupChecklist";
import {
  PageHeader, StatCard, Card, CardBody, Table, StatusBadge,
  LoadingBlock, EmptyState, ErrorState, Button,
} from "@/components/ui";

export default function AdminDashboard() {
  const { user } = useAuth();
  const currency = user?.institution?.currency;

  const summaryQ = useQuery({ queryKey: ["analytics-summary"], queryFn: fetchAnalyticsSummary });
  const ordersQ = useQuery({ queryKey: ["orders", "admin"], queryFn: () => fetchOrders() });

  const s = summaryQ.data;
  const orders = asList<ServiceOrder>(ordersQ.data as any);
  const recent = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={user?.institution?.name ? `Overview for ${user.institution.name}` : "Institution overview"}
        actions={<Link to="/admin/analytics" className="btn-secondary">View analytics</Link>}
      />

      <SetupChecklist />

      {summaryQ.isLoading ? (
        <LoadingBlock />
      ) : summaryQ.isError ? (
        <ErrorState error={summaryQ.error} />
      ) : s ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Revenue" value={money(s.revenue, currency)} icon={<IndianRupee className="h-5 w-5" />} />
            <StatCard label="Total orders" value={s.totalOrders} icon={<ClipboardList className="h-5 w-5" />} />
            <StatCard label="Active" value={s.activeOrders} icon={<Activity className="h-5 w-5" />} />
            <StatCard label="Completed" value={s.completedOrders} icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Instruments" value={s.instruments} icon={<Microscope className="h-5 w-5" />} />
            <StatCard label="Utilization" value={`${Math.round(s.utilizationPct)}%`} icon={<Gauge className="h-5 w-5" />} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="section-title mb-4">Revenue trend</h2>
                {s.revenueByMonth?.length ? (
                  <RevenueLineChart data={s.revenueByMonth} />
                ) : (
                  <EmptyState title="No revenue yet" description="Revenue will appear as orders complete." />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h2 className="section-title mb-4">Orders by status</h2>
                {s.ordersByStatus?.length ? (
                  <StatusBarChart data={s.ordersByStatus.map((d) => ({ ...d, status: orderLabel(d.status) }))} />
                ) : (
                  <EmptyState title="No orders yet" />
                )}
              </CardBody>
            </Card>
          </div>
        </>
      ) : null}

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <h2 className="font-semibold text-ink">Recent orders</h2>
          <Link to="/admin/orders" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>
        </div>
        {ordersQ.isLoading ? (
          <LoadingBlock />
        ) : ordersQ.isError ? (
          <ErrorState error={ordersQ.error} />
        ) : recent.length === 0 ? (
          <CardBody><EmptyState title="No orders yet" description="Incoming quote requests will show here." /></CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Order</th>
                <th className="th">Service</th>
                <th className="th">Buyer</th>
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
                  <td className="td">{o.buyer?.orgName || o.buyer?.name || "-"}</td>
                  <td className="td"><StatusBadge status={o.status} label={orderLabel(o.status)} /></td>
                  <td className="td">{money(o.quotedPrice, currency)}</td>
                  <td className="td">{dateShort(o.createdAt)}</td>
                  <td className="td text-right">
                    <Link to={`/admin/orders/${o.id}`}>
                      <Button variant="ghost" className="btn-sm">Open</Button>
                    </Link>
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
