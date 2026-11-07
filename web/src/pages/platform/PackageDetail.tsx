import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowLeft, Package, Building2, ExternalLink, Wallet, Clock, Layers, ListOrdered, Route,
  TrendingDown, ArrowUp, ArrowDown, CheckCircle2, ShieldCheck,
} from "lucide-react";
import {
  fetchAdminCatalog, fetchPackageFull, fetchPackageInsights, createPackage, updatePackage,
  type PackageInput,
} from "@/lib/adminCatalog";
import { imageForCategory } from "@/lib/imagery";
import { money, dateShort } from "@/lib/format";
import { Card, CardBody, Field, Input, Select, Textarea, Button, Badge, LoadingBlock, useToast } from "@/components/ui";

function blankPkg(industrySlug: string): PackageInput {
  return { name: "", industrySlug, summary: "", description: "", pricingMode: "DYNAMIC", fixedPrice: null, discountPct: 10, accreditation: "", sampleFlow: "PER_TEST", testIds: [] };
}
type Tab = "overview" | "config" | "sequence" | "routing";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" }, { key: "config", label: "Configuration" },
  { key: "sequence", label: "Tests & sequence" }, { key: "routing", label: "Routing & price" },
];

export default function PlatformPackageDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(isNew ? "config" : "overview");

  const catQ = useQuery({ queryKey: ["admin-catalog"], queryFn: fetchAdminCatalog });
  const fullQ = useQuery({ queryKey: ["package-full", id], queryFn: () => fetchPackageFull(id!), enabled: !isNew && !!id });
  const insQ = useQuery({ queryKey: ["package-insights", id], queryFn: () => fetchPackageInsights(id!), enabled: !isNew && !!id });

  const [form, setForm] = useState<PackageInput | null>(null);
  const [fixedPrice, setFixedPrice] = useState("");
  const [discountPct, setDiscountPct] = useState("10");

  useEffect(() => { if (isNew && catQ.data && !form) setForm(blankPkg(catQ.data.industries[0]?.slug ?? "")); }, [isNew, catQ.data, form]);
  useEffect(() => {
    if (!isNew && fullQ.data) {
      const p = fullQ.data;
      setForm({
        name: p.name, industrySlug: p.industrySlug ?? "", summary: p.summary ?? "", description: p.description ?? "",
        pricingMode: (p.pricingMode as "DYNAMIC" | "FIXED") ?? "DYNAMIC", fixedPrice: p.fixedPrice, discountPct: p.discountPct,
        accreditation: p.accreditation ?? "", sampleFlow: p.sampleFlow, isActive: p.isActive, testIds: p.testIds,
      });
      setFixedPrice(p.fixedPrice != null ? String(p.fixedPrice) : "");
      setDiscountPct(String(p.discountPct ?? 10));
    }
  }, [isNew, fullQ.data]);

  const cat = catQ.data;
  const ins = insQ.data;
  const industry = useMemo(() => cat?.industries.find((i) => i.slug === form?.industrySlug), [cat, form?.industrySlug]);
  const availableTests = industry?.tests ?? [];
  const testName = (tid: string) => availableTests.find((t) => t.id === tid)?.name ?? fullQ.data?.items.find((i) => i.testId === tid)?.test.name ?? "Test";

  const save = useMutation({
    mutationFn: () => {
      const body: PackageInput = {
        ...form!,
        fixedPrice: form!.pricingMode === "FIXED" ? Number(fixedPrice) || 0 : null,
        discountPct: Number(discountPct) || 0,
        accreditation: form!.accreditation || null,
      };
      return isNew ? createPackage(body) : updatePackage(id!, body);
    },
    onSuccess: (res: any) => {
      toast.push("success", isNew ? "Package created." : "Package saved.");
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
      qc.invalidateQueries({ queryKey: ["package-full", id] });
      qc.invalidateQueries({ queryKey: ["package-insights", id] });
      if (isNew && res?.id) nav(`/platform/catalog/packages/${res.id}`, { replace: true });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save package."),
  });

  if (!cat || !form) return <div className="mx-auto max-w-6xl px-4 py-8"><LoadingBlock /></div>;
  const set = (patch: Partial<PackageInput>) => setForm((f) => ({ ...f!, ...patch }));
  const toggleTest = (tid: string) => set({ testIds: form.testIds.includes(tid) ? form.testIds.filter((x) => x !== tid) : [...form.testIds, tid] });
  const moveTest = (i: number, dir: -1 | 1) => {
    const arr = [...form.testIds]; const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; set({ testIds: arr });
  };
  const industryTitle = industry?.title ?? form.industrySlug;
  const covered = ins ? ins.items.filter((it) => it.recommended).length : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/platform/catalog" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to catalog</Link>

      <Card className="overflow-hidden">
        <div className="relative h-36 sm:h-44">
          <img src={imageForCategory(availableTests[0]?.category || "testing", 1200)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-ink">{industryTitle}</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur">{form.pricingMode === "FIXED" ? "Fixed price" : `Dynamic · ${form.discountPct ?? discountPct}% off`}</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur">{form.sampleFlow === "SHARED" ? "Shared specimen" : "Per-test samples"}</span>
            </div>
            <h1 className="mt-1.5 flex items-center gap-2 text-2xl font-bold tracking-tight text-white"><Package className="h-6 w-6" /> {isNew ? "New package" : form.name || "Package"}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-surface-border p-4">
          <Metric icon={<Layers className="h-4 w-4" />} label="Tests" value={String(form.testIds.length)} />
          <Metric icon={<Wallet className="h-4 w-4" />} label="Bundle price" value={ins ? money(ins.bundlePrice, ins.currency) : "—"} />
          <Metric icon={<TrendingDown className="h-4 w-4" />} label="Savings" value={ins && ins.savings > 0 ? money(ins.savings, ins.currency) : "—"} />
          <Metric icon={<Clock className="h-4 w-4" />} label="Est. completion" value={ins?.estimatedCompletion ? dateShort(ins.estimatedCompletion) : "—"} />
          <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Routable" value={ins ? `${covered}/${ins.items.length}` : "—"} />
          <div className="ml-auto"><Button loading={save.isPending} disabled={!form.name || form.testIds.length === 0} onClick={() => save.mutate()}>{isNew ? "Create package" : "Save changes"}</Button></div>
        </div>
      </Card>

      <div className="mt-6 border-b border-surface-border">
        <div className="-mb-px flex flex-wrap gap-1">
          {TABS.filter((t) => !(isNew && t.key !== "config")).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={clsx("border-b-2 px-4 py-2.5 text-sm font-semibold transition", tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink")}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card><CardBody className="space-y-3">
              <Section icon={<Package className="h-4 w-4" />} title="About this package" />
              {form.summary && <p className="text-ink-soft">{form.summary}</p>}
              {form.description ? <p className="whitespace-pre-line text-sm text-ink-soft">{form.description}</p> : <p className="text-sm text-ink-faint">No description.</p>}
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <Fact label="Pricing" value={form.pricingMode === "FIXED" ? `Fixed ${money(Number(fixedPrice) || 0)}` : `Dynamic, ${discountPct}% bundle discount`} />
                <Fact label="Sample flow" value={form.sampleFlow === "SHARED" ? "One specimen flows through tests in sequence" : "Each test needs its own sample"} />
                <Fact label="Accreditation" value={form.accreditation || "—"} />
                <Fact label="Tests" value={`${form.testIds.length} included`} />
              </div>
            </CardBody></Card>
            <Card><CardBody className="space-y-1">
              <Section icon={<Wallet className="h-4 w-4" />} title="Live quote" />
              {ins ? (
                <>
                  <div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-ink">{money(ins.bundlePrice, ins.currency)}</span>{ins.savings > 0 && <span className="text-sm font-medium text-brand-700">save {money(ins.savings, ins.currency)}</span>}</div>
                  <p className="text-sm text-ink-muted">{covered}/{ins.items.length} tests routable to a lab</p>
                  <button onClick={() => setTab("routing")} className="mt-1 text-sm font-semibold text-brand-700 hover:underline">See routing →</button>
                </>
              ) : <p className="text-sm text-ink-muted">Save the package to see the live quote.</p>}
            </CardBody></Card>
          </div>
        )}

        {tab === "config" && (
          <div className="space-y-6">
            <Card><CardBody className="space-y-4">
              <Section icon={<ListOrdered className="h-4 w-4" />} title="Package details" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Package name"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. EV Battery Safety Package" /></Field>
                <Field label="Industry"><Select value={form.industrySlug} onChange={(e) => set({ industrySlug: e.target.value, testIds: [] })}>{cat.industries.map((i) => <option key={i.slug} value={i.slug}>{i.title}</option>)}</Select></Field>
              </div>
              <Field label="Summary"><Input value={form.summary ?? ""} onChange={(e) => set({ summary: e.target.value })} placeholder="One-line summary" /></Field>
              <Field label="Description"><Textarea rows={2} value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Pricing mode"><Select value={form.pricingMode} onChange={(e) => set({ pricingMode: e.target.value as "DYNAMIC" | "FIXED" })}><option value="DYNAMIC">Dynamic (sum of providers)</option><option value="FIXED">Fixed (flat price)</option></Select></Field>
                {form.pricingMode === "DYNAMIC"
                  ? <Field label="Bundle discount (%)"><Input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></Field>
                  : <Field label="Fixed price (₹)"><Input type="number" min={0} value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value)} /></Field>}
                <Field label="Accreditation"><Input value={form.accreditation ?? ""} onChange={(e) => set({ accreditation: e.target.value })} placeholder="NABL" /></Field>
              </div>
              <Field label="Sample flow"><Select value={form.sampleFlow} onChange={(e) => set({ sampleFlow: e.target.value as "SHARED" | "PER_TEST" })}><option value="PER_TEST">Per test — each needs its own sample (parallel)</option><option value="SHARED">Shared specimen — flows through tests in order (sequential)</option></Select></Field>
            </CardBody></Card>

            <Card><CardBody className="space-y-3">
              <Section icon={<Layers className="h-4 w-4" />} title={`Included tests (${form.testIds.length})`} />
              {form.sampleFlow === "SHARED" && <p className="text-xs text-ink-muted">Order below is the sequence; each test waits for the previous one to deliver. Reorder in the "Tests & sequence" tab.</p>}
              <div className="max-h-72 overflow-auto rounded-lg border border-surface-border">
                {availableTests.length === 0 ? <p className="p-4 text-sm text-ink-muted">No tests in this industry.</p> : availableTests.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-3 border-b border-surface-border px-3 py-2 last:border-0 hover:bg-surface-muted">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.testIds.includes(t.id)} onChange={() => toggleTest(t.id)} />
                    <span className="flex-1 text-sm text-ink">{t.name}</span>
                    <Badge tone="gray">{t.category}</Badge>
                  </label>
                ))}
              </div>
            </CardBody></Card>
          </div>
        )}

        {tab === "sequence" && (
          <Card><CardBody className="space-y-3">
            <Section icon={<ListOrdered className="h-4 w-4" />} title="Test sequence & prerequisites" />
            <p className="text-sm text-ink-muted">{form.sampleFlow === "SHARED" ? "Shared specimen: tests run top-to-bottom; each waits for the previous to deliver." : "Per-test samples: tests can run in parallel. Order is informational."}</p>
            {form.testIds.length === 0 ? <p className="text-sm text-ink-faint">No tests added yet.</p> : (
              <ol className="space-y-2">
                {form.testIds.map((tid, i) => (
                  <li key={tid} className="flex items-center gap-3 rounded-lg border border-surface-border p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/platform/catalog/tests/${tid}`} className="font-medium text-brand-700 hover:underline">{testName(tid)}</Link>
                      {form.sampleFlow === "SHARED" && i > 0 && <p className="text-xs text-ink-muted">Waits for: {testName(form.testIds[i - 1])}</p>}
                    </div>
                    <div className="flex flex-col">
                      <button onClick={() => moveTest(i, -1)} disabled={i === 0} className="rounded p-0.5 text-ink-faint hover:text-brand-600 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button onClick={() => moveTest(i, 1)} disabled={i === form.testIds.length - 1} className="rounded p-0.5 text-ink-faint hover:text-brand-600 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-ink-faint">Reordering changes the sequence — click Save changes to apply.</p>
          </CardBody></Card>
        )}

        {tab === "routing" && (
          <Card><CardBody className="space-y-3">
            <Section icon={<Route className="h-4 w-4" />} title="Live routing & price (Balanced)" />
            {!ins ? <p className="text-sm text-ink-muted">Save the package to compute routing.</p> : (
              <>
                <div className="table-wrap"><table className="w-full text-sm">
                  <thead><tr><th className="th">Test</th><th className="th">Recommended lab</th><th className="th">Price</th><th className="th">Turnaround</th><th className="th">Labs</th></tr></thead>
                  <tbody>
                    {ins.items.map((it) => (
                      <tr key={it.testId}>
                        <td className="td"><Link to={`/platform/catalog/tests/${it.testId}`} className="font-medium text-brand-700 hover:underline">{it.testName}</Link></td>
                        <td className="td">{it.recommended ? <Link to={`/platform/providers/${it.recommended.institutionId}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Building2 className="h-3.5 w-3.5" />{it.recommended.institutionName}{it.recommended.accredited && <ShieldCheck className="h-3 w-3 text-brand-600" />}</Link> : <Badge tone="warning">No lab</Badge>}</td>
                        <td className="td whitespace-nowrap">{it.recommended ? money(it.recommended.price, ins.currency) : "—"}</td>
                        <td className="td whitespace-nowrap">{it.recommended ? `${it.recommended.turnaroundDays} d` : "—"}</td>
                        <td className="td">{it.providerCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                <div className="flex flex-wrap justify-end gap-6 border-t border-surface-border pt-3 text-sm">
                  <span className="text-ink-muted">Sum of tests: <span className="font-medium text-ink">{money(ins.gross, ins.currency)}</span></span>
                  {ins.pricingMode === "DYNAMIC" && <span className="text-ink-muted">Discount: <span className="font-medium text-ink">{ins.discountPct}%</span></span>}
                  <span className="text-ink-muted">Bundle price: <span className="font-bold text-ink">{money(ins.bundlePrice, ins.currency)}</span></span>
                </div>
              </>
            )}
          </CardBody></Card>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5"><span className="text-brand-600">{icon}</span><div className="leading-tight"><p className="text-sm font-bold text-ink">{value}</p><p className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</p></div></div>;
}
function Section({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h2 className="section-title flex items-center gap-2"><span className="text-brand-600">{icon}</span> {title}</h2>;
}
function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p><p className="text-sm text-ink-soft">{value}</p></div>;
}
