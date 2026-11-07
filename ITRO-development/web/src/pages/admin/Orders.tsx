import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders, asList } from "@/lib/queries";
import type { ServiceOrder } from "@/lib/types";
import { orderLabel, money, dateShort, fromNow } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  PageHeader, Card, CardBody, Table, StatusBadge, Select,
  LoadingBlock, EmptyState, ErrorState, Button,
} from "@/components/ui";

const STATUSES = [
  "QUOTE_REQUESTED", "QUOTED", "ACCEPTED", "NDA_PENDING", "SAMPLE_AWAITED",
  "IN_PROGRESS", "REPORT_READY", "COMPLETED", "CANCELLED",
];

export default function AdminOrders() {
  const { user } = useAuth();
  const currency = user?.institution?.currency;
  const [status, setStatus] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["orders", "admin"],
    queryFn: () => fetchOrders(),
  });
  const all = asList<ServiceOrder>(data as any);
  const orders = status ? all.filter((o) => o.status === status) : all;

  return (
    <div>
      <PageHeader title="Service Orders" subtitle="Incoming requests and active engagements." />

      <Card>
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
          <div className="w-52">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{orderLabel(s)}</option>)}
            </Select>
          </div>
          <p className="text-sm text-ink-muted">{orders.length} orders</p>
        </div>

        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : orders.length === 0 ? (
          <CardBody><EmptyState title="No orders" description="Quote requests from buyers will appear here." /></CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Order</th>
                <th className="th">Service</th>
                <th className="th">Buyer</th>
                <th className="th">Status</th>
                <th className="th text-right">Quoted</th>
                <th className="th">Due</th>
                <th className="th">Created</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium text-ink">{o.code}</td>
                  <td className="td">{o.service?.name ?? "-"}</td>
                  <td className="td">{o.buyer?.orgName || o.buyer?.name || "-"}</td>
                  <td className="td"><StatusBadge status={o.status} label={orderLabel(o.status)} /></td>
                  <td className="td text-right">{money(o.quotedPrice, currency)}</td>
                  <td className="td">{o.dueAt ? fromNow(o.dueAt) : "-"}</td>
                  <td className="td">{dateShort(o.createdAt)}</td>
                  <td className="td text-right">
                    <Link to={`/admin/orders/${o.id}`}>
                      <Button variant="ghost" className="btn-sm">Manage</Button>
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
