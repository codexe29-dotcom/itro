import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Building2, ClipboardList, IndianRupee, Wallet, Activity, Users,
} from "lucide-react";
import { fetchPlatformAnalytics } from "@/lib/queries";
import { useConfig } from "@/lib/useConfig";
import { money } from "@/lib/format";
import { orderLabel } from "@/lib/format";
import { RevenueLineChart, StatusBarChart } from "@/components/charts";
import {
  PageHeader, StatCard, Card, CardBody, Table,
  LoadingBlock, EmptyState, ErrorState,
} from "@/components/ui";

export default function PlatformDashboard() {
  const { config } = useConfig();
  const currency = config.defaultCurrency;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["platform-analytics"],
    queryFn: fetchPlatformAnalytics,
  });

  return (
    <div>
      <PageHeader title="Network overview" subtitle="Platform-wide performance across all providers." />

      {isLoading ? (
        <LoadingBlock />
      ) : isError ? (
        <ErrorState error={error} />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="GMV" value={money(data.totalRevenue, currency)} icon={<IndianRupee className="h-5 w-5" />} />
            <StatCard label="Platform fees" value={money(data.platformFees, currency)} icon={<Wallet className="h-5 w-5" />} />
            <StatCard label="Orders" value={data.totalOrders} icon={<ClipboardList className="h-5 w-5" />} />
            <StatCard label="Active" value={data.activeOrders} icon={<Activity className="h-5 w-5" />} />
            <StatCard label="Providers" value={data.totalInstitutions} icon={<Building2 className="h-5 w-5" />} />
            <StatCard label="Buyers" value={data.totalBuyers} icon={<Users className="h-5 w-5" />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="section-title mb-4">Network revenue</h2>
                {data.revenueByMonth?.some((m) => m.revenue > 0) ? (
                  <RevenueLineChart data={data.revenueByMonth} />
                ) : (
                  <EmptyState title="No revenue yet" />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h2 className="section-title mb-4">Orders by status</h2>
                {data.ordersByStatus?.length ? (
                  <StatusBarChart data={data.ordersByStatus.map((o) => ({ status: orderLabel(o.status), count: o.count }))} />
                ) : (
                  <EmptyState title="No orders yet" />
                )}
              </CardBody>
            </Card>
          </div>

          {data.settlements && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Settlement gross" value={money(data.settlements.grossAmount, currency)} />
              <StatCard label="Net to providers" value={money(data.settlements.netToProvider, currency)} />
              <StatCard label="Fees released" value={money(data.settlements.releasedPlatformFee, currency)} />
              <StatCard label="Pending payout" value={money(data.settlements.pendingNetToProvider, currency)} />
            </div>
          )}

          <Card>
            <div className="border-b border-surface-border px-5 py-4">
              <h2 className="font-semibold text-ink">Provider leaderboard</h2>
            </div>
            {data.leaderboard?.length ? (
              <Table>
                <thead>
                  <tr>
                    <th className="th">#</th>
                    <th className="th">Provider</th>
                    <th className="th text-right">Orders</th>
                    <th className="th text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((row, i) => (
                    <tr key={row.id} className="hover:bg-surface-subtle">
                      <td className="td text-ink-muted">{i + 1}</td>
                      <td className="td font-medium text-ink">
                        <Link to={`/platform/providers/${row.id}`} className="hover:text-brand-600">{row.name}</Link>
                      </td>
                      <td className="td text-right">{row.orders}</td>
                      <td className="td text-right">{money(row.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <CardBody><EmptyState title="No providers ranked yet" /></CardBody>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
