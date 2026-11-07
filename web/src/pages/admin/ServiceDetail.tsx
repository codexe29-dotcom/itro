import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowLeft, Wallet, Clock, Activity, CheckCircle2, Cpu, FlaskConical, ClipboardList,
  Users, Star, Zap, Package, Image as ImageIcon, ExternalLink, Plus, X,
} from "lucide-react";
import { fetchService, fetchServiceInsights, fetchServiceReviews, updateService } from "@/lib/queries";
import { imageForCategory } from "@/lib/imagery";
import { money, dateShort } from "@/lib/format";
import { RatingStars } from "@/components/RatingStars";
import { ImageUploader } from "@/components/ImageUploader";
import { Card, CardBody, Field, Input, Select, Textarea, Button, Badge, LoadingBlock, useToast } from "@/components/ui";

type Tab = "overview" | "pricing" | "requirements" | "demand";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" }, { key: "pricing", label: "Pricing & turnaround" },
  { key: "requirements", label: "Buyer requirements" }, { key: "demand", label: "Demand & reviews" },
];
const s = (v: number | null | undefined) => (v == null ? "" : String(v));

type IntakeType = "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX" | "FILE";
type IntakeForm = { name: string; description: string; required: boolean; type: IntakeType; options: string[] };
const INTAKE_TYPES: { value: IntakeType; label: string }[] = [
  { value: "TEXT", label: "Short text" },
  { value: "TEXTAREA", label: "Long text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Dropdown (choices)" },
  { value: "CHECKBOX", label: "Yes / no" },
  { value: "FILE", label: "File upload" },
];

