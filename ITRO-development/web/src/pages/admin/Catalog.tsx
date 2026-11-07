import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, X, ArrowRight, CheckCircle2, Sparkles, FlaskConical } from "lucide-react";
import {
  fetchProviderCatalog, offerTest, unenrollService, createAndOfferTest,
  type ProviderCatalog, type ProvTest,
} from "@/lib/providerCatalog";
import { money } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Button, Field, Input, Select, Badge,
  Modal, LoadingBlock, ErrorState, EmptyState, useToast,
} from "@/components/ui";

type FlatTest = ProvTest & { industrySlug: string; industryTitle: string };

// ---- Offer an EXISTING catalog test ----
function OfferModal({ test, cat, onClose }: { test: FlatTest; cat: ProviderCatalog; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [o, setO] = useState({ name: test.name, price: "", pricingMode: "FIXED", turnaroundDays: "7", instrumentId: "" });

  const offer = useMutation({
    mutationFn: () => offerTest(test.id, {
      name: o.name.trim() || undefined, priceIndustry: Number(o.price) || 0,
      pricingMode: o.pricingMode as "FIXED" | "QUOTE", turnaroundDays: Number(o.turnaroundDays) || 7,
      instrumentId: o.instrumentId || null,
    }),
    onSuccess: (r: any) => {
      toast.push("success", "Added — your testing service is live.");
      qc.invalidateQueries({ queryKey: ["provider-catalog"] }); qc.invalidateQueries({ queryKey: ["services"] });
      onClose();
      if (r?.service?.id) nav(`/admin/services/${r.service.id}`);
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not add."),
  });

  return (
    <Modal open onClose={onClose} title={`Add "${test.name}"`}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={offer.isPending} disabled={o.pricingMode === "FIXED" && !o.price} onClick={() => offer.mutate()}>Add this test</Button></div>}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-ink-soft">
        <Badge tone="gray">{test.category}</Badge>{test.accreditation && <Badge tone="brand">{test.accreditation}</Badge>}
        <span className="text-ink-faint">{test.industryTitle} · sample rules &amp; deliverables prefill automatically</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your service name"><Input value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} /></Field>
        <Field label="Instrument" hint="Optional"><Select value={o.instrumentId} onChange={(e) => setO({ ...o, instrumentId: e.target.value })}><option value="">None</option>{cat.instruments.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}</Select></Field>
        <Field label="Pricing"><Select value={o.pricingMode} onChange={(e) => setO({ ...o, pricingMode: e.target.value })}><option value="FIXED">Fixed price</option><option value="QUOTE">Quote on request</option></Select></Field>
        <Field label="Turnaround (days)"><Input type="number" min={1} value={o.turnaroundDays} onChange={(e) => setO({ ...o, turnaroundDays: e.target.value })} /></Field>
        {o.pricingMode === "FIXED" && <Field label="Price (₹)"><Input type="number" min={0} value={o.price} onChange={(e) => setO({ ...o, price: e.target.value })} /></Field>}
      </div>
    </Modal>
  );
}

// ---- Create a BRAND-NEW test AND offer it (self-serve) ----
function NewTestModal({ presetName, cat, onClose }: { presetName: string; cat: ProviderCatalog; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const cats = useMemo(() => Array.from(new Set(cat.myServices.map((s) => s.category))).sort(), [cat.myServices]);
  const industries = cat.industries;
  const [f, setF] = useState({ name: presetName, industrySlug: industries[0]?.slug ?? "", category: "", standards: "", price: "", pricingMode: "FIXED", turnaroundDays: "7", instrumentId: "" });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  const create = useMutation({
    mutationFn: () => createAndOfferTest({
      name: f.name.trim(), industrySlug: f.industrySlug, category: f.category.trim(),
      standardCodes: f.standards.split(",").map((s) => s.trim()).filter(Boolean),
      priceIndustry: Number(f.price) || 0, pricingMode: f.pricingMode as "FIXED" | "QUOTE", turnaroundDays: Number(f.turnaroundDays) || 7,
      instrumentId: f.instrumentId || null,
    }),
    onSuccess: (r) => {
      toast.push("success", "New test created and live.");
      qc.invalidateQueries({ queryKey: ["provider-catalog"] }); qc.invalidateQueries({ queryKey: ["services"] });
      onClose();
      if (r?.service?.id) nav(`/admin/services/${r.service.id}`);
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not create."),
  });

  return (
    <Modal open onClose={onClose} wide title="Add a new test"
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.isPending} disabled={!f.name || !f.category || (f.pricingMode === "FIXED" && !f.price)} onClick={() => create.mutate()}>Create &amp; add</Button></div>}>
      <p className="text-sm text-ink-muted">This test isn't in the standard list yet — add it and it goes live immediately, offered by you. You can refine its details afterwards.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="Test name"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Salt Spray Corrosion (ASTM B117)" /></Field>
        <Field label="Industry"><Select value={f.industrySlug} onChange={(e) => set({ industrySlug: e.target.value })}>{industries.map((i) => <option key={i.slug} value={i.slug}>{i.title}</option>)}</Select></Field>
        <Field label="Category (equipment type)"><Input list="prov-cats" value={f.category} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Corrosion" /><datalist id="prov-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Standards (comma-separated)" hint="Optional"><Input value={f.standards} onChange={(e) => set({ standards: e.target.value })} placeholder="ASTM B117" /></Field>
        <Field label="Instrument" hint="Optional"><Select value={f.instrumentId} onChange={(e) => set({ instrumentId: e.target.value })}><option value="">None</option>{cat.instruments.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}</Select></Field>
        <Field label="Pricing"><Select value={f.pricingMode} onChange={(e) => set({ pricingMode: e.target.value })}><option value="FIXED">Fixed price</option><option value="QUOTE">Quote on request</option></Select></Field>
        <Field label="Turnaround (days)"><Input type="number" min={1} value={f.turnaroundDays} onChange={(e) => set({ turnaroundDays: e.target.value })} /></Field>
        {f.pricingMode === "FIXED" && <Field label="Price (₹)"><Input type="number" min={0} value={f.price} onChange={(e) => set({ price: e.target.value })} /></Field>}
      </div>
    </Modal>
  );
}

export default function AdminCatalog() {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const { data: cat, isLoading, isError, error } = useQuery({ queryKey: ["provider-catalog"], queryFn: fetchProviderCatalog });
  const [query, setQuery] = useState("");
  const [offering, setOffering] = useState<FlatTest | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  const allTests: FlatTest[] = useMemo(
    () => (cat?.industries ?? []).flatMap((ind) => ind.tests.map((t) => ({ ...t, industrySlug: ind.slug, industryTitle: ind.title }))),
    [cat],
  );
  const enrolledTestIds = useMemo(() => new Set((cat?.enrollments ?? []).map((e) => e.testId)), [cat]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return allTests.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.accreditation ?? "").toLowerCase().includes(q)).slice(0, 8);
  }, [query, allTests]);

  const remove = useMutation({
    mutationFn: ({ testId, serviceId }: { testId: string; serviceId: string }) => unenrollService(testId, serviceId),
    onSuccess: () => { toast.push("success", "Removed."); qc.invalidateQueries({ queryKey: ["provider-catalog"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not remove."),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError) return <ErrorState error={error} />;
  if (!cat) return null;

  // Tests I currently offer.
  const offered = cat.enrollments.map((e) => ({
    ...e,
    test: allTests.find((t) => t.id === e.testId),
    service: cat.myServices.find((s) => s.id === e.serviceId),
  })).filter((o) => o.test && o.service);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My tests" subtitle="Add the tests you perform — search the standard list, or add your own if it isn't there." />

      {/* Search-first add box */}
      <Card>
        <CardBody>
          <h2 className="section-title mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-600" /> Add a test you offer</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a test you perform… e.g. Vibration, Salt Spray, Tensile" className="pl-9" />
          </div>

          {query.trim().length >= 2 && (
            <div className="mt-2 overflow-hidden rounded-lg border border-surface-border">
              {results.map((t) => {
                const already = enrolledTestIds.has(t.id);
                return (
                  <button key={t.id} onClick={() => !already && setOffering(t)} disabled={already}
                    className="flex w-full items-center justify-between gap-3 border-b border-surface-border px-3 py-2.5 text-left last:border-0 hover:bg-surface-muted disabled:cursor-default disabled:hover:bg-transparent">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{t.name}</p>
                      <p className="text-xs text-ink-faint">{t.category}{t.accreditation ? ` · ${t.accreditation}` : ""} · {t.industryTitle}</p>
                    </div>
                    {already ? <Badge tone="success"><CheckCircle2 className="mr-1 inline h-3 w-3" />Offered</Badge> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">Add <ArrowRight className="h-3.5 w-3.5" /></span>}
                  </button>
                );
              })}
              {/* Add-new fallback */}
              <button onClick={() => setCreating(query.trim())} className="flex w-full items-center gap-2 bg-surface-subtle px-3 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50">
                <Plus className="h-4 w-4" /> Add “{query.trim()}” as a new test
              </button>
            </div>
          )}
          {query.trim().length > 0 && query.trim().length < 2 && <p className="mt-2 text-xs text-ink-faint">Keep typing…</p>}
        </CardBody>
      </Card>

      {/* Tests I offer */}
      <div className="mt-6">
        <h2 className="section-title mb-3 flex items-center gap-2"><FlaskConical className="h-4 w-4 text-brand-600" /> Tests you offer ({offered.length})</h2>
        {offered.length === 0 ? (
          <Card><CardBody><EmptyState title="No tests yet" description="Use the search box above to add the tests you perform." /></CardBody></Card>
        ) : (
          <Card><CardBody className="divide-y divide-surface-border">
            {offered.map((o) => (
              <div key={`${o.testId}-${o.serviceId}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <button onClick={() => nav(`/admin/services/${o.serviceId}`)} className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium text-ink hover:text-brand-700">{o.service!.name}</p>
                  <p className="text-xs text-ink-faint">{o.test!.category}{o.test!.accreditation ? ` · ${o.test!.accreditation}` : ""} · {money(o.service!.priceIndustry)}</p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" className="btn-sm" onClick={() => nav(`/admin/services/${o.serviceId}`)}>Edit</Button>
                  <button onClick={() => { if (confirm(`Remove "${o.service!.name}"?`)) remove.mutate({ testId: o.testId, serviceId: o.serviceId }); }} className="rounded p-1.5 text-ink-faint hover:text-danger"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </CardBody></Card>
        )}
      </div>

      {offering && <OfferModal test={offering} cat={cat} onClose={() => setOffering(null)} />}
      {creating !== null && <NewTestModal presetName={creating} cat={cat} onClose={() => setCreating(null)} />}
    </div>
  );
}
