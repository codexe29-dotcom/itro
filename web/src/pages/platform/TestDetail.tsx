import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowLeft, Plus, X, Search, Package, Building2, ExternalLink, Cpu, Clock, Wallet,
  Activity, FlaskConical, ClipboardList, BookOpen, ShieldCheck, FileText, Users, CheckCircle2,
} from "lucide-react";
import {
  fetchAdminCatalog, fetchTestFull, fetchTestInsights, createTest, updateTest, attachProvider, detachProvider,
  type TestInput,
} from "@/lib/adminCatalog";
import { imageForCategory } from "@/lib/imagery";
import { money, dateShort } from "@/lib/format";
import {
  Card, CardBody, Field, Input, Select, Textarea, Button, Badge, LoadingBlock, useToast,
} from "@/components/ui";

function blankTest(industrySlug: string): TestInput {
  return {
    name: "", industrySlug, category: "", summary: "", purpose: "", description: "",
    standardCodes: [], sampleRequirements: "", samplesRequired: 1, sampleDestructive: false,
    sampleReturned: false, deliverables: [], conformanceRows: [], fixturesRequired: [], severityNotes: "",
    turnaroundDays: 7, accreditation: "NABL",
    procedures: [{ title: "", detail: "" }], forms: [], providerServiceIds: [],
  };
}
const blankRow = () => ({ standard: "", clause: "", testNo: "", condition: "", severity: "" });

type Tab = "overview" | "config" | "labs" | "demand" | "knowledge";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "config", label: "Configuration" },
  { key: "labs", label: "Labs & equipment" },
  { key: "demand", label: "Demand" },
  { key: "knowledge", label: "Knowledge & standards" },
];

