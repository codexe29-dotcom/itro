import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, CalendarCheck } from "lucide-react";
import { fetchBookings, asList } from "@/lib/queries";
import { post } from "@/lib/api";
import type { Booking } from "@/lib/types";
import { dateTime } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Table, StatusBadge, Select, Button,
  LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"];

export default function AdminBookings() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["bookings", status],
    queryFn: () => fetchBookings(status ? { status } : undefined),
  });
  const bookings = asList<Booking>(data as any);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bookings"] });

  const approve = useMutation({
    mutationFn: (bid: string) => post(`/bookings/${bid}/approve`),
    onSuccess: () => { toast.push("success", "Booking approved."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not approve."),
  });
  const reject = useMutation({
    mutationFn: (bid: string) => post(`/bookings/${bid}/reject`),
    onSuccess: () => { toast.push("success", "Booking rejected."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not reject."),
  });

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Instrument booking requests and schedule." />

      <Card>
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
          <div className="w-48">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <p className="text-sm text-ink-muted">{bookings.length} bookings</p>
        </div>

        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : bookings.length === 0 ? (
          <CardBody>
            <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="No bookings" description="Instrument bookings will appear here." />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Instrument</th>
                <th className="th">Requested by</th>
                <th className="th">Start</th>
                <th className="th">End</th>
                <th className="th">Purpose</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium text-ink">{b.instrument?.name ?? "-"}</td>
                  <td className="td">{b.user?.name ?? "-"}</td>
                  <td className="td">{dateTime(b.startAt)}</td>
                  <td className="td">{dateTime(b.endAt)}</td>
                  <td className="td max-w-[200px] truncate">{b.purpose || "-"}</td>
                  <td className="td"><StatusBadge status={b.status} /></td>
                  <td className="td">
                    {b.status === "PENDING" ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="btn-sm text-success" loading={approve.isPending} onClick={() => approve.mutate(b.id)}>
                          <Check className="h-4 w-4" /> Approve
                        </Button>
                        <Button variant="ghost" className="btn-sm text-danger" loading={reject.isPending} onClick={() => reject.mutate(b.id)}>
                          <X className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="block text-right text-xs text-ink-faint">-</span>
                    )}
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
