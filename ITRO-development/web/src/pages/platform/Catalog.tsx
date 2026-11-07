import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Pencil, Trash2, Layers, Cpu, Search, TrendingDown, X, Cog } from "lucide-react";
import {
  fetchAdminCatalog, createPackage, updatePackage, deletePackage,
  attachProvider, detachProvider,
  fetchTestFull, createTest, updateTest, deleteTest,
  createTechnology, updateTechnology, deleteTechnology,
  type AdminCatalog, type AdminPackage, type AdminTest, type AdminTechnology, type PackageInput, type TestInput, type TechnologyInput,
} from "@/lib/adminCatalog";
import { iconFor } from "@/lib/industryIcons";
import { fetchTestRequests, approveTestRequest, rejectTestRequest } from "@/lib/providerCatalog";
import { money } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Button, Field, Input, Textarea, Select,
  Badge, Modal, LoadingBlock, ErrorState, EmptyState, useToast,
} from "@/components/ui";

// -------- Provider new-test request approval queue --------
function RequestsQueue() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: requests } = useQuery({ queryKey: ["platform-test-requests"], queryFn: () => fetchTestRequests("PENDING") });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-test-requests"] });
    qc.invalidateQueries({ queryKey: ["admin-catalog"] });
  };
  const approve = useMutation({
    mutationFn: (id: string) => approveTestRequest(id),
    onSuccess: () => { toast.push("success", "Approved - test added to the catalog."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not approve."),
  });
  const reject = useMutation({
    mutationFn: (id: string) => rejectTestRequest(id),
    onSuccess: () => { toast.push("success", "Request rejected."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not reject."),
  });

  if (!requests || requests.length === 0) return null;
  return (
    <Card className="mb-6 border-warning/40">
      <CardBody>
        <h2 className="section-title mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-brand-600" /> Provider test requests ({requests.length})</h2>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{r.name} <span className="font-normal text-ink-faint">· {r.category}</span></p>
                <p className="text-xs text-ink-faint">{r.institution?.name ?? "-"} · {r.industry?.title ?? "no industry"}{r.summary ? ` · ${r.summary}` : ""}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" className="btn-sm" loading={reject.isPending && reject.variables === r.id} onClick={() => reject.mutate(r.id)}>Reject</Button>
                <Button className="btn-sm" loading={approve.isPending && approve.variables === r.id} onClick={() => approve.mutate(r.id)}>Approve</Button>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function blankTest(industrySlug: string): TestInput {
  return {
    name: "", industrySlug, category: "", summary: "", description: "",
    standardCodes: [], sampleRequirements: "", turnaroundDays: 7, accreditation: "NABL",
    samplesRequired: 1, sampleDestructive: false, sampleReturned: false, deliverables: [],
    procedures: [{ title: "", detail: "" }], forms: [], providerServiceIds: [],
  };
}

// ---------------------------------------------------------------- Package editor
function PackageEditor({ pkg, cat, onClose }: { pkg: AdminPackage | "new"; cat: AdminCatalog; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = pkg === "new";
  const p = isNew ? null : pkg;

  const [name, setName] = useState(p?.name ?? "");
  const [industrySlug, setIndustrySlug] = useState(p?.industry?.slug ?? cat.industries[0]?.slug ?? "");
  const [summary, setSummary] = useState(p?.summary ?? "");
  const [description, setDescription] = useState(p?.description ?? "");
  const [pricingMode, setPricingMode] = useState<"DYNAMIC" | "FIXED">((p?.pricingMode as "DYNAMIC" | "FIXED") ?? "DYNAMIC");
  const [fixedPrice, setFixedPrice] = useState(p?.fixedPrice != null ? String(p.fixedPrice) : "");
  const [discountPct, setDiscountPct] = useState(String(p?.discountPct ?? 10));
  const [accreditation, setAccreditation] = useState(p?.accreditation ?? "");
  const [sampleFlow, setSampleFlow] = useState<"SHARED" | "PER_TEST">(p?.sampleFlow ?? "PER_TEST");
  const [testIds, setTestIds] = useState<string[]>(p?.testIds ?? []);

  const industry = cat.industries.find((i) => i.slug === industrySlug);
  const availableTests = industry?.tests ?? [];

  const save = useMutation({
    mutationFn: () => {
      const body: PackageInput = {
        name, industrySlug, summary, description, pricingMode,
        fixedPrice: pricingMode === "FIXED" ? Number(fixedPrice) || 0 : null,
        discountPct: Number(discountPct) || 0,
        accreditation: accreditation || null,
        sampleFlow,
        testIds,
      };
      return isNew ? createPackage(body) : updatePackage(p!.id, body);
    },
    onSuccess: () => {
      toast.push("success", isNew ? "Package created." : "Package updated.");
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
      onClose();
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save package."),
  });

  const toggleTest = (id: string) =>
    setTestIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <Modal open onClose={onClose} wide title={isNew ? "New package" : `Edit - ${p?.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} disabled={!name || testIds.length === 0} onClick={() => save.mutate()}>
            {isNew ? "Create package" : "Save changes"}
          </Button>
        </div>
      }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Package name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. EV Battery Safety Package" /></Field>
        <Field label="Industry">
          <Select value={industrySlug} onChange={(e) => { setIndustrySlug(e.target.value); setTestIds([]); }}>
            {cat.industries.map((i) => <option key={i.slug} value={i.slug}>{i.title}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Summary"><Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One-line summary" /></Field>
      <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Pricing mode">
          <Select value={pricingMode} onChange={(e) => setPricingMode(e.target.value as "DYNAMIC" | "FIXED")}>
            <option value="DYNAMIC">Dynamic (sum of providers)</option>
            <option value="FIXED">Fixed (flat price)</option>
          </Select>
        </Field>
        {pricingMode === "DYNAMIC"
          ? <Field label="Bundle discount (%)"><Input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></Field>
          : <Field label="Fixed price (₹)"><Input type="number" min={0} value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value)} /></Field>}
        <Field label="Accreditation"><Input value={accreditation} onChange={(e) => setAccreditation(e.target.value)} placeholder="NABL" /></Field>
      </div>

      <Field label="Sample flow">
        <Select value={sampleFlow} onChange={(e) => setSampleFlow(e.target.value as "SHARED" | "PER_TEST")}>
          <option value="PER_TEST">Per test - each test needs its own sample (tests run in parallel)</option>
          <option value="SHARED">Shared specimen - one sample flows through tests in order (sequential)</option>
        </Select>
      </Field>

      <div className="mt-2">
        <p className="label mb-2">Included tests <span className="text-ink-faint">({testIds.length} selected)</span></p>
        {sampleFlow === "SHARED" && (
          <p className="mb-2 text-xs text-ink-muted">Tests run in the order selected below; each waits for the previous one to deliver before the specimen is forwarded.</p>
        )}
        <div className="max-h-56 overflow-auto rounded-lg border border-surface-border">
          {availableTests.length === 0
            ? <p className="p-4 text-sm text-ink-muted">No tests in this industry.</p>
            : availableTests.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-3 border-b border-surface-border px-3 py-2 last:border-0 hover:bg-surface-muted">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={testIds.includes(t.id)} onChange={() => toggleTest(t.id)} />
                <span className="flex-1 text-sm text-ink">{t.name}</span>
                <Badge tone="gray">{t.category}</Badge>
                <span className="text-xs text-ink-faint">{t.providerCount} prov.</span>
              </label>
            ))}
        </div>
        <p className="mt-2 text-xs text-ink-faint">At order time each test is routed to its Cheapest / Fastest provider automatically based on the buyer's choice.</p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Provider (machine) manager
function ProviderManager({ test, cat, onClose }: { test: AdminTest; cat: AdminCatalog; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [attached, setAttached] = useState<string[]>(test.providerServiceIds);

  const services = useMemo(() => {
    const term = q.toLowerCase();
    return cat.services.filter((s) => !term || s.name.toLowerCase().includes(term) || s.institution.name.toLowerCase().includes(term) || s.category.toLowerCase().includes(term));
  }, [q, cat.services]);

  const toggle = useMutation({
    mutationFn: async ({ serviceId, on }: { serviceId: string; on: boolean }) =>
      on ? attachProvider(test.id, serviceId) : detachProvider(test.id, serviceId),
    onSuccess: (_d, v) => {
      setAttached((cur) => (v.on ? [...cur, v.serviceId] : cur.filter((x) => x !== v.serviceId)));
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not update provider."),
  });

  return (
    <Modal open onClose={onClose} wide title={`Providers - ${test.name}`}
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Done</Button></div>}>
      <p className="text-sm text-ink-muted">Connect the provider machines/services that fulfil this test. Their live price &amp; turnaround feed the Cheapest/Fastest routing.</p>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input placeholder="Search services / labs / category…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-surface-border">
        {services.map((s) => {
          const on = attached.includes(s.id);
          return (
            <div key={s.id} className="flex items-center gap-3 border-b border-surface-border px-3 py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                <p className="truncate text-xs text-ink-faint">{s.institution.name} · {money(s.priceIndustry)}</p>
              </div>
              <Badge tone="gray">{s.category}</Badge>
              <Button variant={on ? "secondary" : "primary"} className="btn-sm"
                loading={toggle.isPending && toggle.variables?.serviceId === s.id}
                onClick={() => toggle.mutate({ serviceId: s.id, on: !on })}>
                {on ? "Remove" : "Add"}
              </Button>
            </div>
          );
        })}
        {services.length === 0 && <p className="p-4 text-sm text-ink-muted">No matching services.</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Test editor
function TestEditor({ target, presetIndustry, cat, onClose }: { target: { id: string } | "new"; presetIndustry?: string; cat: AdminCatalog; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = target === "new";
  const fullQ = useQuery({ queryKey: ["test-full", isNew ? "new" : target.id], queryFn: () => fetchTestFull((target as { id: string }).id), enabled: !isNew });

  const [form, setForm] = useState<TestInput | null>(isNew ? blankTest(presetIndustry ?? cat.industries[0]?.slug ?? "") : null);
  const [codesStr, setCodesStr] = useState("");
  const [delivStr, setDelivStr] = useState("");
  const [provSearch, setProvSearch] = useState("");

  useEffect(() => {
    if (!isNew && fullQ.data) {
      const f = fullQ.data;
      setForm({
        name: f.name, industrySlug: f.industrySlug, category: f.category,
        summary: f.summary ?? "", description: f.description ?? "",
        standardCodes: f.standardCodes, sampleRequirements: f.sampleRequirements ?? "",
        samplesRequired: f.samplesRequired ?? 1, sampleDestructive: f.sampleDestructive ?? false,
        sampleReturned: f.sampleReturned ?? false, deliverables: f.deliverables ?? [],
        turnaroundDays: f.turnaroundDays, accreditation: f.accreditation ?? "",
        procedures: f.procedures.length ? f.procedures : [{ title: "", detail: "" }],
        forms: f.forms, providerServiceIds: f.providerServiceIds,
      });
      setCodesStr(f.standardCodes.join(", "));
      setDelivStr((f.deliverables ?? []).join(", "));
    }
  }, [fullQ.data, isNew]);

  const categories = useMemo(() => Array.from(new Set(cat.services.map((s) => s.category))).sort(), [cat.services]);
  const filteredServices = useMemo(() => {
    const t = provSearch.toLowerCase();
    return cat.services.filter((s) => !t || s.name.toLowerCase().includes(t) || s.institution.name.toLowerCase().includes(t) || s.category.toLowerCase().includes(t));
  }, [provSearch, cat.services]);

  const save = useMutation({
    mutationFn: () => {
      const body: TestInput = {
        ...form!,
        standardCodes: codesStr.split(",").map((s) => s.trim()).filter(Boolean),
        deliverables: delivStr.split(",").map((s) => s.trim()).filter(Boolean),
        procedures: (form!.procedures ?? []).filter((p) => p.title.trim()),
        forms: (form!.forms ?? []).filter((f) => f.name.trim()),
      };
      return isNew ? createTest(body) : updateTest((target as { id: string }).id, body);
    },
    onSuccess: () => {
      toast.push("success", isNew ? "Test created." : "Test updated.");
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
      onClose();
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save test."),
  });

  if (!form) return <Modal open onClose={onClose} title="Loading test…"><LoadingBlock /></Modal>;
  const set = (patch: Partial<TestInput>) => setForm((f) => ({ ...f!, ...patch }));

  return (
    <Modal open onClose={onClose} wide title={isNew ? "New test" : `Edit test - ${form.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} disabled={!form.name || !form.category} onClick={() => save.mutate()}>{isNew ? "Create test" : "Save changes"}</Button>
        </div>
      }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Test name"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Vibration Testing (MIL-STD-810)" /></Field>
        <Field label="Industry">
          <Select value={form.industrySlug} onChange={(e) => set({ industrySlug: e.target.value })}>
            {cat.industries.map((i) => <option key={i.slug} value={i.slug}>{i.title}</option>)}
          </Select>
        </Field>
        <Field label="Category (provider machine type)" hint="Providers of this category match this test">
          <Input list="cat-list" value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. UTM, SEM, CNC" />
          <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Turnaround (days)"><Input type="number" min={1} value={form.turnaroundDays} onChange={(e) => set({ turnaroundDays: Number(e.target.value) || 1 })} /></Field>
      </div>
      <Field label="Summary"><Input value={form.summary ?? ""} onChange={(e) => set({ summary: e.target.value })} placeholder="One-line summary" /></Field>
      <Field label="Description"><Textarea rows={2} value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Standards (comma-separated)"><Input value={codesStr} onChange={(e) => setCodesStr(e.target.value)} placeholder="MIL-STD-810, DO-160" /></Field>
        <Field label="Accreditation"><Input value={form.accreditation ?? ""} onChange={(e) => set({ accreditation: e.target.value })} placeholder="NABL" /></Field>
      </div>
      {/* Sample configuration — drives what the buyer must provide at order time */}
      <div className="mt-2 rounded-lg border border-surface-border p-4">
        <p className="label mb-3">Sample & deliverables</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Samples required" hint="Number of specimens the buyer must supply">
            <Input type="number" min={0} value={form.samplesRequired ?? 1} onChange={(e) => set({ samplesRequired: Number(e.target.value) || 0 })} />
          </Field>
          <label className="flex items-center gap-2 pt-7 text-sm text-ink-soft">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.sampleDestructive ?? false} onChange={(e) => set({ sampleDestructive: e.target.checked })} />
            Destructive (sample consumed)
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm text-ink-soft">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.sampleReturned ?? false} onChange={(e) => set({ sampleReturned: e.target.checked })} />
            Sample returned to buyer
          </label>
        </div>
        <Field label="Sample requirements (spec / prep / condition)"><Textarea rows={2} value={form.sampleRequirements ?? ""} onChange={(e) => set({ sampleRequirements: e.target.value })} placeholder="e.g. 3 coupons, 50x50x5 mm, machined finish, degreased" /></Field>
        <Field label="Deliverables (comma-separated)" hint="What the buyer receives"><Input value={delivStr} onChange={(e) => setDelivStr(e.target.value)} placeholder="Test report (PDF), Raw data, NABL certificate" /></Field>
      </div>

      {/* Procedures */}
      <div className="mt-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="label">Procedure steps</p>
          <Button variant="secondary" className="btn-sm" onClick={() => set({ procedures: [...(form.procedures ?? []), { title: "", detail: "" }] })}><Plus className="h-3.5 w-3.5" /> Step</Button>
        </div>
        <div className="space-y-2">
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
        </div>
      </div>

      {/* Forms */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="label">Forms</p>
          <Button variant="secondary" className="btn-sm" onClick={() => set({ forms: [...(form.forms ?? []), { name: "", description: "", required: false }] })}><Plus className="h-3.5 w-3.5" /> Form</Button>
        </div>
        <div className="space-y-2">
          {(form.forms ?? []).map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={f.name} onChange={(e) => { const fs = [...form.forms!]; fs[i] = { ...fs[i], name: e.target.value }; set({ forms: fs }); }} placeholder="Form name" className="flex-1" />
              <Input value={f.description ?? ""} onChange={(e) => { const fs = [...form.forms!]; fs[i] = { ...fs[i], description: e.target.value }; set({ forms: fs }); }} placeholder="Description" className="flex-1" />
              <label className="flex shrink-0 items-center gap-1 text-xs text-ink-muted"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!f.required} onChange={(e) => { const fs = [...form.forms!]; fs[i] = { ...fs[i], required: e.target.checked }; set({ forms: fs }); }} /> req</label>
              <button onClick={() => set({ forms: form.forms!.filter((_, j) => j !== i) })} className="rounded p-1 text-ink-faint hover:text-danger"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Providers */}
      <div className="mt-4">
        <p className="label mb-2 flex items-center gap-1.5"><Cog className="h-3.5 w-3.5" /> Connected providers ({(form.providerServiceIds ?? []).length})</p>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><Input placeholder="Search services / labs…" value={provSearch} onChange={(e) => setProvSearch(e.target.value)} className="pl-9" /></div>
        <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-surface-border">
          {filteredServices.map((s) => {
            const on = (form.providerServiceIds ?? []).includes(s.id);
            return (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 border-b border-surface-border px-3 py-2 last:border-0 hover:bg-surface-muted">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={on}
                  onChange={() => set({ providerServiceIds: on ? form.providerServiceIds!.filter((x) => x !== s.id) : [...(form.providerServiceIds ?? []), s.id] })} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm text-ink">{s.name}</span><span className="text-xs text-ink-faint">{s.institution.name} · {money(s.priceIndustry)}</span></span>
                <Badge tone="gray">{s.category}</Badge>
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Technology editor
const TECH_ICONS = ["Cog", "Boxes", "Microscope", "FlaskConical", "Gauge", "Waves", "Cpu", "Zap", "Factory", "Bot"];

function TechnologyEditor({ tech, cat, onClose }: { tech: AdminTechnology | "new"; cat: AdminCatalog; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = tech === "new";
  const t = isNew ? null : tech;
  const [title, setTitle] = useState(t?.title ?? "");
  const [icon, setIcon] = useState(t?.icon ?? "Cog");
  const [blurb, setBlurb] = useState(t?.blurb ?? "");
  const [categories, setCategories] = useState<string[]>(t?.categories ?? []);

  const save = useMutation({
    mutationFn: () => {
      const body: TechnologyInput = { title, icon, blurb, categories };
      return isNew ? createTechnology(body) : updateTechnology(t!.id, body);
    },
    onSuccess: () => {
      toast.push("success", isNew ? "Technology created." : "Technology updated.");
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
      onClose();
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save."),
  });
  const toggle = (c: string) => setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const Preview = iconFor(icon);

  return (
    <Modal open onClose={onClose} title={isNew ? "New technology" : `Edit - ${t?.title}`}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!title || categories.length === 0} onClick={() => save.mutate()}>{isNew ? "Create" : "Save"}</Button></div>}>
      <p className="text-sm text-ink-muted">A technology is a grouping of instrument categories. Its page auto-lists the tests, instruments and facilities in those categories - no separate tests to create.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mechanical Testing" /></Field>
        <Field label="Icon">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Preview className="h-5 w-5" /></span>
            <Select value={icon} onChange={(e) => setIcon(e.target.value)}>{TECH_ICONS.map((k) => <option key={k} value={k}>{k}</option>)}</Select>
          </div>
        </Field>
      </div>
      <Field label="Blurb"><Textarea rows={2} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Short description of the capability" /></Field>
      <div className="mt-1">
        <p className="label mb-2">Instrument categories <span className="text-ink-faint">({categories.length} selected)</span></p>
        <div className="flex flex-wrap gap-2">
          {cat.categoryOptions.map((c) => {
            const on = categories.includes(c);
            return (
              <button key={c} onClick={() => toggle(c)} className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-border text-ink-soft hover:border-brand-300"}`}>{c}</button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Page
export default function Catalog() {
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: cat, isLoading, isError, error } = useQuery({ queryKey: ["admin-catalog"], queryFn: fetchAdminCatalog });
  const [providerTest, setProviderTest] = useState<AdminTest | null>(null);
  const [industryFilter, setIndustryFilter] = useState<string>("");

  const del = useMutation({
    mutationFn: (id: string) => deletePackage(id),
    onSuccess: () => { toast.push("success", "Package deleted."); qc.invalidateQueries({ queryKey: ["admin-catalog"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete."),
  });

  const delTest = useMutation({
    mutationFn: (id: string) => deleteTest(id),
    onSuccess: () => { toast.push("success", "Test deleted."); qc.invalidateQueries({ queryKey: ["admin-catalog"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete test."),
  });

  const [editingTech, setEditingTech] = useState<AdminTechnology | "new" | null>(null);
  const delTech = useMutation({
    mutationFn: (id: string) => deleteTechnology(id),
    onSuccess: () => { toast.push("success", "Technology deleted."); qc.invalidateQueries({ queryKey: ["admin-catalog"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete technology."),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError) return <ErrorState error={error} />;
  if (!cat) return null;

  const shownIndustries = industryFilter ? cat.industries.filter((i) => i.slug === industryFilter) : cat.industries;

  return (
    <div>
      <PageHeader
        title="Test catalog"
        subtitle="Configure certification packages, their tests, and the provider machines connected to each test. Buyers pick Cheapest/Fastest and the system routes each test to a provider."
        actions={<Button onClick={() => nav("/platform/catalog/packages/new")}><Plus className="h-4 w-4" /> New package</Button>}
      />

      <RequestsQueue />

      {/* Packages */}
      <Card>
        <CardBody>
          <h2 className="section-title mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-brand-600" /> Packages ({cat.packages.length})</h2>
          {cat.packages.length === 0 ? (
            <EmptyState title="No packages yet" description="Create a certification package that bundles related tests." action={<Button onClick={() => nav("/platform/catalog/packages/new")}><Plus className="h-4 w-4" /> New package</Button>} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cat.packages.map((p) => (
                <div key={p.id} className="rounded-lg border border-surface-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button onClick={() => nav(`/platform/catalog/packages/${p.id}`)} className="text-left font-semibold text-ink hover:text-brand-700">{p.name}</button>
                      <p className="text-xs text-ink-faint">{p.industry?.title ?? "-"}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => nav(`/platform/catalog/packages/${p.id}`)} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`Delete package "${p.name}"?`)) del.mutate(p.id); }} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge tone="gray"><Layers className="mr-1 inline h-3 w-3" />{p.tests.length} tests</Badge>
                    {p.pricingMode === "FIXED"
                      ? <Badge tone="brand">Fixed {money(p.fixedPrice ?? 0)}</Badge>
                      : <Badge tone="brand"><TrendingDown className="mr-1 inline h-3 w-3" />{p.discountPct}% off</Badge>}
                    {p.accreditation && <Badge tone="gray">{p.accreditation}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Technologies */}
      <Card className="mt-6">
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2"><Cog className="h-4 w-4 text-brand-600" /> Technologies ({cat.technologies.length})</h2>
            <Button className="btn-sm" onClick={() => setEditingTech("new")}><Plus className="h-3.5 w-3.5" /> New technology</Button>
          </div>
          <p className="mb-3 text-xs text-ink-faint">Capability groupings of instrument categories - pages auto-list matching tests, instruments &amp; facilities.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cat.technologies.map((tech) => {
              const TIcon = iconFor(tech.icon);
              return (
                <div key={tech.id} className="rounded-lg border border-surface-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><TIcon className="h-5 w-5" /></span>
                      <div><p className="font-semibold text-ink">{tech.title}</p><p className="text-xs text-ink-faint line-clamp-1">{tech.blurb}</p></div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingTech(tech)} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`Delete technology "${tech.title}"?`)) delTech.mutate(tech.id); }} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tech.categories.map((c) => <Badge key={c} tone="gray">{c}</Badge>)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Tests & providers */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2"><Cpu className="h-4 w-4 text-brand-600" /> Tests &amp; connected providers</h2>
          <Select className="w-56" value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}>
            <option value="">All industries</option>
            {cat.industries.map((i) => <option key={i.slug} value={i.slug}>{i.title}</option>)}
          </Select>
        </div>
        <div className="space-y-4">
          {shownIndustries.map((ind) => (
            <Card key={ind.slug}>
              <CardBody>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{ind.title} <span className="text-xs font-normal text-ink-faint">· {ind.tests.length} tests</span></p>
                  <Button variant="secondary" className="btn-sm" onClick={() => nav("/platform/catalog/tests/new")}><Plus className="h-3.5 w-3.5" /> Test</Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ind.tests.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2">
                      <button onClick={() => nav(`/platform/catalog/tests/${t.id}`)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium text-ink hover:text-brand-700">{t.name}</span>
                        <span className="text-xs text-ink-faint">{t.category} · {t.providerCount} prov.</span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button onClick={() => setProviderTest(t)} title="Providers" className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-brand-600"><Cog className="h-4 w-4" /></button>
                        <button onClick={() => nav(`/platform/catalog/tests/${t.id}`)} title="Edit test" className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { if (confirm(`Delete test "${t.name}"?`)) delTest.mutate(t.id); }} title="Delete test" className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {providerTest && <ProviderManager test={providerTest} cat={cat} onClose={() => setProviderTest(null)} />}
      {editingTech && <TechnologyEditor tech={editingTech} cat={cat} onClose={() => setEditingTech(null)} />}
    </div>
  );
}
