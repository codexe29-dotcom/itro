import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Building2, FileText, Download, ShieldCheck, FlaskConical, Truck } from "lucide-react";
import { fetchOrder, payOrder, fetchPaymentStatus, createRazorpayOrder, verifyRazorpayPayment } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import type { Order, ServiceOrder, OrderEvent } from "@/lib/types";
import { orderLabel, money, dateShort } from "@/lib/format";
import OrderTimeline from "@/components/OrderTimeline";
import OrderThread from "@/components/OrderThread";
import ReviewBlock from "@/components/ReviewBlock";
import {
  Card, CardBody, StatusBadge, LoadingBlock, ErrorState, Button, useToast,
} from "@/components/ui";

export default function BuyerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  const { user } = useAuth();
  const { data: payStatus } = useQuery({ queryKey: ["payment-status"], queryFn: fetchPaymentStatus });
  const [payStarting, setPayStarting] = useState(false);

  const pay = useMutation({
    mutationFn: () => payOrder(id!, { method: "card" }),
    onSuccess: () => { toast.push("success", "Payment successful."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Payment failed."),
  });

  async function startRazorpay() {
    setPayStarting(true);
    try {
      const loaded = await new Promise<boolean>((resolve) => {
        if ((window as any).Razorpay) return resolve(true);
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve(true); s.onerror = () => resolve(false);
        document.body.appendChild(s);
      });
      if (!loaded) { toast.push("error", "Could not load the payment gateway."); return; }
      const rp = await createRazorpayOrder(id!);
      const rz = new (window as any).Razorpay({
        key: rp.keyId, amount: rp.amount, currency: rp.currency, name: "ITRO", description: `Order ${(order as any)?.code ?? ""}`,
        order_id: rp.orderId,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#0d9488" },
        handler: async (resp: any) => {
          try {
            await verifyRazorpayPayment({ orderId: id!, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature });
            toast.push("success", "Payment successful."); invalidate();
          } catch (e: any) { toast.push("error", e?.response?.data?.message || "Payment verification failed."); }
        },
      });
      rz.on("payment.failed", () => toast.push("error", "Payment failed."));
      rz.open();
    } catch (e: any) {
      toast.push("error", e?.response?.data?.message || "Could not start payment.");
    } finally { setPayStarting(false); }
  }
  const handlePay = () => (payStatus?.razorpay ? startRazorpay() : pay.mutate());

  if (isLoading) return <LoadingBlock />;
  if (isError || !order) return <ErrorState error={error} />;

  // The buyer endpoint returns a parent Order (with .lines). Guard for legacy single-line responses.
  const parent = order as unknown as Order;
  const lines: ServiceOrder[] = parent.lines ?? [];
  const currency = parent.currency || "INR";

  // Group by provider.
  const groups = new Map<string, { name: string; lines: ServiceOrder[] }>();
  for (const l of lines) {
    const key = l.institutionId;
    const name = l.institution?.name ?? "Provider";
    if (!groups.has(key)) groups.set(key, { name, lines: [] });
    groups.get(key)!.lines.push(l);
  }

  // Merge every line's events into one timeline.
  const allEvents: OrderEvent[] = lines.flatMap((l) => l.events ?? []);

  const unpaidTotal = lines
    .map((l) => l.invoice)
    .filter((inv) => inv && inv.status !== "PAID" && inv.status !== "VOID")
    .reduce((s, inv) => s + (inv?.total ?? 0), 0);
  const canPay = unpaidTotal > 0;

  return (
    <div>
      <Link to="/app/orders" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-ink">{parent.code}</h1>
            <StatusBadge status={parent.status} label={parent.status === "PLACED" ? "Placed" : parent.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {lines.length} item{lines.length === 1 ? "" : "s"} · {groups.size} provider{groups.size === 1 ? "" : "s"}
          </p>
        </div>
        {canPay && (
          <Button loading={pay.isPending || payStarting} onClick={handlePay}>
            <CreditCard className="h-4 w-4" /> Pay {money(unpaidTotal, currency)}
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: lines grouped by provider + timeline */}
        <div className="space-y-6">
          {[...groups.entries()].map(([gid, group]) => (
            <Card key={gid}>
              <div className="flex items-center gap-2 border-b border-surface-border px-5 py-3">
                <Building2 className="h-4 w-4 text-ink-faint" />
                <span className="font-semibold text-ink">{group.name}</span>
              </div>
              <div className="divide-y divide-surface-border">
                {group.lines.map((l) => {
                  const isQuote = (l.service?.pricingMode ?? "QUOTE") === "QUOTE" && l.buyerAmount == null;
                  return (
                    <div key={l.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{l.service?.name ?? "Service"}</p>
                          <p className="text-xs text-ink-muted">{l.service?.category} · Qty {l.quantity}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge status={l.status} label={orderLabel(l.status)} />
                          {isQuote
                            ? <span className="text-xs text-ink-muted">Awaiting quote</span>
                            : <span className="font-semibold text-ink">{money(l.buyerAmount, currency)}</span>}
                        </div>
                      </div>

                      {/* Per-line breakdown */}
                      {l.buyerAmount != null && (
                        <div className="mt-3 grid gap-1 rounded-lg bg-surface-subtle px-3 py-2 text-xs sm:grid-cols-3">
                          <span className="text-ink-muted">Provider: <span className="text-ink-soft">{money(l.providerAmount, currency)}</span></span>
                          <span className="text-ink-muted">Platform fee: <span className="text-ink-soft">{money(l.platformFeeAmount, currency)}</span></span>
                          <span className="text-ink-muted">You pay: <span className="font-medium text-ink">{money(l.buyerAmount, currency)}</span></span>
                        </div>
                      )}
                      {l.intakeAnswers && l.intakeAnswers.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Information you provided</p>
                          <dl className="grid gap-1.5 rounded-lg border border-surface-border p-3 text-xs sm:grid-cols-2">
                            {l.intakeAnswers.map((a) => (
                              <div key={a.name} className="flex flex-col">
                                <dt className="text-ink-muted">{a.name}</dt>
                                <dd className="font-medium text-ink">
                                  {a.type === "FILE"
                                    ? (a.answer ? <a href={a.answer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Download className="h-3 w-3" /> View file</a> : <span className="text-ink-faint">—</span>)
                                    : (a.answer || <span className="text-ink-faint">—</span>)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}
                      {l.invoice && (
                        <p className="mt-2 text-xs text-ink-muted">
                          Invoice {l.invoice.number} · <StatusBadge status={l.invoice.status} /> · {money(l.invoice.total, l.invoice.currency)}
                        </p>
                      )}
                      {l.reportUrl && (
                        <a href={l.reportUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                          <Download className="h-3 w-3" /> Download report
                        </a>
                      )}
                      {l.status === "COMPLETED" && (
                        <div className="mt-3">
                          <ReviewBlock lineId={l.id} review={l.review} onChanged={invalidate} />
                        </div>
                      )}
                      <div className="mt-4">
                        <OrderThread lineId={l.id} documents={l.documents ?? []} messages={l.messages ?? []} onChanged={invalidate} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          <Card>
            <CardBody>
              <h2 className="section-title mb-4">Activity</h2>
              <OrderTimeline events={allEvents} />
            </CardBody>
          </Card>
        </div>

        {/* Right: summary */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-6">
          <Card>
            <CardBody>
              <h2 className="section-title mb-3">Summary</h2>
              <div className="space-y-2 text-sm">
                <Row label="Subtotal" value={money(parent.subtotal, currency)} />
                <Row label="Platform fee (incl.)" value={money(parent.platformFee, currency)} />
                <Row label="Tax" value={money(parent.taxAmount, currency)} />
                <div className="border-t border-surface-border pt-2">
                  <Row label="Total" value={money(parent.total, currency)} strong />
                </div>
              </div>
              {canPay ? (
                <Button className="mt-4 w-full" loading={pay.isPending || payStarting} onClick={handlePay}>
                  <CreditCard className="h-4 w-4" /> Pay {money(unpaidTotal, currency)}
                </Button>
              ) : parent.total > 0 ? (
                <div className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-success-soft py-2 text-sm font-medium text-success">
                  <ShieldCheck className="h-4 w-4" /> Paid in full
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-surface-subtle py-2 text-sm text-ink-muted">
                  <FileText className="h-4 w-4" /> Awaiting provider quotes
                </div>
              )}
            </CardBody>
          </Card>

          {(parent.samples?.length || parent.shippingNote) && (
            <Card>
              <CardBody>
                <h2 className="section-title mb-3 flex items-center gap-2"><FlaskConical className="h-4 w-4 text-brand-600" /> Samples</h2>
                {parent.samples && parent.samples.length > 0 ? (
                  <ul className="space-y-2">
                    {parent.samples.map((s) => (
                      <li key={s.id} className="rounded-lg border border-surface-border p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-ink">{s.label}{s.quantity > 1 ? ` ×${s.quantity}` : ""}</span>
                          <span className="badge-gray">{sampleStatusLabel(s.status)}</span>
                        </div>
                        {s.condition && <p className="mt-0.5 text-xs text-ink-muted">{s.condition}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-muted">No samples declared.</p>
                )}
                {parent.shippingNote && (
                  <div className="mt-3 rounded-lg bg-surface-subtle p-2.5 text-xs text-ink-soft">
                    <span className="inline-flex items-center gap-1 font-medium text-ink"><Truck className="h-3.5 w-3.5" /> Shipping instructions</span>
                    <p className="mt-1 whitespace-pre-line">{parent.shippingNote}</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function sampleStatusLabel(s: string): string {
  return ({
    AWAITING_SHIPMENT: "Awaiting shipment", RECEIVED: "Received",
    IN_TESTING: "In testing", RETURNED: "Returned", CONSUMED: "Consumed",
  } as Record<string, string>)[s] ?? s;
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={strong ? "font-semibold text-ink" : "text-ink-soft"}>{value}</span>
    </div>
  );
}
