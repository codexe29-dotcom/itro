import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, Pencil, Trash2, TrendingDown, Layers } from "lucide-react";
import { fetchBundles, createBundle, updateBundle, deleteBundle, type Bundle, type BundleInput } from "@/lib/bundles";
import { fetchServices } from "@/lib/queries";
import type { Service } from "@/lib/types";
import { money } from "@/lib/format";
import { INDUSTRIES } from "@/lib/taxonomy";
import { ImageUploader } from "@/components/ImageUploader";
import {
  PageHeader, Card, CardBody, Button, Field, Input, Select, Badge, Modal,
  LoadingBlock, EmptyState, useToast,
} from "@/components/ui";

function BundleEditor({ initial, services, onClose }: { initial: Bundle | "new"; services: Service[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = initial === "new";
  const b = isNew ? null : initial;
  const [name, setName] = useState(b?.name ?? "");
  const [description, setDescription] = useState(b?.description ?? "");
  const [industrySlug, setIndustrySlug] = useState(b?.industry?.slug ?? "");
  const [discountPct, setDiscountPct] = useState(String(b?.discountPct ?? 10));
  const [serviceIds, setServiceIds] = useState<string[]>(b?.items.map((i) => i.serviceId) ?? []);
  const [images, setImages] = useState<string[]>(b?.images ?? []);

  const fixed = services.filter((s) => (s.pricingMode ?? "QUOTE") === "FIXED");
  const toggle = (id: string) => setServiceIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const gross = fixed.filter((s) => serviceIds.includes(s.id)).reduce((sum, s) => sum + (s.priceIndustry ?? 0), 0);
  const bundled = Math.round(gross * (1 - (Number(discountPct) || 0) / 100));

  const save = useMutation({
    mutationFn: () => {
      const body: BundleInput = { name, description: description || null, industrySlug: industrySlug || null, discountPct: Number(discountPct) || 0, serviceIds, images };
      return isNew ? createBundle(body) : updateBundle(b!.id, body);
    },
    onSuccess: () => { toast.push("success", isNew ? "Bundle created." : "Bundle saved."); qc.invalidateQueries({ queryKey: ["bundles"] }); onClose(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save bundle."),
  });

  return (
    <Modal open onClose={onClose} wide title={isNew ? "New bundle" : `Edit — ${b?.name}`}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!name || serviceIds.length < 2} onClick={() => save.mutate()}>{isNew ? "Create bundle" : "Save"}</Button></div>}>
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field label="Bundle name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="EMI/EMC compliance pack" /></Field>
        <Field label="Bundle discount (%)" hint="Off the combined price"><Input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Industry / domain" hint="Where buyers browse it on the exchange">
          <Select value={industrySlug} onChange={(e) => setIndustrySlug(e.target.value)}>
            <option value="">— Select industry —</option>
            {INDUSTRIES.map((i) => <option key={i.slug} value={i.slug}>{i.title}</option>)}
          </Select>
        </Field>
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this bundle covers" /></Field>
      </div>

      <div className="mt-2">
        <ImageUploader images={images} onChange={setImages} label="Bundle image"
          hint="Optional. Shown on the bundle card and detail page. The first image is used as the cover." />
      </div>

      <div className="mt-2">
        <p className="label mb-2">Your services in this bundle <span className="text-ink-faint">({serviceIds.length} selected · pick 2+)</span></p>
        <div className="max-h-64 overflow-auto rounded-lg border border-surface-border">
          {fixed.length === 0 ? <p className="p-4 text-sm text-ink-muted">You have no fixed-price services to bundle. Only fixed-price services can be bundled.</p> : fixed.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-3 border-b border-surface-border px-3 py-2 last:border-0 hover:bg-surface-muted">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={serviceIds.includes(s.id)} onChange={() => toggle(s.id)} />
              <span className="flex-1 text-sm text-ink">{s.name}</span>
              <Badge tone="gray">{s.category}</Badge>
              <span className="text-xs text-ink-faint">{money(s.priceIndustry ?? 0)}</span>
            </label>
          ))}
        </div>
      </div>

      {serviceIds.length >= 2 && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50/60 px-3 py-2 text-sm">
          <span className="text-ink-muted">Combined <span className="text-ink-faint line-through">{money(gross)}</span> → bundle price</span>
          <span className="font-semibold text-ink">{money(bundled)} <span className="text-xs font-normal text-success">save {money(gross - bundled)}</span></span>
        </div>
      )}
    </Modal>
  );
}

export default function AdminBundles() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: bundles, isLoading } = useQuery({ queryKey: ["bundles"], queryFn: fetchBundles });
  const { data: services } = useQuery({ queryKey: ["services"], queryFn: () => fetchServices() });
  const [editing, setEditing] = useState<Bundle | "new" | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteBundle(id),
    onSuccess: () => { toast.push("success", "Bundle deleted."); qc.invalidateQueries({ queryKey: ["bundles"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete."),
  });
  const toggle = useMutation({
    mutationFn: (b: Bundle) => updateBundle(b.id, { isActive: !b.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bundles"] }),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="Bundles" subtitle="Bundle your own services at a combined discount. Buyers add the whole bundle to their cart in one click."
        actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New bundle</Button>} />

      {(bundles ?? []).length === 0 ? (
        <Card><CardBody><EmptyState icon={<Boxes className="h-6 w-6" />} title="No bundles yet" description="Group 2+ of your fixed-price services and offer a discount." action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New bundle</Button>} /></CardBody></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles!.map((b) => (
            <Card key={b.id}>
              {b.images?.[0] && (
                <div className="aspect-[16/9] overflow-hidden rounded-t-xl bg-surface-muted">
                  <img src={b.images[0]} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <CardBody>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{b.name}</p>
                    <p className="text-xs text-ink-faint">{b.items.length} services</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(b)} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => { if (confirm(`Delete bundle "${b.name}"?`)) del.mutate(b.id); }} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {b.description && <p className="mt-1 text-sm text-ink-muted line-clamp-2">{b.description}</p>}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-ink">{money(b.quote.bundlePrice)}</span>
                  {b.quote.savings > 0 && <span className="text-xs text-ink-faint line-through">{money(b.quote.gross)}</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand"><TrendingDown className="mr-1 inline h-3 w-3" />{b.discountPct}% off</Badge>
                  {b.quote.savings > 0 && <Badge tone="success">save {money(b.quote.savings)}</Badge>}
                  <button onClick={() => toggle.mutate(b)}><Badge tone={b.isActive ? "success" : "gray"}>{b.isActive ? "Live" : "Off"}</Badge></button>
                </div>
                <div className="mt-3 space-y-1 border-t border-surface-border pt-2">
                  {b.items.slice(0, 5).map((it) => (
                    <p key={it.serviceId} className="flex items-center gap-1.5 text-xs text-ink-muted"><Layers className="h-3 w-3 text-ink-faint" /> {it.service.name}</p>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {editing && <BundleEditor initial={editing} services={services ?? []} onClose={() => setEditing(null)} />}
      <p className="mt-4 text-xs text-ink-faint">Bundle discounts are provider-funded — the platform fee is recomputed on the discounted price.</p>
    </div>
  );
}
