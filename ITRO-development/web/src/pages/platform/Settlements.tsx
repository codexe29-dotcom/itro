import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Landmark, Search, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { fetchSettlements } from "@/lib/queries";
import { post } from "@/lib/api";
import type { Settlement, ServiceOrder, Institution } from "@/lib/types";
import { useConfig } from "@/lib/useConfig";
import { money, dateShort } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Table, StatusBadge, Button, Modal, Input, Select,
  LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";

type SettlementRow = Settlement & { order?: ServiceOrder & { institution?: Institution } };
type SortKey = "order" | "institution" | "grossAmount" | "platformFee" | "netToProvider" | "status";

const instName = (s: SettlementRow) => s.order?.institution?.name ?? "";

export default function PlatformSettlements() {
  const qc = useQueryClient();
  const toast = useToast();
  const { config } = useConfig();
  const currency = config.defaultCurrency;
  const [confirm, setConfirm] = useState<SettlementRow | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["settlements"],
    queryFn: () => fetchSettlements() as Promise<SettlementRow[]>,
  });
  const settlements = data ?? [];

  const release = useMutation({
    mutationFn: (sid: string) => post(`/settlements/${sid}/release`),
    onSuccess: () => {
      toast.push("success", "Settlement released.");
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["settlements"] });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not release."),
  });

  const pendingFees = settlements.filter((s) => s.status !== "RELEASED").reduce((sum, s) => sum + (s.platformFee || 0), 0);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = settlements.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!term) return true;
      return (s.order?.code ?? "").toLowerCase().includes(term) || instName(s).toLowerCase().includes(term);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case "order": av = a.order?.code ?? ""; bv = b.order?.code ?? ""; break;
        case "institution": av = instName(a); bv = instName(b); break;
        case "status": av = a.status; bv = b.status; break;
        default: av = (a[sortKey] as number) ?? 0; bv = (b[sortKey] as number) ?? 0;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return out;
  }, [settlements, q, statusFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  const SortHead = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`th cursor-pointer select-none ${right ? "text-right" : ""}`} onClick={() => toggleSort(k)}>
      <span className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""}`}>
        {label}
        {sortKey === k ? (sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ChevronsUpDown className="h-3.5 w-3.5 text-ink-faint" />}
      </span>
    </th>
  );

  return (
    <div>
      <PageHeader title="Settlements" subtitle="Provider payouts and platform fees." />

      {!isLoading && !isError && settlements.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Settlements" value={String(settlements.length)} />
          <SummaryCard label="Released" value={String(settlements.filter((s) => s.status === "RELEASED").length)} />
          <SummaryCard label="Pending fees" value={money(pendingFees, currency)} />
        </div>
      )}

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : settlements.length === 0 ? (
          <CardBody>
            <EmptyState icon={<Landmark className="h-6 w-6" />} title="No settlements yet" description="Settlements are created when orders are accepted." />
          </CardBody>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-surface-border p-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input placeholder="Search by order or provider…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="RELEASED">Released</option>
                <option value="ON_HOLD">On hold</option>
              </Select>
              <span className="text-sm text-ink-muted">{rows.length} of {settlements.length}</span>
            </div>
            {rows.length === 0 ? (
              <CardBody><EmptyState title="No matches" description="Try a different search or filter." /></CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <SortHead k="order" label="Order" />
                    <SortHead k="institution" label="Provider" />
                    <SortHead k="grossAmount" label="Gross" right />
                    <SortHead k="platformFee" label="Fee" right />
                    <SortHead k="netToProvider" label="Net to provider" right />
                    <SortHead k="status" label="Status" />
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-subtle">
                      <td className="td font-medium">
                        {s.order?.id
                          ? <Link to={`/platform/orders/${s.order.id}`} className="text-brand-700 hover:underline">{s.order.code}</Link>
                          : <span className="text-ink">{s.order?.code ?? "-"}</span>}
                      </td>
                      <td className="td">
                        {s.order?.institution
                          ? <Link to={`/platform/providers/${s.order.institution.id}`} className="text-ink hover:text-brand-700 hover:underline">{s.order.institution.name}</Link>
                          : "-"}
                      </td>
                      <td className="td text-right">{money(s.grossAmount, currency)}</td>
                      <td className="td text-right">{money(s.platformFee, currency)}</td>
                      <td className="td text-right font-medium text-ink">{money(s.netToProvider, currency)}</td>
                      <td className="td">
                        <StatusBadge status={s.status} />
                        {s.releasedAt && <span className="ml-2 text-xs text-ink-faint">{dateShort(s.releasedAt)}</span>}
                      </td>
                      <td className="td text-right">
                        {s.status !== "RELEASED" && <Button className="btn-sm" onClick={() => setConfirm(s)}>Release</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        )}
      </Card>

      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} title="Release settlement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button loading={release.isPending} onClick={() => confirm && release.mutate(confirm.id)}>
              Release {money(confirm?.netToProvider, currency)}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Release <span className="font-semibold">{money(confirm?.netToProvider, currency)}</span> to{" "}
          <span className="font-semibold">{confirm?.order?.institution?.name ?? "the provider"}</span> for order {confirm?.order?.code}?
        </p>
      </Modal>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="p-5">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="stat-value mt-1">{value}</p>
      </div>
    </Card>
  );
}