export default function PlatformTestDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(isNew ? "config" : "overview");

  const catQ = useQuery({ queryKey: ["admin-catalog"], queryFn: fetchAdminCatalog });
  const fullQ = useQuery({ queryKey: ["test-full", id], queryFn: () => fetchTestFull(id!), enabled: !isNew && !!id });
  const insQ = useQuery({ queryKey: ["test-insights", id], queryFn: () => fetchTestInsights(id!), enabled: !isNew && !!id });

  const [form, setForm] = useState<TestInput | null>(null);
  const [codesStr, setCodesStr] = useState("");
  const [delivStr, setDelivStr] = useState("");
  const [fixturesStr, setFixturesStr] = useState("");
  const [attached, setAttached] = useState<string[]>([]);
  const [provSearch, setProvSearch] = useState("");

  useEffect(() => { if (isNew && catQ.data && !form) setForm(blankTest(catQ.data.industries[0]?.slug ?? "")); }, [isNew, catQ.data, form]);
  useEffect(() => {
    if (!isNew && fullQ.data) {
      const f = fullQ.data;
      setForm({
        name: f.name, industrySlug: f.industrySlug, category: f.category,
        summary: f.summary ?? "", purpose: f.purpose ?? "", description: f.description ?? "",
        standardCodes: f.standardCodes, sampleRequirements: f.sampleRequirements ?? "",
        samplesRequired: f.samplesRequired ?? 1, sampleDestructive: f.sampleDestructive ?? false,
        sampleReturned: f.sampleReturned ?? false, deliverables: f.deliverables ?? [],
        conformanceRows: f.conformanceRows ?? [], fixturesRequired: f.fixturesRequired ?? [], severityNotes: f.severityNotes ?? "",
        turnaroundDays: f.turnaroundDays, accreditation: f.accreditation ?? "",
        procedures: f.procedures.length ? f.procedures : [{ title: "", detail: "" }],
        forms: f.forms, providerServiceIds: f.providerServiceIds,
      });
      setCodesStr(f.standardCodes.join(", "));
      setDelivStr((f.deliverables ?? []).join(", "));
      setFixturesStr((f.fixturesRequired ?? []).join(", "));
      setAttached(f.providerServiceIds);
    }
  }, [isNew, fullQ.data]);

  const cat = catQ.data;
  const ins = insQ.data;
  const categories = useMemo(() => Array.from(new Set((cat?.services ?? []).map((s) => s.category))).sort(), [cat]);
  const services = useMemo(() => {
    const t = provSearch.toLowerCase();
    return (cat?.services ?? []).filter((s) => !t || s.name.toLowerCase().includes(t) || s.institution.name.toLowerCase().includes(t) || s.category.toLowerCase().includes(t));
  }, [provSearch, cat]);

  const save = useMutation({
    mutationFn: () => {
      const body: TestInput = {
        ...form!,
        standardCodes: codesStr.split(",").map((s) => s.trim()).filter(Boolean),
        deliverables: delivStr.split(",").map((s) => s.trim()).filter(Boolean),
        fixturesRequired: fixturesStr.split(",").map((s) => s.trim()).filter(Boolean),
        conformanceRows: (form!.conformanceRows ?? []).filter((r) => r.standard.trim() || r.clause.trim() || r.testNo.trim() || r.condition.trim() || r.severity.trim()),
        procedures: (form!.procedures ?? []).filter((p) => p.title.trim()),
        forms: (form!.forms ?? []).filter((f) => f.name.trim()),
      };
      return isNew ? createTest(body) : updateTest(id!, body);
    },
    onSuccess: (res: any) => {
      toast.push("success", isNew ? "Test created." : "Test saved.");
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
      qc.invalidateQueries({ queryKey: ["test-full", id] });
      if (isNew && res?.id) nav(`/platform/catalog/tests/${res.id}`, { replace: true });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save test."),
  });
  const toggleProvider = useMutation({
    mutationFn: async ({ serviceId, on }: { serviceId: string; on: boolean }) => (on ? attachProvider(id!, serviceId) : detachProvider(id!, serviceId)),
    onSuccess: (_d, v) => { setAttached((c) => (v.on ? [...c, v.serviceId] : c.filter((x) => x !== v.serviceId))); qc.invalidateQueries({ queryKey: ["admin-catalog"] }); qc.invalidateQueries({ queryKey: ["test-insights", id] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not update lab."),
  });

  if (!cat || !form) return <div className="mx-auto max-w-6xl px-4 py-8"><LoadingBlock /></div>;
  const set = (patch: Partial<TestInput>) => setForm((f) => ({ ...f!, ...patch }));
  const industryTitle = cat.industries.find((i) => i.slug === form.industrySlug)?.title ?? form.industrySlug;
  const priceR = ins?.priceRange;
  const turnR = ins?.turnaroundRange;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/platform/catalog" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to catalog</Link>

      {/* Enterprise header with hero image */}
      <Card className="overflow-hidden">
        <div className="relative h-36 sm:h-44">
          <img src={imageForCategory(form.category || "testing", 1200)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-ink">{industryTitle}</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur">{form.category || "Uncategorised"}</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">{isNew ? "New test" : form.name || "Test"}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-surface-border p-4">
          <Metric icon={<Building2 className="h-4 w-4" />} label="Labs" value={String(ins?.providers.length ?? attached.length)} />
          <Metric icon={<Activity className="h-4 w-4" />} label="Active orders" value={String(ins?.orders.active ?? 0)} />
          <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={String(ins?.orders.completed ?? 0)} />
          <Metric icon={<Wallet className="h-4 w-4" />} label="Price" value={priceR ? (priceR.min === priceR.max ? money(priceR.min) : `${money(priceR.min)}–${money(priceR.max)}`) : "—"} />
          <Metric icon={<Clock className="h-4 w-4" />} label="Turnaround" value={turnR ? (turnR.min === turnR.max ? `${turnR.min} d` : `${turnR.min}–${turnR.max} d`) : `${form.turnaroundDays} d`} />
          <div className="ml-auto">
            <Button loading={save.isPending} disabled={!form.name || !form.category} onClick={() => save.mutate()}>{isNew ? "Create test" : "Save changes"}</Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="mt-6 border-b border-surface-border">
        <div className="-mb-px flex flex-wrap gap-1">
          {TABS.filter((t) => !(isNew && t.key !== "config")).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={clsx("border-b-2 px-4 py-2.5 text-sm font-semibold transition", tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <Card><CardBody className="space-y-4">
                <Section icon={<FlaskConical className="h-4 w-4" />} title="Purpose" />
                <p className="text-ink-soft">{form.purpose || <span className="text-ink-faint">No purpose set. Add it in Configuration.</span>}</p>
                {form.summary && <p className="text-sm text-ink-muted">{form.summary}</p>}
                {form.description && <p className="whitespace-pre-line text-sm text-ink-soft">{form.description}</p>}
              </CardBody></Card>

              <Card><CardBody className="space-y-3">
                <Section icon={<ClipboardList className="h-4 w-4" />} title="At a glance" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fact label="Standards" value={form.standardCodes.length ? form.standardCodes.join(", ") : "—"} />
                  <Fact label="Accreditation" value={form.accreditation || "—"} />
                  <Fact label="Samples required" value={`${form.samplesRequired ?? 1}${form.sampleDestructive ? " · destructive" : ""}${form.sampleReturned ? " · returned" : ""}`} />
                  <Fact label="Deliverables" value={(form.deliverables ?? []).join(", ") || "—"} />
                  <Fact label="Fixtures / prerequisites" value={(form.fixturesRequired ?? []).join(", ") || "—"} />
                  <Fact label="Conformance points" value={(form.conformanceRows ?? []).length ? `${(form.conformanceRows ?? []).length} standard clause(s)` : "—"} />
                </div>
              </CardBody></Card>
            </div>
            <div className="space-y-6">
              <Card><CardBody className="space-y-2">
                <Section icon={<Package className="h-4 w-4" />} title={`In packages (${ins?.packages.length ?? 0})`} />
                {(ins?.packages ?? []).length === 0 ? <p className="text-sm text-ink-muted">Not in any package.</p> : ins!.packages.map((p) => (
                  <Link key={p.id} to={`/platform/catalog/packages/${p.id}`} className="flex items-center justify-between rounded-lg border border-surface-border p-2 text-sm hover:border-brand-300"><span className="font-medium text-ink">{p.name}</span><ExternalLink className="h-3.5 w-3.5 text-ink-faint" /></Link>
                ))}
              </CardBody></Card>
              <Card><CardBody className="space-y-1">
                <Section icon={<Users className="h-4 w-4" />} title="Demand" />
                <div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-ink">{ins?.orders.total ?? 0}</span><span className="text-sm text-ink-muted">orders all-time</span></div>
                <p className="text-sm text-ink-muted">{ins?.orders.active ?? 0} active · {ins?.orders.completed ?? 0} completed</p>
                <button onClick={() => setTab("demand")} className="mt-1 text-sm font-semibold text-brand-700 hover:underline">View demand →</button>
              </CardBody></Card>
            </div>
          </div>
        )}

        {/* CONFIGURATION */}
        {tab === "config" && (
          <div className="space-y-6">
            <Card><CardBody className="space-y-4">
              <Section icon={<ClipboardList className="h-4 w-4" />} title="Identity" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Test name"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Vibration Testing (MIL-STD-810)" /></Field>
                <Field label="Industry"><Select value={form.industrySlug} onChange={(e) => set({ industrySlug: e.target.value })}>{cat.industries.map((i) => <option key={i.slug} value={i.slug}>{i.title}</option>)}</Select></Field>
                <Field label="Category (provider machine type)" hint="Providers of this category match this test"><Input list="cat-list" value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. UTM, SEM, CNC" /><datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
                <Field label="Turnaround (days)"><Input type="number" min={1} value={form.turnaroundDays} onChange={(e) => set({ turnaroundDays: Number(e.target.value) || 1 })} /></Field>
              </div>
              <Field label="Purpose" hint="Why this test is done / what it proves"><Textarea rows={2} value={form.purpose ?? ""} onChange={(e) => set({ purpose: e.target.value })} placeholder="e.g. Verifies tensile strength, yield and elongation to qualify a material for structural use." /></Field>
              <Field label="Summary"><Input value={form.summary ?? ""} onChange={(e) => set({ summary: e.target.value })} placeholder="One-line summary" /></Field>
              <Field label="Description"><Textarea rows={2} value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Standards (comma-separated)"><Input value={codesStr} onChange={(e) => setCodesStr(e.target.value)} placeholder="MIL-STD-810, DO-160" /></Field>
                <Field label="Accreditation"><Input value={form.accreditation ?? ""} onChange={(e) => set({ accreditation: e.target.value })} placeholder="NABL" /></Field>
              </div>
            </CardBody></Card>

            <Card><CardBody className="space-y-4">
              <Section icon={<FlaskConical className="h-4 w-4" />} title="Sample & deliverables" />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Samples required" hint="Specimens the buyer supplies"><Input type="number" min={0} value={form.samplesRequired ?? 1} onChange={(e) => set({ samplesRequired: Number(e.target.value) || 0 })} /></Field>
                <label className="flex items-center gap-2 pt-7 text-sm text-ink-soft"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.sampleDestructive ?? false} onChange={(e) => set({ sampleDestructive: e.target.checked })} /> Destructive</label>
                <label className="flex items-center gap-2 pt-7 text-sm text-ink-soft"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.sampleReturned ?? false} onChange={(e) => set({ sampleReturned: e.target.checked })} /> Returned to buyer</label>
              </div>
              <Field label="Sample requirements (spec / prep / condition)"><Textarea rows={2} value={form.sampleRequirements ?? ""} onChange={(e) => set({ sampleRequirements: e.target.value })} placeholder="e.g. 3 coupons, 50x50x5 mm, machined finish, degreased" /></Field>
              <Field label="Deliverables (comma-separated)"><Input value={delivStr} onChange={(e) => setDelivStr(e.target.value)} placeholder="Test report (PDF), Raw data, NABL certificate" /></Field>
            </CardBody></Card>

            <Card><CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <Section icon={<ShieldCheck className="h-4 w-4" />} title="Conformance & fixtures" />
                <Button variant="secondary" className="btn-sm" onClick={() => set({ conformanceRows: [...(form.conformanceRows ?? []), blankRow()] })}><Plus className="h-3.5 w-3.5" /> Row</Button>
              </div>
              <p className="text-xs text-ink-muted">Structured conformance: which standard clause / test number / condition this test establishes, and the pass-fail severity.</p>
              {(form.conformanceRows ?? []).length > 0 && (
                <div className="table-wrap">
                  <table className="w-full text-sm">
                    <thead><tr><th className="th">Standard</th><th className="th">Clause</th><th className="th">Test no.</th><th className="th">Condition</th><th className="th">Severity</th><th className="th"></th></tr></thead>
                    <tbody>
                      {(form.conformanceRows ?? []).map((r, i) => {
                        const upd = (patch: Partial<typeof r>) => { const rows = [...(form.conformanceRows ?? [])]; rows[i] = { ...rows[i], ...patch }; set({ conformanceRows: rows }); };
                        return (
                          <tr key={i}>
                            <td className="td"><Input value={r.standard} onChange={(e) => upd({ standard: e.target.value })} placeholder="MIL-STD-461" /></td>
                            <td className="td"><Input value={r.clause} onChange={(e) => upd({ clause: e.target.value })} placeholder="5.7" /></td>
                            <td className="td"><Input value={r.testNo} onChange={(e) => upd({ testNo: e.target.value })} placeholder="CE102" /></td>
                            <td className="td"><Input value={r.condition} onChange={(e) => upd({ condition: e.target.value })} placeholder="28 VDC, 10 kHz–10 MHz" /></td>
                            <td className="td"><Input value={r.severity} onChange={(e) => upd({ severity: e.target.value })} placeholder="Army / Class A" /></td>
                            <td className="td"><button onClick={() => set({ conformanceRows: (form.conformanceRows ?? []).filter((_, j) => j !== i) })} className="rounded p-1 text-ink-faint hover:text-danger"><X className="h-4 w-4" /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <Field label="Severity notes" hint="Broad details of conformance severities / limits"><Textarea rows={2} value={form.severityNotes ?? ""} onChange={(e) => set({ severityNotes: e.target.value })} placeholder="e.g. Limits per Army mobile platform; margins reported for each frequency band." /></Field>
              <Field label="Fixtures / prerequisites (comma-separated)" hint="Test jigs, pre/post-exposure rigs, conditioning needed before conduct"><Input value={fixturesStr} onChange={(e) => setFixturesStr(e.target.value)} placeholder="Vibration fixture, LISN, pre-exposure thermal soak jig" /></Field>
            </CardBody></Card>

            <Card><CardBody className="space-y-3">
              <div className="flex items-center justify-between"><Section icon={<ClipboardList className="h-4 w-4" />} title="Procedure steps" /><Button variant="secondary" className="btn-sm" onClick={() => set({ procedures: [...(form.procedures ?? []), { title: "", detail: "" }] })}><Plus className="h-3.5 w-3.5" /> Step</Button></div>
              {(form.procedures ?? []).map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 text-xs font-semibold text-ink-faint">{i + 1}</span>
                  <div className="flex-1 space-y-1">
                    <Input value={p.title} onChange={(e) => { const ps = [...form.procedures!]; ps[i] = { ...ps[i], title: e.target.value }; set({ procedures: ps }); }} placeholder="Step title" />
                    <Input value={p.detail ?? ""} onChange={(e) => { const ps = [...form.procedures!]; ps[i] = { ...ps[i], detail: e.target.value }; set({ procedures: ps }); }} placeholder="Detail (optional)" />
                  </div>
                  <button onClick={() => set({ procedures: form.procedures!.filter((_, j) => j !== i) })} className="mt-1.5 rounded p-1 text-ink-faint hover:text-danger"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </CardBody></Card>

            <Card><CardBody className="space-y-3">
              <div className="flex items-center justify-between"><Section icon={<FileText className="h-4 w-4" />} title="Intake forms" /><Button variant="secondary" className="btn-sm" onClick={() => set({ forms: [...(form.forms ?? []), { name: "", description: "", required: false }] })}><Plus className="h-3.5 w-3.5" /> Form</Button></div>
              {(form.forms ?? []).map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={f.name} onChange={(e) => { const fs = [...form.forms!]; fs[i] = { ...fs[i], name: e.target.value }; set({ forms: fs }); }} placeholder="Form name" className="flex-1" />
                  <Input value={f.description ?? ""} onChange={(e) => { const fs = [...form.forms!]; fs[i] = { ...fs[i], description: e.target.value }; set({ forms: fs }); }} placeholder="Description" className="flex-1" />
                  <label className="flex shrink-0 items-center gap-1 text-xs text-ink-muted"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!f.required} onChange={(e) => { const fs = [...form.forms!]; fs[i] = { ...fs[i], required: e.target.checked }; set({ forms: fs }); }} /> req</label>
                  <button onClick={() => set({ forms: form.forms!.filter((_, j) => j !== i) })} className="rounded p-1 text-ink-faint hover:text-danger"><X className="h-4 w-4" /></button>
                </div>
              ))}
              {(form.forms ?? []).length === 0 && <p className="text-sm text-ink-muted">No intake forms.</p>}
            </CardBody></Card>
          </div>
        )}

        {/* LABS & EQUIPMENT */}
        {tab === "labs" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card><CardBody className="space-y-3">
              <Section icon={<Building2 className="h-4 w-4" />} title={`Enrolled labs (${ins?.providers.length ?? 0})`} />
              {(ins?.providers ?? []).length === 0 ? <p className="text-sm text-ink-muted">No labs enrolled yet. Add them from the panel.</p> : (
                <div className="table-wrap">
                  <table className="w-full text-sm">
                    <thead><tr><th className="th">Lab</th><th className="th">Service</th><th className="th">Equipment</th><th className="th">Price</th><th className="th">Turnaround</th></tr></thead>
                    <tbody>
                      {ins!.providers.map((p) => (
                        <tr key={p.serviceId}>
                          <td className="td"><Link to={`/institutions/${p.institution.slug}`} className="font-medium text-brand-700 hover:underline">{p.institution.name}</Link></td>
                          <td className="td">{p.serviceName}</td>
                          <td className="td">{p.instrument ? <Link to={`/instruments/${p.instrument.id}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Cpu className="h-3.5 w-3.5" /> {p.instrument.name}</Link> : <span className="text-ink-faint">—</span>}</td>
                          <td className="td whitespace-nowrap">{p.pricingMode === "FIXED" ? money(p.price) : <Badge tone="gray">Quote</Badge>}</td>
                          <td className="td whitespace-nowrap">{p.turnaroundDays} d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody></Card>
            <Card><CardBody className="space-y-3">
              <Section icon={<Plus className="h-4 w-4" />} title="Enroll a lab" />
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><Input placeholder="Search labs / services…" value={provSearch} onChange={(e) => setProvSearch(e.target.value)} className="pl-9" /></div>
              <div className="max-h-[28rem] space-y-1.5 overflow-auto">
                {services.map((s) => { const on = attached.includes(s.id); return (
                  <div key={s.id} className={clsx("flex items-center gap-2 rounded-lg border p-2", on ? "border-brand-200 bg-brand-50/50" : "border-surface-border")}>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{s.name}</p><p className="truncate text-xs text-ink-faint">{s.institution.name} · {money(s.priceIndustry)}</p></div>
                    <Button variant={on ? "secondary" : "primary"} className="btn-sm" loading={toggleProvider.isPending && toggleProvider.variables?.serviceId === s.id} onClick={() => toggleProvider.mutate({ serviceId: s.id, on: !on })}>{on ? "Remove" : "Add"}</Button>
                  </div>
                ); })}
              </div>
            </CardBody></Card>
          </div>
        )}

        {/* DEMAND */}
        {tab === "demand" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="All-time orders" value={ins?.orders.total ?? 0} icon={<Activity className="h-5 w-5" />} />
              <StatCard label="Active" value={ins?.orders.active ?? 0} icon={<Clock className="h-5 w-5" />} />
              <StatCard label="Completed" value={ins?.orders.completed ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} />
            </div>
            <Card><CardBody className="space-y-3">
              <Section icon={<Users className="h-4 w-4" />} title="Recent orders" />
              {(ins?.recentOrders ?? []).length === 0 ? <p className="text-sm text-ink-muted">No orders yet for this test.</p> : (
                <div className="table-wrap"><table className="w-full text-sm">
                  <thead><tr><th className="th">Order</th><th className="th">Buyer</th><th className="th">Lab</th><th className="th">Service</th><th className="th">Amount</th><th className="th">Status</th><th className="th">Date</th></tr></thead>
                  <tbody>
                    {ins!.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="td font-medium">{o.code}</td>
                        <td className="td"><Link to={`/platform/buyers/${o.buyer.id}`} className="text-brand-700 hover:underline">{o.buyer.orgName || o.buyer.name}</Link></td>
                        <td className="td"><Link to={`/institutions/${o.lab.slug}`} className="text-brand-700 hover:underline">{o.lab.name}</Link></td>
                        <td className="td">{o.service}</td>
                        <td className="td whitespace-nowrap">{o.amount != null ? money(o.amount) : "—"}</td>
                        <td className="td"><Badge tone="gray">{o.status}</Badge></td>
                        <td className="td whitespace-nowrap text-ink-muted">{dateShort(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </CardBody></Card>
          </div>
        )}

        {/* KNOWLEDGE & STANDARDS */}
        {tab === "knowledge" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardBody className="space-y-3">
              <Section icon={<ShieldCheck className="h-4 w-4" />} title="Standards" />
              {form.standardCodes.length === 0 ? <p className="text-sm text-ink-muted">No standards listed.</p> : (
                <div className="flex flex-wrap gap-2">{form.standardCodes.map((s) => <a key={s} href={`https://www.google.com/search?q=${encodeURIComponent(s + " standard")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-surface-border px-3 py-1 text-sm font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700"><ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> {s} <ExternalLink className="h-3 w-3" /></a>)}</div>
              )}
            </CardBody></Card>
            <Card><CardBody className="space-y-2">
              <Section icon={<FileText className="h-4 w-4" />} title="Intake forms" />
              {(form.forms ?? []).length === 0 ? <p className="text-sm text-ink-muted">No forms.</p> : (form.forms ?? []).map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-surface-border p-2.5 text-sm">
                  <div><p className="font-medium text-ink">{f.name}</p>{f.description && <p className="text-xs text-ink-muted">{f.description}</p>}</div>
                  {f.required && <Badge tone="brand">Required</Badge>}
                </div>
              ))}
            </CardBody></Card>
            {((form.conformanceRows ?? []).length > 0 || (form.fixturesRequired ?? []).length > 0 || form.severityNotes) && (
              <Card className="lg:col-span-2"><CardBody className="space-y-3">
                <Section icon={<ShieldCheck className="h-4 w-4" />} title="Conformance & fixtures" />
                {(form.conformanceRows ?? []).length > 0 && (
                  <div className="table-wrap"><table className="w-full text-sm">
                    <thead><tr><th className="th">Standard</th><th className="th">Clause</th><th className="th">Test no.</th><th className="th">Condition</th><th className="th">Severity</th></tr></thead>
                    <tbody>
                      {(form.conformanceRows ?? []).map((r, i) => (
                        <tr key={i}><td className="td font-medium">{r.standard || "—"}</td><td className="td">{r.clause || "—"}</td><td className="td">{r.testNo || "—"}</td><td className="td">{r.condition || "—"}</td><td className="td">{r.severity || "—"}</td></tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
                {form.severityNotes && <p className="text-sm text-ink-soft"><span className="font-medium text-ink">Severity notes: </span>{form.severityNotes}</p>}
                {(form.fixturesRequired ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">{(form.fixturesRequired ?? []).map((fx) => <Badge key={fx} tone="gray">{fx}</Badge>)}</div>
                )}
              </CardBody></Card>
            )}
            <Card className="lg:col-span-2"><CardBody className="space-y-3">
              <Section icon={<BookOpen className="h-4 w-4" />} title="Procedure" />
              {(form.procedures ?? []).filter((p) => p.title.trim()).length === 0 ? <p className="text-sm text-ink-muted">No procedure steps.</p> : (
                <ol className="space-y-2">
                  {(form.procedures ?? []).filter((p) => p.title.trim()).map((p, i) => (
                    <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span><div><p className="text-sm font-medium text-ink">{p.title}</p>{p.detail && <p className="text-sm text-ink-muted">{p.detail}</p>}</div></li>
                  ))}
                </ol>
              )}
            </CardBody></Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5">
      <span className="text-brand-600">{icon}</span>
      <div className="leading-tight"><p className="text-sm font-bold text-ink">{value}</p><p className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</p></div>
    </div>
  );
}
function Section({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h2 className="section-title flex items-center gap-2"><span className="text-brand-600">{icon}</span> {title}</h2>;
}
function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p><p className="text-sm text-ink-soft">{value}</p></div>;
}
function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card><CardBody className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
      <div><p className="text-2xl font-bold text-ink">{value}</p><p className="text-xs text-ink-muted">{label}</p></div>
    </CardBody></Card>
  );
}
