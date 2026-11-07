import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Trash2, Minus, Plus, Building2, Store, FlaskConical, AlertTriangle, RotateCcw, FileCheck, Ticket, Wallet, ClipboardList, Paperclip, Loader2, CheckCircle2 } from "lucide-react";
import { fetchCart, updateCartItem, removeCartItem, checkoutCart, fetchCartRequirements, type SampleDeclaration, type IntakeForm } from "@/lib/queries";
import { previewCartDiscount, fetchMyWallet } from "@/lib/discounts";
import { uploadFile } from "@/lib/api";
import type { Order, ServiceOrder } from "@/lib/types";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  PageHeader, Card, CardBody, Button, Input, Textarea, Select, LoadingBlock, ErrorState, EmptyState, useToast,
} from "@/components/ui";

export default function BuyerCart() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: cart, isLoading, isError, error } = useQuery({
    queryKey: ["cart"],
    queryFn: fetchCart,
    enabled: !!user,
  });

  const { data: reqs } = useQuery({ queryKey: ["cart-requirements"], queryFn: fetchCartRequirements });

  const [samples, setSamples] = useState<SampleDeclaration[]>([]);
  const [shippingNote, setShippingNote] = useState("");
  // Buyer answers to each provider's intake questions: { [lineId]: { [fieldName]: value } }
  const [intake, setIntake] = useState<Record<string, Record<string, string>>>({});
  const setIntakeAnswer = (lineId: string, name: string, value: string) =>
    setIntake((m) => ({ ...m, [lineId]: { ...(m[lineId] ?? {}), [name]: value } }));
  // Discounts: code + wallet credits.
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [useCredits, setUseCredits] = useState(false);
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: fetchMyWallet });
  const { data: preview } = useQuery({
    queryKey: ["cart-discount", appliedCode, useCredits],
    queryFn: () => previewCartDiscount({ couponCode: appliedCode || undefined, useCredits }),
    enabled: !!appliedCode || useCredits,
  });
  const seeded = useRef(false);
  // Seed one declaration row per required sample (capped) once requirements load.
  useEffect(() => {
    if (reqs && !seeded.current && reqs.totalSamples > 0) {
      seeded.current = true;
      setSamples(Array.from({ length: Math.min(reqs.totalSamples, 12) }, (_, i) => ({ label: `Sample ${i + 1}`, quantity: 1 })));
    }
  }, [reqs]);
  const setSample = (i: number, patch: Partial<SampleDeclaration>) =>
    setSamples((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addSample = () => setSamples((s) => [...s, { label: `Sample ${s.length + 1}`, quantity: 1 }]);
  const removeSample = (i: number) => setSamples((s) => s.filter((_, idx) => idx !== i));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cart"] });
    qc.invalidateQueries({ queryKey: ["cart-requirements"] });
  };

  const setQty = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) => updateCartItem(lineId, quantity),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not update quantity."),
  });

  const remove = useMutation({
    mutationFn: (lineId: string) => removeCartItem(lineId),
    onSuccess: () => { toast.push("success", "Item removed."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not remove item."),
  });

  const checkout = useMutation({
    mutationFn: () => checkoutCart({
      samples: samples.filter((s) => s.label.trim()),
      shippingNote: shippingNote.trim() || undefined,
      couponCode: appliedCode || undefined,
      useCredits,
      intakeAnswers: intake,
    }),
    onSuccess: (order: Order) => {
      toast.push("success", "Order placed.");
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      navigate(`/app/orders/${order.id}`);
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not check out."),
  });

  function onCheckout() {
    for (const it of reqs?.items ?? []) {
      for (const fm of it.intakeForms ?? []) {
        if (fm.required && !(intake[it.lineId]?.[fm.name] ?? "").trim()) {
          toast.push("error", `Please provide "${fm.name}" for ${it.service}.`);
          return;
        }
      }
    }
    checkout.mutate();
  }

  // Cart lives in the public shell — prompt sign-in for anonymous visitors.
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardBody>
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title="Your cart"
              description="Sign in to view your cart and check out."
              action={<Link to="/login" state={{ from: "/cart" }} className="btn-primary btn-sm">Sign in</Link>}
            />
          </CardBody>
        </Card>
      </div>
    );
  }
  if (isLoading) return <LoadingBlock />;
  if (isError) return <ErrorState error={error} />;

  const lines = cart?.lines ?? [];
  const currency = cart?.currency || "INR";

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Cart" subtitle="Build one order across multiple providers." />
        <Card>
          <CardBody>
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title="Your cart is empty"
              description="Browse the catalog and add services to your order."
              action={<Link to="/exchange" className="btn-primary btn-sm"><Store className="h-4 w-4" /> Browse catalog</Link>}
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  // Group lines by provider institution.
  const groups = new Map<string, { name: string; lines: ServiceOrder[] }>();
  for (const l of lines) {
    const key = l.institutionId;
    const name = l.institution?.name ?? "Provider";
    if (!groups.has(key)) groups.set(key, { name, lines: [] });
    groups.get(key)!.lines.push(l);
  }

  // Compute live totals from lines (fee-inclusive buyerAmount for FIXED; quotes excluded).
  const subtotal = lines.reduce((s, l) => s + (l.buyerAmount ?? 0), 0);
  const platformFee = lines.reduce((s, l) => s + (l.platformFeeAmount ?? 0), 0);
  const quoteCount = lines.filter((l) => (l.service?.pricingMode ?? "QUOTE") === "QUOTE" || l.buyerAmount == null).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Cart"
        subtitle="Build one order across multiple providers."
        actions={<Link to="/exchange" className="btn-secondary"><Store className="h-4 w-4" /> Add more</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {[...groups.entries()].map(([id, group]) => (
            <Card key={id}>
              <div className="flex items-center gap-2 border-b border-surface-border px-5 py-3">
                <Building2 className="h-4 w-4 text-ink-faint" />
                <span className="font-semibold text-ink">{group.name}</span>
                <span className="text-xs text-ink-muted">· {group.lines.length} item{group.lines.length === 1 ? "" : "s"}</span>
              </div>
              <div className="divide-y divide-surface-border">
                {group.lines.map((l) => {
                  const isFixed = (l.service?.pricingMode ?? "QUOTE") === "FIXED" && l.buyerAmount != null;
                  return (
                    <div key={l.id} className="flex items-start justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{l.service?.name ?? "Service"}</p>
                        <p className="text-xs text-ink-muted">{l.service?.category}</p>
                        <div className="mt-2 inline-flex items-center gap-1 rounded-lg border border-surface-border">
                          <button
                            className="px-2 py-1 text-ink-muted hover:text-ink disabled:opacity-40"
                            disabled={l.quantity <= 1 || setQty.isPending}
                            onClick={() => setQty.mutate({ lineId: l.id, quantity: l.quantity - 1 })}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-8 px-1 text-center text-sm font-medium text-ink">{l.quantity}</span>
                          <button
                            className="px-2 py-1 text-ink-muted hover:text-ink disabled:opacity-40"
                            disabled={setQty.isPending}
                            onClick={() => setQty.mutate({ lineId: l.id, quantity: l.quantity + 1 })}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isFixed ? (
                          <div className="text-right">
                            {l.listPrice != null && l.listPrice > (l.buyerAmount ?? 0) && <span className="mr-1.5 text-xs text-ink-faint line-through">{money(l.listPrice, currency)}</span>}
                            <span className="font-semibold text-ink">{money(l.buyerAmount, currency)}</span>
                          </div>
                        ) : (
                          <span className="badge-info">Quote on request</span>
                        )}
                        <button
                          className="text-ink-faint hover:text-danger"
                          onClick={() => remove.mutate(l.id)}
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          {/* Samples & requirements — driven by each test's provider config */}
          <Card>
            <div className="flex items-center gap-2 border-b border-surface-border px-5 py-3">
              <FlaskConical className="h-4 w-4 text-brand-600" />
              <span className="font-semibold text-ink">Samples &amp; requirements</span>
            </div>
            <CardBody className="space-y-4">
              {reqs && reqs.items.length > 0 && (
                <div className="space-y-2">
                  {reqs.items.map((it) => (
                    <div key={it.lineId} className="rounded-lg border border-surface-border bg-surface-subtle p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">{it.service}</span>
                        <span className="text-xs text-ink-muted">{it.provider}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        Requires <span className="font-medium text-ink-soft">{it.samplesRequired}</span> sample{it.samplesRequired === 1 ? "" : "s"}
                        {it.sampleSpec ? ` — ${it.sampleSpec}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {it.destructive && <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-ink-soft"><AlertTriangle className="h-3 w-3" /> Destructive</span>}
                        {it.returned && <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-ink-soft"><RotateCcw className="h-3 w-3" /> Sample returned</span>}
                        {it.deliverables.map((d) => (
                          <span key={d} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700"><FileCheck className="h-3 w-3" /> {d}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="label mb-2">Declare the samples you'll provide {reqs && reqs.totalSamples > 0 && <span className="text-ink-faint">(≈{reqs.totalSamples} needed)</span>}</p>
                <div className="space-y-2">
                  {samples.map((s, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_84px_auto] sm:items-center">
                      <Input value={s.label} onChange={(e) => setSample(i, { label: e.target.value })} placeholder="Label e.g. Coupon A" />
                      <Input value={s.condition ?? ""} onChange={(e) => setSample(i, { condition: e.target.value })} placeholder="Condition / prep (optional)" />
                      <Input type="number" min={1} value={s.quantity ?? 1} onChange={(e) => setSample(i, { quantity: Number(e.target.value) || 1 })} />
                      <button className="justify-self-end p-2 text-ink-faint hover:text-danger" onClick={() => removeSample(i)} aria-label="Remove sample"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
                <Button variant="secondary" className="btn-sm mt-2" onClick={addSample}><Plus className="h-3.5 w-3.5" /> Add sample</Button>
              </div>

              <div>
                <p className="label mb-1.5">Shipping / handling instructions</p>
                <Textarea rows={2} value={shippingNote} onChange={(e) => setShippingNote(e.target.value)} placeholder="How you'll ship samples, courier, special handling, return address…" />
              </div>
            </CardBody>
          </Card>

          <IntakeSection reqs={reqs} intake={intake} setAnswer={setIntakeAnswer} />
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody>
              <h2 className="section-title mb-3">Order summary</h2>
              {(() => {
                const hasDisc = preview && !preview.error;
                const finalTotal = hasDisc ? preview!.newSubtotal : subtotal;
                return (
                  <div className="space-y-2 text-sm">
                    <Row label="Subtotal" value={money(subtotal, currency)} />
                    <Row label="Platform fee (incl.)" value={money(platformFee, currency)} />
                    {hasDisc && preview!.discountAmount > 0 && <Row label={`Discount${preview!.couponCode ? ` (${preview!.couponCode})` : ""}`} value={`− ${money(preview!.discountAmount, currency)}`} />}
                    {hasDisc && preview!.creditApplied > 0 && <Row label="Wallet credits" value={`− ${money(preview!.creditApplied, currency)}`} />}
                    <Row label="Tax" value="At checkout" muted />
                    <div className="border-t border-surface-border pt-2">
                      <Row label="Priced total" value={money(finalTotal, currency)} strong />
                    </div>
                    {quoteCount > 0 && (
                      <p className="text-xs text-ink-muted">
                        {quoteCount} quote {quoteCount === 1 ? "line" : "lines"} will be sent as RFQs (priced by the provider).
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Discount code */}
              <div className="mt-4 space-y-2">
                <p className="label flex items-center gap-1.5"><Ticket className="h-3.5 w-3.5" /> Discount code</p>
                {appliedCode ? (
                  <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
                    <span className="font-mono font-semibold text-brand-700">{appliedCode}</span>
                    <button className="text-xs text-ink-muted hover:text-danger" onClick={() => { setAppliedCode(""); setCode(""); }}>Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code" />
                    <Button variant="secondary" disabled={!code.trim()} onClick={() => setAppliedCode(code.trim())}>Apply</Button>
                  </div>
                )}
                {preview?.error && <p className="text-xs text-danger">{preview.error}</p>}
              </div>

              {/* Wallet credits */}
              {wallet && wallet.total > 0 && (
                <label className="mt-3 flex cursor-pointer items-center justify-between rounded-lg border border-surface-border px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-ink-soft"><Wallet className="h-4 w-4 text-brand-600" /> Use my credits ({money(wallet.total, currency)})</span>
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={useCredits} onChange={(e) => setUseCredits(e.target.checked)} />
                </label>
              )}

              <Button
                className="mt-4 w-full"
                loading={checkout.isPending}
                onClick={onCheckout}
              >
                Checkout
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={strong ? "font-semibold text-ink" : muted ? "text-ink-faint" : "text-ink-soft"}>{value}</span>
    </div>
  );
}

function IntakeSection({ reqs, intake, setAnswer }: {
  reqs?: import("@/lib/queries").CartRequirements;
  intake: Record<string, Record<string, string>>;
  setAnswer: (lineId: string, name: string, value: string) => void;
}) {
  const items = (reqs?.items ?? []).filter((it) => (it.intakeForms ?? []).length > 0);
  if (items.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-surface-border px-5 py-3">
        <ClipboardList className="h-4 w-4 text-brand-600" />
        <span className="font-semibold text-ink">Information the labs need</span>
      </div>
      <CardBody className="space-y-5">
        {items.map((it) => (
          <div key={it.lineId} className="space-y-3">
            <p className="text-sm font-semibold text-ink">{it.service} <span className="font-normal text-ink-muted">· {it.provider}</span></p>
            {it.intakeForms.map((fm) => (
              <IntakeField key={fm.name} form={fm} value={intake[it.lineId]?.[fm.name] ?? ""} onChange={(v) => setAnswer(it.lineId, fm.name, v)} />
            ))}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function IntakeField({ form, value, onChange }: { form: IntakeForm; value: string; onChange: (v: string) => void }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const type = form.type ?? "TEXT";

  async function onFile(files: FileList | null) {
    if (!files || !files[0]) return;
    setUploading(true);
    try { const { url } = await uploadFile(files[0]); onChange(url); toast.push("success", "File uploaded."); }
    catch (e: any) { toast.push("error", e?.response?.data?.message || "Upload failed."); }
    finally { setUploading(false); }
  }

  return (
    <div>
      <label className="label mb-1 block">{form.name}{form.required && <span className="ml-0.5 text-danger">*</span>}</label>
      {type === "TEXTAREA" ? (
        <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : type === "SELECT" ? (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {(form.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      ) : type === "CHECKBOX" ? (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={value === "Yes"} onChange={(e) => onChange(e.target.checked ? "Yes" : "")} />
          {form.description || "Yes"}
        </label>
      ) : type === "FILE" ? (
        <div className="flex items-center gap-2">
          <label className="btn-secondary btn-sm cursor-pointer">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} {value ? "Replace file" : "Upload file"}
            <input type="file" className="hidden" onChange={(e) => onFile(e.target.files)} />
          </label>
          {value && <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><CheckCircle2 className="h-3.5 w-3.5" /> Uploaded</a>}
        </div>
      ) : (
        <Input type={type === "NUMBER" ? "number" : type === "DATE" ? "date" : "text"} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {form.description && type !== "CHECKBOX" && <p className="mt-1 text-xs text-ink-faint">{form.description}</p>}
    </div>
  );
}
