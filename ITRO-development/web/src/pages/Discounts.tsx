import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Plus, Trash2, Pencil, Wallet, Gift, Percent, IndianRupee } from "lucide-react";
import {
  fetchCoupons, createCoupon, updateCoupon, deleteCoupon,
  issueCredit, fetchIssuedCredits, type Coupon, type CouponInput,
} from "@/lib/discounts";
import { money, dateShort } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Button, Field, Input, Select, Badge, Modal,
  LoadingBlock, EmptyState, useToast,
} from "@/components/ui";

function blankCoupon(): CouponInput {
  return { code: "", name: "", kind: "PERCENT", value: 10, appliesTo: "ALL", minOrder: 0, perBuyerLimit: 1, isActive: true };
}

function CouponEditor({ initial, onClose }: { initial: Coupon | "new"; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = initial === "new";
  const c = isNew ? null : initial;
  const [f, setF] = useState<CouponInput & { categoriesStr: string }>({
    code: c?.code ?? "", name: c?.name ?? "", kind: c?.kind ?? "PERCENT", value: c?.value ?? 10,
    appliesTo: c?.appliesTo ?? "ALL", categoriesStr: (c?.categories ?? []).join(", "),
    minOrder: c?.minOrder ?? 0, maxDiscount: c?.maxDiscount ?? null,
    usageLimit: c?.usageLimit ?? null, perBuyerLimit: c?.perBuyerLimit ?? 1, isActive: c?.isActive ?? true,
  });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  const save = useMutation({
    mutationFn: () => {
      const body: CouponInput = {
        code: f.code, name: f.name, kind: f.kind, value: Number(f.value) || 0,
        appliesTo: f.appliesTo, categories: f.appliesTo === "CATEGORY" ? f.categoriesStr.split(",").map((s) => s.trim()).filter(Boolean) : [],
        minOrder: Number(f.minOrder) || 0, maxDiscount: f.kind === "PERCENT" && f.maxDiscount ? Number(f.maxDiscount) : null,
        usageLimit: f.usageLimit ? Number(f.usageLimit) : null, perBuyerLimit: Number(f.perBuyerLimit) || 0, isActive: f.isActive,
      };
      return isNew ? createCoupon(body) : updateCoupon(c!.id, body);
    },
    onSuccess: () => { toast.push("success", isNew ? "Coupon created." : "Coupon saved."); qc.invalidateQueries({ queryKey: ["coupons"] }); onClose(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save."),
  });

  return (
    <Modal open onClose={onClose} title={isNew ? "New discount code" : `Edit — ${c?.code}`}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!f.code || !f.name} onClick={() => save.mutate()}>{isNew ? "Create" : "Save"}</Button></div>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" hint="What buyers type at checkout"><Input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="WELCOME10" /></Field>
        <Field label="Name"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Welcome offer" /></Field>
        <Field label="Type"><Select value={f.kind} onChange={(e) => set({ kind: e.target.value as any })}><option value="PERCENT">Percent off</option><option value="FIXED">Fixed amount off</option></Select></Field>
        <Field label={f.kind === "PERCENT" ? "Percent (%)" : "Amount (₹)"}><Input type="number" min={0} value={f.value} onChange={(e) => set({ value: Number(e.target.value) })} /></Field>
        <Field label="Applies to"><Select value={f.appliesTo} onChange={(e) => set({ appliesTo: e.target.value as any })}><option value="ALL">All tests</option><option value="CATEGORY">Specific categories</option></Select></Field>
        {f.appliesTo === "CATEGORY" && <Field label="Categories (comma-separated)"><Input value={f.categoriesStr} onChange={(e) => set({ categoriesStr: e.target.value })} placeholder="EMI/EMC, Environmental" /></Field>}
        <Field label="Min order (₹)"><Input type="number" min={0} value={f.minOrder} onChange={(e) => set({ minOrder: Number(e.target.value) })} /></Field>
        {f.kind === "PERCENT" && <Field label="Max discount cap (₹)" hint="Optional"><Input type="number" min={0} value={f.maxDiscount ?? ""} onChange={(e) => set({ maxDiscount: e.target.value ? Number(e.target.value) : null })} /></Field>}
        <Field label="Total uses" hint="Blank = unlimited"><Input type="number" min={1} value={f.usageLimit ?? ""} onChange={(e) => set({ usageLimit: e.target.value ? Number(e.target.value) : null })} /></Field>
        <Field label="Per-buyer uses" hint="0 = unlimited"><Input type="number" min={0} value={f.perBuyerLimit} onChange={(e) => set({ perBuyerLimit: Number(e.target.value) })} /></Field>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Active</label>
    </Modal>
  );
}

export default function Discounts() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: coupons, isLoading } = useQuery({ queryKey: ["coupons"], queryFn: fetchCoupons });
  const { data: issued } = useQuery({ queryKey: ["credits-issued"], queryFn: fetchIssuedCredits });
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => { toast.push("success", "Coupon deleted."); qc.invalidateQueries({ queryKey: ["coupons"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete."),
  });
  const toggle = useMutation({
    mutationFn: (c: Coupon) => updateCoupon(c.id, { isActive: !c.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const [email, setEmail] = useState(""); const [amount, setAmount] = useState(""); const [reason, setReason] = useState("");
  const issue = useMutation({
    mutationFn: () => issueCredit({ buyerEmail: email.trim(), amount: Number(amount), reason: reason.trim() || undefined }),
    onSuccess: (r) => { toast.push("success", `Credit issued. Buyer balance: ${money(r.buyerBalance)}`); setEmail(""); setAmount(""); setReason(""); qc.invalidateQueries({ queryKey: ["credits-issued"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not issue credit."),
  });

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-8"><LoadingBlock /></div>;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Discounts & Credits" subtitle="Create discount codes buyers apply at checkout, and grant wallet credits to buyers."
        actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New code</Button>} />

      {/* Coupons */}
      <Card>
        <CardBody>
          <h2 className="section-title mb-3 flex items-center gap-2"><Ticket className="h-4 w-4 text-brand-600" /> Discount codes ({coupons?.length ?? 0})</h2>
          {(coupons ?? []).length === 0 ? (
            <EmptyState title="No discount codes yet" description="Create a code buyers can apply at checkout." action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New code</Button>} />
          ) : (
            <div className="table-wrap"><table className="w-full text-sm">
              <thead><tr><th className="th">Code</th><th className="th">Discount</th><th className="th">Applies</th><th className="th">Used</th><th className="th">Status</th><th className="th"></th></tr></thead>
              <tbody>
                {coupons!.map((c) => (
                  <tr key={c.id}>
                    <td className="td"><span className="font-mono font-semibold text-ink">{c.code}</span><span className="block text-xs text-ink-faint">{c.name}{c.institution ? ` · ${c.institution.name}` : c.funder === "PLATFORM" ? " · Platform" : ""}</span></td>
                    <td className="td whitespace-nowrap">{c.kind === "PERCENT" ? <span className="inline-flex items-center gap-0.5"><Percent className="h-3.5 w-3.5" />{c.value}</span> : money(c.value)}{c.maxDiscount ? <span className="text-xs text-ink-faint"> (max {money(c.maxDiscount)})</span> : ""}</td>
                    <td className="td text-xs">{c.appliesTo === "ALL" ? "All tests" : c.categories.join(", ")}{c.minOrder > 0 ? ` · min ${money(c.minOrder)}` : ""}</td>
                    <td className="td whitespace-nowrap">{c._count?.redemptions ?? c.timesUsed}{c.usageLimit ? `/${c.usageLimit}` : ""}</td>
                    <td className="td"><button onClick={() => toggle.mutate(c)}><Badge tone={c.isActive ? "success" : "gray"}>{c.isActive ? "Active" : "Off"}</Badge></button></td>
                    <td className="td"><div className="flex gap-1">
                      <button onClick={() => setEditing(c)} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`Delete code "${c.code}"?`)) del.mutate(c.id); }} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </CardBody>
      </Card>

      {/* Credits */}
      <Card className="mt-6">
        <CardBody>
          <h2 className="section-title mb-1 flex items-center gap-2"><Gift className="h-4 w-4 text-brand-600" /> Issue wallet credit to a buyer</h2>
          <p className="mb-3 text-sm text-ink-muted">Credits are applied automatically at the buyer's next checkout.</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end">
            <Field label="Buyer email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@company.com" /></Field>
            <Field label="Amount (₹)"><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Reason" hint="Optional"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Goodwill / delay compensation" /></Field>
            <Button loading={issue.isPending} disabled={!email || !amount} onClick={() => issue.mutate()}><Wallet className="h-4 w-4" /> Issue</Button>
          </div>

          {(issued ?? []).length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">Recently issued</p>
              <div className="table-wrap"><table className="w-full text-sm">
                <thead><tr><th className="th">Buyer</th><th className="th">Amount</th><th className="th">Reason</th><th className="th">Date</th></tr></thead>
                <tbody>
                  {issued!.slice(0, 15).map((e) => (
                    <tr key={e.id}>
                      <td className="td">{e.buyer?.orgName || e.buyer?.name || e.buyer?.email}</td>
                      <td className="td whitespace-nowrap font-medium text-success">+{money(e.amount)}</td>
                      <td className="td text-xs text-ink-muted">{e.reason ?? "—"}</td>
                      <td className="td whitespace-nowrap text-ink-muted">{dateShort(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </CardBody>
      </Card>

      {editing && <CouponEditor initial={editing} onClose={() => setEditing(null)} />}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint"><IndianRupee className="h-3.5 w-3.5" /> Provider-funded discounts recompute the platform fee on the discounted price.</p>
    </div>
  );
}
