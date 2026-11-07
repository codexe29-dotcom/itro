import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, User as UserIcon, ClipboardList, Activity, IndianRupee, Mail, Phone, Building2,
} from "lucide-react";
import { fetchPlatformBuyer } from "@/lib/queries";
import { useConfig } from "@/lib/useConfig";
import { money, dateShort, orderLabel } from "@/lib/format";
import {
  Card, CardBody, Table, StatCard, StatusBadge,
  LoadingBlock, ErrorState, EmptyState,
} from "@/components/ui";

export default function PlatformBuyerDetail() {
  const { id } = useParams<{ id: string }>();
  const { config } = useConfig();
  const currency = config.defaultCurrency;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["platform-buyer", id],
    queryFn: () => fetchPlatformBuyer(id!),
    enabled: !!id,
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) return <ErrorState error={error} />;

  const { buyer, orders, invoices, stats } = data;

  return (
    <div>
      <Link to="/platform/buyers" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to buyers
      </Link>

      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <UserIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{buyer.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
            {buyer.orgName && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {buyer.orgName}</span>}
            <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {buyer.email}</span>
            {buyer.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {buyer.phone}</span>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total spend" value={money(stats.totalSpend, currency)} icon={<IndianRupee className="h-5 w-5" />} />
        <StatCard label="Orders" value={stats.totalOrders} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Active" value={stats.activeOrders} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Completed" value={stats.completedOrders} icon={<ClipboardList className="h-5 w-5" />} />
      </div>

      <Card className="mt-6">
        <div className="border-b border-surface-border px-5 py-4">
          <h2 className="font-semibold text-ink">Orders</h2>
        </div>
        {orders.length ? (
          <Table>
            <thead>
              <tr>
                <th className="th">Order</th>
                <th className="th">Service</th>
                <th className="th">Provider</th>
                <th className="th">Status</th>
                <th className="th text-right">Amount</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium text-ink">{o.code}</td>
                  <td className="td">{o.service?.name || "-"}</td>
                  <td className="td">{o.institution?.name || "-"}</td>
                  <td className="td"><StatusBadge status={o.status} label={orderLabel(o.status)} /></td>
                  <td className="td text-right">{money(o.invoice?.total ?? o.quotedPrice, o.invoice?.currency || currency)}</td>
                  <td className="td text-right">
                    <Link to={`/platform/orders/${o.id}`} className="btn-ghost btn-sm inline-flex">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody><EmptyState title="No orders yet" /></CardBody>
        )}
      </Card>

      <Card className="mt-6">
        <div className="border-b border-surface-border px-5 py-4">
          <h2 className="font-semibold text-ink">Invoices</h2>
        </div>
        {invoices.length ? (
          <Table>
            <thead>
              <tr>
                <th className="th">Invoice</th>
                <th className="th">Order</th>
                <th className="th">Provider</th>
                <th className="th">Issued</th>
                <th className="th">Status</th>
                <th className="th text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium text-ink">{inv.number}</td>
                  <td className="td">{inv.order?.code || "-"}</td>
                  <td className="td">{inv.institution?.name || "-"}</td>
                  <td className="td text-ink-muted">{dateShort(inv.issuedAt)}</td>
                  <td className="td"><StatusBadge status={inv.status} /></td>
                  <td className="td text-right font-medium text-ink">{money(inv.total, inv.currency || currency)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody><EmptyState title="No invoices yet" /></CardBody>
        )}
      </Card>

      <p className="mt-6 text-xs text-ink-faint">Buyer since {dateShort(buyer.createdAt)}.</p>
    </div>
  );
}
