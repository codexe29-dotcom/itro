import { useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, FileText, PackageCheck, Upload, CheckCircle2, XCircle, Circle, Download,
} from "lucide-react";
import clsx from "clsx";
import { fetchOrder, uploadOrderDocument } from "@/lib/queries";
import { post } from "@/lib/api";
import type { OrderDocument } from "@/lib/types";
import { orderLabel, money, dateShort, dateTime } from "@/lib/format";
import OrderTimeline from "@/components/OrderTimeline";
import OrderThread from "@/components/OrderThread";
import {
  Card, CardBody, StatusBadge, LoadingBlock, ErrorState, Button, Modal,
  Field, Input, useToast,
} from "@/components/ui";

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<null | "quote" | "report" | "cancel">(null);
  const [quotedPrice, setQuotedPrice] = useState("");
  const [slaDays, setSlaDays] = useState("");
  const [quoteDiscount, setQuoteDiscount] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [reportUploading, setReportUploading] = useState(false);
  const reportFileRef = useRef<HTMLInputElement>(null);

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };
  const err = (e: any, fallback: string) => toast.push("error", e?.response?.data?.message || fallback);

  const quote = useMutation({
    mutationFn: () => post(`/orders/${id}/quote`, { quotedPrice: Number(quotedPrice), slaDays: Number(slaDays), ...(quoteDiscount ? { discountPct: Number(quoteDiscount) } : {}) }),
    onSuccess: () => { toast.push("success", "Quote issued."); setModal(null); invalidate(); },
    onError: (e) => err(e, "Could not issue quote."),
  });
  const sampleReceived = useMutation({
    mutationFn: () => post(`/orders/${id}/sample-received`),
    onSuccess: () => { toast.push("success", "Marked sample received."); invalidate(); },
    onError: (e) => err(e, "Could not update."),
  });
  const report = useMutation({
    mutationFn: () => post(`/orders/${id}/report`, { reportUrl }),
    onSuccess: () => { toast.push("success", "Report uploaded."); setModal(null); setReportUrl(""); invalidate(); },
    onError: (e) => err(e, "Could not upload report."),
  });
  async function handleReportFile(files: FileList | null) {
    if (!id || !files || files.length === 0) return;
    setReportUploading(true);
    try {
      const { url } = await uploadOrderDocument(id, files[0], "REPORT");
      setReportUrl(url);
      toast.push("success", "File uploaded — click Save report to attach it.");
    } catch (e) { err(e, "Upload failed."); }
    finally { setReportUploading(false); }
  }
  const complete = useMutation({
    mutationFn: () => post(`/orders/${id}/complete`),
    onSuccess: () => { toast.push("success", "Order completed."); invalidate(); },
    onError: (e) => err(e, "Could not complete."),
  });
  const cancel = useMutation({
    mutationFn: () => post(`/orders/${id}/cancel`),
    onSuccess: () => { toast.push("success", "Order cancelled."); setModal(null); invalidate(); },
    onError: (e) => err(e, "Could not cancel."),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !order) return <ErrorState error={error} />;

  const currency = order.invoice?.currency || order.institution?.currency;
  const st = order.status;
  const canQuote = st === "QUOTE_REQUESTED";
  const canSample = st === "SAMPLE_AWAITED";
  const canReport = st === "IN_PROGRESS";
  const canComplete = st === "REPORT_READY";
  const canCancel = !["COMPLETED", "CANCELLED"].includes(st);

  return (
    <div>
      <Link to="/admin/orders" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-ink">{order.code}</h1>
            <StatusBadge status={st} label={orderLabel(st)} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {order.service?.name} · {order.buyer?.orgName || order.buyer?.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canQuote && <Button onClick={() => setModal("quote")}>Issue quote</Button>}
          {canSample && (
            <Button loading={sampleReceived.isPending} onClick={() => sampleReceived.mutate()}>
              <PackageCheck className="h-4 w-4" /> Sample received
            </Button>
          )}
          {canReport && <Button onClick={() => setModal("report")}><Upload className="h-4 w-4" /> Upload report</Button>}
          {canComplete && (
            <Button loading={complete.isPending} onClick={() => complete.mutate()}>
              <CheckCircle2 className="h-4 w-4" /> Complete
            </Button>
          )}
          {canCancel && (
            <Button variant="secondary" onClick={() => setModal("cancel")}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="section-title mb-4">Request details</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Buyer" value={order.buyer?.name || "-"} />
                <Detail label="Organization" value={order.buyer?.orgName || "-"} />
                <Detail label="Quantity" value={String(order.quantity)} />
                <Detail label="Pricing tier" value={order.tier} />
                <Detail label="Sample details" value={order.sampleDetails || "-"} full />
                <Detail label="Requirements" value={order.requirements || "-"} full />
              </dl>
            </CardBody>
          </Card>

          {order.intakeAnswers && order.intakeAnswers.length > 0 && (
            <Card>
              <CardBody>
                <h2 className="section-title mb-4">Buyer's submitted information</h2>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {order.intakeAnswers.map((a) => (
                    <div key={a.name}>
                      <dt className="text-xs uppercase tracking-wide text-ink-faint">{a.name}</dt>
                      <dd className="text-sm text-ink">
                        {a.type === "FILE"
                          ? (a.answer ? <a href={a.answer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"><Download className="h-3.5 w-3.5" /> View file</a> : <span className="text-ink-faint">Not provided</span>)
                          : (a.answer || <span className="text-ink-faint">Not provided</span>)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          )}

          <DeliverablesChecklist lineId={order.id} deliverables={(order.service as any)?.deliverables ?? []} documents={order.documents ?? []} onChanged={invalidate} />

          {order.reportUrl && (
            <Card>
              <CardBody className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink">Report</p>
                    <p className="text-sm text-ink-muted">Deliverable uploaded.</p>
                  </div>
                </div>
                <a href={order.reportUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Open</a>
              </CardBody>
            </Card>
          )}

          <OrderThread lineId={order.id} documents={order.documents ?? []} messages={order.messages ?? []} onChanged={invalidate} title="Documents & messages" />

          <Card>
            <CardBody>
              <h2 className="section-title mb-4">Activity</h2>
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

          {order.invoice && (
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title">Invoice</h2>
                  <StatusBadge status={order.invoice.status} />
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Number" value={order.invoice.number} />
                  <Row label="Total" value={money(order.invoice.total, order.invoice.currency)} strong />
                  {order.invoice.payment?.paidAt && <Row label="Paid" value={dateTime(order.invoice.payment.paidAt)} />}
                </div>
              </CardBody>
            </Card>
          )}

          {order.settlement && (
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title">Settlement</h2>
                  <StatusBadge status={order.settlement.status} />
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Gross" value={money(order.settlement.grossAmount, currency)} />
                  <Row label={`Platform fee (${(order.settlement.takeRate * 100).toFixed(0)}%)`} value={money(order.settlement.platformFee, currency)} />
                  <div className="border-t border-surface-border pt-2">
                    <Row label="Net to you" value={money(order.settlement.netToProvider, currency)} strong />
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Quote modal */}
      <Modal
        open={modal === "quote"} onClose={() => setModal(null)} title="Issue quote"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={quote.isPending} disabled={!quotedPrice || !slaDays} onClick={() => quote.mutate()}>
              Send quote
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={`Quoted price${currency ? ` (${currency})` : ""}`}>
            <Input type="number" min={0} value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)} placeholder="e.g. 25000" />
          </Field>
          <Field label="SLA (days)">
            <Input type="number" min={1} value={slaDays} onChange={(e) => setSlaDays(e.target.value)} placeholder="e.g. 10" />
          </Field>
          <Field label="Discount on this quote (%)" hint="Optional — you bear it; platform fee recomputed on the discounted price">
            <Input type="number" min={0} max={100} value={quoteDiscount} onChange={(e) => setQuoteDiscount(e.target.value)} placeholder="e.g. 10" />
          </Field>
          {Number(quoteDiscount) > 0 && Number(quotedPrice) > 0 && (
            <p className="text-xs text-ink-soft">Buyer will see <span className="font-medium text-ink">{money(Math.round(Number(quotedPrice) * (1 - Number(quoteDiscount) / 100)))}</span> <span className="text-ink-faint line-through">{money(Number(quotedPrice))}</span> (before platform fee &amp; tax).</p>
          )}
        </div>
      </Modal>

      {/* Report modal */}
      <Modal
        open={modal === "report"} onClose={() => setModal(null)} title="Upload report"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={report.isPending} disabled={!reportUrl.trim()} onClick={() => report.mutate()}>Save report</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Browse & upload from computer */}
          <div>
            <input ref={reportFileRef} type="file" className="hidden"
              onChange={(e) => { handleReportFile(e.target.files); e.target.value = ""; }} />
            <Button variant="secondary" loading={reportUploading} onClick={() => reportFileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Browse & upload file…
            </Button>
            <p className="mt-1.5 text-xs text-ink-faint">Pick a PDF / data file from your computer — or paste an external link below.</p>
          </div>

          <Field label="Report URL" hint="Auto-filled after upload, or paste a link to the deliverable.">
            <Input value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} placeholder="https://…" />
          </Field>

          <p className="rounded-lg bg-surface-subtle px-3 py-2 text-xs text-ink-muted">
            This sets the <span className="font-medium text-ink">primary report</span> (one file). To attach several files — raw data, NABL certificate, photos — use <span className="font-medium text-ink">Documents &amp; messages</span> below, which supports multiple uploads.
          </p>
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal
        open={modal === "cancel"} onClose={() => setModal(null)} title="Cancel order"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Keep order</Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel order</Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Cancel <span className="font-semibold">{order.code}</span>? The buyer will be notified.
        </p>
      </Modal>
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

function DeliverablesChecklist({ lineId, deliverables, documents, onChanged }: {
  lineId: string; deliverables: string[]; documents: OrderDocument[]; onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  if (!deliverables || deliverables.length === 0) return null;
  const docFor = (d: string) => documents.find((x) => x.deliverable === d);
  const done = deliverables.filter((d) => docFor(d)).length;

  async function upload(deliverable: string, files: FileList | null) {
    if (!files || !files[0]) return;
    setBusy(deliverable);
    try { await uploadOrderDocument(lineId, files[0], "DELIVERABLE", deliverable); toast.push("success", "Deliverable uploaded."); onChanged(); }
    catch (e: any) { toast.push("error", e?.response?.data?.message || "Upload failed."); }
    finally { setBusy(null); }
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Deliverables checklist</h2>
          <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", done === deliverables.length ? "bg-success-soft text-success" : "bg-surface-muted text-ink-soft")}>{done}/{deliverables.length} uploaded</span>
        </div>
        <ul className="space-y-2">
          {deliverables.map((d) => {
            const doc = docFor(d);
            return (
              <li key={d} className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  {doc ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-ink-faint" />}
                  <span className={clsx("truncate", doc ? "text-ink" : "text-ink-soft")}>{d}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {doc && <a href={doc.url} target="_blank" rel="noreferrer" className="max-w-[120px] truncate text-xs font-medium text-brand-700 hover:underline">{doc.name}</a>}
                  <input ref={(el) => { inputs.current[d] = el; }} type="file" className="hidden" onChange={(e) => upload(d, e.target.files)} />
                  <Button variant="secondary" className="btn-sm" loading={busy === d} onClick={() => inputs.current[d]?.click()}>
                    <Upload className="h-3.5 w-3.5" /> {doc ? "Replace" : "Upload"}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
        {done < deliverables.length && <p className="mt-3 text-xs text-warning">Upload every deliverable before marking the order delivered.</p>}
      </CardBody>
    </Card>
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
