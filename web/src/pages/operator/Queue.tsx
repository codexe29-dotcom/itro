import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Upload, ListChecks, CalendarClock } from "lucide-react";
import { fetchOperatorQueue } from "@/lib/queries";
import { post } from "@/lib/api";
import type { ServiceOrder } from "@/lib/types";
import { orderLabel, dateTime, fromNow } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  PageHeader, Card, CardBody, Table, StatusBadge, Button, Modal, Field, Input,
  LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";

export default function OperatorQueue() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [reportFor, setReportFor] = useState<ServiceOrder | null>(null);
  const [reportUrl, setReportUrl] = useState("");

  const isAdminContext = user?.role === "INSTITUTION_ADMIN" || user?.role === "LAB_MANAGER" || user?.role === "SUPER_ADMIN";
  const orderLinkBase = isAdminContext ? "/admin/orders" : "/operator";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["operator-queue"],
    queryFn: fetchOperatorQueue,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["operator-queue"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const sampleReceived = useMutation({
    mutationFn: (oid: string) => post(`/orders/${oid}/sample-received`),
    onSuccess: () => { toast.push("success", "Sample received."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not update."),
  });
  const uploadReport = useMutation({
    mutationFn: () => post(`/orders/${reportFor!.id}/report`, { reportUrl }),
    onSuccess: () => { toast.push("success", "Report uploaded."); setReportFor(null); setReportUrl(""); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not upload report."),
  });

  const orders = data?.orders ?? [];
  const bookings = data?.bookings ?? [];
  const awaited = orders.filter((o) => o.status === "SAMPLE_AWAITED");
  const inProgress = orders.filter((o) => o.status === "IN_PROGRESS");

  return (
    <div>
      <PageHeader title="Work Queue" subtitle="Samples to process and today's bookings." />

      {isLoading ? (
        <LoadingBlock />
      ) : isError ? (
        <ErrorState error={error} />
      ) : (
        <div className="space-y-6">
          {/* Samples awaited */}
          <Card>
            <div className="flex items-center gap-2 border-b border-surface-border px-5 py-4">
              <PackageCheck className="h-[18px] w-[18px] text-warning" />
              <h2 className="font-semibold text-ink">Samples awaited</h2>
              <span className="badge-warning ml-1">{awaited.length}</span>
            </div>
            {awaited.length === 0 ? (
              <CardBody><EmptyState icon={<ListChecks className="h-6 w-6" />} title="Nothing awaiting samples" /></CardBody>
            ) : (
              <QueueTable orders={awaited} base={orderLinkBase}
                action={(o) => (
                  <Button className="btn-sm" loading={sampleReceived.isPending} onClick={() => sampleReceived.mutate(o.id)}>
                    <PackageCheck className="h-4 w-4" /> Mark received
                  </Button>
                )} />
            )}
          </Card>

          {/* In progress */}
          <Card>
            <div className="flex items-center gap-2 border-b border-surface-border px-5 py-4">
              <ListChecks className="h-[18px] w-[18px] text-info" />
              <h2 className="font-semibold text-ink">In progress</h2>
              <span className="badge-info ml-1">{inProgress.length}</span>
            </div>
            {inProgress.length === 0 ? (
              <CardBody><EmptyState icon={<ListChecks className="h-6 w-6" />} title="No work in progress" /></CardBody>
            ) : (
              <QueueTable orders={inProgress} base={orderLinkBase} showDue
                action={(o) => (
                  <Button variant="secondary" className="btn-sm" onClick={() => { setReportFor(o); setReportUrl(""); }}>
                    <Upload className="h-4 w-4" /> Upload report
                  </Button>
                )} />
            )}
          </Card>

          {/* Bookings */}
          <Card>
            <div className="flex items-center gap-2 border-b border-surface-border px-5 py-4">
              <CalendarClock className="h-[18px] w-[18px] text-brand-600" />
              <h2 className="font-semibold text-ink">Today's bookings</h2>
              <span className="badge-brand ml-1">{bookings.length}</span>
            </div>
            {bookings.length === 0 ? (
              <CardBody><EmptyState icon={<CalendarClock className="h-6 w-6" />} title="No bookings today" /></CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className="th">Instrument</th>
                    <th className="th">User</th>
                    <th className="th">Start</th>
                    <th className="th">End</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-subtle">
                      <td className="td font-medium text-ink">{b.instrument?.name ?? "-"}</td>
                      <td className="td">{b.user?.name ?? "-"}</td>
                      <td className="td">{dateTime(b.startAt)}</td>
                      <td className="td">{dateTime(b.endAt)}</td>
                      <td className="td"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={!!reportFor} onClose={() => setReportFor(null)} title="Upload report"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportFor(null)}>Cancel</Button>
            <Button loading={uploadReport.isPending} disabled={!reportUrl.trim()} onClick={() => uploadReport.mutate()}>
              Save report
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-muted">
          Order <span className="font-semibold text-ink">{reportFor?.code}</span> - {reportFor?.service?.name}
        </p>
        <Field label="Report URL" hint="Link to the deliverable">
          <Input value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} placeholder="https://…" />
        </Field>
      </Modal>
    </div>
  );
}

function QueueTable({
  orders, base, action, showDue,
}: {
  orders: ServiceOrder[];
  base: string;
  action: (o: ServiceOrder) => React.ReactNode;
  showDue?: boolean;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <th className="th">Order</th>
          <th className="th">Service</th>
          <th className="th">Buyer</th>
          <th className="th">Status</th>
          {showDue && <th className="th">Due</th>}
          <th className="th"></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-surface-subtle">
            <td className="td font-medium text-ink">
              {base === "/admin/orders"
                ? <Link to={`${base}/${o.id}`} className="hover:underline">{o.code}</Link>
                : o.code}
            </td>
            <td className="td">{o.service?.name ?? "-"}</td>
            <td className="td">{o.buyer?.orgName || o.buyer?.name || "-"}</td>
            <td className="td"><StatusBadge status={o.status} label={orderLabel(o.status)} /></td>
            {showDue && <td className="td">{o.dueAt ? fromNow(o.dueAt) : "-"}</td>}
            <td className="td text-right">{action(o)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
