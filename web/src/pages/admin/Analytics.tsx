import { useQuery } from "@tanstack/react-query";
import { fetchAnalyticsSummary } from "@/lib/queries";
import { orderLabel, money } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { RevenueLineChart, StatusDonut } from "@/components/charts";
import {
  PageHeader, Card, CardBody, Table, LoadingBlock, EmptyState, ErrorState,
} from "@/components/ui";

export default function AdminAnalytics() {
  const { user } = useAuth();
  const currency = user?.institution?.currency;
  const { data: s, isLoading, isError, error } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: fetchAnalyticsSummary,
  });

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Performance across your institution." />

      {isLoading ? (
        <LoadingBlock />
      ) : isError ? (
        <ErrorState error={error} />
      ) : s ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardBody>
                <h2 className="section-title mb-4">Revenue over time</h2>
                {s.revenueByMonth?.length ? (
                  <RevenueLineChart data={s.revenueByMonth} />
                ) : (
                  <EmptyState title="No revenue data" />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h2 className="section-title mb-4">Order mix</h2>
                {s.ordersByStatus?.length ? (
                  <StatusDonut data={s.ordersByStatus.map((d) => ({ ...d, status: orderLabel(d.status) }))} />
                ) : (
                  <EmptyState title="No orders" />
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <div className="border-b border-surface-border px-5 py-4">
              <h2 className="font-semibold text-ink">Top services</h2>
            </div>
            {s.topServices?.length ? (
              <Table>
                <thead>
                  <tr>
                    <th className="th">Service</th>
                    <th className="th text-right">Orders</th>
                    <th className="th text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {s.topServices.map((t) => (
                    <tr key={t.name} className="hover:bg-surface-subtle">
                      <td className="td font-medium text-ink">{t.name}</td>
                      <td className="td text-right">{t.orders}</td>
                      <td className="td text-right">{money(t.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <CardBody><EmptyState title="No service data yet" /></CardBody>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