export default function AdminServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");

  const svcQ = useQuery({ queryKey: ["service", id], queryFn: () => fetchService(id!), enabled: !!id });
  const insQ = useQuery({ queryKey: ["service-insights", id], queryFn: () => fetchServiceInsights(id!), enabled: !!id });
  const revQ = useQuery({ queryKey: ["reviews", id], queryFn: () => fetchServiceReviews(id!), enabled: !!id });

  const [f, setF] = useState<Record<string, string> | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [pricingMode, setPricingMode] = useState("FIXED");
  const [images, setImages] = useState<string[]>([]);
  const [req, setReq] = useState<{ samplesRequired: string; sampleRequirements: string; destructive: boolean; returned: boolean; deliverables: string[] } | null>(null);
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);

  useEffect(() => {
    const d = svcQ.data as any;
    if (d && !f) {
      setF({
        name: d.name ?? "", description: d.description ?? "",
        priceIndustry: s(d.priceIndustry), priceAcademic: s(d.priceAcademic), priceInternal: s(d.priceInternal),
        unitLabel: d.unitLabel ?? "", setupFee: s(d.setupFee), minCharge: s(d.minCharge),
        turnaroundDays: s(d.turnaroundDays), rushDays: s(d.rushDays), rushSurchargePct: s(d.rushSurchargePct),
        discountPct: s(d.discountPct), discountLabel: d.discountLabel ?? "",
      });
      setIsActive(d.isActive ?? true);
      setPricingMode(d.pricingMode ?? "FIXED");
      setImages(d.images ?? []);
      setReq({
        samplesRequired: d.samplesRequired != null ? String(d.samplesRequired) : "",
        sampleRequirements: d.sampleRequirements ?? "",
        destructive: d.sampleDestructive ?? false,
        returned: d.sampleReturned ?? false,
        deliverables: d.deliverables ?? [],
      });
      setIntakeForms((d.intakeForms ?? []).map((x: any) => ({
        name: x.name ?? "", description: x.description ?? "", required: !!x.required,
        type: (x.type as IntakeType) ?? "TEXT", options: Array.isArray(x.options) ? x.options : [],
      })));
    }
  }, [svcQ.data, f]);

  const save = useMutation({
    mutationFn: () => updateService(id!, {
      name: f!.name, description: f!.description, pricingMode, isActive, images,
      priceIndustry: Number(f!.priceIndustry) || 0, priceAcademic: Number(f!.priceAcademic) || 0, priceInternal: Number(f!.priceInternal) || 0,
      unitLabel: f!.unitLabel || null, setupFee: Number(f!.setupFee) || 0, minCharge: Number(f!.minCharge) || 0,
      turnaroundDays: Number(f!.turnaroundDays) || 1,
      rushDays: f!.rushDays ? Number(f!.rushDays) : null,
      rushSurchargePct: f!.rushSurchargePct ? Number(f!.rushSurchargePct) : null,
      discountPct: Number(f!.discountPct) || 0,
      discountLabel: f!.discountLabel.trim() || null,
      samplesRequired: req!.samplesRequired.trim() === "" ? null : Number(req!.samplesRequired),
      sampleRequirements: req!.sampleRequirements.trim() || null,
      sampleDestructive: req!.destructive,
      sampleReturned: req!.returned,
      deliverables: req!.deliverables.map((x) => x.trim()).filter(Boolean),
      intakeForms: intakeForms
        .filter((x) => x.name.trim())
        .map((x) => ({
          name: x.name.trim(),
          description: x.description,
          required: x.required,
          type: x.type,
          options: x.type === "SELECT" ? x.options.map((o) => o.trim()).filter(Boolean) : [],
        })),
    }),
    onSuccess: () => { toast.push("success", "Service saved."); qc.invalidateQueries({ queryKey: ["service", id] }); qc.invalidateQueries({ queryKey: ["admin-services"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save."),
  });

  const data = svcQ.data as any;
  const ins = insQ.data;
  const rev = revQ.data;
  const reqAgg = useMemo(() => {
    const t = ins?.fulfilledTests ?? [];
    return {
      maxSamples: t.reduce((n, x) => Math.max(n, x.samplesRequired ?? 0), 0),
      destructive: t.some((x) => x.sampleDestructive),
      returned: t.some((x) => x.sampleReturned),
      forms: Array.from(new Set(t.flatMap((x) => x.forms.filter((fm) => fm.required).map((fm) => fm.name)))),
      deliverables: Array.from(new Set(t.flatMap((x) => x.deliverables ?? []))),
    };
  }, [ins]);

  if (!data || !f || !req) return <div className="mx-auto max-w-6xl px-4 py-8"><LoadingBlock /></div>;
  const price = data.buyerPrice ?? data.priceIndustry;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/admin/services" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to testing services</Link>

      <Card className="overflow-hidden">
        <div className="relative h-36 sm:h-44">
          <img src={images[0] ?? imageForCategory(data.category || "testing", 1200)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-ink">{data.category}</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur">{pricingMode === "FIXED" ? "Fixed price" : "Quote on request"}</span>
              {!isActive && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur">Inactive</span>}
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">{data.name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-surface-border p-4">
          <Metric icon={<Wallet className="h-4 w-4" />} label="Price" value={pricingMode === "FIXED" ? money(price, data.institution?.currency) : "Quote"} />
          <Metric icon={<Clock className="h-4 w-4" />} label="Turnaround" value={`${f.turnaroundDays} d`} />
          <Metric icon={<Activity className="h-4 w-4" />} label="Active" value={String(ins?.orders.active ?? 0)} />
          <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={String(ins?.orders.completed ?? 0)} />
          <Metric icon={<Star className="h-4 w-4" />} label="Rating" value={data.rating?.count ? `${data.rating.avg.toFixed(1)} (${data.rating.count})` : "—"} />
          <div className="ml-auto"><Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button></div>
        </div>
      </Card>

      <div className="mt-6 border-b border-surface-border">
        <div className="-mb-px flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={clsx("border-b-2 px-4 py-2.5 text-sm font-semibold transition", tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink")}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card><CardBody className="space-y-3">
              <Section icon={<FlaskConical className="h-4 w-4" />} title="About this service" />
              {data.description ? <p className="whitespace-pre-line text-sm text-ink-soft">{data.description}</p> : <p className="text-sm text-ink-faint">No description.</p>}
              {data.instrument && (
                <div className="pt-1">
                  <p className="text-xs uppercase tracking-wide text-ink-faint">Equipment</p>
                  <Link to={`/instruments/${data.instrument.id}`} className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"><Cpu className="h-4 w-4" /> {data.instrument.name}</Link>
                </div>
              )}
            </CardBody></Card>
            <Card><CardBody className="space-y-2">
              <Section icon={<Package className="h-4 w-4" />} title={`Fulfils tests (${ins?.fulfilledTests.length ?? 0})`} />
              {(ins?.fulfilledTests ?? []).length === 0 ? <p className="text-sm text-ink-muted">Not enrolled in any catalog test.</p> : ins!.fulfilledTests.map((t) => (
                <Link key={t.id} to={`/tests/${t.slug}`} className="flex items-center justify-between rounded-lg border border-surface-border p-2 text-sm hover:border-brand-300"><span className="font-medium text-ink">{t.name}</span><Badge tone="gray">{t.category}</Badge></Link>
              ))}
            </CardBody></Card>
            <Card className="lg:col-span-2"><CardBody className="space-y-3">
              <Section icon={<ImageIcon className="h-4 w-4" />} title="Service photos" />
              <p className="text-sm text-ink-muted">Shown on the public service page and as the banner above. The first image is the primary photo. Click <span className="font-medium text-ink">Save changes</span> after editing.</p>
              <ImageUploader images={images} onChange={setImages} label="" hint="Upload one or more photos of the setup, samples or reports. First image is primary." />
            </CardBody></Card>
          </div>
        )}

        {tab === "pricing" && (
          <Card><CardBody className="space-y-4">
            <Section icon={<Wallet className="h-4 w-4" />} title="Pricing & turnaround" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Pricing mode"><Select value={pricingMode} onChange={(e) => setPricingMode(e.target.value)}><option value="FIXED">Fixed price</option><option value="QUOTE">Quote on request</option></Select></Field>
            </div>
            <Field label="Description"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Industry price (₹)"><Input type="number" value={f.priceIndustry} onChange={(e) => setF({ ...f, priceIndustry: e.target.value })} /></Field>
              <Field label="Academic price (₹)"><Input type="number" value={f.priceAcademic} onChange={(e) => setF({ ...f, priceAcademic: e.target.value })} /></Field>
              <Field label="Internal price (₹)"><Input type="number" value={f.priceInternal} onChange={(e) => setF({ ...f, priceInternal: e.target.value })} /></Field>
              <Field label="Unit label"><Input value={f.unitLabel} onChange={(e) => setF({ ...f, unitLabel: e.target.value })} placeholder="per sample" /></Field>
              <Field label="Setup fee (₹)"><Input type="number" value={f.setupFee} onChange={(e) => setF({ ...f, setupFee: e.target.value })} /></Field>
              <Field label="Minimum charge (₹)"><Input type="number" value={f.minCharge} onChange={(e) => setF({ ...f, minCharge: e.target.value })} /></Field>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink"><Zap className="h-4 w-4 text-orange-500" /> Service discount</p>
              <p className="mb-3 text-xs text-ink-muted">A standing sale price on this service. You bear the discount; the platform fee is recomputed on the discounted price. Set 0 for no discount.</p>
              <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                <Field label="Discount (%)"><Input type="number" min={0} max={100} value={f.discountPct} onChange={(e) => setF({ ...f, discountPct: e.target.value })} /></Field>
                <Field label="Label" hint="Optional badge shown to buyers"><Input value={f.discountLabel} onChange={(e) => setF({ ...f, discountLabel: e.target.value })} placeholder="Launch offer" /></Field>
              </div>
              {Number(f.discountPct) > 0 && Number(f.priceIndustry) > 0 && (
                <p className="mt-2 text-xs text-ink-soft">Industry price after discount: <span className="font-medium text-ink">{money(Math.round(Number(f.priceIndustry) * (1 - Number(f.discountPct) / 100)))}</span> <span className="text-ink-faint line-through">{money(Number(f.priceIndustry))}</span></p>
              )}
            </div>
            <div className="rounded-lg border border-surface-border p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Clock className="h-4 w-4 text-brand-600" /> Turnaround tiers</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Standard (days)"><Input type="number" min={1} value={f.turnaroundDays} onChange={(e) => setF({ ...f, turnaroundDays: e.target.value })} /></Field>
                <Field label="Expedited (days)" hint="Leave blank for no rush option"><Input type="number" min={1} value={f.rushDays} onChange={(e) => setF({ ...f, rushDays: e.target.value })} /></Field>
                <Field label="Expedited surcharge (%)"><Input type="number" min={0} value={f.rushSurchargePct} onChange={(e) => setF({ ...f, rushSurchargePct: e.target.value })} placeholder="e.g. 40" /></Field>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Service is active &amp; listed</label>
          </CardBody></Card>
        )}

        {tab === "requirements" && (
          <div className="space-y-6">
            <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-sm text-ink-soft">
              These prefill from the catalog test when you enrol, and are <span className="font-medium text-ink">fully editable here</span> — no need to go to the catalog. Buyers see them when adding this test to their cart. Click <span className="font-medium text-ink">Save changes</span> to apply.
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card><CardBody className="space-y-4">
                <Section icon={<ClipboardList className="h-4 w-4" />} title="What you need from the buyer" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Samples required" hint={reqAgg.maxSamples ? `Catalog: ${reqAgg.maxSamples}` : undefined}>
                    <Input type="number" min={0} value={req.samplesRequired} onChange={(e) => setReq({ ...req, samplesRequired: e.target.value })} placeholder={String(reqAgg.maxSamples || 1)} />
                  </Field>
                  <label className="flex items-center gap-2 pt-7 text-sm text-ink-soft"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={req.destructive} onChange={(e) => setReq({ ...req, destructive: e.target.checked })} /> Destructive</label>
                  <label className="flex items-center gap-2 pt-7 text-sm text-ink-soft"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={req.returned} onChange={(e) => setReq({ ...req, returned: e.target.checked })} /> Returned</label>
                </div>
                <Field label="Sample requirements / prep notes"><Textarea rows={2} value={req.sampleRequirements} onChange={(e) => setReq({ ...req, sampleRequirements: e.target.value })} placeholder="e.g. 3 coupons, 50×50×5 mm, machined finish, degreased" /></Field>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="label">Intake questions the buyer must answer</p>
                    <Button variant="secondary" className="btn-sm" onClick={() => setIntakeForms([...intakeForms, { name: "", description: "", required: false, type: "TEXT", options: [] }])}><Plus className="h-3.5 w-3.5" /> Add</Button>
                  </div>
                  {intakeForms.length === 0 ? <p className="text-sm text-ink-faint">None. Add anything you need the buyer to provide — a value, a date, a choice, or a file upload (e.g. material grade, drawing PDF).</p> : (
                    <div className="space-y-3">
                      {intakeForms.map((fm, i) => {
                        const upd = (patch: Partial<IntakeForm>) => { const a = [...intakeForms]; a[i] = { ...a[i], ...patch }; setIntakeForms(a); };
                        return (
                          <div key={i} className="rounded-lg border border-surface-border p-3">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 space-y-2">
                                <Input value={fm.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Field label (e.g. Material grade, Drawing file)" />
                                <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                                  <Input value={fm.description} onChange={(e) => upd({ description: e.target.value })} placeholder="Help text (optional)" />
                                  <Select value={fm.type} onChange={(e) => upd({ type: e.target.value as IntakeType })}>
                                    {INTAKE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                  </Select>
                                </div>
                                {fm.type === "SELECT" && (
                                  <Input value={fm.options.join(", ")} onChange={(e) => upd({ options: e.target.value.split(",").map((o) => o.replace(/^\s+/, "")) })} placeholder="Choices, comma-separated (e.g. Steel, Aluminium, Titanium)" />
                                )}
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <button onClick={() => setIntakeForms(intakeForms.filter((_, j) => j !== i))} className="rounded p-1 text-ink-faint hover:text-danger"><X className="h-4 w-4" /></button>
                                <label className="flex items-center gap-1 text-xs text-ink-muted"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={fm.required} onChange={(e) => upd({ required: e.target.checked })} /> required</label>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardBody></Card>
              <Card><CardBody className="space-y-3">
                <Section icon={<Package className="h-4 w-4" />} title="Deliverables you provide" />
                <div className="flex items-center justify-between">
                  <p className="label">Deliverables checklist</p>
                  <Button variant="secondary" className="btn-sm" onClick={() => setReq({ ...req, deliverables: [...req.deliverables, ""] })}><Plus className="h-3.5 w-3.5" /> Add</Button>
                </div>
                {reqAgg.deliverables.length > 0 && <p className="text-xs text-ink-faint">Catalog: {reqAgg.deliverables.join(", ")}</p>}
                {req.deliverables.length === 0 ? (
                  <p className="text-sm text-ink-faint">None yet. Add each deliverable on its own line (e.g. “Test report (PDF)”). Your uploads at delivery are checked against this list.</p>
                ) : (
                  <div className="space-y-2">
                    {req.deliverables.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                        <Input value={d} onChange={(e) => { const a = [...req.deliverables]; a[i] = e.target.value; setReq({ ...req, deliverables: a }); }} placeholder="e.g. Test report (PDF)" className="flex-1" />
                        <button onClick={() => setReq({ ...req, deliverables: req.deliverables.filter((_, j) => j !== i) })} className="rounded p-1 text-ink-faint hover:text-danger"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-ink-faint">Shown to buyers, and used to verify the documents you upload when delivering the order.</p>
              </CardBody></Card>
            </div>
          </div>
        )}

        {tab === "demand" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="All-time orders" value={ins?.orders.total ?? 0} icon={<Activity className="h-5 w-5" />} />
              <StatCard label="Active" value={ins?.orders.active ?? 0} icon={<Clock className="h-5 w-5" />} />
              <StatCard label="Completed" value={ins?.orders.completed ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} />
            </div>
            <Card><CardBody className="space-y-3">
              <Section icon={<Users className="h-4 w-4" />} title="Recent orders" />
              {(ins?.recentOrders ?? []).length === 0 ? <p className="text-sm text-ink-muted">No orders yet.</p> : (
                <div className="table-wrap"><table className="w-full text-sm">
                  <thead><tr><th className="th">Order</th><th className="th">Buyer</th><th className="th">Amount</th><th className="th">Status</th><th className="th">Date</th></tr></thead>
                  <tbody>{ins!.recentOrders.map((o) => (
                    <tr key={o.id}><td className="td font-medium">{o.code}</td><td className="td">{o.buyer.orgName || o.buyer.name}</td><td className="td whitespace-nowrap">{o.amount != null ? money(o.amount) : "—"}</td><td className="td"><Badge tone="gray">{o.status}</Badge></td><td className="td whitespace-nowrap text-ink-muted">{dateShort(o.createdAt)}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </CardBody></Card>
            {rev && rev.count > 0 && (
              <Card><CardBody className="space-y-3">
                <Section icon={<Star className="h-4 w-4" />} title={`Reviews (${rev.count})`} />
                <div className="flex items-center gap-3"><span className="text-3xl font-bold text-ink">{rev.avg.toFixed(1)}</span><RatingStars value={rev.avg} /></div>
                <div className="space-y-2">{rev.items.slice(0, 5).map((r) => (
                  <div key={r.id} className="rounded-lg border border-surface-border p-3"><div className="flex items-center justify-between"><span className="text-sm font-medium text-ink">{r.author}</span><RatingStars value={r.rating} size={13} /></div>{r.comment && <p className="mt-1 text-sm text-ink-soft">“{r.comment}”</p>}</div>
                ))}</div>
              </CardBody></Card>
            )}
          </div>
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
function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card><CardBody className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span><div><p className="text-2xl font-bold text-ink">{value}</p><p className="text-xs text-ink-muted">{label}</p></div></CardBody></Card>;
}
