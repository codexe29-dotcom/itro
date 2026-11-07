import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Building2, User as UserIcon } from "lucide-react";
import { fetchPlatformOrder } from "@/lib/queries";
import { useConfig } from "@/lib/useConfig";
import { orderLabel, money, dateShort, dateTime } from "@/lib/format";
import OrderTimeline from "@/components/OrderTimeline";
import OrderThread from "@/components/OrderThread";
import {
  Card, CardBody, StatusBadge, LoadingBlock, ErrorState,
} from "@/components/ui";

export default function PlatformOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { config } = useConfig();
  const qc = useQueryClient();
  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ["platform-order", id],
    queryFn: () => fetchPlatformOrder(id!),
    enabled: !!id,
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !order) return <ErrorState error={error} />;

  const currency = order.invoice?.currency || order.institution?.currency || config.defaultCurrency;
  const inv = order.invoice;
  const settlement = order.settlement;

  return (
    <div>
      <Link to="/platform/orders" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-ink">{order.code}</h1>
            <StatusBadge status={order.status} label={orderLabel(order.status)} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">{order.service?.name}</p>
        </div>
      </div>

      {/* Provider + buyer */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Building2 className="h-5 w-5" /></span>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Provider</p>
              {order.institution
                ? <Link to={`/platform/providers/${order.institution.id}`} className="font-semibold text-ink hover:text-brand-600">{order.institution.name}</Link>
                : <p className="font-semibold text-ink">-</p>}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><UserIcon className="h-5 w-5" /></span>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Buyer</p>
              {order.buyer
                ? <Link to={`/platform/buyers/${order.buyer.id}`} className="font-semibold text-ink hover:text-brand-600">{order.buyer.orgName || order.buyer.name}</Link>
                : <p className="font-semibold text-ink">-</p>}
              {order.buyer?.email && <p className="text-xs text-ink-muted">{order.buyer.email}</p>}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="section-title mb-4">Request details</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Quantity" value={String(order.quantity)} />
                <Detail label="Pricing tier" value={order.tier} />
                <Detail label="Sample details" value={order.sampleDetails || "-"} full />
                <Detail label="Requirements" value={order.requirements || "-"} full />
              </dl>
            </CardBody>
          </Card>

          {order.reportUrl && (
            <Card>
              <CardBody className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><FileText className="h-5 w-5" /></span>
                  <div>
                    <p className="font-semibold text-ink">Report</p>
                    <p className="text-sm text-ink-muted">Deliverable uploaded.</p>
                  </div>
                </div>
                <a href={order.reportUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Open</a>
              </CardBody>
            </Card>
          )}

          <OrderThread lineId={order.id} documents={order.documents ?? []} messages={order.messages ?? []} onChanged={() => qc.invalidateQueries({ queryKey: ["platform-order", id] })} title="Documents & messages" />

          <Card>
            <CardBody>
              <h2 className="section-title mb-4">Lifecycle</h2>
              <OrderTimeline events={order.events} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="section-title mb-3">Commercials</h2>
              <div className="space-y-2 text-sm">
                <Row label="Quoted price" value={money(order.quotedPrice, currency)} strong />
                {order.slaDays != null && <Row label="SLA" value={`${order.slaDays} days`} />}
                {order.dueAt && <Row label="Due" value={dateShort(order.dueAt)} />}
                <Row label="NDA" value={order.ndaSigned ? `Signed ${dateShort(order.ndaSignedAt)}` : "Not signed"} />
              </div>
            </CardBody>
          </Card>

          {order.buyerAmount != null && (
            <Card>
              <CardBody>
                <h2 className="section-title mb-3">Fee breakdown</h2>
                <div className="space-y-2 text-sm">
                  <Row label="Provider receives" value={money(order.providerAmount, currency)} />
                  <Row label="Platform fee" value={money(order.platformFeeAmount, currency)} />
                  <div className="border-t border-surface-border pt-2">
                    <Row label="Buyer pays" value={money(order.buyerAmount, currency)} strong />
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {inv && (
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title">Invoice</h2>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Number" value={inv.number} />
                  <Row label="Subtotal" value={money(inv.subtotal, inv.currency)} />
                  <Row label={`Tax (${(inv.taxRate * 100).toFixed(0)}%)`} value={money(inv.taxAmount, inv.currency)} />
                  <div className="border-t border-surface-border pt-2">
                    <Row label="Total" value={money(inv.total, inv.currency)} strong />
                  </div>
                  {inv.payment?.paidAt && <Row label="Paid" value={dateTime(inv.payment.paidAt)} />}
                </div>
              </CardBody>
            </Card>
          )}

          {settlement && (
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title">Settlement</h2>
                  <StatusBadge status={settlement.status} />
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Gross" value={money(settlement.grossAmount, currency)} />
                  <Row label={`Platform fee (${(settlement.takeRate * 100).toFixed(0)}%)`} value={money(settlement.platformFee, currency)} />
                  <div className="border-t border-surface-border pt-2">
                    <Row label="Net to provider" value={money(settlement.netToProvider, currency)} strong />
                  </div>
                  {settlement.releasedAt && <Row label="Released" value={dateShort(settlement.releasedAt)} />}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-ink-soft">{value}</dd>
    </div>
  );
}
function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={strong ? "font-semibold text-ink" : "text-ink-soft"}>{value}</span>
    </div>
  );
}
